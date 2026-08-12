/* POST /api/animate-status — polled by the page until the clip is ready.
   SELF-CONTAINED (no shared lib) for the same reason as animate.js.
   body: { model, requestId } -> { status: 'processing'|'done'|'failed', videoUrl? }
*/
'use strict';

const FAL_HOST = 'https://queue.fal.run';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(obj) };
}
function pickVideo(data) {
  return (data && data.video && data.video.url) ||
         (data && data.videos && data.videos[0] && data.videos[0].url) ||
         (data && data.output && data.output.url) ||
         (data && data.url) || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  try {
    const key = process.env.FAL_KEY;
    if (!key) return json(500, { error: 'FAL_KEY is not set in Netlify environment variables' });

    const b = JSON.parse(event.body || '{}');
    if (!b.model || !b.requestId) return json(400, { error: 'model and requestId are required' });

    const headers = { Authorization: `Key ${key}` };
    const base = `${FAL_HOST}/${b.model.split('/').slice(0, 2).join('/')}/requests/${b.requestId}`;
    const s = await fetch(`${base}/status`, { headers });
    if (!s.ok) return json(200, { status: 'processing' });
    const st = await s.json();
    if (st.status === 'COMPLETED') {
      const res = await fetch(base, { headers });
      if (!res.ok) return json(500, { error: 'fal result ' + res.status });
      const data = await res.json();
      const url = pickVideo(data);
      if (!url) return json(500, { error: 'fal: no video in result' });
      return json(200, { status: 'done', videoUrl: url });
    }
    if (st.status === 'FAILED') return json(200, { status: 'failed' });
    return json(200, { status: 'processing' });
  } catch (err) {
    return json(500, { error: String(err.message || err) });
  }
};
