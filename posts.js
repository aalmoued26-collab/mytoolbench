/* posts.js — Heritage Frame marketing-post composer (client-side canvas).
   Sharp gold Sadu borders, Arabic calligraphy + English serif, logo medallion,
   Kuwait seal, and an AI/food hero — composited at high resolution.
   window.renderHeritagePost(opts) -> Promise<dataURL(PNG)>
   opts: {size:'1:1'|'4:5'|'9:16', palette:'navy'|'terracotta',
          logoDataUrl?, foodDataUrl?, arHeadline?, arSub?, enHeadline?,
          showText?:true, showSeal?:true} */
(function () {
  'use strict';

  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function roundRect(x, a, y, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, y); x.arcTo(a + w, y, a + w, y + h, r); x.arcTo(a + w, y + h, a, y + h, r);
    x.arcTo(a, y + h, a, y, r); x.arcTo(a, y, a + w, y, r); x.closePath();
  }
  function cover(ctx, img, dx, dy, dw, dh, r) {
    if (!img) return;
    ctx.save(); roundRect(ctx, dx, dy, dw, dh, r || 0); ctx.clip();
    var s = Math.max(dw / img.width, dh / img.height);
    var w = img.width * s, h = img.height * s;
    ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
    ctx.restore();
  }
  // A clean Sadu-style band: gold rules + a row of diamonds and zigzag.
  function sadu(ctx, x, y, w, h, pal) {
    ctx.save();
    ctx.fillStyle = pal.band; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = pal.gold; ctx.lineWidth = Math.max(2, h * 0.03);
    var m = h * 0.16;
    ctx.beginPath(); ctx.moveTo(x, y + m); ctx.lineTo(x + w, y + m); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + h - m); ctx.lineTo(x + w, y + h - m); ctx.stroke();
    var cy = y + h / 2, dh = h * 0.34, step = h * 0.62;
    ctx.fillStyle = pal.gold;
    for (var cx = x + step / 2; cx < x + w; cx += step) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - dh); ctx.lineTo(cx + dh, cy); ctx.lineTo(cx, cy + dh); ctx.lineTo(cx - dh, cy);
      ctx.closePath(); ctx.fill();
      // small triangles between diamonds
      ctx.beginPath();
      ctx.moveTo(cx + step / 2 - dh * 0.5, cy - dh * 0.5); ctx.lineTo(cx + step / 2 + dh * 0.5, cy - dh * 0.5);
      ctx.lineTo(cx + step / 2, cy + dh * 0.2); ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function medallion(ctx, img, cx, cy, r, pal) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + r * 0.12, 0, 7); ctx.fillStyle = pal.bg; ctx.fill();
    ctx.lineWidth = r * 0.12; ctx.strokeStyle = pal.gold; ctx.stroke();
    if (img) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
      var s = Math.max(2 * r / img.width, 2 * r / img.height);
      ctx.drawImage(img, cx - img.width * s / 2, cy - img.height * s / 2, img.width * s, img.height * s); }
    ctx.restore();
  }
  function seal(ctx, cx, cy, r, pal) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = pal.gold; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, 7); ctx.strokeStyle = pal.bg; ctx.lineWidth = r * 0.05; ctx.stroke();
    // small Kuwait flag
    var fw = r * 0.9, fh = r * 0.5, fx = cx - fw / 2, fy = cy - fh * 0.75, band = fh / 3;
    ctx.fillStyle = '#007a3d'; ctx.fillRect(fx, fy, fw, band);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, fy + band, fw, band);
    ctx.fillStyle = '#ce1126'; ctx.fillRect(fx, fy + 2 * band, fw, band);
    ctx.fillStyle = '#000000'; ctx.beginPath();
    ctx.moveTo(fx, fy); ctx.lineTo(fx + fw * 0.28, fy + band); ctx.lineTo(fx + fw * 0.28, fy + 2 * band); ctx.lineTo(fx, fy + 3 * band); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.bg; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.font = '700 ' + Math.round(r * 0.26) + 'px "Amiri",serif';
    ctx.fillText('صنع في الكويت', cx, cy + r * 0.35);
    ctx.direction = 'ltr'; ctx.font = '700 ' + Math.round(r * 0.16) + 'px Arial';
    ctx.fillText('PRODUCED IN KUWAIT', cx, cy + r * 0.62);
    ctx.restore();
  }
  function fitFont(ctx, text, weight, family, maxW, startPx) {
    var px = startPx;
    do { ctx.font = weight + ' ' + px + 'px ' + family; px -= 2; }
    while (ctx.measureText(text).width > maxW && px > 14);
    return px + 2;
  }

  window.renderHeritagePost = async function (o) {
    var dim = o.size === '4:5' ? [1080, 1350] : o.size === '9:16' ? [1080, 1920] : [1080, 1080];
    var W = dim[0], H = dim[1];
    var pal = o.palette === 'terracotta'
      ? { bg: '#6e3a24', gold: '#e6c07a', cream: '#f5ead4', band: '#552b1a' }
      : { bg: '#10233f', gold: '#d9b667', cream: '#f0e6cf', band: '#0b1a2e' };

    try {
      await document.fonts.load('700 80px "Aref Ruqaa"');
      await document.fonts.load('400 40px "Amiri"');
      await document.fonts.load('700 40px "Amiri"');
      await document.fonts.load('600 48px "Playfair Display"');
      await document.fonts.ready;
    } catch (e) {}

    var logoImg = await loadImg(o.logoDataUrl);
    var foodImg = await loadImg(o.foodDataUrl);

    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);

    var band = Math.round(W * 0.11);
    sadu(ctx, 0, 0, W, band, pal);
    sadu(ctx, 0, H - band, W, band, pal);

    var showText = o.showText !== false;
    var contentTop = showText ? Math.round(W * 0.40) : band + Math.round(W * 0.03);
    var fx = Math.round(W * 0.09), fw = W - 2 * fx;
    var foodBottom = H - band - Math.round(W * 0.03);
    if (foodImg) cover(ctx, foodImg, fx, contentTop, fw, foodBottom - contentTop, Math.round(W * 0.03));
    else { ctx.fillStyle = pal.band; roundRect(ctx, fx, contentTop, fw, foodBottom - contentTop, Math.round(W * 0.03)); ctx.fill(); }

    if (showText) {
      ctx.textAlign = 'center';
      var yh = band + Math.round(W * 0.17);
      if (o.arHeadline) {
        var hp = fitFont(ctx, o.arHeadline, '700', '"Aref Ruqaa","Amiri",serif', W * 0.82, Math.round(W * 0.085));
        ctx.font = '700 ' + hp + 'px "Aref Ruqaa","Amiri",serif';
        ctx.fillStyle = pal.gold; ctx.direction = 'rtl';
        ctx.fillText(o.arHeadline, W / 2, yh);
      }
      if (o.arSub) {
        ctx.font = '700 ' + Math.round(W * 0.036) + 'px "Amiri",serif';
        ctx.fillStyle = pal.cream; ctx.direction = 'rtl';
        ctx.fillText(o.arSub, W / 2, band + Math.round(W * 0.25));
      }
      if (o.enHeadline) {
        ctx.font = '600 ' + Math.round(W * 0.038) + 'px "Playfair Display",serif';
        ctx.fillStyle = pal.gold; ctx.direction = 'ltr';
        ctx.fillText(o.enHeadline, W / 2, band + Math.round(W * 0.32));
      }
    }

    if (logoImg) medallion(ctx, logoImg, W / 2, band * 0.52, Math.round(W * 0.075), pal);
    if (o.showSeal !== false) seal(ctx, W - Math.round(W * 0.135), foodBottom - Math.round(W * 0.10), Math.round(W * 0.075), pal);

    return c.toDataURL('image/png');
  };

  // ---- Cinematic / luxury full-bleed post (image fills frame, text overlaid) ----
  window.renderCinematicPost = async function (o) {
    var dim = o.size === '1:1' ? [1080, 1080] : o.size === '9:16' ? [1080, 1920] : [1080, 1350];
    var W = dim[0], H = dim[1];
    var pal = o.palette === 'terracotta'
      ? { gold: '#f0cf8f', cream: '#f7eeda' } : { gold: '#e9c877', cream: '#f3ead6' };
    try {
      await document.fonts.load('700 80px "Aref Ruqaa"');
      await document.fonts.load('600 60px "Playfair Display"');
      await document.fonts.ready;
    } catch (e) {}
    var img = await loadImg(o.imageDataUrl);
    var logo = await loadImg(o.logoDataUrl);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
    if (img) {
      var s = Math.max(W / img.width, H / img.height);
      ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    }
    var showText = o.showText !== false && (o.arHeadline || o.enHeadline);
    if (showText) {
      var g = ctx.createLinearGradient(0, H * 0.45, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
      ctx.textAlign = 'left';
      var pad = Math.round(W * 0.07), y = H - Math.round(W * 0.10);
      if (o.enHeadline) {
        ctx.font = '600 ' + Math.round(W * 0.062) + 'px "Playfair Display",serif';
        ctx.fillStyle = pal.cream; ctx.direction = 'ltr';
        wrapText(ctx, o.enHeadline, pad, y, W - pad * 2, Math.round(W * 0.07));
      }
      if (o.arHeadline) {
        ctx.font = '700 ' + Math.round(W * 0.075) + 'px "Aref Ruqaa","Amiri",serif';
        ctx.fillStyle = pal.gold; ctx.direction = 'rtl'; ctx.textAlign = 'right';
        ctx.fillText(o.arHeadline, W - pad, o.enHeadline ? y - Math.round(W * 0.16) : y);
        ctx.textAlign = 'left';
      }
    }
    if (logo) medallion(ctx, logo, W - Math.round(W * 0.13), Math.round(W * 0.13), Math.round(W * 0.085), { bg: '#1a1a1a', gold: pal.gold });
    return c.toDataURL('image/png');
  };
  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = text.split(' '), line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var t = line + words[i] + ' ';
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = words[i] + ' '; } else line = t;
    }
    lines.push(line);
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j].trim(), x, y - (lines.length - 1 - j) * lh);
  }
})();
