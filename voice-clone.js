/* POST /api/voice-clone
   body: { audioDataUrl, name? }
   -> clones the uploaded voice sample with ElevenLabs Instant Voice Cloning.
      Returns { voiceId }. (Requires a paid ElevenLabs plan.)
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    if (!b.audioDataUrl) return P.json(400, { error: 'audioDataUrl (the uploaded voice sample) is required' });

    const { buffer, mime } = P.decodeDataUrl(b.audioDataUrl);
    if (!buffer || !buffer.length) return P.json(400, { error: 'could not read the audio sample' });
    if (buffer.length > 8 * 1024 * 1024) return P.json(413, { error: 'voice sample is too large (max 8 MB)' });

    const voiceId = await P.cloneVoice({
      name: (b.name || 'Uploaded voice').slice(0, 60),
      audioBuffer: buffer,
      mime: mime || 'audio/mpeg',
    });
    return P.json(200, { voiceId });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
