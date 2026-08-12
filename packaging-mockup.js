/* POST /api/packaging-mockup  — one angle of a packaging mockup.
   Three ways to drive it:
     A) artworkDataUrl  -> wrap your EXISTING design onto the box.
     B) exampleBoxDataUrl and/or logoDataUrl (+ description/text) -> DESIGN a
        creative package from scratch, featuring the logo and following the
        reference box's shape.
     C) neither -> generate from colours + description only.
   body: { angle, boxStyle, finish?, style?, colors?[], productName?,
           artworkDataUrl?, exampleBoxDataUrl?, logoDataUrl?, description?, text? }
   Returns { imageUrl }. One angle per call (kept fast); the page loops angles.
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    const boxStyle = (b.boxStyle || 'straight tuck end box').replace(/_/g, ' ');
    const angle = b.angle || 'three-quarter hero angle showing the front and one side';
    const finish = b.finish || 'matte laminate';
    const colors = Array.isArray(b.colors) && b.colors.length ? b.colors.join(', ') : 'brand colours';
    const studio = 'Professional studio product photography, soft shadows, seamless light background, sharp focus, high resolution. Show the package clearly. No watermark.';

    let model, input;

    if (b.artworkDataUrl) {
      // A) wrap the user's real design onto the package
      const prompt =
        `Turn this artwork into a photorealistic product mockup of a ${boxStyle}. ` +
        `Print this exact design — logo, colours, patterns, illustration and text — onto the package as the printed wrap, keeping the layout faithful. ` +
        `${angle}. ${finish} finish. ${studio}`;
      model = P.MODELS.packEdit;
      input = { prompt, image_url: b.artworkDataUrl, image_urls: [b.artworkDataUrl], num_images: 1 };

    } else if (b.exampleBoxDataUrl || b.logoDataUrl) {
      // B) design a creative package from scratch using references
      const refs = [b.exampleBoxDataUrl, b.logoDataUrl].filter(Boolean);
      const prompt =
        `Design a complete, creative and elegant retail ${boxStyle} package` +
        (b.productName ? ` for "${b.productName}"` : '') + '. ' +
        (b.description ? b.description + '. ' : '') +
        (b.logoDataUrl ? 'Feature the provided brand logo prominently and clearly. ' : '') +
        (b.text ? `Tastefully include the text "${b.text}" on the pack. ` : '') +
        `Brand colours ${colors}, ${finish} finish, premium, ${b.style || 'clean and modern'} style. ` +
        (b.exampleBoxDataUrl ? 'Follow the shape, proportions and format of the reference box. ' : '') +
        `Render it as a photorealistic 3D product mockup, ${angle}. ${studio}`;
      model = P.MODELS.packEdit;
      input = { prompt, image_urls: refs, image_url: refs[0], num_images: 1 };

    } else {
      // C) from colours + description only
      const prompt =
        `Photorealistic product photograph of a ${boxStyle} retail package` +
        (b.productName ? ` for "${b.productName}"` : '') + `. ${angle}. ` +
        `Brand colours ${colors}, ${b.style || 'clean, premium'} design, ${finish} finish. ` +
        (b.description ? b.description + '. ' : '') + (b.text ? `Featuring the text "${b.text}". ` : '') + studio;
      model = P.MODELS.image;
      input = { prompt, image_size: 'square_hd', num_images: 1 };
    }

    const data = await P.runFal(model, input);
    return P.json(200, { imageUrl: P.pickImage(data) });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
