/* GET/POST /api/voices-list — return the account's ElevenLabs voices so they
   appear in Toolbench's voice pickers (cloned, designed, premade, professional).
   Returns { voices: [{ voiceId, name, category, preview, labels }] }.
*/
'use strict';
const P = require('./lib/providers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return P.preflight();
  try {
    const voices = await P.listVoices();
    return P.json(200, { voices });
  } catch (err) {
    return P.json(500, { error: String(err.message || err) });
  }
};
