/* POST /api/talking-video
   Two ways to give the character a voice, then lip-sync onto the image:
     A) sourceAudioDataUrl  -> the client RECORDED their own speech; we convert it
        to the target voice with Speech-to-Speech (keeps their delivery).
     B) script              -> type text; the target voice reads it (text-to-speech).
   body: { imageUrl, voiceId?, language?, resolution?, script?, sourceAudioDataUrl? }
   Returns { videoUrl, audioDataUrl }. The voice matches the mouth.
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    if (!b.imageUrl) return P.json(400, { error: 'imageUrl (the character image) is required' });
    const hasRecording = !!b.sourceAudioDataUrl;
    const hasScript = b.script && b.script.trim();
    if (!hasRecording && !hasScript) {
      return P.json(400, { error: 'Provide either a recorded voice (sourceAudioDataUrl) or a typed script' });
    }
    if (hasScript && !hasRecording && b.script.length > 800) {
      return P.json(400, { error: 'script is too long — keep it under 800 characters per clip' });
    }

    // 1) produce speech in the target voice
    let audio;
    if (hasRecording) {
      // Voice Changer: convert the client's recording into the chosen voice
      const { buffer, mime } = P.decodeDataUrl(b.sourceAudioDataUrl);
      if (!buffer || !buffer.length) return P.json(400, { error: 'could not read the recorded audio' });
      if (buffer.length > 10 * 1024 * 1024) return P.json(413, { error: 'recording is too large (max 10 MB)' });
      audio = await P.speechToSpeech({ voiceId: b.voiceId, audioBuffer: buffer, mime: mime || 'audio/mpeg' });
    } else {
      audio = await P.tts({ voiceId: b.voiceId, text: b.script, language: b.language || undefined });
    }
    const audioDataUrl = P.bufferToDataUrl(audio, 'audio/mpeg');

    // 2) lip-sync the audio onto the character image
    const data = await P.runFal(P.MODELS.talking, {
      image_url: b.imageUrl,
      audio_url: audioDataUrl,
      resolution: b.resolution === '720p' ? '720p' : '480p',
    });

    return P.json(200, { videoUrl: P.pickVideo(data), audioDataUrl });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
