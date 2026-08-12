/* fns/api.js — ONE serverless function that handles EVERY /api/* endpoint for
   Toolbench. Self-contained (no shared lib, no npm deps — Node 18 globals only).

   Why one file: it makes deployment foolproof. There is exactly one backend
   file to create, so there are no folders to drag and no duplicate "(1)" files
   possible. netlify.toml points the functions folder at "fns" and rewrites
   /api/* to this function; the router below dispatches on the last path segment.

   Secrets come from Netlify environment variables (never sent to the browser):
     FAL_KEY               fal.ai key (images, video, packaging, restyle)
     ELEVENLABS_API_KEY    ElevenLabs key (voices: list, clone, design, TTS, STS)
*/
'use strict';

const FAL_HOST = 'https://queue.fal.run';
const EL_HOST = 'https://api.elevenlabs.io';

const MODELS = {
  character: process.env.FAL_MODEL_CHARACTER || 'fal-ai/nano-banana/edit',
  image:     process.env.FAL_MODEL_IMAGE     || 'fal-ai/flux/dev',
  talking:   process.env.FAL_MODEL_TALKING   || 'fal-ai/veed/fabric-1.0',
  video:     process.env.FAL_MODEL_VIDEO     || 'fal-ai/kling-video/v2.1/standard/image-to-video',
  packEdit:  process.env.FAL_MODEL_PACK_EDIT || 'fal-ai/nano-banana/edit',
};
const ALLOWED = new Set(Object.values(MODELS));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(obj) };
}
function preflight() { return { statusCode: 204, headers: CORS, body: '' }; }
function falKey() { const k = process.env.FAL_KEY; if (!k) throw new Error('FAL_KEY is not set in Netlify environment variables'); return k; }
function elKey() { const k = process.env.ELEVENLABS_API_KEY; if (!k) throw new Error('ELEVENLABS_API_KEY is not set in Netlify environment variables'); return k; }

/* ---- fal: submit + poll until done (for images) ---- */
async function runFal(model, input, timeoutMs = 200000) {
  if (!ALLOWED.has(model)) throw new Error('model not allowed: ' + model);
  const headers = { Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json' };
  const submit = await fetch(`${FAL_HOST}/${model}`, { method: 'POST', headers, body: JSON.stringify(input) });
  if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const { request_id } = await submit.json();
  if (!request_id) throw new Error('fal: no request_id');
  const base = `${FAL_HOST}/${model.split('/').slice(0, 2).join('/')}/requests/${request_id}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const s = await fetch(`${base}/status`, { headers });
    if (!s.ok) continue;
    const st = await s.json();
    if (st.status === 'COMPLETED') { const res = await fetch(base, { headers }); if (!res.ok) throw new Error(`fal result ${res.status}`); return res.json(); }
    if (st.status === 'FAILED') throw new Error('fal job failed');
  }
  throw new Error('fal: timed out (the model took too long)');
}
/* ---- fal: submit-then-poll (for long video jobs) ---- */
async function falSubmit(model, input) {
  if (!ALLOWED.has(model)) throw new Error('model not allowed: ' + model);
  const headers = { Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json' };
  const submit = await fetch(`${FAL_HOST}/${model}`, { method: 'POST', headers, body: JSON.stringify(input) });
  if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const { request_id } = await submit.json();
  if (!request_id) throw new Error('fal: no request_id');
  return request_id;
}
async function falStatus(model, requestId) {
  if (!ALLOWED.has(model)) throw new Error('model not allowed');
  const headers = { Authorization: `Key ${falKey()}` };
  const base = `${FAL_HOST}/${model.split('/').slice(0, 2).join('/')}/requests/${requestId}`;
  const s = await fetch(`${base}/status`, { headers });
  if (!s.ok) return { status: 'processing' };
  const st = await s.json();
  if (st.status === 'COMPLETED') { const res = await fetch(base, { headers }); if (!res.ok) throw new Error('fal result ' + res.status); return { status: 'done', data: await res.json() }; }
  if (st.status === 'FAILED') return { status: 'failed' };
  return { status: 'processing' };
}
function pickImage(data) { const u = data?.images?.[0]?.url || data?.image?.url || data?.output?.[0] || data?.url; if (!u) throw new Error('fal: no image in result'); return u; }
function pickVideo(data) { const u = data?.video?.url || data?.videos?.[0]?.url || data?.output?.url || data?.url; if (!u) throw new Error('fal: no video in result'); return u; }

/* ---- ElevenLabs ---- */
async function listVoices() {
  const r = await fetch(`${EL_HOST}/v1/voices`, { headers: { 'xi-api-key': elKey() } });
  if (!r.ok) throw new Error(`ElevenLabs voices ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return (Array.isArray(data && data.voices) ? data.voices : []).map((v) => ({ voiceId: v.voice_id, name: v.name || 'Voice', category: v.category || 'custom', preview: v.preview_url || '', labels: v.labels || {} }));
}
async function cloneVoice({ name, audioBuffer, mime }) {
  const fd = new FormData();
  fd.append('name', name || 'Uploaded voice');
  fd.append('files', new Blob([audioBuffer], { type: mime || 'audio/mpeg' }), 'sample' + extFor(mime));
  const r = await fetch(`${EL_HOST}/v1/voices/add`, { method: 'POST', headers: { 'xi-api-key': elKey() }, body: fd });
  if (!r.ok) { const t = (await r.text()).slice(0, 400); if (r.status === 401 || /can_not_use_instant_voice_cloning|subscription/i.test(t)) throw new Error('Voice cloning needs a paid ElevenLabs plan (Starter or higher). Details: ' + t); throw new Error(`ElevenLabs clone ${r.status}: ${t}`); }
  const v = await r.json();
  if (!v.voice_id) throw new Error('ElevenLabs: no voice_id returned');
  return v.voice_id;
}
async function designVoice({ name, description, sampleText }) {
  const gen = await fetch(`${EL_HOST}/v1/text-to-voice/create-previews`, { method: 'POST', headers: { 'xi-api-key': elKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ voice_description: description, text: sampleText }) });
  if (!gen.ok) { const t = (await gen.text()).slice(0, 400); if (gen.status === 401 || /subscription|can_not|permission/i.test(t)) throw new Error('Voice design needs a paid ElevenLabs plan. Details: ' + t); throw new Error(`ElevenLabs voice-design ${gen.status}: ${t}`); }
  const previews = await gen.json();
  const pick = previews && previews.previews && previews.previews[0];
  if (!pick || !pick.generated_voice_id) throw new Error('No voice preview generated');
  const save = await fetch(`${EL_HOST}/v1/text-to-voice/create-voice-from-preview`, { method: 'POST', headers: { 'xi-api-key': elKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ voice_name: name, voice_description: description, generated_voice_id: pick.generated_voice_id }) });
  if (!save.ok) throw new Error(`ElevenLabs save-voice ${save.status}: ${(await save.text()).slice(0, 300)}`);
  const voice = await save.json();
  if (!voice || !voice.voice_id) throw new Error('No voice_id returned');
  return { voiceId: voice.voice_id, previewAudio: Buffer.from(pick.audio_base_64 || '', 'base64') };
}
async function speechToSpeech({ voiceId, audioBuffer, mime }) {
  const voice = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE;
  if (!voice) throw new Error('No target voice selected and ELEVENLABS_DEFAULT_VOICE is not set');
  const fd = new FormData();
  fd.append('audio', new Blob([audioBuffer], { type: mime || 'audio/mpeg' }), 'input' + extFor(mime));
  fd.append('model_id', process.env.ELEVENLABS_STS_MODEL || 'eleven_multilingual_sts_v2');
  fd.append('remove_background_noise', 'true');
  const r = await fetch(`${EL_HOST}/v1/speech-to-speech/${voice}`, { method: 'POST', headers: { 'xi-api-key': elKey(), Accept: 'audio/mpeg' }, body: fd });
  if (!r.ok) throw new Error(`ElevenLabs speech-to-speech ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}
async function tts({ voiceId, text, language }) {
  const voice = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE;
  if (!voice) throw new Error('No voice selected and ELEVENLABS_DEFAULT_VOICE is not set');
  const r = await fetch(`${EL_HOST}/v1/text-to-speech/${voice}`, { method: 'POST', headers: { 'xi-api-key': elKey(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2', language_code: language || undefined, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }) });
  if (!r.ok) throw new Error(`ElevenLabs tts ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}
function extFor(mime) { if (!mime) return '.mp3'; if (mime.includes('wav')) return '.wav'; if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3'; if (mime.includes('webm')) return '.webm'; if (mime.includes('ogg')) return '.ogg'; if (mime.includes('m4a') || mime.includes('mp4')) return '.m4a'; return '.mp3'; }
function decodeDataUrl(dataUrl) { const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || ''); if (m) return { buffer: Buffer.from(m[2], 'base64'), mime: m[1] }; return { buffer: Buffer.from(dataUrl || '', 'base64'), mime: null }; }
function bufferToDataUrl(buffer, mime) { return `data:${mime};base64,${buffer.toString('base64')}`; }

/* =========================================================================
   ENDPOINT HANDLERS — each returns a response object
   ========================================================================= */
async function ep_character(b) {
  if (!b.imageDataUrl) return json(400, { error: 'imageDataUrl (the uploaded photo) is required' });
  const view = b.view || 'head-and-shoulders portrait, facing the camera';
  const expression = b.expression || 'natural, warm';
  const outfit = b.outfit ? `Wearing ${b.outfit}.` : '';
  const action = b.action ? `The person is ${b.action}.` : '';
  const scene = b.scene ? `Setting: ${b.scene}.` : 'Setting: clean studio with soft key light.';
  const prompt = `Ultra-realistic professional photograph of the SAME person shown in the reference photo. Keep their face, features and identity strongly consistent. View: ${view}. Expression: ${expression}. ${outfit} ${action} ${scene} Full-frame camera look, 50mm lens, natural cinematic lighting, richly detailed environment and props, realistic skin texture and fabric detail, shallow depth of field, sharp focus, high resolution, strong identity match. Photorealistic, not illustrated. No text, no watermark.`;
  const data = await runFal(MODELS.character, { prompt, image_url: b.imageDataUrl, image_urls: [b.imageDataUrl], aspect_ratio: b.aspect || '1:1', num_images: 1 });
  return json(200, { imageUrl: pickImage(data) });
}
async function ep_combine(b) {
  if (!b.imageA || !b.imageB) return json(400, { error: 'imageA and imageB are required' });
  const framing = { selfie: 'IMPORTANT — frame this exactly as a LIVE front-facing phone selfie camera stream: our view IS the phone\'s front camera, as if the person is live-streaming to us. One person holds the phone at arm\'s length and looks straight into the lens talking to the camera; the other leans in close beside them. Both faces are large, close and clearly visible, filling a vertical 9:16 frame, slightly high selfie angle, mild wide-angle selfie lens with a little edge distortion, natural indoor lighting, authentic hand-held social-media vlog / live-stream look, photorealistic. ', overshoulder: 'Over-the-shoulder framing, cinematic and candid. ', twoshot: 'A clean two-shot with both people nicely framed side by side. ' }[b.framing] || '';
  const prompt = 'Create ONE photorealistic photograph that shows BOTH people from the two reference images together in the same scene. Keep each person\'s face, features and identity faithful and recognizable. ' + (b.outfitA ? `The first person is wearing ${b.outfitA}. ` : '') + (b.outfitB ? `The second person is wearing ${b.outfitB}. ` : '') + (b.action ? `They are ${b.action}. ` : 'They are together, interacting naturally. ') + (b.scene ? `Setting / location: ${b.scene}. ` : 'Setting: a warm, richly detailed environment. ') + framing + 'Consistent natural lighting on both, full-frame camera look, cinematic, professional, ultra-detailed, photorealistic. No text, no watermark.';
  const data = await runFal(MODELS.character, { prompt, image_urls: [b.imageA, b.imageB], image_url: b.imageA, aspect_ratio: b.aspect || '4:5', num_images: 1 });
  return json(200, { imageUrl: pickImage(data) });
}
async function ep_generate_start(b) {
  if (!b.characterImageUrl) return json(400, { error: 'characterImageUrl is required' });
  const mode = b.mode === 'action' ? 'action' : 'talking';
  if (mode === 'talking') {
    let audio;
    if (b.sourceAudioDataUrl) {
      const { buffer, mime } = decodeDataUrl(b.sourceAudioDataUrl);
      if (!buffer || !buffer.length) return json(400, { error: 'could not read the recorded audio' });
      if (buffer.length > 10 * 1024 * 1024) return json(413, { error: 'recording too large (max 10 MB)' });
      audio = await speechToSpeech({ voiceId: b.voiceId, audioBuffer: buffer, mime: mime || 'audio/mpeg' });
    } else {
      if (!b.script || !b.script.trim()) return json(400, { error: 'Provide a script or a recording' });
      if (b.script.length > 800) return json(400, { error: 'script too long — keep under 800 characters' });
      audio = await tts({ voiceId: b.voiceId, text: b.script, language: b.language || undefined });
    }
    const audioDataUrl = bufferToDataUrl(audio, 'audio/mpeg');
    const requestId = await falSubmit(MODELS.talking, { image_url: b.characterImageUrl, audio_url: audioDataUrl, resolution: b.resolution === '720p' ? '720p' : '480p' });
    return json(200, { requestId, model: MODELS.talking });
  }
  const prompt = (b.action ? `${b.action}. ` : '') + (b.scene ? `Setting: ${b.scene}. ` : '') + 'Natural realistic motion, lifelike faces, gentle handheld camera movement, cinematic, high detail, photorealistic.';
  const requestId = await falSubmit(MODELS.video, { image_url: b.characterImageUrl, prompt, duration: b.duration === '10' ? '10' : '5' });
  return json(200, { requestId, model: MODELS.video });
}
async function ep_generate_status(b) {
  if (!b.model || !b.requestId) return json(400, { error: 'model and requestId are required' });
  const r = await falStatus(b.model, b.requestId);
  if (r.status === 'done') return json(200, { status: 'done', videoUrl: pickVideo(r.data) });
  return json(200, { status: r.status });
}
async function ep_animate(b) {
  if (!b.characterImageUrl) return json(400, { error: 'characterImageUrl is required' });
  const prompt = (b.action ? `${b.action}. ` : '') + (b.scene ? `Setting: ${b.scene}. ` : '') + 'Natural realistic motion, lifelike faces, gentle handheld camera movement, cinematic, high detail, photorealistic.';
  const requestId = await falSubmit(MODELS.video, { image_url: b.characterImageUrl, prompt, duration: b.duration === '10' ? '10' : '5' });
  return json(200, { requestId, model: MODELS.video });
}
async function ep_animate_status(b) { return ep_generate_status(b); }
async function ep_packaging_mockup(b) {
  const boxStyle = (b.boxStyle || 'premium retail box').replace(/_/g, ' ');
  const angle = b.angle || 'a three-quarter hero angle showing the front and top';
  const finish = b.finish || 'matte laminate';
  const colors = Array.isArray(b.colors) && b.colors.length ? b.colors.join(', ') : 'elegant brand colours';
  const studio = 'Ultra-realistic 3D product packaging mockup, professional studio product photography, soft realistic shadows and a subtle reflection, clean seamless background, sharp focus, high resolution, premium, creative and elegant. No watermark, no extra text beyond the pack.';
  const refs = [b.exampleBoxDataUrl, b.logoDataUrl, b.productDataUrl, b.artworkDataUrl].filter(Boolean);
  let model, input;
  if (b.artworkDataUrl && !b.logoDataUrl && !b.productDataUrl && !b.exampleBoxDataUrl) {
    // wrap a finished full artwork onto the box
    const prompt = `Turn this artwork into a photorealistic 3D packaging mockup of a ${boxStyle}. Print this exact design — logo, colours, patterns, illustration and text — onto the package as the printed wrap, keeping the layout faithful. Show it as ${angle}. ${finish} finish. ${studio}`;
    model = MODELS.packEdit; input = { prompt, image_url: b.artworkDataUrl, image_urls: [b.artworkDataUrl], num_images: 1 };
  } else if (refs.length) {
    // DESIGN a premium package from the references (logo + product + example)
    const prompt =
      `Design a complete, creative, premium retail ${boxStyle}` + (b.productName ? ` for "${b.productName}"` : '') + '. ' +
      (b.description ? b.description + '. ' : '') +
      (b.logoDataUrl ? 'Feature the provided brand logo prominently, cleanly and consistently on the pack. ' : '') +
      (b.productDataUrl ? 'Show the actual product from the reference photo attractively with or inside the pack. ' : '') +
      (b.exampleBoxDataUrl ? 'Follow the shape, proportions and format of the reference box. ' : '') +
      (b.text ? `Tastefully include the text "${b.text}" on the pack. ` : '') +
      `Elegant brand colours ${colors}, ${finish} finish, ${b.style || 'clean, modern, luxury'} design, keep the SAME identity and layout on every face. ` +
      `Render it as an ultra-realistic 3D product mockup — ${angle}. ${studio}`;
    model = MODELS.packEdit; input = { prompt, image_urls: refs, image_url: refs[0], num_images: 1 };
  } else {
    const prompt = `Photorealistic 3D packaging mockup of a ${boxStyle} retail package` + (b.productName ? ` for "${b.productName}"` : '') + `. Show it as ${angle}. Brand colours ${colors}, ${b.style || 'clean, premium, luxury'} design, ${finish} finish. ` + (b.description ? b.description + '. ' : '') + (b.text ? `Featuring the text "${b.text}". ` : '') + studio;
    model = MODELS.image; input = { prompt, image_size: 'square_hd', num_images: 1 };
  }
  const data = await runFal(model, input);
  return json(200, { imageUrl: pickImage(data) });
}
async function ep_post_image(b) {
  // Neutral, sector-agnostic — the full creative styling comes from b.prompt
  // (built per-concept on the client), so this works for ANY business, not food.
  const prompt = (b.prompt || 'a premium product, elegant advertising scene') + '. Professional advertising photography, cinematic lighting, sharp focus, ultra-detailed, high resolution, photorealistic. No text, no watermark, no logo.';
  let data;
  if (b.refDataUrl) data = await runFal(MODELS.packEdit, { prompt: 'Restyle this into a professional advertising photograph, keeping the real product faithful and recognizable. ' + prompt, image_url: b.refDataUrl, image_urls: [b.refDataUrl], num_images: 1 });
  else data = await runFal(MODELS.image, { prompt, image_size: 'square_hd', num_images: 1 });
  const url = pickImage(data);
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch image ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = r.headers.get('content-type') || 'image/jpeg';
  return json(200, { dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
}
async function ep_talking_video(b) {
  if (!b.imageUrl) return json(400, { error: 'imageUrl (the character image) is required' });
  const hasRecording = !!b.sourceAudioDataUrl, hasScript = b.script && b.script.trim();
  if (!hasRecording && !hasScript) return json(400, { error: 'Provide either a recorded voice (sourceAudioDataUrl) or a typed script' });
  if (hasScript && !hasRecording && b.script.length > 800) return json(400, { error: 'script is too long — keep it under 800 characters per clip' });
  let audio;
  if (hasRecording) {
    const { buffer, mime } = decodeDataUrl(b.sourceAudioDataUrl);
    if (!buffer || !buffer.length) return json(400, { error: 'could not read the recorded audio' });
    if (buffer.length > 10 * 1024 * 1024) return json(413, { error: 'recording is too large (max 10 MB)' });
    audio = await speechToSpeech({ voiceId: b.voiceId, audioBuffer: buffer, mime: mime || 'audio/mpeg' });
  } else {
    audio = await tts({ voiceId: b.voiceId, text: b.script, language: b.language || undefined });
  }
  const audioDataUrl = bufferToDataUrl(audio, 'audio/mpeg');
  const data = await runFal(MODELS.talking, { image_url: b.imageUrl, audio_url: audioDataUrl, resolution: b.resolution === '720p' ? '720p' : '480p' });
  return json(200, { videoUrl: pickVideo(data), audioDataUrl });
}
async function ep_voice_clone(b) {
  if (!b.audioDataUrl) return json(400, { error: 'audioDataUrl (the uploaded voice sample) is required' });
  const { buffer, mime } = decodeDataUrl(b.audioDataUrl);
  if (!buffer || !buffer.length) return json(400, { error: 'could not read the audio sample' });
  if (buffer.length > 8 * 1024 * 1024) return json(413, { error: 'voice sample is too large (max 8 MB)' });
  const voiceId = await cloneVoice({ name: (b.name || 'Uploaded voice').slice(0, 60), audioBuffer: buffer, mime: mime || 'audio/mpeg' });
  return json(200, { voiceId });
}
const VOICE_PRESETS = {
  ar_grandmother: { name: 'Arabic Grandmother — warm', language: 'ar', description: 'Elderly Arabic-speaking woman, around 70 years old, warm and gentle, slightly raspy, slow and measured, kind and reassuring, Gulf (Khaleeji) accent.', sample: 'يا حبيبي، تعال قرّب واجلس بجانبي، خليني أحكي لك قصة من زمان جميل، أيام الطيبين، لما كنا نصنع السمبوسة بأيدينا في البيت بكل حب وبركة.' },
  ar_grandfather: { name: 'Arabic Grandfather — wise', language: 'ar', description: 'Elderly Arabic-speaking man, around 75, warm and wise, deep and calm, slow measured pace, Gulf accent.', sample: 'يا ولدي، اسمع كلام جدّك جيداً، الأصالة لا تروح والطعم الأصيل يبقى في القلب، تعلّمنا الصبر والكرم من آبائنا وأجدادنا في هذه الأرض الطيبة.' },
  ar_boy: { name: 'Arabic Boy — playful', language: 'ar', description: 'Young Arabic-speaking boy, about 8 years old, cheerful, playful, energetic, bright high-pitched voice.', sample: 'ماما، أنا جوعان كثير! أبغى سمبوسة ماما نورة، هي ألذّ سمبوسة في الدنيا كلها! تعالوا بسرعة نجهّز السفرة ونأكل كلنا مع بعض ونفرح!' },
  ar_girl: { name: 'Arabic Girl — sweet', language: 'ar', description: 'Young Arabic-speaking girl, about 8 years old, sweet, bright, playful and happy.', sample: 'تعالوا نساعد ماما نورة في المطبخ! أنا أحبّ أشوفها وهي تصنع الأكل اللذيذ، رائحته تملأ البيت كله، وكل ما نجتمع حوالي السفرة نضحك ونفرح مع بعض.' },
  ar_young_woman: { name: 'Arabic Young Woman — friendly', language: 'ar', description: 'Young adult Arabic-speaking woman, bright, friendly and upbeat, natural conversational pace, Levantine accent.', sample: 'أهلاً وسهلاً فيكم! خليني أوريكم المنتج الجديد اللي الكل يحكي عنه، طعمه أصيل ومصنوع بحب، جرّبوه اليوم وأنا متأكدة إنكم رح تحبوه من أول قضمة.' },
  ar_young_man: { name: 'Arabic Young Man — confident', language: 'ar', description: 'Young adult Arabic-speaking man, confident, friendly and modern, clear natural delivery.', sample: 'جرّب الطعم الأصيل من ماما نورة، جودة عالية ونكهة من قلب التراث، صنع في الكويت بكل فخر، اطلبه الآن وعيش تجربة لا تُنسى مع كل قضمة لذيذة.' },
  ar_announcer: { name: 'Arabic Announcer — bold', language: 'ar', description: 'Confident adult Arabic male voice, rich and resonant, energetic broadcast-announcer delivery, Modern Standard Arabic.', sample: 'عرض حصري لفترة محدودة! لا تفوّت الفرصة واحصل على منتجات ماما نورة الأصيلة، طعم التراث في كل قضمة، اطلب الآن قبل نفاد الكمية، الجودة التي تستحقها.' },
  ar_narrator_f: { name: 'Arabic Narrator — storyteller', language: 'ar', description: 'Warm adult Arabic female narrator, calm and cinematic, gentle storytelling tone, Modern Standard Arabic.', sample: 'من قلب التراث، ومن مطبخ مليء بالحب والذكريات، نقدّم لكم نكهة الأصالة التي توارثتها الأجيال، حكاية طعم يجمع العائلة حول سفرة واحدة، صنعت بحب في الكويت.' },
};
async function ep_voice_design(b) {
  const p = b.preset ? VOICE_PRESETS[b.preset] : null;
  const description = b.description || (p && p.description);
  if (!description) return json(400, { error: 'preset or description required' });
  const name = b.name || (p && p.name) || 'Custom voice';
  const language = b.language || (p && p.language) || 'ar';
  const sampleText = b.sampleText || (p && p.sample) || 'مرحباً بكم، هذا صوت تجريبي لعرض النبرة والأسلوب، نتمنى أن ينال إعجابكم ويكون مناسباً لمشروعكم القادم بإذن الله.';
  const v = await designVoice({ name, description, sampleText });
  return json(200, { voiceId: v.voiceId, name, language, previewDataUrl: v.previewAudio && v.previewAudio.length ? bufferToDataUrl(v.previewAudio, 'audio/mpeg') : null });
}
async function ep_voices_list() { return json(200, { voices: await listVoices() }); }

/* =========================================================================
   ROUTER — dispatch on the last path segment of /api/<endpoint>
   ========================================================================= */
const ROUTES = {
  'character': ep_character,
  'combine': ep_combine,
  'generate-start': ep_generate_start,
  'generate-status': ep_generate_status,
  'animate': ep_animate,
  'animate-status': ep_animate_status,
  'packaging-mockup': ep_packaging_mockup,
  'post-image': ep_post_image,
  'talking-video': ep_talking_video,
  'voice-clone': ep_voice_clone,
  'voice-design': ep_voice_design,
  'voices-list': ep_voices_list,
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const path = event.path || '';
  let seg;
  if (path.indexOf('/api/') >= 0) seg = path.split('/api/')[1].split(/[/?#]/)[0];
  else seg = path.split('/').filter(Boolean).pop();
  const fn = ROUTES[seg];
  if (!fn) return json(404, { error: 'unknown endpoint: ' + seg });
  if (seg !== 'voices-list' && event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  try {
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    return await fn(body);
  } catch (err) {
    return json(500, { error: String(err.message || err) });
  }
};
