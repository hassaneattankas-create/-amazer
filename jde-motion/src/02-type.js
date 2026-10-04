/* ============================================================================
 *  02 — TYPOGRAPHIE ANIMEE  (KIT.md §3)
 *  Toutes les fonctions prennent le temps absolu `t` et des bornes de beat.
 * ========================================================================== */

/** Chasse d'une chaine avec tracking applique lettre par lettre. */
function trackedWidth(text, tracking) {
  var chars = Array.from(text), tot = 0;
  for (var i = 0; i < chars.length; i++) tot += ctx.measureText(chars[i]).width + tracking;
  return chars.length ? tot - tracking : 0;
}
function drawTracked(text, x, y, tracking, align) {
  var chars = Array.from(text);
  var tot = trackedWidth(text, tracking);
  var cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  for (var i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += ctx.measureText(chars[i]).width + tracking;
  }
  return tot;
}

/**
 * titleAt — titre dont les lettres montent sous un masque horizontal.
 * Stagger « Layered Time » de `step` secondes par lettre (defaut 0.05 s).
 * opts : {tracking, weight, color, align, step, easeIn, outT0, outDur, shadow,
 *         alpha, scale}
 */
function titleAt(text, x, y, size, t, t0, dur, opts) {
  opts = opts || {};
  var tracking = opts.tracking === undefined ? -size * 0.015 : opts.tracking;
  var weight   = opts.weight || 900;
  var color    = opts.color || C.WHITE;
  var align    = opts.align || 'center';
  var step     = opts.step === undefined ? 0.05 : opts.step;
  var easeIn   = opts.easeIn || 'easeOutQuint';
  var outT0    = opts.outT0, outDur = opts.outDur || 0.42;
  var gAlpha   = opts.alpha === undefined ? 1 : opts.alpha;

  ctx.font = FT.display(size, weight);
  var chars = Array.from(text);
  var tot = trackedWidth(text, tracking);
  var startX = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  var bandTop = y - size * 1.12, bandH = size * 1.50;

  if (t < t0 - 0.001) return { width: tot, left: startX, right: startX + tot, cx: startX + tot / 2 };

  layer(function () {
    ctx.beginPath();
    ctx.rect(startX - size * 0.30, bandTop, tot + size * 0.60, bandH);
    ctx.clip();
    ctx.font = FT.display(size, weight);
    ctx.textBaseline = 'alphabetic';
    if (opts.shadow !== false) softShadow('#00070F', size * 0.34, size * 0.10, 0.46);
    var cx = startX, vis = 0;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], wch = ctx.measureText(ch).width;
      if (ch !== ' ') {
        var p = seg(t, t0 + vis * step, dur, easeIn);
        var o = outT0 !== undefined ? seg(t, outT0 + vis * step * 0.55, outDur, 'easeInCubic') : 0;
        if (p > 0.0005 && o < 0.9995) {
          var dy = (1 - p) * size * 1.22 - size * 1.40 * o;
          ctx.globalAlpha = Math.min(1, p * 1.3) * (1 - o) * gAlpha;
          ctx.fillStyle = color;
          ctx.fillText(ch, cx, y + dy);
        }
        vis++;
      }
      cx += wch + tracking;
    }
  });
  return { width: tot, left: startX, right: startX + tot, cx: startX + tot / 2 };
}

/** Mot-cle cinetique : entree clip-up, maintien, sortie backIn vers le haut. */
function kineticWord(text, x, y, size, t, t0, holdDur, opts) {
  opts = opts || {};
  var o = {};
  for (var k in opts) o[k] = opts[k];
  o.outT0 = t0 + holdDur;
  o.outDur = opts.outDur || 0.38;
  o.step = opts.step === undefined ? 0.045 : opts.step;
  return titleAt(text, x, y, size, t, t0, opts.dur || 0.46, o);
}

/** Micro-label capitales a tracking large. */
function labelTrack(text, x, y, size, t, t0, opts) {
  opts = opts || {};
  var p = seg(t, t0, opts.dur || 0.5, opts.easeIn || 'easeOutCubic');
  var o = opts.outT0 !== undefined ? seg(t, opts.outT0, opts.outDur || 0.35, 'easeInCubic') : 0;
  if (p <= 0.001 || o >= 0.999) return;
  layer(function () {
    ctx.font = FT.ui(size, opts.weight || 600);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = p * (1 - o) * (opts.alpha === undefined ? 1 : opts.alpha);
    ctx.fillStyle = opts.color || C.ORANGE;
    if (opts.shadow) softShadow('#00070F', size * 0.8, size * 0.2, 0.5);
    ctx.translate(0, (1 - p) * size * 0.8);
    drawTracked(text, x, y, size * (opts.tracking === undefined ? 0.17 : opts.tracking), opts.align || 'center');
  });
}

/** Ligne de corps de texte : fade + rise. */
function bodyLine(text, x, y, size, t, t0, opts) {
  opts = opts || {};
  var p = seg(t, t0, opts.dur || 0.55, opts.easeIn || 'easeOutCubic');
  var o = opts.outT0 !== undefined ? seg(t, opts.outT0, opts.outDur || 0.35, 'easeInCubic') : 0;
  if (p <= 0.001 || o >= 0.999) return;
  layer(function () {
    ctx.font = opts.font || FT.ui(size, opts.weight || 500);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = opts.align || 'center';
    ctx.globalAlpha = p * (1 - o) * (opts.alpha === undefined ? 1 : opts.alpha);
    ctx.fillStyle = opts.color || C.WHITE;
    if (opts.shadow !== false) softShadow('#00070F', size * 0.55, size * 0.14, 0.45);
    ctx.fillText(text, x, y + (1 - p) * size * 0.62 - o * size * 0.45);
  });
}

/** Filet d'accent anime en scaleX. */
function accentRule(x, y, w, h, t, t0, opts) {
  opts = opts || {};
  var p = seg(t, t0, opts.dur || 0.5, opts.easeIn || 'easeOutCubic');
  var o = opts.outT0 !== undefined ? seg(t, opts.outT0, opts.outDur || 0.3, 'easeInCubic') : 0;
  if (p <= 0.001 || o >= 0.999) return;
  var origin = opts.origin || 'center';
  layer(function () {
    ctx.globalAlpha = (1 - o) * (opts.alpha === undefined ? 1 : opts.alpha);
    var ww = w * p;
    var xx = origin === 'center' ? x - ww / 2 : origin === 'right' ? x - ww : x;
    var g = ctx.createLinearGradient(xx, 0, xx + ww, 0);
    g.addColorStop(0, opts.c0 || C.ORANGE);
    g.addColorStop(1, opts.c1 || C.ORANGE_LT);
    ctx.fillStyle = g;
    softShadow(C.ORANGE, 26, 0, 0.5);
    rr(xx, y, ww, h, h / 2); ctx.fill();
  });
}

/** Suite de mots separes par des puces orange (ligne centree). */
function bulletRow(items, x, y, size, t, t0, opts) {
  opts = opts || {};
  var step = opts.step === undefined ? 0.14 : opts.step;
  var tr = size * (opts.tracking === undefined ? 0.10 : opts.tracking);
  ctx.font = FT.ui(size, opts.weight || 600);
  var widths = items.map(function (s) { return trackedWidth(s, tr); });
  var gap = size * 0.62, bulletW = size * 0.30;
  var tot = 0, i;
  for (i = 0; i < widths.length; i++) tot += widths[i];
  tot += (items.length - 1) * (gap * 2 + bulletW);
  var cx = x - tot / 2;

  for (i = 0; i < items.length; i++) {
    var p = seg(t, t0 + i * step, opts.dur || 0.5, 'easeOutCubic');
    var o = opts.outT0 !== undefined ? seg(t, opts.outT0 + i * 0.05, 0.3, 'easeInCubic') : 0;
    if (p > 0.001 && o < 0.999) {
      (function (p, o, cx, idx) {
        layer(function () {
          ctx.font = FT.ui(size, opts.weight || 600);
          ctx.textBaseline = 'alphabetic';
          ctx.globalAlpha = p * (1 - o);
          ctx.fillStyle = opts.color || C.WHITE;
          softShadow('#00070F', size * 0.6, size * 0.12, 0.42);
          ctx.translate(0, (1 - p) * size * 0.5);
          drawTracked(items[idx], cx, y, tr, 'left');
        });
      })(p, o, cx, i);
    }
    cx += widths[i];
    if (i < items.length - 1) {
      var pb = seg(t, t0 + i * step + 0.07, 0.3, 'easeOutCubic');
      var ob = opts.outT0 !== undefined ? seg(t, opts.outT0 + i * 0.05, 0.3, 'easeInCubic') : 0;
      if (pb > 0.001 && ob < 0.999) {
        (function (pb, ob, cx) {
          layer(function () {
            ctx.globalAlpha = pb * (1 - ob) * 0.95;
            ctx.fillStyle = C.ORANGE;
            ctx.beginPath();
            ctx.arc(cx + gap + bulletW / 2, y - size * 0.30, size * 0.105 * pb, 0, 6.2832);
            ctx.fill();
          });
        })(pb, ob, cx);
      }
      cx += gap * 2 + bulletW;
    }
  }
}

/** Carte-problematique (scene 1) : pastille + mot, ombre portee, parallax. */
function problemCard(text, x, y, scale, alpha, tint) {
  if (alpha <= 0.003) return;
  var size = 34;
  layer(function () {
    ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.font = FT.ui(size, 700);
    var tw = trackedWidth(text, size * 0.09);
    var pw = tw + 104, ph = 76;
    ctx.globalAlpha = alpha;
    softShadow('#000814', 38, 14, 0.55);
    var g = ctx.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
    g.addColorStop(0, rgba(mixHex(C.BLUE, C.INK, 0.25), 0.97));
    g.addColorStop(1, rgba(mixHex(C.BLUE, C.BLUE_LT, 0.30), 0.97));
    ctx.fillStyle = g;
    rr(-pw / 2, -ph / 2, pw, ph, 14); ctx.fill();
    noShadow();
    ctx.strokeStyle = rgba(tint || C.BLUE_LT, 0.55);
    ctx.lineWidth = 1.6;
    rr(-pw / 2, -ph / 2, pw, ph, 14); ctx.stroke();
    // pastille d'accent
    ctx.fillStyle = tint || C.ORANGE;
    ctx.beginPath(); ctx.arc(-pw / 2 + 36, 0, 9, 0, 6.2832); ctx.fill();
    // libelle
    ctx.fillStyle = C.WHITE;
    ctx.textBaseline = 'middle';
    drawTracked(text, -pw / 2 + 62, 2, size * 0.09, 'left');
  });
}
