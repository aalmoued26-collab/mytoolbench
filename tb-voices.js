/* tb-voices.js — one place to load the ElevenLabs voice library and fill any
   <select> with: the character's own voice + voices saved in Toolbench +
   every voice from the connected ElevenLabs account (grouped by type).

   Usage:
     TBVoices.fill(selectEl, { firstLabel:'— choose a voice —',
                               characterVoiceId, characterVoiceName });
   It fetches /api/voices-list once and caches it. If that endpoint isn't
   deployed or the key isn't set, it still fills the saved/character voices so
   the picker is never empty.
*/
(function () {
  var cache = null; // promise -> array of {voiceId,name,category}
  function esc(s){ return String(s==null?'':s).replace(/[<>&"]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m];}); }
  function catLabel(c){ return c==='cloned'?'Cloned':c==='generated'?'Designed':c==='professional'?'Professional':c==='premade'?'Preset':'Custom'; }

  function load(){
    if (cache) return cache;
    cache = fetch('/api/voices-list')
      .then(function(x){ return x.ok ? x.json() : {voices:[]}; })
      .then(function(j){ return (j && j.voices) || []; })
      .catch(function(){ return []; });
    return cache;
  }

  function optionsHtml(lib, opts){
    opts = opts || {};
    var html = '<option value="">'+esc(opts.firstLabel || '— choose a voice —')+'</option>';
    if (opts.characterVoiceId){
      html += '<optgroup label="This character\'s voice"><option value="'+esc(opts.characterVoiceId)+'">'+
        esc(opts.characterVoiceName || 'Character voice')+'</option></optgroup>';
    }
    var saved = (window.TBStore && window.TBStore.listVoices) ? window.TBStore.listVoices() : [];
    if (saved && saved.length){
      html += '<optgroup label="Saved in Toolbench">'+saved.map(function(v){
        return '<option value="'+esc(v.voiceId||v.id)+'">'+esc(v.name||'Voice')+'</option>'; }).join('')+'</optgroup>';
    }
    if (lib && lib.length){
      var byCat = {};
      lib.forEach(function(v){ (byCat[v.category]=byCat[v.category]||[]).push(v); });
      ['cloned','generated','professional','premade','custom'].forEach(function(cat){
        if (!byCat[cat]) return;
        html += '<optgroup label="ElevenLabs — '+catLabel(cat)+'">'+byCat[cat].map(function(v){
          return '<option value="'+esc(v.voiceId)+'">'+esc(v.name)+'</option>'; }).join('')+'</optgroup>';
      });
    }
    return html;
  }

  // Fill immediately with saved/character voices, then again once the library loads.
  function fill(sel, opts){
    if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = optionsHtml([], opts);
    if (opts && opts.characterVoiceId) sel.value = opts.characterVoiceId; else if (keep) sel.value = keep;
    load().then(function(lib){
      var keep2 = sel.value;
      sel.innerHTML = optionsHtml(lib, opts);
      if (opts && opts.characterVoiceId) sel.value = opts.characterVoiceId; else if (keep2) sel.value = keep2;
    });
  }

  window.TBVoices = { load: load, fill: fill };
})();
