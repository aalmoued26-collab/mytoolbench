/* POST /api/animate — turn a still (the two-character keyframe, or any image)
   into a short motion clip. SELF-CONTAINED on purpose: it does NOT require the
   shared lib, so it always works even if netlify/functions/lib/providers.js on
   the deployed site is out of date. Returns { requestId, model } fast; the page
   polls /api/animate-status.
   body: { characterImageUrl, action?, scene?, duration? }
*/
'use strict';

const FAL_HOST = 'https://queue.fal.run';
const MODEL = process.env.FAL_MODEL_VIDEO || 'fal-ai/kling-video/v2.1/standard/image-to-video';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  try {
    const key = process.env.FAL_KEY;
    if (!key) return json(500, { error: 'FAL_KEY is not set in Netlify environment variables' });

    const b = JSON.parse(event.body || '{}');
    if (!b.characterImageUrl) return json(400, { error: 'characterImageUrl is required' });

    const prompt =
      (b.action ? `${b.action}. ` : '') +
      (b.scene ? `Setting: ${b.scene}. ` : '') +
      'Natural realistic motion, lifelike faces, gentle handheld camera movement, cinematic, high detail, photorealistic.';

    const submit = await fetch(`${FAL_HOST}/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: b.characterImageUrl,
        prompt,
        duration: b.duration === '10' ? '10' : '5',
      }),
    });
    if (!submit.ok) return json(500, { error: `fal submit ${submit.status}: ${(await submit.text()).slice(0, 300)}` });
    const out = await submit.json();
    if (!out.request_id) return json(500, { error: 'fal: no request_id returned' });

    return json(200, { requestId: out.request_id, model: MODEL });
  } catch (err) {
    return json(500, { error: String(err.message || err) });
  }
};
