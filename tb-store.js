/* tb-store.js — save characters & voices in the visitor's browser (no login).
   Used by the character studio and the talking-video tool so a character you
   build (look from all sides + its voice) can be reused when making videos. */
(function () {
  'use strict';
  var CKEY = 'tb_characters_v1', VKEY = 'tb_voices_v1';
  function read(k){ try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch(e){ return []; } }
  function write(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  function id(){ return 'x'+Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36); }

  window.TBStore = {
    // characters: {id,name,ref,shots:[{url,label}],outfit,scene,voiceId,createdAt}
    listCharacters: function(){ return read(CKEY); },
    saveCharacter: function(c){
      var all = read(CKEY);
      if (c.id) { all = all.filter(function(x){return x.id!==c.id;}); } else { c.id = id(); }
      c.createdAt = c.createdAt || Date.now();
      all.unshift(c); write(CKEY, all.slice(0, 30)); return c;
    },
    deleteCharacter: function(cid){ write(CKEY, read(CKEY).filter(function(x){return x.id!==cid;})); },
    getCharacter: function(cid){ return read(CKEY).filter(function(x){return x.id===cid;})[0] || null; },

    // voices: {id,name,voiceId,language,createdAt}
    listVoices: function(){ return read(VKEY); },
    saveVoice: function(v){
      var all = read(VKEY);
      if (!v.id) v.id = id();
      all = all.filter(function(x){return x.voiceId!==v.voiceId;});
      v.createdAt = v.createdAt || Date.now();
      all.unshift(v); write(VKEY, all.slice(0, 30)); return v;
    },
    deleteVoice: function(vid){ write(VKEY, read(VKEY).filter(function(x){return x.id!==vid;})); }
  };
})();
