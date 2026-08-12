/* dielines.js — parametric packaging dielines, drawn in the browser.
   Deterministic geometry to real millimetres (1 SVG unit = 1 mm). Free, instant.
   window.buildDieline({style,width_mm,depth_mm,height_mm,glue_mm,bleed_mm,material,title})
   Styles: straight_tuck_end, reverse_tuck_end, sleeve, pillow_box. */
(function () {
  'use strict';
  var CUT = 'stroke="#e6007e" stroke-width="0.5" fill="none"';
  var CREASE = 'stroke="#0057ff" stroke-width="0.4" stroke-dasharray="3 2" fill="none"';
  var BLEED = 'stroke="#bbbbbb" stroke-width="0.3" stroke-dasharray="1 1" fill="none"';
  var DIM = 'stroke="#888888" stroke-width="0.25" fill="none"';
  var LBL = 'font-family="Helvetica,Arial,sans-serif" font-size="4" fill="#333333"';
  function r(n){return Math.round(n*100)/100;}
  function esc(s){return String(s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c];});}
  function line(x1,y1,x2,y2,s){return '<line x1="'+r(x1)+'" y1="'+r(y1)+'" x2="'+r(x2)+'" y2="'+r(y2)+'" '+s+'/>';}
  function rect(x,y,w,h,s){return '<rect x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+'" height="'+r(h)+'" '+s+'/>';}
  function text(x,y,str,extra){return '<text x="'+r(x)+'" y="'+r(y)+'" '+LBL+(extra?' '+extra:'')+'>'+esc(str)+'</text>';}
  function hDim(x,y,w,label){return line(x,y,x+w,y,DIM)+line(x,y-1.5,x,y+1.5,DIM)+line(x+w,y-1.5,x+w,y+1.5,DIM)+text(x+w/2-label.length*1.1,y-1.2,label);}
  var _clip=0;
  function panelArt(art,x,y,w,h){
    var id='cp'+(_clip++);
    return '<clipPath id="'+id+'"><rect x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+'" height="'+r(h)+'"/></clipPath>'+
      '<image href="'+art+'" x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+'" height="'+r(h)+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+id+')"/>';
  }

  function tuckEnd(spec, reverse){
    var W=spec.width_mm, H=spec.height_mm, D=spec.depth_mm;
    var g=spec.glue_mm||12, bleed=spec.bleed_mm||3, tuck=Math.min(D,35), dust=D-3, margin=25;
    var bodyW=2*W+2*D+g, bodyH=H, totalW=bodyW+margin*2, totalH=bodyH+tuck*2+margin*2;
    var x0=margin, y0=margin+tuck;
    var xBack=x0, xSide1=x0+W, xFront=xSide1+D, xSide2=xFront+W, xGlue=xSide2+D;
    var p=[];
    p.push(rect(x0-bleed,y0-bleed,bodyW+bleed*2,bodyH+bleed*2,BLEED));
    if(spec.artwork){
      p.push('<defs></defs>');
      p.push(panelArt(spec.artwork,xFront,y0,W,bodyH));
      p.push(panelArt(spec.artwork,xBack,y0,W,bodyH));
      p.push(panelArt(spec.artwork,xSide1,y0,D,bodyH));
      p.push(panelArt(spec.artwork,xSide2,y0,D,bodyH));
    }
    p.push(rect(x0,y0,bodyW,bodyH,CUT));
    [xSide1,xFront,xSide2,xGlue].forEach(function(cx){p.push(line(cx,y0,cx,y0+bodyH,CREASE));});
    var topTuckX=reverse?xBack:xFront;
    p.push(line(topTuckX,y0,topTuckX,y0-tuck,CUT),line(topTuckX,y0-tuck,topTuckX+W,y0-tuck,CUT),line(topTuckX+W,y0-tuck,topTuckX+W,y0,CUT),line(topTuckX,y0,topTuckX+W,y0,CREASE));
    [xSide1,xSide2].forEach(function(sx){p.push(line(sx,y0,sx,y0-dust,CUT),line(sx,y0-dust,sx+D,y0-dust,CUT),line(sx+D,y0-dust,sx+D,y0,CUT),line(sx,y0,sx+D,y0,CREASE));});
    var yb=y0+bodyH, botTuckX=reverse?xFront:xBack;
    p.push(line(botTuckX,yb,botTuckX,yb+tuck,CUT),line(botTuckX,yb+tuck,botTuckX+W,yb+tuck,CUT),line(botTuckX+W,yb+tuck,botTuckX+W,yb,CUT),line(botTuckX,yb,botTuckX+W,yb,CREASE));
    [xSide1,xSide2].forEach(function(sx){p.push(line(sx,yb,sx,yb+dust,CUT),line(sx,yb+dust,sx+D,yb+dust,CUT),line(sx+D,yb+dust,sx+D,yb,CUT),line(sx,yb,sx+D,yb,CREASE));});
    if(!spec.artwork){ p.push(text(xBack+W/2-6,y0+bodyH/2,'BACK'),text(xSide1+D/2-6,y0+bodyH/2,'SIDE'),text(xFront+W/2-7,y0+bodyH/2,'FRONT'),text(xSide2+D/2-6,y0+bodyH/2,'SIDE')); }
    p.push('<text x="'+r(xGlue+1)+'" y="'+r(y0+bodyH/2)+'" '+LBL+' transform="rotate(90 '+r(xGlue+3)+' '+r(y0+bodyH/2)+')">GLUE</text>');
    p.push(hDim(xBack,y0+bodyH+tuck+6,W,'W '+W+'mm'),hDim(xSide1,y0+bodyH+tuck+12,D,'D '+D+'mm'));
    p.push('<text x="'+r(x0-8)+'" y="'+r(y0+bodyH/2)+'" '+LBL+' transform="rotate(-90 '+r(x0-8)+' '+r(y0+bodyH/2)+')">H '+H+'mm</text>');
    return wrap(totalW,totalH,spec,p.join(''));
  }
  function sleeve(spec){
    var W=spec.width_mm,H=spec.height_mm,D=spec.depth_mm,g=spec.glue_mm||12,bleed=spec.bleed_mm||3,margin=25;
    var bodyW=2*W+2*D+g,bodyH=H,totalW=bodyW+margin*2,totalH=bodyH+margin*2,x0=margin,y0=margin,p=[];
    p.push(rect(x0-bleed,y0-bleed,bodyW+bleed*2,bodyH+bleed*2,BLEED),rect(x0,y0,bodyW,bodyH,CUT));
    [x0+W,x0+W+D,x0+2*W+D,x0+2*W+2*D].forEach(function(cx){p.push(line(cx,y0,cx,y0+bodyH,CREASE));});
    p.push(text(x0+W/2-7,y0+bodyH/2,'FRONT'),hDim(x0,y0+bodyH+6,W,'W '+W+'mm'),hDim(x0+W,y0+bodyH+12,D,'D '+D+'mm'));
    return wrap(totalW,totalH,spec,p.join(''));
  }
  function pillow(spec){
    var W=spec.width_mm,H=spec.height_mm,g=spec.glue_mm||12,bleed=spec.bleed_mm||3,margin=25,curve=H*0.18;
    var bodyW=2*W+g,bodyH=H,totalW=bodyW+margin*2,totalH=bodyH+curve*2+margin*2,x0=margin,y0=margin+curve,p=[];
    p.push(rect(x0-bleed,y0-bleed,bodyW+bleed*2,bodyH+bleed*2,BLEED),rect(x0,y0,bodyW,bodyH,CUT));
    p.push(line(x0+W,y0,x0+W,y0+bodyH,CREASE),line(x0+2*W,y0,x0+2*W,y0+bodyH,CREASE));
    [x0,x0+W].forEach(function(px){
      p.push('<path d="M '+r(px)+' '+r(y0)+' Q '+r(px+W/2)+' '+r(y0-curve)+' '+r(px+W)+' '+r(y0)+'" '+CUT+'/>');
      p.push('<path d="M '+r(px)+' '+r(y0+bodyH)+' Q '+r(px+W/2)+' '+r(y0+bodyH+curve)+' '+r(px+W)+' '+r(y0+bodyH)+'" '+CUT+'/>');
    });
    p.push(text(x0+W/2-7,y0+bodyH/2,'FRONT'),hDim(x0,y0+bodyH+curve+6,W,'W '+W+'mm'));
    return wrap(totalW,totalH,spec,p.join(''));
  }
  function wrap(totalW,totalH,spec,inner){
    var title=spec.title||(spec.style+' dieline');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+
      '<svg xmlns="http://www.w3.org/2000/svg" width="'+r(totalW)+'mm" height="'+r(totalH)+'mm" viewBox="0 0 '+r(totalW)+' '+r(totalH)+'">'+
      '<title>'+esc(title)+'</title>'+
      '<rect x="0" y="0" width="'+r(totalW)+'" height="'+r(totalH)+'" fill="#ffffff"/>'+inner+
      '<text x="6" y="'+r(totalH-12)+'" font-family="Helvetica,Arial,sans-serif" font-size="4.5" fill="#333333">'+esc(title)+' — '+spec.width_mm+'×'+spec.depth_mm+'×'+spec.height_mm+'mm'+(spec.material?' — '+esc(spec.material):'')+'</text>'+
      '<text x="6" y="'+r(totalH-6)+'" font-family="Helvetica,Arial,sans-serif" font-size="3.5" fill="#888888">CUT = magenta solid · CREASE = blue dashed · BLEED 3mm = grey · scale 1:1 (mm)</text>'+
      '</svg>';
  }
  // Full per-panel packaging design — ALL SIX panels (front, back, two sides,
  // top flap, bottom flap), with professional demo content auto-filled when a
  // field is left blank. Returns a print-ready SVG (1:1 mm).
  window.buildPackagingArt = function(spec){
    var W=+spec.width_mm||80, H=+spec.height_mm||150, D=+spec.depth_mm||40;
    var g=spec.glue_mm||12, bleed=spec.bleed_mm||3, tuck=Math.min(D,35), dust=D-3, margin=25;
    var reverse = spec.style==='reverse_tuck_end';
    var bodyW=2*W+2*D+g, bodyH=H, totalW=bodyW+margin*2, totalH=bodyH+tuck*2+margin*2;
    var x0=margin, y0=margin+tuck;
    var xBack=x0, xSide1=x0+W, xFront=xSide1+D, xSide2=xFront+W, xGlue=xSide2+D;
    function lum(hex){hex=(hex||'').replace('#','');if(hex.length<6)return 255;var n=parseInt(hex,16);return (n>>16&255)*0.3+(n>>8&255)*0.59+(n&255)*0.11;}
    var bg=spec.brandColor||'#20130c';
    var tc=spec.textColor||(lum(bg)<140?'#f5ead4':'#2a1c10');
    var accent=spec.accentColor||(lum(bg)<150?'#c8a24a':'#8a5a2a');
    function isAr(s){return /[؀-ۿ]/.test(s||'');}
    function wrapTxt(s,max){var w=String(s||'').split(/\s+/),ln='',out=[];for(var i=0;i<w.length;i++){var tt=(ln?ln+' ':'')+w[i];if(tt.length>max&&ln){out.push(ln);ln=w[i];}else ln=tt;}if(ln)out.push(ln);return out;}
    function paras(s,max,maxLines){var out=[];String(s||'').split(/\n/).forEach(function(ln){wrapTxt(ln,max).forEach(function(w){out.push(w);});});return out.slice(0,maxLines);}
    function t(x,y,s,size,color,anchor,rtl,weight){ if(!s&&s!==0) return ''; return '<text x="'+r(x)+'" y="'+r(y)+'" font-family="Arial,Helvetica,sans-serif" font-size="'+size+'" fill="'+(color||'#222')+'"'+(anchor?' text-anchor="'+anchor+'"':'')+(rtl?' direction="rtl"':'')+(weight?' font-weight="'+weight+'"':'')+'>'+esc(s)+'</text>'; }
    function bgRect(x,w){ return '<rect x="'+r(x)+'" y="'+r(y0)+'" width="'+r(w)+'" height="'+r(bodyH)+'" fill="'+bg+'"/>'; }
    function barcode(bx,by,bw,bh){
      var out='<rect x="'+r(bx)+'" y="'+r(by)+'" width="'+r(bw)+'" height="'+r(bh)+'" fill="#ffffff"/>';
      var xx=bx+3, seed=1234567, end=bx+bw-3;
      while(xx<end){ seed=(seed*1103515245+12345)&0x7fffffff; var wd=0.3+((seed>>8)%4)*0.14;
        out+='<rect x="'+r(xx)+'" y="'+r(by+1.4)+'" width="'+r(wd)+'" height="'+r(bh-3.6)+'" fill="#000"/>'; xx+=wd;
        seed=(seed*1103515245+12345)&0x7fffffff; xx+=0.28+((seed>>8)%3)*0.14; }
      out+=t(bx+bw/2, by+bh-0.4,'6 291000 000000',1.9,'#000','middle');
      return out;
    }

    /* ---- demo fallbacks so every panel reads as a finished pack ---- */
    var name = spec.productName || 'Product Name';
    var netWeight = spec.netWeight || '220 g';
    var ingredients = spec.ingredients || 'Wheat flour, water, filling (chicken 22%, onion, coriander, mixed spices), sunflower oil, salt, yeast.';
    var nutrition = (spec.nutrition&&spec.nutrition.length)?spec.nutrition:
      [['Energy','250 kcal'],['Fat','12 g'],['  of which saturates','4.5 g'],['Carbohydrate','28 g'],['  of which sugars','2 g'],['Protein','7 g'],['Salt','0.8 g']].map(function(a){return {label:a[0],value:a[1]};});
    var instructions = spec.instructions || 'Oven: bake from frozen at 200°C for 12–15 min until golden.\nAir-fryer: 180°C for 8–10 min.';
    var storage = spec.storage || 'Keep frozen at −18°C. Do not refreeze once thawed.';
    var allergens = spec.allergens || 'Contains: gluten. May contain: celery, sesame.';
    var bestBefore = spec.bestBefore || 'Best before: printed on top flap · Batch: L-000';
    var website = spec.website || 'www.brand.com · +965 0000 0000';
    var showBarcode = spec.barcode!==false;

    var p=[];
    p.push(rect(x0-bleed,y0-bleed,bodyW+bleed*2,bodyH+bleed*2,BLEED));
    p.push(bgRect(xBack,W)); p.push(bgRect(xSide1,D)); p.push(bgRect(xSide2,D)); p.push(bgRect(xGlue,g));

    /* ---- FRONT ---- */
    if(spec.frontImg){ p.push(panelArt(spec.frontImg, xFront, y0, W, H)); }
    else {
      p.push(bgRect(xFront,W));
      var fcx=xFront+W/2;
      p.push('<rect x="'+r(xFront+4)+'" y="'+r(y0+4)+'" width="'+r(W-8)+'" height="'+r(H-8)+'" rx="3" fill="none" stroke="'+accent+'" stroke-width="0.7"/>');
      if(spec.logoImg){ p.push('<image href="'+spec.logoImg+'" x="'+r(fcx-W*0.30)+'" y="'+r(y0+H*0.09)+'" width="'+r(W*0.60)+'" height="'+r(W*0.60)+'" preserveAspectRatio="xMidYMid meet"/>'); }
      p.push(t(fcx, y0+H*0.56, name, 8, tc,'middle',isAr(name),'bold'));
      p.push('<rect x="'+r(xFront+W*0.17)+'" y="'+r(y0+H*0.60)+'" width="'+r(W*0.66)+'" height="'+r(H*0.22)+'" rx="2" fill="#ffffff" opacity="0.12" stroke="'+accent+'" stroke-width="0.4" stroke-dasharray="2 2"/>');
      p.push(t(fcx, y0+H*0.72, 'YOUR PRODUCT PHOTO', 3.2, tc,'middle'));
      p.push(t(fcx, y0+H*0.90, netWeight, 4.4, accent,'middle',false,'bold'));
    }

    /* ---- BACK — full info panel ---- */
    var pad=4, bx=xBack+pad, by=y0+pad, bw=W-2*pad;
    p.push('<rect x="'+r(bx)+'" y="'+r(by)+'" width="'+r(bw)+'" height="'+r(bodyH-2*pad)+'" rx="2" fill="#fffdf8" opacity="0.97"/>');
    var yy=by+7;
    p.push(t(xBack+W/2, yy, name, 4.8, '#2a1c10','middle',isAr(name),'bold')); yy+=3.4;
    p.push(t(xBack+W/2, yy, 'Net weight '+netWeight, 3, '#666','middle')); yy+=5;
    function section(title){ p.push('<rect x="'+r(bx+1.5)+'" y="'+r(yy-3.1)+'" width="'+r(bw-3)+'" height="4.4" rx="0.6" fill="'+bg+'"/>'); p.push(t(bx+3, yy, title, 2.9, tc,'start',isAr(title),'bold')); yy+=5.8; }
    section('Ingredients · المكوّنات');
    paras(ingredients,52,5).forEach(function(l){ p.push(t(bx+3, yy, l, 2.6,'#333','start',isAr(l))); yy+=3.3; });
    p.push(t(bx+3, yy+0.5, allergens, 2.6,'#8a2b2b','start',isAr(allergens),'bold')); yy+=5.5;
    section('Nutrition · القيمة الغذائية (per 100 g)');
    nutrition.slice(0,8).forEach(function(row){
      p.push(t(bx+3, yy, row.label, 2.6,'#333','start',isAr(row.label)));
      p.push(t(bx+bw-3, yy, row.value, 2.6,'#333','end'));
      p.push('<line x1="'+r(bx+3)+'" y1="'+r(yy+1)+'" x2="'+r(bx+bw-3)+'" y2="'+r(yy+1)+'" stroke="#e5ddca" stroke-width="0.2"/>'); yy+=3.5;
    });
    yy+=2.5;
    section('Preparation & storage · التحضير');
    paras(instructions,54,3).forEach(function(l){ p.push(t(bx+3, yy, l, 2.6,'#333','start',isAr(l))); yy+=3.3; });
    paras(storage,54,2).forEach(function(l){ p.push(t(bx+3, yy, l, 2.6,'#333','start',isAr(l))); yy+=3.3; });
    if(showBarcode){ p.push(barcode(bx+bw-30, by+bodyH-2*pad-15, 27, 12)); }
    p.push(t(bx+3, by+bodyH-2*pad-9, bestBefore, 2.4,'#555','start',isAr(bestBefore)));
    p.push(t(bx+3, by+bodyH-2*pad-4.5, website, 2.5,'#7a3b24','start',false,'bold'));
    p.push(t(xBack+W/2, y0+bodyH-2, spec.producedIn||'Produced in Kuwait — صنع في الكويت', 2.5,tc,'middle',true));

    /* ---- SIDES ---- */
    function fillSide(sx){
      if(spec.logoImg){ p.push('<image href="'+spec.logoImg+'" x="'+r(sx+D*0.15)+'" y="'+r(y0+5)+'" width="'+r(D*0.70)+'" height="'+r(D*0.70)+'" preserveAspectRatio="xMidYMid meet"/>'); }
      var cx=sx+D/2, cy=y0+bodyH*0.56, fs=Math.min(5.5,D*0.15);
      p.push('<text x="'+r(cx)+'" y="'+r(cy)+'" font-family="Arial,Helvetica,sans-serif" font-size="'+fs+'" fill="'+tc+'" text-anchor="middle" font-weight="bold" transform="rotate(-90 '+r(cx)+' '+r(cy)+')"'+(isAr(name)?' direction="rtl"':'')+'>'+esc(name)+'</text>');
      p.push(t(cx, y0+bodyH-3, netWeight, 2.6, tc,'middle'));
    }
    fillSide(xSide1); fillSide(xSide2);
    p.push('<text x="'+r(xGlue+2)+'" y="'+r(y0+bodyH/2)+'" '+LBL+' transform="rotate(90 '+r(xGlue+3)+' '+r(y0+bodyH/2)+')">GLUE</text>');

    /* ---- TOP flap (the top of the box) ---- */
    var topTuckX=reverse?xBack:xFront;
    p.push('<rect x="'+r(topTuckX)+'" y="'+r(y0-tuck)+'" width="'+r(W)+'" height="'+r(tuck)+'" fill="'+bg+'"/>');
    if(spec.logoImg) p.push('<image href="'+spec.logoImg+'" x="'+r(topTuckX+W/2-tuck*0.30)+'" y="'+r(y0-tuck+2)+'" width="'+r(tuck*0.60)+'" height="'+r(tuck*0.60)+'" preserveAspectRatio="xMidYMid meet"/>');
    p.push(t(topTuckX+W/2, y0-2.5, name, 3.4, tc,'middle',isAr(name),'bold'));

    /* ---- BOTTOM flap (the bottom of the box) ---- */
    var yb=y0+bodyH, botTuckX=reverse?xFront:xBack;
    p.push('<rect x="'+r(botTuckX)+'" y="'+r(yb)+'" width="'+r(W)+'" height="'+r(tuck)+'" fill="'+bg+'"/>');
    p.push(t(botTuckX+W/2, yb+5, name, 3, tc,'middle',isAr(name),'bold'));
    p.push(t(botTuckX+W/2, yb+9, bestBefore, 2.3, tc,'middle',isAr(bestBefore)));
    if(showBarcode && tuck>=20) p.push(barcode(botTuckX+W/2-14, yb+11.5, 28, Math.min(tuck-13,9)));

    /* ---- dieline lines on top ---- */
    p.push(rect(x0,y0,bodyW,bodyH,CUT));
    [xSide1,xFront,xSide2,xGlue].forEach(function(cx){p.push(line(cx,y0,cx,y0+bodyH,CREASE));});
    p.push(line(topTuckX,y0,topTuckX,y0-tuck,CUT),line(topTuckX,y0-tuck,topTuckX+W,y0-tuck,CUT),line(topTuckX+W,y0-tuck,topTuckX+W,y0,CUT),line(topTuckX,y0,topTuckX+W,y0,CREASE));
    [xSide1,xSide2].forEach(function(sx){p.push(line(sx,y0,sx,y0-dust,CUT),line(sx,y0-dust,sx+D,y0-dust,CUT),line(sx+D,y0-dust,sx+D,y0,CUT),line(sx,y0,sx+D,y0,CREASE));});
    p.push(line(botTuckX,yb,botTuckX,yb+tuck,CUT),line(botTuckX,yb+tuck,botTuckX+W,yb+tuck,CUT),line(botTuckX+W,yb+tuck,botTuckX+W,yb,CUT),line(botTuckX,yb,botTuckX+W,yb,CREASE));
    [xSide1,xSide2].forEach(function(sx){p.push(line(sx,yb,sx,yb+dust,CUT),line(sx,yb+dust,sx+D,yb+dust,CUT),line(sx+D,yb+dust,sx+D,yb,CUT),line(sx,yb,sx+D,yb,CREASE));});
    p.push(hDim(xBack,y0+bodyH+tuck+6,W,'W '+W+'mm'),hDim(xSide1,y0+bodyH+tuck+12,D,'D '+D+'mm'));
    p.push('<text x="'+r(x0-8)+'" y="'+r(y0+bodyH/2)+'" '+LBL+' transform="rotate(-90 '+r(x0-8)+' '+r(y0+bodyH/2)+')">H '+H+'mm</text>');
    [['BACK',xBack,W],['SIDE',xSide1,D],['FRONT',xFront,W],['SIDE',xSide2,D]].forEach(function(a){ p.push(t(a[1]+a[2]/2, y0-tuck-2, a[0], 3,'#aaa','middle')); });

    return wrap(totalW,totalH,{style:spec.style||'straight_tuck_end',width_mm:W,depth_mm:D,height_mm:H,material:spec.material,title:spec.title||'Packaging design'}, p.join(''));
  };

  window.buildDieline = function(spec){
    switch(spec.style){
      case 'reverse_tuck_end': return tuckEnd(spec,true);
      case 'sleeve': return sleeve(spec);
      case 'pillow_box': return pillow(spec);
      default: return tuckEnd(spec,false);
    }
  };
  /* Extract a small brand palette from an <img> element (client-side, free). */
  window.extractPalette = function(img, k){
    k=k||5;
    var c=document.createElement('canvas'), s=64;
    c.width=s; c.height=s;
    var ctx=c.getContext('2d');
    ctx.drawImage(img,0,0,s,s);
    var d=ctx.getImageData(0,0,s,s).data, buckets={};
    for(var i=0;i<d.length;i+=4){
      if(d[i+3]<128) continue;
      var R=Math.round(d[i]/32)*32, G=Math.round(d[i+1]/32)*32, B=Math.round(d[i+2]/32)*32;
      var key=R+','+G+','+B; buckets[key]=(buckets[key]||0)+1;
    }
    var arr=Object.keys(buckets).map(function(key){return {key:key,n:buckets[key]};}).sort(function(a,b){return b.n-a.n;});
    function hex(key){return '#'+key.split(',').map(function(v){return ('0'+Math.min(255,parseInt(v,10)).toString(16)).slice(-2);}).join('');}
    return arr.slice(0,k).map(function(o){return hex(o.key);});
  };
})();
