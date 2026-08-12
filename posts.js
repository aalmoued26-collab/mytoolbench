/* posts.js — multi-layout marketing-post composer (client-side canvas).
   Brand-agnostic: works with ANY logo, many colour themes (or custom / auto),
   and several distinct layouts. Crisp Arabic + English type composed as layers.

   Layout renderers (all return Promise<dataURL PNG>):
     window.renderHeritagePost(o)   — ornamental framed poster (Sadu / geo / plain)
     window.renderCinematicPost(o)  — full-bleed image, text overlaid at bottom
     window.renderMinimalPost(o)    — clean light layout, image + type below
     window.renderBoldPost(o)       — image top, solid colour block + big headline
     window.renderEditorialPost(o)  — magazine cover: image, top text, kicker, rule
   Shared opts: { size:'1:1'|'4:5'|'9:16', palette:<key|object>, ornament?,
                  logoDataUrl?, imageDataUrl?/foodDataUrl?, arHeadline?, arSub?,
                  enHeadline?, showText?, showSeal? } */
(function () {
  'use strict';

  /* ---------- theme library ---------- */
  var THEMES = {
    navy:      { name:'Navy & gold',        bg:'#10233f', accent:'#d9b667', text:'#f0e6cf', band:'#0b1a2e' },
    terracotta:{ name:'Terracotta & gold',  bg:'#6e3a24', accent:'#e6c07a', text:'#f5ead4', band:'#552b1a' },
    emerald:   { name:'Emerald & gold',     bg:'#0f3d2e', accent:'#e0c56e', text:'#eaf3ec', band:'#0a2c20' },
    royal:     { name:'Royal purple & gold',bg:'#2a1a4a', accent:'#e4c46a', text:'#efe8f7', band:'#1e1236' },
    black:     { name:'Black & gold',       bg:'#16171b', accent:'#e9c877', text:'#f2ead6', band:'#0e0f12' },
    crimson:   { name:'Crimson & cream',    bg:'#5c1622', accent:'#f0d9a0', text:'#f7ece0', band:'#45101a' },
    teal:      { name:'Teal & copper',      bg:'#0c3b40', accent:'#e6a15a', text:'#eaf5f4', band:'#082b2f' },
    forest:    { name:'Forest & sand',      bg:'#24331f', accent:'#d8c98a', text:'#eef2e6', band:'#1a2616' },
    plum:      { name:'Plum & rose gold',   bg:'#3a1f2e', accent:'#d9a273', text:'#f4e8ee', band:'#2a1521' },
    slate:     { name:'Slate & silver',     bg:'#22303b', accent:'#c2ced6', text:'#eef3f6', band:'#18232c' },
    sunset:    { name:'Sunset orange',      bg:'#7a2e12', accent:'#ffd27a', text:'#fff0dd', band:'#5e2110' },
    ocean:     { name:'Ocean blue',         bg:'#0b2a52', accent:'#7fd0e6', text:'#eaf4fb', band:'#071d3b' },
    rose:      { name:'Rose & blush',       bg:'#7a3b52', accent:'#f4d4b0', text:'#fbeef2', band:'#5e2b3f' },
    mono:      { name:'Monochrome',         bg:'#1b1b1b', accent:'#d0d0d0', text:'#f4f4f4', band:'#111111' },
    olive:     { name:'Olive & cream',      bg:'#3f3d22', accent:'#e4d59a', text:'#f4f1e2', band:'#2d2b16' }
  };
  window.POST_THEMES = THEMES;

  function normalize(t){ return { bg:t.bg, gold:t.accent||t.gold||'#d9b667', cream:t.text||t.cream||'#f5ead4', band:t.band||t.bg, accent:t.accent||t.gold||'#d9b667' }; }
  function resolvePal(p){
    if (p && typeof p === 'object') return normalize(p);
    return normalize(THEMES[p] || THEMES.navy);
  }

  /* ---------- helpers ---------- */
  function loadImg(src){ return new Promise(function(res){ if(!src) return res(null); var im=new Image(); im.onload=function(){res(im);}; im.onerror=function(){res(null);}; im.src=src; }); }
  function canvas(W,H){ var c=document.createElement('canvas'); c.width=W; c.height=H; return c; }
  function roundRect(x,a,y,w,h,r){ x.beginPath(); x.moveTo(a+r,y); x.arcTo(a+w,y,a+w,y+h,r); x.arcTo(a+w,y+h,a,y+h,r); x.arcTo(a,y+h,a,y,r); x.arcTo(a,y,a+w,y,r); x.closePath(); }
  function cover(ctx,img,dx,dy,dw,dh,r){ if(!img) return; ctx.save(); roundRect(ctx,dx,dy,dw,dh,r||0); ctx.clip(); var s=Math.max(dw/img.width,dh/img.height); var w=img.width*s,h=img.height*s; ctx.drawImage(img,dx+(dw-w)/2,dy+(dh-h)/2,w,h); ctx.restore(); }
  function drawLogo(ctx,logo,cx,cy,maxR){ if(!logo) return; var s=Math.min((maxR*2)/logo.width,(maxR*2)/logo.height); ctx.drawImage(logo,cx-logo.width*s/2,cy-logo.height*s/2,logo.width*s,logo.height*s); }
  function fitFont(ctx,text,weight,family,maxW,startPx){ var px=startPx; do{ ctx.font=weight+' '+px+'px '+family; px-=2; } while(ctx.measureText(text).width>maxW && px>14); return px+2; }
  function wrapText(ctx,text,x,y,maxW,lh,align){ var words=String(text).split(' '),line='',lines=[]; for(var i=0;i<words.length;i++){ var t=line+words[i]+' '; if(ctx.measureText(t).width>maxW && line){ lines.push(line); line=words[i]+' '; } else line=t; } lines.push(line); for(var j=0;j<lines.length;j++){ ctx.fillText(lines[j].trim(), x, y-(lines.length-1-j)*lh); } return lines.length; }
  async function fontsReady(){ try{ await document.fonts.load('700 80px "Aref Ruqaa"'); await document.fonts.load('400 40px "Amiri"'); await document.fonts.load('700 40px "Amiri"'); await document.fonts.load('600 48px "Playfair Display"'); await document.fonts.load('700 48px "Playfair Display"'); await document.fonts.ready; }catch(e){} }

  /* ---------- ornaments ---------- */
  function sadu(ctx,x,y,w,h,pal){
    ctx.save(); ctx.fillStyle=pal.band; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=pal.gold; ctx.lineWidth=Math.max(2,h*0.03);
    var m=h*0.16; ctx.beginPath(); ctx.moveTo(x,y+m); ctx.lineTo(x+w,y+m); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y+h-m); ctx.lineTo(x+w,y+h-m); ctx.stroke();
    var cy=y+h/2, dh=h*0.34, step=h*0.62; ctx.fillStyle=pal.gold;
    for(var cx=x+step/2; cx<x+w; cx+=step){
      ctx.beginPath(); ctx.moveTo(cx,cy-dh); ctx.lineTo(cx+dh,cy); ctx.lineTo(cx,cy+dh); ctx.lineTo(cx-dh,cy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx+step/2-dh*0.5,cy-dh*0.5); ctx.lineTo(cx+step/2+dh*0.5,cy-dh*0.5); ctx.lineTo(cx+step/2,cy+dh*0.2); ctx.closePath(); ctx.globalAlpha=0.85; ctx.fill(); ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  function geoBand(ctx,x,y,w,h,pal){
    ctx.save(); ctx.fillStyle=pal.band; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=pal.gold; ctx.lineWidth=Math.max(1.5,h*0.03);
    ctx.beginPath(); ctx.moveTo(x,y+h*0.28); ctx.lineTo(x+w,y+h*0.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y+h*0.72); ctx.lineTo(x+w,y+h*0.72); ctx.stroke();
    var cy=y+h/2, rr=h*0.12, step=h*0.5; ctx.fillStyle=pal.gold;
    for(var cx=x+step/2; cx<x+w; cx+=step){ ctx.beginPath(); ctx.arc(cx,cy,rr,0,7); ctx.fill(); }
    ctx.restore();
  }
  function plainBand(ctx,x,y,w,h,pal){
    ctx.save(); ctx.fillStyle=pal.bg; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=pal.gold; ctx.lineWidth=Math.max(1.5,h*0.018);
    ctx.beginPath(); ctx.moveTo(x+w*0.08,y+h*0.44); ctx.lineTo(x+w*0.92,y+h*0.44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w*0.08,y+h*0.56); ctx.lineTo(x+w*0.92,y+h*0.56); ctx.stroke();
    ctx.restore();
  }
  function ornamentBand(ctx,x,y,w,h,pal,kind){ if(kind==='geo') return geoBand(ctx,x,y,w,h,pal); if(kind==='plain'||kind==='none') return plainBand(ctx,x,y,w,h,pal); return sadu(ctx,x,y,w,h,pal); }

  function medallion(ctx,img,cx,cy,r,pal){
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r+r*0.12,0,7); ctx.fillStyle=pal.bg; ctx.fill();
    ctx.lineWidth=r*0.12; ctx.strokeStyle=pal.gold; ctx.stroke();
    if(img){ ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.clip(); var s=Math.max(2*r/img.width,2*r/img.height); ctx.drawImage(img,cx-img.width*s/2,cy-img.height*s/2,img.width*s,img.height*s); }
    ctx.restore();
  }
  function seal(ctx,cx,cy,r,pal){
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fillStyle=pal.gold; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,r*0.82,0,7); ctx.strokeStyle=pal.bg; ctx.lineWidth=r*0.05; ctx.stroke();
    var fw=r*0.9,fh=r*0.5,fx=cx-fw/2,fy=cy-fh*0.75,band=fh/3;
    ctx.fillStyle='#007a3d'; ctx.fillRect(fx,fy,fw,band);
    ctx.fillStyle='#ffffff'; ctx.fillRect(fx,fy+band,fw,band);
    ctx.fillStyle='#ce1126'; ctx.fillRect(fx,fy+2*band,fw,band);
    ctx.fillStyle='#000000'; ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+fw*0.28,fy+band); ctx.lineTo(fx+fw*0.28,fy+2*band); ctx.lineTo(fx,fy+3*band); ctx.closePath(); ctx.fill();
    ctx.fillStyle=pal.bg; ctx.textAlign='center'; ctx.direction='rtl'; ctx.font='700 '+Math.round(r*0.26)+'px "Amiri",serif'; ctx.fillText('صنع في الكويت',cx,cy+r*0.35);
    ctx.direction='ltr'; ctx.font='700 '+Math.round(r*0.16)+'px Arial'; ctx.fillText('PRODUCED IN KUWAIT',cx,cy+r*0.62);
    ctx.restore();
  }

  var SIZES = { '1:1':[1080,1080], '4:5':[1080,1350], '9:16':[1080,1920] };
  function dimOf(size,def){ return SIZES[size]||SIZES[def||'4:5']; }

  /* ---------- 1) Heritage / ornamental frame ---------- */
  window.renderHeritagePost = async function (o) {
    var d=dimOf(o.size,'1:1'), W=d[0], H=d[1], pal=resolvePal(o.palette);
    await fontsReady();
    var logoImg=await loadImg(o.logoDataUrl), foodImg=await loadImg(o.foodDataUrl||o.imageDataUrl);
    var c=canvas(W,H), ctx=c.getContext('2d');
    ctx.fillStyle=pal.bg; ctx.fillRect(0,0,W,H);
    var band=Math.round(W*0.11), kind=o.ornament||'sadu';
    ornamentBand(ctx,0,0,W,band,pal,kind); ornamentBand(ctx,0,H-band,W,band,pal,kind);
    var showText=o.showText!==false;
    var contentTop=showText?Math.round(W*0.40):band+Math.round(W*0.03);
    var fx=Math.round(W*0.09), fw=W-2*fx, foodBottom=H-band-Math.round(W*0.03);
    if(foodImg) cover(ctx,foodImg,fx,contentTop,fw,foodBottom-contentTop,Math.round(W*0.03));
    else { ctx.fillStyle=pal.band; roundRect(ctx,fx,contentTop,fw,foodBottom-contentTop,Math.round(W*0.03)); ctx.fill(); }
    if(showText){
      ctx.textAlign='center';
      var yh=band+Math.round(W*0.17);
      if(o.arHeadline){ var hp=fitFont(ctx,o.arHeadline,'700','"Aref Ruqaa","Amiri",serif',W*0.82,Math.round(W*0.085)); ctx.font='700 '+hp+'px "Aref Ruqaa","Amiri",serif'; ctx.fillStyle=pal.gold; ctx.direction='rtl'; ctx.fillText(o.arHeadline,W/2,yh); }
      if(o.arSub){ ctx.font='700 '+Math.round(W*0.036)+'px "Amiri",serif'; ctx.fillStyle=pal.cream; ctx.direction='rtl'; ctx.fillText(o.arSub,W/2,band+Math.round(W*0.25)); }
      if(o.enHeadline){ ctx.font='600 '+Math.round(W*0.038)+'px "Playfair Display",serif'; ctx.fillStyle=pal.gold; ctx.direction='ltr'; ctx.fillText(o.enHeadline,W/2,band+Math.round(W*0.32)); }
    }
    if(logoImg) medallion(ctx,logoImg,W/2,band*0.52,Math.round(W*0.075),pal);
    if(o.showSeal===true) seal(ctx,W-Math.round(W*0.135),foodBottom-Math.round(W*0.10),Math.round(W*0.075),pal);
    return c.toDataURL('image/png');
  };

  /* ---------- 2) Cinematic full-bleed ---------- */
  window.renderCinematicPost = async function (o) {
    var d=dimOf(o.size,'4:5'), W=d[0], H=d[1], pal=resolvePal(o.palette);
    await fontsReady();
    var img=await loadImg(o.imageDataUrl||o.foodDataUrl), logo=await loadImg(o.logoDataUrl);
    var c=canvas(W,H), ctx=c.getContext('2d');
    ctx.fillStyle='#111'; ctx.fillRect(0,0,W,H);
    if(img){ var s=Math.max(W/img.width,H/img.height); ctx.drawImage(img,(W-img.width*s)/2,(H-img.height*s)/2,img.width*s,img.height*s); }
    var showText=o.showText!==false && (o.arHeadline||o.enHeadline);
    if(showText){
      var g=ctx.createLinearGradient(0,H*0.45,0,H); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.74)');
      ctx.fillStyle=g; ctx.fillRect(0,H*0.45,W,H*0.55);
      var pad=Math.round(W*0.07), y=H-Math.round(W*0.10);
      if(o.enHeadline){ ctx.textAlign='left'; ctx.font='600 '+Math.round(W*0.062)+'px "Playfair Display",serif'; ctx.fillStyle=pal.cream; ctx.direction='ltr'; wrapText(ctx,o.enHeadline,pad,y,W-pad*2,Math.round(W*0.07)); }
      if(o.arHeadline){ ctx.font='700 '+Math.round(W*0.075)+'px "Aref Ruqaa","Amiri",serif'; ctx.fillStyle=pal.gold; ctx.direction='rtl'; ctx.textAlign='right'; ctx.fillText(o.arHeadline,W-pad,o.enHeadline?y-Math.round(W*0.16):y); }
      if(o.arSub){ ctx.font='400 '+Math.round(W*0.032)+'px "Amiri",serif'; ctx.fillStyle=pal.cream; ctx.direction='rtl'; ctx.textAlign='right'; ctx.fillText(o.arSub,W-pad,y+Math.round(W*0.05)); }
    }
    if(logo) medallion(ctx,logo,W-Math.round(W*0.13),Math.round(W*0.13),Math.round(W*0.085),{bg:'#1a1a1a',gold:pal.gold});
    return c.toDataURL('image/png');
  };

  /* ---------- 3) Minimal / clean ---------- */
  window.renderMinimalPost = async function (o) {
    var d=dimOf(o.size,'4:5'), W=d[0], H=d[1], pal=resolvePal(o.palette);
    await fontsReady();
    var img=await loadImg(o.imageDataUrl||o.foodDataUrl), logo=await loadImg(o.logoDataUrl);
    var c=canvas(W,H), ctx=c.getContext('2d');
    ctx.fillStyle='#f6f1e7'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=pal.bg; ctx.globalAlpha=0.06; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
    ctx.fillStyle=pal.gold; ctx.fillRect(0,0,W,Math.round(H*0.010));
    var pad=Math.round(W*0.09);
    if(logo){ drawLogo(ctx,logo,W/2,Math.round(H*0.075),Math.round(W*0.06)); }
    var iy=Math.round(H*0.15), iw=W-2*pad, ih=Math.round(H*0.50);
    if(img) cover(ctx,img,pad,iy,iw,ih,Math.round(W*0.03));
    else { ctx.fillStyle=pal.band; roundRect(ctx,pad,iy,iw,ih,Math.round(W*0.03)); ctx.fill(); }
    var showText=o.showText!==false;
    if(showText){
      ctx.textAlign='center'; var ty=iy+ih+Math.round(H*0.085);
      if(o.enHeadline){ ctx.font='600 '+Math.round(W*0.028)+'px "Inter",Arial,sans-serif'; ctx.fillStyle=pal.gold; ctx.direction='ltr'; ctx.fillText(String(o.enHeadline).toUpperCase(),W/2,ty-Math.round(W*0.06)); }
      if(o.arHeadline){ var hp=fitFont(ctx,o.arHeadline,'700','"Aref Ruqaa","Amiri",serif',W*0.82,Math.round(W*0.082)); ctx.font='700 '+hp+'px "Aref Ruqaa","Amiri",serif'; ctx.fillStyle=pal.bg; ctx.direction='rtl'; ctx.fillText(o.arHeadline,W/2,ty); }
      if(o.arSub){ ctx.font='400 '+Math.round(W*0.03)+'px "Amiri",serif'; ctx.fillStyle=pal.bg; ctx.direction='rtl'; ctx.fillText(o.arSub,W/2,ty+Math.round(W*0.06)); }
    }
    return c.toDataURL('image/png');
  };

  /* ---------- 4) Bold colour block ---------- */
  window.renderBoldPost = async function (o) {
    var d=dimOf(o.size,'4:5'), W=d[0], H=d[1], pal=resolvePal(o.palette);
    await fontsReady();
    var img=await loadImg(o.imageDataUrl||o.foodDataUrl), logo=await loadImg(o.logoDataUrl);
    var c=canvas(W,H), ctx=c.getContext('2d');
    var splitY=Math.round(H*0.60);
    ctx.fillStyle=pal.band; ctx.fillRect(0,0,W,splitY);
    if(img){ var s=Math.max(W/img.width,splitY/img.height); ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,splitY); ctx.clip(); ctx.drawImage(img,(W-img.width*s)/2,(splitY-img.height*s)/2,img.width*s,img.height*s); ctx.restore(); }
    ctx.fillStyle=pal.bg; ctx.fillRect(0,splitY,W,H-splitY);
    ctx.fillStyle=pal.gold; ctx.fillRect(0,splitY,W,Math.round(H*0.014));
    var showText=o.showText!==false, pad=Math.round(W*0.07);
    if(showText){
      ctx.textAlign='center'; var ty=splitY+Math.round(W*0.135);
      if(o.arHeadline){ var hp=fitFont(ctx,o.arHeadline,'700','"Aref Ruqaa","Amiri",serif',W*0.86,Math.round(W*0.09)); ctx.font='700 '+hp+'px "Aref Ruqaa","Amiri",serif'; ctx.fillStyle=pal.gold; ctx.direction='rtl'; ctx.fillText(o.arHeadline,W/2,ty); ty+=Math.round(W*0.085); }
      if(o.enHeadline){ ctx.font='700 '+Math.round(W*0.05)+'px "Playfair Display",serif'; ctx.fillStyle=pal.cream; ctx.direction='ltr'; wrapText(ctx,o.enHeadline,W/2,ty,W-pad*2,Math.round(W*0.055),'center'); ty+=Math.round(W*0.055); }
      if(o.arSub){ ctx.font='400 '+Math.round(W*0.03)+'px "Amiri",serif'; ctx.fillStyle=pal.cream; ctx.direction='rtl'; ctx.fillText(o.arSub,W/2,Math.min(H-Math.round(W*0.05),ty+Math.round(W*0.03))); }
    }
    if(logo) medallion(ctx,logo,W-Math.round(W*0.12),splitY-Math.round(W*0.12),Math.round(W*0.075),pal);
    return c.toDataURL('image/png');
  };

  /* ---------- 5) Editorial / magazine cover ---------- */
  window.renderEditorialPost = async function (o) {
    var d=dimOf(o.size,'4:5'), W=d[0], H=d[1], pal=resolvePal(o.palette);
    await fontsReady();
    var img=await loadImg(o.imageDataUrl||o.foodDataUrl), logo=await loadImg(o.logoDataUrl);
    var c=canvas(W,H), ctx=c.getContext('2d');
    ctx.fillStyle='#111'; ctx.fillRect(0,0,W,H);
    if(img){ var s=Math.max(W/img.width,H/img.height); ctx.drawImage(img,(W-img.width*s)/2,(H-img.height*s)/2,img.width*s,img.height*s); }
    var showText=o.showText!==false && (o.arHeadline||o.enHeadline);
    if(showText){
      var g=ctx.createLinearGradient(0,0,0,H*0.5); g.addColorStop(0,'rgba(0,0,0,0.66)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H*0.5);
      var pad=Math.round(W*0.07), y=Math.round(H*0.10);
      ctx.textAlign='left'; ctx.direction='ltr';
      if(o.enHeadline){ ctx.font='600 '+Math.round(W*0.026)+'px "Inter",Arial,sans-serif'; ctx.fillStyle=pal.gold; ctx.fillText(String(o.enHeadline).toUpperCase(),pad,y); y+=Math.round(W*0.02); }
      if(o.arHeadline){ ctx.textAlign='left'; ctx.direction='rtl'; ctx.font='700 '+Math.round(W*0.085)+'px "Aref Ruqaa","Amiri",serif'; ctx.fillStyle=pal.cream; ctx.fillText(o.arHeadline,pad,y+Math.round(W*0.075)); y+=Math.round(W*0.10); }
      ctx.strokeStyle=pal.gold; ctx.lineWidth=Math.max(2,W*0.004); ctx.beginPath(); ctx.moveTo(pad,y+Math.round(W*0.01)); ctx.lineTo(pad+Math.round(W*0.24),y+Math.round(W*0.01)); ctx.stroke();
      if(o.arSub){ ctx.direction='rtl'; ctx.textAlign='left'; ctx.font='400 '+Math.round(W*0.032)+'px "Amiri",serif'; ctx.fillStyle=pal.cream; ctx.fillText(o.arSub,pad,y+Math.round(W*0.055)); }
    }
    if(logo) medallion(ctx,logo,W-Math.round(W*0.13),Math.round(W*0.13),Math.round(W*0.08),{bg:'#1a1a1a',gold:pal.gold});
    return c.toDataURL('image/png');
  };

  /* ---------- palette extraction from a logo (for "Auto from logo") ---------- */
  window.paletteFromImage = function (img) {
    try {
      var s=48, cv=canvas(s,s), ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,s,s);
      var data=ctx.getImageData(0,0,s,s).data, buckets={};
      for(var i=0;i<data.length;i+=4){ if(data[i+3]<128) continue; var R=data[i],G=data[i+1],B=data[i+2];
        if(R>240&&G>240&&B>240) continue; if(R<12&&G<12&&B<12) continue;
        var key=(R>>5)+','+(G>>5)+','+(B>>5); (buckets[key]=buckets[key]||{n:0,r:0,g:0,b:0}); var o=buckets[key]; o.n++; o.r+=R; o.g+=G; o.b+=B; }
      var arr=Object.keys(buckets).map(function(k){var o=buckets[k];return {r:o.r/o.n,g:o.g/o.n,b:o.b/o.n,n:o.n};});
      if(!arr.length) return null;
      function lum(o){return o.r*0.3+o.g*0.59+o.b*0.11;}
      function sat(o){var mx=Math.max(o.r,o.g,o.b),mn=Math.min(o.r,o.g,o.b);return mx?(mx-mn)/mx:0;}
      var byCount=arr.slice().sort(function(a,b){return b.n-a.n;});
      var bg=byCount.slice(0,5).sort(function(a,b){return lum(a)-lum(b);})[0];      // dark, common
      var accent=arr.slice().sort(function(a,b){return (sat(b)*lum(b))-(sat(a)*lum(a));})[0]; // vivid/bright
      function hex(o){return '#'+[o.r,o.g,o.b].map(function(v){return('0'+Math.round(v).toString(16)).slice(-2);}).join('');}
      function shade(o,f){return {r:o.r*f,g:o.g*f,b:o.b*f};}
      return { bg:hex(bg), accent:hex(accent), text:(lum(bg)<140?'#f5ead4':'#20140c'), band:hex(shade(bg,0.7)) };
    } catch(e){ return null; }
  };
})();
