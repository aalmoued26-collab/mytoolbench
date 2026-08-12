/* POST /api/character
   body: { imageDataUrl, view?, outfit?, action?, expression?, scene?, aspect? }
   -> one photorealistic, identity-matched shot of the SAME person from the
      uploaded photo, in the requested view/outfit/action. The page calls this
      several times to build a full set (turnaround + variations).
      Returns { imageUrl }.
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    if (!b.imageDataUrl) return P.json(400, { error: 'imageDataUrl (the uploaded photo) is required' });

    const view = b.view || 'head-and-shoulders portrait, facing the camera';
    const expression = b.expression || 'natural, warm';
    const outfit = b.outfit ? `Wearing ${b.outfit}.` : '';
    const action = b.action ? `The person is ${b.action}.` : '';
    const scene = b.scene ? `Setting: ${b.scene}.` : 'Setting: clean studio with soft key light.';
    const aspect = b.aspect || '1:1';

    const prompt =
      `Ultra-realistic professional photograph of the SAME person shown in the reference photo. ` +
      `Keep their face, features and identity strongly consistent. ` +
      `View: ${view}. Expression: ${expression}. ${outfit} ${action} ${scene} ` +
      `Full-frame camera look, 50mm lens, natural cinematic lighting, richly detailed environment and props, ` +
      `realistic skin texture and fabric detail, shallow depth of field, sharp focus, high resolution, ` +
      `strong identity match. Photorealistic, not illustrated. No text, no watermark.`;

    const data = await P.runFal(P.MODELS.character, {
      prompt,
      image_url: b.imageDataUrl,        // kontext-style
      image_urls: [b.imageDataUrl],     // nano-banana / seedream edit
      aspect_ratio: aspect,
      num_images: 1,
    });

    return P.json(200, { imageUrl: P.pickImage(data) });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
