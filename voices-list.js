/* GET/POST /api/voices-list — return the account's ElevenLabs voices so they
   appear in Toolbench's voice pickers. SELF-CONTAINED (no shared lib) so it
   works even if netlify/functions/lib/providers.js on the site is out of date.
   Returns { voices: [{ voiceId, name, category, preview, labels }] }.
*/
'use strict';

const EL_HOST = 'https://api.elevenlabs.io';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return json(500, { error: 'ELEVENLABS_API_KEY is not set in Netlify environment variables' });

    const r = await fetch(`${EL_HOST}/v1/voices`, { headers: { 'xi-api-key': key } });
    if (!r.ok) return json(500, { error: `ElevenLabs voices ${r.status}: ${(await r.text()).slice(0, 300)}` });
    const data = await r.json();
    const voices = (Array.isArray(data && data.voices) ? data.voices : []).map((v) => ({
      voiceId: v.voice_id,
      name: v.name || 'Voice',
      category: v.category || 'custom',
      preview: v.preview_url || '',
      labels: v.labels || {},
    }));
    return json(200, { voices });
  } catch (err) {
    return json(500, { error: String(err.message || err) });
  }
};
