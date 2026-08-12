/* netlify/functions/lib/providers.js
   Shared server-side helpers for the AI tools. No npm dependencies — uses the
   Node 18+ globals Netlify provides (fetch, FormData, Blob, Buffer).

   Secrets are read from Netlify environment variables and NEVER sent to the
   browser:
     FAL_KEY                 fal.ai key (images, talking video)
     ELEVENLABS_API_KEY      ElevenLabs key (voice clone + text-to-speech)
   Optional:
     FAL_MODEL_CHARACTER, FAL_MODEL_IMAGE, FAL_MODEL_TALKING
     ELEVENLABS_TTS_MODEL, ELEVENLABS_DEFAULT_VOICE
*/

'use strict';

const FAL_HOST = 'https://queue.fal.run';
const EL_HOST = 'https://api.elevenlabs.io';

/* ---- model config (override via env) ---- */
const MODELS = {
  // Fast identity-preserving edit model — good for turnarounds & outfit swaps
  // and quick enough to finish inside the function time limit.
  character: process.env.FAL_MODEL_CHARACTER || 'fal-ai/nano-banana/edit',
  image:     process.env.FAL_MODEL_IMAGE     || 'fal-ai/flux/dev',
  talking:   process.env.FAL_MODEL_TALKING   || 'fal-ai/veed/fabric-1.0',
  // Image -> short motion clip (action / vlog animation). THIS was missing,
  // which caused "model not allowed: undefined" on Animate.
  video:     process.env.FAL_MODEL_VIDEO     || 'fal-ai/kling-video/v2.1/standard/image-to-video',
  // Fast image-EDIT model for packaging: wraps the uploaded artwork onto a
  // realistic package while keeping the logo/colours/layout faithful.
  packEdit:  process.env.FAL_MODEL_PACK_EDIT || 'fal-ai/nano-banana/edit',
};
/* Only these models may be invoked — stops the public endpoint from being used
   to run arbitrary (expensive) fal models. */
const ALLOWED = new Set(Object.values(MODELS));

/* ---- small helpers ---- */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(obj) };
}
function preflight() { return { statusCode: 204, headers: CORS, body: '' }; }

function falKey() {
  const k = process.env.FAL_KEY;
  if (!k) throw new Error('FAL_KEY is not set in Netlify environment variables');
  return k;
}
function elKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY is not set in Netlify environment variables');
  return k;
}

/* ---- fal: submit to the queue and poll until the job resolves ---- */
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
    if (st.status === 'COMPLETED') {
      const res = await fetch(base, { headers });
      if (!res.ok) throw new Error(`fal result ${res.status}`);
      return res.json();
    }
    if (st.status === 'FAILED') throw new Error('fal job failed');
  }
  throw new Error('fal: timed out (the model took too long)');
}

/* ---- fal: SUBMIT-then-POLL (for long jobs like video) ----
   falSubmit kicks the job off and returns a request id fast (well under the
   function time limit). falStatus is polled by the browser until it's done, so
   fal's own queue is the job store — no database needed. */
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
  if (st.status === 'COMPLETED') {
    const res = await fetch(base, { headers });
    if (!res.ok) throw new Error('fal result ' + res.status);
    return { status: 'done', data: await res.json() };
  }
  if (st.status === 'FAILED') return { status: 'failed' };
  return { status: 'processing' };
}

function pickImage(data) {
  const u = data?.images?.[0]?.url || data?.image?.url || data?.output?.[0] || data?.url;
  if (!u) throw new Error('fal: no image in result');
  return u;
}
function pickVideo(data) {
  const u = data?.video?.url || data?.videos?.[0]?.url || data?.output?.url || data?.url;
  if (!u) throw new Error('fal: no video in result');
  return u;
}

/* ---- ElevenLabs: list the account's voices (library + cloned + designed) ----
   So every voice the user has saved in ElevenLabs shows up in Toolbench's
   voice pickers. Returns a slim list the browser can render. */
async function listVoices() {
  const r = await fetch(`${EL_HOST}/v1/voices`, { headers: { 'xi-api-key': elKey() } });
  if (!r.ok) throw new Error(`ElevenLabs voices ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const voices = Array.isArray(data && data.voices) ? data.voices : [];
  return voices.map((v) => ({
    voiceId: v.voice_id,
    name: v.name || 'Voice',
    category: v.category || 'custom',           // premade | cloned | generated | professional
    preview: v.preview_url || '',
    labels: v.labels || {},
  }));
}

/* ---- ElevenLabs: Instant Voice Cloning from an uploaded sample ---- */
async function cloneVoice({ name, audioBuffer, mime }) {
  const fd = new FormData();
  fd.append('name', name || 'Uploaded voice');
  fd.append('files', new Blob([audioBuffer], { type: mime || 'audio/mpeg' }), 'sample' + extFor(mime));
  const r = await fetch(`${EL_HOST}/v1/voices/add`, {
    method: 'POST', headers: { 'xi-api-key': elKey() }, body: fd,
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 400);
    if (r.status === 401 || /can_not_use_instant_voice_cloning|subscription/i.test(t)) {
      throw new Error('Voice cloning needs a paid ElevenLabs plan (Starter or higher). Details: ' + t);
    }
    throw new Error(`ElevenLabs clone ${r.status}: ${t}`);
  }
  const v = await r.json();
  if (!v.voice_id) throw new Error('ElevenLabs: no voice_id returned');
  return v.voice_id;
}

/* ---- ElevenLabs: Voice Design — mint a voice from a description ----
   Used for the preset voice library (grandmother, kid, announcer…). Creates a
   preview from the description, then saves it as a reusable voice_id. */
async function designVoice({ name, description, sampleText }) {
  const gen = await fetch(`${EL_HOST}/v1/text-to-voice/create-previews`, {
    method: 'POST', headers: { 'xi-api-key': elKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_description: description, text: sampleText }),
  });
  if (!gen.ok) {
    const t = (await gen.text()).slice(0, 400);
    if (gen.status === 401 || /subscription|can_not|permission/i.test(t)) {
      throw new Error('Voice design needs a paid ElevenLabs plan. Details: ' + t);
    }
    throw new Error(`ElevenLabs voice-design ${gen.status}: ${t}`);
  }
  const previews = await gen.json();
  const pick = previews && previews.previews && previews.previews[0];
  if (!pick || !pick.generated_voice_id) throw new Error('No voice preview generated');

  const save = await fetch(`${EL_HOST}/v1/text-to-voice/create-voice-from-preview`, {
    method: 'POST', headers: { 'xi-api-key': elKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_name: name, voice_description: description, generated_voice_id: pick.generated_voice_id }),
  });
  if (!save.ok) throw new Error(`ElevenLabs save-voice ${save.status}: ${(await save.text()).slice(0, 300)}`);
  const voice = await save.json();
  if (!voice || !voice.voice_id) throw new Error('No voice_id returned');
  return { voiceId: voice.voice_id, previewAudio: Buffer.from(pick.audio_base_64 || '', 'base64') };
}

/* ---- ElevenLabs: Speech-to-Speech (Voice Changer) ----
   Take the client's RECORDED speech and re-render it in the target voice,
   keeping their exact delivery, pacing and emotion. Returns mp3 Buffer. */
async function speechToSpeech({ voiceId, audioBuffer, mime }) {
  const voice = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE;
  if (!voice) throw new Error('No target voice selected and ELEVENLABS_DEFAULT_VOICE is not set');
  const fd = new FormData();
  fd.append('audio', new Blob([audioBuffer], { type: mime || 'audio/mpeg' }), 'input' + extFor(mime));
  fd.append('model_id', process.env.ELEVENLABS_STS_MODEL || 'eleven_multilingual_sts_v2');
  fd.append('remove_background_noise', 'true');
  const r = await fetch(`${EL_HOST}/v1/speech-to-speech/${voice}`, {
    method: 'POST', headers: { 'xi-api-key': elKey(), Accept: 'audio/mpeg' }, body: fd,
  });
  if (!r.ok) throw new Error(`ElevenLabs speech-to-speech ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

/* ---- ElevenLabs: text-to-speech -> mp3 Buffer ---- */
async function tts({ voiceId, text, language }) {
  const voice = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE;
  if (!voice) throw new Error('No voice selected and ELEVENLABS_DEFAULT_VOICE is not set');
  const r = await fetch(`${EL_HOST}/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: { 'xi-api-key': elKey(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
      language_code: language || undefined,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs tts ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

/* ---- misc ---- */
function extFor(mime) {
  if (!mime) return '.mp3';
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('m4a') || mime.includes('mp4')) return '.m4a';
  return '.mp3';
}
/** Decode a data: URL (or bare base64) into { buffer, mime }. */
function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
  if (m) return { buffer: Buffer.from(m[2], 'base64'), mime: m[1] };
  return { buffer: Buffer.from(dataUrl || '', 'base64'), mime: null };
}
function bufferToDataUrl(buffer, mime) {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

module.exports = {
  MODELS, CORS, json, preflight,
  runFal, falSubmit, falStatus, pickImage, pickVideo,
  listVoices, cloneVoice, designVoice, tts, speechToSpeech,
  decodeDataUrl, bufferToDataUrl,
};
