/* POST /api/post-image  — generate a hero/food image for a marketing post.
   body: { prompt, refDataUrl? }
   If refDataUrl (a product/food photo) is given, it's restyled faithfully;
   otherwise a new image is generated from the prompt. Returns { dataUrl }
   (base64) so the browser can compose + export the post without CORS taint.
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    const prompt =
      (b.prompt || 'appetizing traditional food') +
      '. Professional food photography, styled on a rustic table, warm cinematic lighting, ' +
      'shallow depth of field, high detail, photorealistic. No text, no watermark, no logo.';

    let data;
    if (b.refDataUrl) {
      data = await P.runFal(P.MODELS.packEdit, {
        prompt: 'Restyle this into a professional food photograph, keep the dish faithful. ' + prompt,
        image_url: b.refDataUrl, image_urls: [b.refDataUrl], num_images: 1,
      });
    } else {
      data = await P.runFal(P.MODELS.image, { prompt, image_size: 'square_hd', num_images: 1 });
    }

    const url = P.pickImage(data);
    const r = await fetch(url);
    if (!r.ok) throw new Error('fetch image ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get('content-type') || 'image/jpeg';
    return P.json(200, { dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
