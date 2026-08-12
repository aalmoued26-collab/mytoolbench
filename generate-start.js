/* POST /api/generate-start  — begins a character video job, returns fast.
   body: {
     mode: 'talking' | 'action',
     characterImageUrl,                       // a saved character shot or uploaded image
     // talking:
     voiceId?, script?, language?, sourceAudioDataUrl?, resolution?,
     // action:
     action?, scene?
   }
   Returns { requestId, model } — the page then polls /api/generate-status.
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    if (!b.characterImageUrl) return P.json(400, { error: 'characterImageUrl is required' });
    const mode = b.mode === 'action' ? 'action' : 'talking';

    if (mode === 'talking') {
      // Build the audio in the target voice (fast enough to stay in the limit).
      let audio;
      if (b.sourceAudioDataUrl) {
        const { buffer, mime } = P.decodeDataUrl(b.sourceAudioDataUrl);
        if (!buffer || !buffer.length) return P.json(400, { error: 'could not read the recorded audio' });
        if (buffer.length > 10 * 1024 * 1024) return P.json(413, { error: 'recording too large (max 10 MB)' });
        audio = await P.speechToSpeech({ voiceId: b.voiceId, audioBuffer: buffer, mime: mime || 'audio/mpeg' });
      } else {
        if (!b.script || !b.script.trim()) return P.json(400, { error: 'Provide a script or a recording' });
        if (b.script.length > 800) return P.json(400, { error: 'script too long — keep under 800 characters' });
        audio = await P.tts({ voiceId: b.voiceId, text: b.script, language: b.language || undefined });
      }
      const audioDataUrl = P.bufferToDataUrl(audio, 'audio/mpeg');
      const requestId = await P.falSubmit(P.MODELS.talking, {
        image_url: b.characterImageUrl,
        audio_url: audioDataUrl,
        resolution: b.resolution === '720p' ? '720p' : '480p',
      });
      return P.json(200, { requestId, model: P.MODELS.talking });
    }

    // action: image -> short cinematic motion clip
    const prompt =
      (b.action ? `${b.action}. ` : '') +
      (b.scene ? `Setting: ${b.scene}. ` : '') +
      'Natural realistic motion, lifelike faces, gentle handheld camera movement, cinematic, high detail, photorealistic.';
    const requestId = await P.falSubmit(P.MODELS.video, {
      image_url: b.characterImageUrl, prompt,
      duration: b.duration === '10' ? '10' : '5',
    });
    return P.json(200, { requestId, model: P.MODELS.video });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
