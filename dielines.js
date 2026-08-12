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
  // Full per-panel packaging design: front = artwork, back = info/nutrition,
  // sides = logo + product name. Returns a print-ready SVG (1:1 mm).
  window.buildPackagingArt = function(spec){
    var W=+spec.width_mm||80, H=+spec.height_mm||150, D=+spec.depth_mm||40;
    var g=spec.glue_mm||12, bleed=spec.bleed_mm||3, tuck=Math.min(D,35), dust=D-3, margin=25;
    var reverse = spec.style==='reverse_tuck_end';
    var bodyW=2*W+2*D+g, bodyH=H, totalW=bodyW+margin*2, totalH=bodyH+tuck*2+margin*2;
    var x0=margin, y0=margin+tuck;
    var xBack=x0, xSide1=x0+W, xFront=xSide1+D, xSide2=xFront+W, xGlue=xSide2+D;
    var bg=spec.brandColor||'#6e3a24', tc=spec.textColor||'#f5ead4';
    function isAr(s){return /[؀-ۿ]/.test(s||'');}
    function wrapTxt(s,max){var w=(s||'').split(/\s+/),ln='',out=[];for(var i=0;i<w.length;i++){var t=(ln?ln+' ':'')+w[i];if(t.length>max&&ln){out.push(ln);ln=w[i];}else ln=t;}if(ln)out.push(ln);return out;}
    function t(x,y,s,size,color,anchor,rtl,weight){ if(!s&&s!==0) return ''; return '<text x="'+r(x)+'" y="'+r(y)+'" font-family="Arial,Helvetica,sans-serif" font-size="'+size+'" fill="'+(color||'#222')+'"'+(anchor?' text-anchor="'+anchor+'"':'')+(rtl?' direction="rtl"':'')+(weight?' font-weight="'+weight+'"':'')+'>'+esc(s)+'</text>'; }
    function bgRect(x,w){ return '<rect x="'+r(x)+'" y="'+r(y0)+'" width="'+r(w)+'" height="'+r(bodyH)+'" fill="'+bg+'"/>'; }
    var p=[];
    p.push(rect(x0-bleed,y0-bleed,bodyW+bleed*2,bodyH+bleed*2,BLEED));
    p.push(bgRect(xBack,W)); p.push(bgRect(xSide1,D)); p.push(bgRect(xSide2,D)); p.push(bgRect(xGlue,g));
    // FRONT — the uploaded design, fit to the front panel
    if(spec.frontImg) p.push(panelArt(spec.frontImg, xFront, y0, W, H)); else p.push(bgRect(xFront,W));

    // BACK — editable info card
    var pad=5, bx=xBack+pad, by=y0+pad, bw=W-2*pad;
    p.push('<rect x="'+r(bx)+'" y="'+r(by)+'" width="'+r(bw)+'" height="'+r(bodyH-2*pad)+'" rx="2" fill="#ffffff" opacity="0.94"/>');
    var yy=by+8;
    p.push(t(xBack+W/2, yy, spec.productName||'Product', 5, '#3a2a1a','middle',isAr(spec.productName),'bold')); yy+=8;
    if(spec.ingredients){
      p.push(t(bx+2, yy, isAr(spec.ingredients)?'المكوّنات':'Ingredients', 3.4,'#7a3b24','start',false,'bold')); yy+=5;
      var lines=wrapTxt(spec.ingredients,44);
      for(var i=0;i<lines.length&&i<6;i++){ p.push(t(bx+2, yy, lines[i], 3,'#333','start',isAr(lines[i]))); yy+=4; }
      yy+=3;
    }
    if(spec.nutrition&&spec.nutrition.length){
      p.push(t(bx+2, yy, 'Nutrition / القيمة الغذائية', 3.4,'#7a3b24','start',false,'bold')); yy+=5;
      for(var n=0;n<spec.nutrition.length&&n<7;n++){
        var row=spec.nutrition[n];
        p.push(t(bx+2, yy, row.label, 3,'#333','start',isAr(row.label)));
        p.push(t(bx+bw-2, yy, row.value, 3,'#333','end'));
        p.push('<line x1="'+r(bx+2)+'" y1="'+r(yy+1.2)+'" x2="'+r(bx+bw-2)+'" y2="'+r(yy+1.2)+'" stroke="#dddddd" stroke-width="0.2"/>');
        yy+=4.4;
      }
      yy+=3;
    }
    if(spec.netWeight){ p.push(t(bx+2, yy, (isAr(spec.netWeight)?'':'Net weight: ')+spec.netWeight, 3.4,'#333','start',isAr(spec.netWeight),'bold')); yy+=6; }
    if(spec.barcode){
      var bcy=by+bodyH-2*pad-16, bcx=bx+3, bcw=bw-6;
      p.push('<rect x="'+r(bcx)+'" y="'+r(bcy)+'" width="'+r(bcw)+'" height="11" fill="#ffffff"/>');
      var bxx=bcx+3, seed=1234567;
      while(bxx<bcx+bcw-3){
        seed=(seed*1103515245+12345)&0x7fffffff; var wd=0.28+((seed>>8)%4)*0.12;
        p.push('<rect x="'+r(bxx)+'" y="'+r(bcy+1)+'" width="'+r(wd)+'" height="8" fill="#000000"/>');
        bxx+=wd;
        seed=(seed*1103515245+12345)&0x7fffffff; bxx+=0.25+((seed>>8)%3)*0.12;
      }
    }
    p.push(t(xBack+W/2, y0+bodyH-3, spec.producedIn||'Produced in Kuwait — صنع في الكويت', 2.8,'#7a3b24','middle',true));

    // SIDES — logo + rotated product name
    function fillSide(sx){
      if(spec.logoImg){ p.push('<image href="'+spec.logoImg+'" x="'+r(sx+D*0.12)+'" y="'+r(y0+6)+'" width="'+r(D*0.76)+'" height="'+r(D*0.76)+'" preserveAspectRatio="xMidYMid meet"/>'); }
      var cx=sx+D/2, cy=y0+bodyH*0.58, fs=Math.min(6,D*0.16);
      p.push('<text x="'+r(cx)+'" y="'+r(cy)+'" font-family="Arial,Helvetica,sans-serif" font-size="'+fs+'" fill="'+tc+'" text-anchor="middle" font-weight="bold" transform="rotate(-90 '+r(cx)+' '+r(cy)+')"'+(isAr(spec.productName)?' direction="rtl"':'')+'>'+esc(spec.productName||'')+'</text>');
      p.push(t(cx, y0+bodyH-3, isAr(spec.producedIn)?'الكويت':'KUWAIT', 2.6, tc,'middle'));
    }
    fillSide(xSide1); fillSide(xSide2);
    p.push('<text x="'+r(xGlue+2)+'" y="'+r(y0+bodyH/2)+'" '+LBL+' transform="rotate(90 '+r(xGlue+3)+' '+r(y0+bodyH/2)+')">GLUE</text>');

    // dieline lines on top
    p.push(rect(x0,y0,bodyW,bodyH,CUT));
    [xSide1,xFront,xSide2,xGlue].forEach(function(cx){p.push(line(cx,y0,cx,y0+bodyH,CREASE));});
    var topTuckX=reverse?xBack:xFront;
    p.push(line(topTuckX,y0,topTuckX,y0-tuck,CUT),line(topTuckX,y0-tuck,topTuckX+W,y0-tuck,CUT),line(topTuckX+W,y0-tuck,topTuckX+W,y0,CUT),line(topTuckX,y0,topTuckX+W,y0,CREASE));
    [xSide1,xSide2].forEach(function(sx){p.push(line(sx,y0,sx,y0-dust,CUT),line(sx,y0-dust,sx+D,y0-dust,CUT),line(sx+D,y0-dust,sx+D,y0,CUT),line(sx,y0,sx+D,y0,CREASE));});
    var yb=y0+bodyH, botTuckX=reverse?xFront:xBack;
    p.push(line(botTuckX,yb,botTuckX,yb+tuck,CUT),line(botTuckX,yb+tuck,botTuckX+W,yb+tuck,CUT),line(botTuckX+W,yb+tuck,botTuckX+W,yb,CUT),line(botTuckX,yb,botTuckX+W,yb,CREASE));
    [xSide1,xSide2].forEach(function(sx){p.push(line(sx,yb,sx,yb+dust,CUT),line(sx,yb+dust,sx+D,yb+dust,CUT),line(sx+D,yb+dust,sx+D,yb,CUT),line(sx,yb,sx+D,yb,CREASE));});
    p.push(hDim(xBack,y0+bodyH+tuck+6,W,'W '+W+'mm'),hDim(xSide1,y0+bodyH+tuck+12,D,'D '+D+'mm'));
    p.push('<text x="'+r(x0-8)+'" y="'+r(y0+bodyH/2)+'" '+LBL+' transform="rotate(-90 '+r(x0-8)+' '+r(y0+bodyH/2)+')">H '+H+'mm</text>');

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
