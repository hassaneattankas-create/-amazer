/* ============================================================================
 *  05 — TRANSITIONS, COMPOSITING ET MARQUE  (KIT.md §8 et §9)
 *  Les transitions qui ont besoin de l'image complete passent par un tampon
 *  hors-ecran : on redirige `ctx` vers le tampon, on dessine, on recompose.
 * ========================================================================== */

var OFF = document.createElement('canvas');
OFF.width = W; OFF.height = H;
var octx = OFF.getContext('2d', { alpha: false });

/** Execute `fn` en redirigeant tout le dessin vers le tampon hors-ecran. */
function withOffscreen(fn) {
  var prev = ctx;
  ctx = octx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  noShadow();
  try { fn(); } finally { ctx = prev; }
}

/* --------------------------------------------------------------------------
 * Lame diagonale : clip de la zone balayee, puis wipe colore.
 * ------------------------------------------------------------------------ */
function diagonalPath(prog, angle, overshoot) {
  var a = angle === undefined ? -0.32 : angle;    // ~18 deg
  var span = W + Math.abs(Math.tan(a)) * H + (overshoot || 0);
  var edge = -Math.abs(Math.tan(a)) * H + prog * span;
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.lineTo(edge, -10);
  ctx.lineTo(edge + Math.tan(a) * H, H + 10);
  ctx.lineTo(-10, H + 10);
  ctx.closePath();
  return edge;
}

/** Dessine `fn` uniquement dans la zone balayee par la lame. */
function clipDiagonal(prog, angle, fn) {
  layer(function () {
    diagonalPath(prog, angle, 0);
    ctx.clip();
    fn();
  });
}

/** Lame orange lumineuse qui balaie l'ecran. */
function wipeBlade(prog, angle, color, width) {
  if (prog <= 0.001 || prog >= 0.999) return;
  var a = angle === undefined ? -0.32 : angle;
  var span = W + Math.abs(Math.tan(a)) * H;
  var edge = -Math.abs(Math.tan(a)) * H + prog * span;
  var bw = width || 190;
  layer(function () {
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(edge - bw, 0, edge + bw * 0.22, 0);
    g.addColorStop(0, rgba(color || C.ORANGE, 0));
    g.addColorStop(0.72, rgba(color || C.ORANGE, 0.55));
    g.addColorStop(0.93, rgba(color || C.ORANGE, 0.95));
    g.addColorStop(1, rgba(color || C.ORANGE, 0));
    ctx.fillStyle = g;
    poly([
      [edge - bw * 1.1, -10], [edge + bw * 0.3, -10],
      [edge + bw * 0.3 + Math.tan(a) * H, H + 10], [edge - bw * 1.1 + Math.tan(a) * H, H + 10]
    ]);
    ctx.fill();
  });
}

/** Flash court (<= 6 frames conseille). */
function flash(prog, color, maxAlpha) {
  if (prog <= 0.001 || prog >= 0.999) return;
  var a = Math.sin(prog * Math.PI) * (maxAlpha === undefined ? 0.85 : maxAlpha);
  layer(function () {
    ctx.globalAlpha = a;
    ctx.fillStyle = color || C.WHITE;
    ctx.fillRect(0, 0, W, H);
  });
}

/** Revelation par disque. */
function maskCircle(prog, cx, cy, fn) {
  var r = easeInOutCubic(clamp01(prog)) * Math.hypot(W, H) * 0.62;
  layer(function () {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.clip();
    fn();
  });
}

/**
 * Portail d'ecran : le contenu du tampon hors-ecran est affiche dans `rect`
 * puis grandit jusqu'a remplir le cadre (zoom-into-screen).
 */
function screenPortal(prog, rect, alpha) {
  var k = easeInOutQuint(clamp01(prog));
  var x = lerp(rect.x, 0, k), y = lerp(rect.y, 0, k);
  var w = lerp(rect.w, W, k), h = lerp(rect.h, H, k);
  layer(function () {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(OFF, x, y, w, h);
  });
}

/** Zoom punch + bloom : accentue une coupe. */
function zoomPunch(prog, cx, cy, amount) {
  if (prog <= 0.001 || prog >= 0.999) return;
  var k = Math.sin(prog * Math.PI);
  var s = 1 + (amount === undefined ? 0.12 : amount) * k;
  layer(function () {
    ctx.globalAlpha = 0.45 * k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    ctx.drawImage(OFF, 0, 0);
  });
}

/** Balayage motion-blurré (3 strates d'alpha decalees). */
function whipPan(prog, dir, strength) {
  if (prog <= 0.001) return;
  var k = Math.sin(clamp01(prog) * Math.PI);
  var d = (dir || 1) * (strength || 170) * k;
  layer(function () {
    for (var i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.22 / i;
      ctx.drawImage(OFF, d * i * 0.42, 0);
    }
  });
}

/** Aspiration de l'image vers un point lumineux. */
function collapseToPoint(prog, cx, cy) {
  var k = easeInOutQuint(clamp01(prog));
  var s = lerp(1, 0.015, k);
  layer(function () {
    ctx.fillStyle = C.INK; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1 - k * 0.15;
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    ctx.drawImage(OFF, 0, 0);
  });
  if (k > 0.45) {
    var b = clamp01((k - 0.45) / 0.55);
    glow(cx, cy, lerp(60, 520, b), C.ORANGE_LT, 0.55 * b);
    glow(cx, cy, lerp(20, 180, b), C.WHITE, 0.75 * b);
  }
}

/* ==========================================================================
 * MARQUE — Maison de l'Entreprise du Niger
 * L'asset officiel n'est JAMAIS redessine ni deforme : translation, echelle
 * uniforme et opacite uniquement (RULES.md §7).
 * ======================================================================== */

var LOGO = { img: null, ratio: 520 / 190, loaded: false, missing: true };

function loadLogo() {
  var candidates = ['assets/logo-men.svg', 'assets/logo-men.png', 'assets/logo-men.jpg', 'assets/logo-men.webp'];
  return new Promise(function (resolve) {
    var i = 0;
    function tryNext() {
      if (i >= candidates.length) {
        LOGO.loaded = true; LOGO.missing = true;
        console.warn('[JDE] logo officiel manquant — lockup typographique de substitution utilise. ' +
                     'Deposer assets/logo-men.svg pour le remplacer.');
        return resolve(false);
      }
      var src = candidates[i++];
      var im = new Image();
      im.onload = function () {
        if (!im.naturalWidth) return tryNext();
        LOGO.img = im;
        LOGO.ratio = im.naturalWidth / im.naturalHeight;
        LOGO.loaded = true; LOGO.missing = false;
        console.log('[JDE] logo officiel charge : ' + src);
        resolve(true);
      };
      im.onerror = tryNext;
      im.src = src;
    }
    tryNext();
  });
}

/**
 * Dessine la marque dans une boite (x,y = centre ; boxW,boxH = boite max).
 * Ratio preserve, inscription type « contain ».
 */
function logoMEN(x, y, boxW, boxH, prog, alpha) {
  var k = elasticSoft(clamp01(prog), 0.26);
  if (k <= 0.002) return;
  var a = (alpha === undefined ? 1 : alpha) * Math.min(1, clamp01(prog) * 1.6);
  if (LOGO.img) {
    var w = boxW, h = boxW / LOGO.ratio;
    if (h > boxH) { h = boxH; w = boxH * LOGO.ratio; }
    w *= lerp(0.84, 1, k); h *= lerp(0.84, 1, k);
    layer(function () {
      ctx.globalAlpha = a;
      ctx.drawImage(LOGO.img, x - w / 2, y - h / 2, w, h);
    });
  } else {
    LOGO_FALLBACK(x, y, boxW, boxH, k, a);
  }
}

/**
 * Lockup typographique institutionnel de substitution.
 * Utilise uniquement si l'asset officiel est absent.
 */
function LOGO_FALLBACK(x, y, boxW, boxH, k, a) {
  var s = boxW / 520;
  layer(function () {
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.scale(s * lerp(0.86, 1, k), s * lerp(0.86, 1, k));
    // ecusson
    layer(function () {
      ctx.translate(-186, 0);
      softShadow('#000814', 34, 12, 0.5);
      var g = ctx.createLinearGradient(-62, -62, 62, 62);
      g.addColorStop(0, mixHex(C.BLUE, C.BLUE_LT, 0.30));
      g.addColorStop(1, C.BLUE);
      ctx.fillStyle = g;
      rr(-62, -62, 124, 124, 22); ctx.fill();
      noShadow();
      ctx.strokeStyle = rgba(C.ORANGE, 0.95); ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 6, 46, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = C.WHITE;
      ctx.font = FT.display(40, 900);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('MEN', 0, -10);
    });
    // raison sociale
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.WHITE;
    ctx.font = FT.display(34, 800);
    drawTracked('MAISON DE L’ENTREPRISE', -104, -10, 1.2, 'left');
    ctx.fillStyle = rgba(C.WHITE, 0.92);
    drawTracked('DU NIGER', -104, 34, 1.2, 'left');
    ctx.fillStyle = C.ORANGE;
    rr(-104, 48, 118, 5, 2.5); ctx.fill();
  });
}

/** Filet d'encadrement institutionnel qui se trace sur les quatre bords. */
function endCardFrame(prog, inset, color, alpha) {
  var p = easeInOutCubic(clamp01(prog));
  if (p <= 0.002) return;
  var m = inset || 54;
  var x0 = m, y0 = m, x1 = W - m, y1 = H - m;
  var per = (x1 - x0) * 2 + (y1 - y0) * 2;
  var drawn = per * p;
  var segs = [
    [x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]
  ];
  layer(function () {
    ctx.globalAlpha = alpha === undefined ? 0.5 : alpha;
    ctx.strokeStyle = color || rgba(C.BLUE_PALE, 0.55);
    ctx.lineWidth = 2;
    var acc = 0;
    for (var i = 0; i < 4; i++) {
      var sx = segs[i][0], sy = segs[i][1], ex = segs[i][2], ey = segs[i][3];
      var L = Math.hypot(ex - sx, ey - sy);
      if (acc >= drawn) break;
      var f = Math.min(1, (drawn - acc) / L);
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(lerp(sx, ex, f), lerp(sy, ey, f)); ctx.stroke();
      acc += L;
    }
    // coins d'accent orange
    if (p > 0.92) {
      var ca = clamp01((p - 0.92) / 0.08);
      ctx.strokeStyle = rgba(C.ORANGE, 0.9 * ca); ctx.lineWidth = 4;
      var L2 = 46;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + L2); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L2, y0);
      ctx.moveTo(x1 - L2, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L2);
      ctx.stroke();
    }
  });
}
