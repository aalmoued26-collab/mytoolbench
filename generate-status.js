/* POST /api/generate-status  — polled by the page until the video is ready.
   body: { model, requestId }
   Returns { status: 'processing' | 'done' | 'failed', videoUrl? }
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    if (!b.model || !b.requestId) return P.json(400, { error: 'model and requestId are required' });
    const r = await P.falStatus(b.model, b.requestId);
    if (r.status === 'done') return P.json(200, { status: 'done', videoUrl: P.pickVideo(r.data) });
    return P.json(200, { status: r.status });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
