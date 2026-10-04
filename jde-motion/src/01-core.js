/* ============================================================================
 *  JDE — MOTEUR DE RENDU DETERMINISTE  ·  01 — NOYAU
 *  Point d'entree unique : window.seek(t)   (t en secondes, 0 -> 30)
 *  Contrat : RULES.md — aucune horloge, aucun accumulateur, aucun random
 *  non seede dans la logique de dessin.
 * ========================================================================== */

var W = 1920, H = 1080, FPS = 60, DURATION = 30.0;
var CX = W / 2, CY = H / 2;

var cv  = document.getElementById('cv');
var ctx = cv.getContext('2d', { alpha: false });

/* --------------------------------------------------------------------------
 * PALETTE  (LOOK.md §2)
 * ------------------------------------------------------------------------ */
var C = {
  INK:       '#061629',
  INK_2:     '#0A2440',
  BLUE:      '#0E3A6B',
  BLUE_LT:   '#1D6FB8',
  BLUE_PALE: '#7FB2DF',
  ORANGE:    '#F6871F',
  ORANGE_LT: '#FFA94D',
  WHITE:     '#FFFFFF',
  PAPER:     '#F2F6FB',
  PAPER_2:   '#DFE8F3',
  SAND:      '#E7C9A3',
  SLATE:     '#2B4A6F'
};
/** Accepte '#rgb', '#rrggbb' et 'rgb(r,g,b)' (sortie de mixHex). */
function rgba(col, a) {
  if (col.charCodeAt(0) === 114) { // 'r' -> rgb(...)
    var p = col.slice(col.indexOf('(') + 1, col.lastIndexOf(')')).split(',');
    return 'rgba(' + (+p[0] | 0) + ',' + (+p[1] | 0) + ',' + (+p[2] | 0) + ',' + a + ')';
  }
  var h = col.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function mixHex(h1, h2, x) {
  var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  var r  = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, x));
  var g  = Math.round(lerp((a >> 8) & 255,  (b >> 8) & 255,  x));
  var bl = Math.round(lerp(a & 255,         b & 255,         x));
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

/* --------------------------------------------------------------------------
 * TYPOGRAPHIE  (LOOK.md §4)
 * ------------------------------------------------------------------------ */
var FT = {
  display: function (s, w) { return (w || 900) + ' ' + s + 'px Montserrat, "Segoe UI", sans-serif'; },
  ui:      function (s, w) { return (w || 500) + ' ' + s + 'px Inter, "Segoe UI", sans-serif'; }
};

/* --------------------------------------------------------------------------
 * NOYAU : calques, camera, geometrie
 * ------------------------------------------------------------------------ */
function layer(fn) { ctx.save(); try { fn(); } finally { ctx.restore(); } }

/** Camera virtuelle 2.5D. depth : 0 = arriere-plan lointain, 1 = premier plan. */
function newCam() { return { x: 0, y: 0, zoom: 1, rot: 0 }; }
function pushCam(cam, depth) {
  var d = depth === undefined ? 1 : depth;
  var z = 1 + (cam.zoom - 1) * d;
  ctx.translate(CX, CY);
  ctx.rotate((cam.rot || 0) * d);
  ctx.scale(z, z);
  ctx.translate(-CX - cam.x * d, -CY - cam.y * d);
}

function rr(x, y, w, h, r) {
  var k = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);     ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k); ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);     ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);         ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}
function poly(pts, close) {
  ctx.beginPath();
  for (var i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]); else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  if (close !== false) ctx.closePath();
}
function softShadow(color, blur, dy, alpha) {
  ctx.shadowColor = rgba(color, alpha === undefined ? 0.35 : alpha);
  ctx.shadowBlur = blur; ctx.shadowOffsetY = dy || 0; ctx.shadowOffsetX = 0;
}
function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }

/* --------------------------------------------------------------------------
 * ATMOSPHERE  (LOOK.md §3)
 * ------------------------------------------------------------------------ */
function bgDeep(topMix) {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  var m = topMix === undefined ? 0 : topMix;
  g.addColorStop(0,    mixHex(C.INK, C.BLUE, 0.22 + m));
  g.addColorStop(0.55, mixHex(C.INK, C.INK_2, 0.35));
  g.addColorStop(1,    C.INK);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function bgPaper() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.WHITE);
  g.addColorStop(0.62, C.PAPER);
  g.addColorStop(1, C.PAPER_2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function glow(x, y, r, color, alpha) {
  if (r <= 0 || alpha <= 0) return;
  var g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0,    rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.42));
  g.addColorStop(1,    rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function vignette(strength, cx, cy) {
  var s = strength === undefined ? 0.5 : strength;
  var x = cx === undefined ? CX : cx, y = cy === undefined ? CY : cy;
  var g = ctx.createRadialGradient(x, y, H * 0.18, x, y, H * 1.02);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.62, 'rgba(0,0,0,' + (0.10 * s).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(0,0,0,' + (0.72 * s).toFixed(3) + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/* Grain : tuile de bruit pre-calculee une seule fois, decalage deterministe. */
var GRAIN = null;
function buildGrain() {
  var s = 256, c = document.createElement('canvas');
  c.width = s; c.height = s;
  var g = c.getContext('2d'), img = g.createImageData(s, s), d = img.data;
  for (var i = 0; i < s * s; i++) {
    var v = 128 + (hash1(i) - 0.5) * 205;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  GRAIN = ctx.createPattern(c, 'repeat');
}
function grain(t, amount) {
  if (!GRAIN) return;
  var f = Math.round(t * FPS);
  layer(function () {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount === undefined ? 0.030 : amount;
    ctx.translate(-((f * 37) % 256), -((f * 61) % 256));
    ctx.fillStyle = GRAIN;
    ctx.fillRect(0, 0, W + 256, H + 256);
  });
}

/** Poussieres en suspension — positions issues de hash2, derive lente. */
function dustMotes(t, n, cx, cy, spread, color, alpha) {
  layer(function () {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) {
      var ph = hash2(i, 11) * 100;
      var x = cx + (hash2(i, 3) - 0.5) * spread + Math.sin(t * 0.33 + ph) * 26;
      var y = cy + (hash2(i, 5) - 0.5) * spread * 0.62 + Math.cos(t * 0.27 + ph) * 20;
      var r = 1.1 + hash2(i, 7) * 2.4;
      var a = alpha * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph)));
      ctx.fillStyle = rgba(color, a);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
  });
}

/** Faisceau de videoprojecteur (trapeze degrade). */
function lightShaft(x0, y0, x1, y1, w0, w1, color, alpha) {
  var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  var nx = -dy / L, ny = dx / L;
  layer(function () {
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    poly([
      [x0 + nx * w0, y0 + ny * w0], [x1 + nx * w1, y1 + ny * w1],
      [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w0, y0 - ny * w0]
    ]);
    ctx.fillStyle = g; ctx.fill();
  });
}

/** Sol reflechissant discret (plans sombres). */
function floorSheen(y, color, alpha) {
  layer(function () {
    var g = ctx.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, y, W, H - y);
  });
}
