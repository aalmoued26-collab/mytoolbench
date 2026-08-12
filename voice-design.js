/* POST /api/voice-design  — create a preset (or custom) voice via Voice Design.
   body: { preset?, description?, name?, sampleText? }
   Returns { voiceId, name, language, previewDataUrl }.
   Requires a paid ElevenLabs plan. The browser saves the voiceId for reuse.
*/
'use strict';
const P = require('./lib/providers');

const PRESETS = {
  ar_grandmother: {
    name: 'Arabic Grandmother — warm',
    language: 'ar',
    description: 'Elderly Arabic-speaking woman, around 70 years old, warm and gentle, slightly raspy, slow and measured, kind and reassuring, Gulf (Khaleeji) accent.',
    sample: 'يا حبيبي، تعال قرّب واجلس بجانبي، خليني أحكي لك قصة من زمان جميل، أيام الطيبين، لما كنا نصنع السمبوسة بأيدينا في البيت بكل حب وبركة.',
  },
  ar_grandfather: {
    name: 'Arabic Grandfather — wise',
    language: 'ar',
    description: 'Elderly Arabic-speaking man, around 75, warm and wise, deep and calm, slow measured pace, Gulf accent.',
    sample: 'يا ولدي، اسمع كلام جدّك جيداً، الأصالة لا تروح والطعم الأصيل يبقى في القلب، تعلّمنا الصبر والكرم من آبائنا وأجدادنا في هذه الأرض الطيبة.',
  },
  ar_boy: {
    name: 'Arabic Boy — playful',
    language: 'ar',
    description: 'Young Arabic-speaking boy, about 8 years old, cheerful, playful, energetic, bright high-pitched voice.',
    sample: 'ماما، أنا جوعان كثير! أبغى سمبوسة ماما نورة، هي ألذّ سمبوسة في الدنيا كلها! تعالوا بسرعة نجهّز السفرة ونأكل كلنا مع بعض ونفرح!',
  },
  ar_girl: {
    name: 'Arabic Girl — sweet',
    language: 'ar',
    description: 'Young Arabic-speaking girl, about 8 years old, sweet, bright, playful and happy.',
    sample: 'تعالوا نساعد ماما نورة في المطبخ! أنا أحبّ أشوفها وهي تصنع الأكل اللذيذ، رائحته تملأ البيت كله، وكل ما نجتمع حوالي السفرة نضحك ونفرح مع بعض.',
  },
  ar_young_woman: {
    name: 'Arabic Young Woman — friendly',
    language: 'ar',
    description: 'Young adult Arabic-speaking woman, bright, friendly and upbeat, natural conversational pace, Levantine accent.',
    sample: 'أهلاً وسهلاً فيكم! خليني أوريكم المنتج الجديد اللي الكل يحكي عنه، طعمه أصيل ومصنوع بحب، جرّبوه اليوم وأنا متأكدة إنكم رح تحبوه من أول قضمة.',
  },
  ar_young_man: {
    name: 'Arabic Young Man — confident',
    language: 'ar',
    description: 'Young adult Arabic-speaking man, confident, friendly and modern, clear natural delivery.',
    sample: 'جرّب الطعم الأصيل من ماما نورة، جودة عالية ونكهة من قلب التراث، صنع في الكويت بكل فخر، اطلبه الآن وعيش تجربة لا تُنسى مع كل قضمة لذيذة.',
  },
  ar_announcer: {
    name: 'Arabic Announcer — bold',
    language: 'ar',
    description: 'Confident adult Arabic male voice, rich and resonant, energetic broadcast-announcer delivery, Modern Standard Arabic.',
    sample: 'عرض حصري لفترة محدودة! لا تفوّت الفرصة واحصل على منتجات ماما نورة الأصيلة، طعم التراث في كل قضمة، اطلب الآن قبل نفاد الكمية، الجودة التي تستحقها.',
  },
  ar_narrator_f: {
    name: 'Arabic Narrator — storyteller',
    language: 'ar',
    description: 'Warm adult Arabic female narrator, calm and cinematic, gentle storytelling tone, Modern Standard Arabic.',
    sample: 'من قلب التراث، ومن مطبخ مليء بالحب والذكريات، نقدّم لكم نكهة الأصالة التي توارثتها الأجيال، حكاية طعم يجمع العائلة حول سفرة واحدة، صنعت بحب في الكويت.',
  },
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  if (event.httpMethod !== 'POST') return P.json(405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    const p = b.preset ? PRESETS[b.preset] : null;
    const description = b.description || (p && p.description);
    if (!description) return P.json(400, { error: 'preset or description required' });
    const name = b.name || (p && p.name) || 'Custom voice';
    const language = b.language || (p && p.language) || 'ar';
    const sampleText = b.sampleText || (p && p.sample) ||
      'مرحباً بكم، هذا صوت تجريبي لعرض النبرة والأسلوب، نتمنى أن ينال إعجابكم ويكون مناسباً لمشروعكم القادم بإذن الله.';

    const v = await P.designVoice({ name, description, sampleText });
    return P.json(200, {
      voiceId: v.voiceId, name, language,
      previewDataUrl: v.previewAudio && v.previewAudio.length
        ? P.bufferToDataUrl(v.previewAudio, 'audio/mpeg') : null,
    });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
