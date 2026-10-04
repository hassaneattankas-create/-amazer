/* ============================================================================
 *  07 — SCENES 4 a 6
 * ========================================================================== */

/* ==========================================================================
 *  SCENE 4 — LES THEMATIQUES  (15.60 -> 21.60)
 *  Travelling horizontal continu dans un univers clair. Sept stations.
 * ======================================================================== */

var S4_GAP = 820;
var S4_STATIONS = [
  { word: 'FISCALITÉ',     obj: objForms,     oy: 455, above: false, s: 1.62 },
  { word: 'FINANCEMENT',   obj: objCoins,     oy: 620, above: true,  s: 1.55 },
  { word: 'GESTION',       obj: objDashboard, oy: 450, above: false, s: 1.50 },
  { word: 'MARKETING',     obj: objTarget,    oy: 455, above: false, s: 1.28 },
  { word: 'COMMERCE',      obj: objShop,      oy: 540, above: true,  s: 1.50 },
  { word: 'DIGITAL',       obj: objScreenNet, oy: 450, above: false, s: 1.46 },
  { word: 'DÉVELOPPEMENT', obj: objStairs,    oy: 560, above: true,  s: 1.42 }
];
var S4_T0 = [15.88, 16.65, 17.35, 18.05, 18.75, 19.45, 20.15];

/** Position ecran d'un point monde sous une camera donnee. */
function worldToScreen(cam, depth, wx, wy) {
  var d = depth === undefined ? 1 : depth;
  var z = 1 + (cam.zoom - 1) * d;
  return [CX + z * (wx - CX - cam.x * d), CY + z * (wy - CY - cam.y * d)];
}

function drawScene4(t) {
  var cam = newCam();
  cam.x = track(t, [
    [15.60, -170, 'easeInOutSine'], [15.95, 0, 'easeOutCubic'],
    [16.65, S4_GAP, 'linear'],     [17.35, S4_GAP * 2, 'linear'],
    [18.05, S4_GAP * 3, 'linear'], [18.75, S4_GAP * 4, 'linear'],
    [19.45, S4_GAP * 5, 'linear'], [20.15, S4_GAP * 6, 'easeInOutSine'],
    [20.85, S4_GAP * 6 + 120, 'easeInOutSine'], [21.60, S4_GAP * 6 + 160]
  ]);
  cam.y = track(t, [
    [15.60, 10], [16.65, -42], [17.35, 34], [18.05, -30],
    [18.75, 40], [19.45, -24], [20.15, 18],
    [20.85, -40, 'easeInOutQuint'], [21.35, -150, 'easeInOutQuint'], [21.60, -170]
  ]);
  cam.zoom = track(t, [
    [15.60, 1.06, 'easeOutCubic'], [15.95, 1.00], [20.15, 1.00],
    [20.85, 0.94, 'easeInOutQuint'], [21.35, 0.70, 'easeInOutQuint'], [21.60, 0.66]
  ]);

  var gridP = seg(t, 20.85, 0.52, 'easeInOutQuint');     // morph vers la grille
  var darken = seg(t, 21.12, 0.46, 'easeInOutCubic');    // retour a la nuit

  bgPaper();

  // --- decor de fond : bandes et horizon ---
  layer(function () {
    pushCam(cam, 0.22);
    ctx.globalAlpha = 0.9;
    var g = ctx.createLinearGradient(0, 600, 0, 1080);
    g.addColorStop(0, rgba(C.BLUE, 0.00));
    g.addColorStop(1, rgba(C.BLUE, 0.20));
    ctx.fillStyle = g; ctx.fillRect(-2000, 600, 12000, 480);
    for (var i = 0; i < 9; i++) {
      ctx.fillStyle = rgba(C.BLUE_LT, i % 2 ? 0.085 : 0.040);
      rr(CX + i * S4_GAP - 660, 90, 520, 830, 28); ctx.fill();
    }
  });

  // --- ligne d'horizon / sol ---
  layer(function () {
    pushCam(cam, 1.0);
    ctx.strokeStyle = rgba(C.BLUE, 0.16); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-3000, 886); ctx.lineTo(14000, 886); ctx.stroke();
  });

  // --- stations : objet + mot ancre dans la scene ---
  for (var i = 0; i < 7; i++) {
    var st = S4_STATIONS[i];
    var wx = CX + i * S4_GAP;
    var t0 = S4_T0[i];
    var prog = clamp01((t - (t0 - (i === 0 ? 0.96 : 0.60))) / 1.15);
    var fade = 1 - clamp01((t - (t0 + 1.95)) / 0.55);   // les stations passees s'effacent
    if (i === 6) fade = 1;
    var alpha = Math.min(1, prog * 2.2) * fade * (1 - gridP * 0.92);
    if (alpha <= 0.004) continue;

    // objet (precede de son disque d'ancrage, verrouille a la meme profondeur)
    (function (st, wx, prog, alpha, idx) {
      layer(function () {
        pushCam(cam, 1.0);
        ctx.globalAlpha = alpha;
        layer(function () {
          var dp = easeOutCubic(clamp01(prog * 1.5));
          ctx.globalAlpha = alpha * 0.9;
          var g = ctx.createRadialGradient(wx, st.oy, 0, wx, st.oy, 420 * dp);
          g.addColorStop(0, rgba(idx % 2 ? C.ORANGE : C.BLUE_LT, 0.16));
          g.addColorStop(0.68, rgba(idx % 2 ? C.ORANGE : C.BLUE_LT, 0.07));
          g.addColorStop(1, rgba(idx % 2 ? C.ORANGE : C.BLUE_LT, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(wx, st.oy, 420 * dp, 0, 6.2832); ctx.fill();
        });
        st.obj(wx, st.oy, st.s, prog, t);
      });
    })(st, wx, prog, alpha, i);

    // mot integre a la scene (soumis au parallax, donc ancre a l'objet).
    // Des que le morph vers la grille demarre, c'est le mot de la grille qui
    // prend le relais depuis cette meme position : on ne dessine pas les deux.
    var wy = st.above ? st.oy - 185 * st.s - 104 : st.oy + 185 * st.s + 186;
    if (gridP > 0.001) continue;
    (function (st, wx, wy, t0, alpha) {
      layer(function () {
        pushCam(cam, 1.0);
        ctx.globalAlpha = alpha;
        titleAt(st.word, wx, wy, 86, t, t0 - 0.22, 0.46,
                { color: C.BLUE, tracking: 1.5, shadow: false, step: 0.05 });
        accentRule(wx, wy + 30, 190, 7, t, t0 - 0.02, { origin: 'center', dur: 0.45 });
      });
    })(st, wx, wy, t0, alpha);
  }

  // --- morph : les sept mots se reorganisent en grille vue de dessus ---
  if (gridP > 0.004) {
    var slots = [
      [CX - 540, 430], [CX, 430], [CX + 540, 430],
      [CX - 540, 580], [CX, 580], [CX + 540, 580],
      [CX, 730]
    ];
    for (var i2 = 0; i2 < 7; i2++) {
      var st2 = S4_STATIONS[i2];
      var wx2 = CX + i2 * S4_GAP;
      var wy2 = st2.above ? st2.oy - 185 * st2.s - 104 : st2.oy + 185 * st2.s + 186;
      var from = worldToScreen(cam, 1.0, wx2, wy2);
      var k = easeInOutQuint(clamp01((gridP - i2 * 0.018) / (1 - 6 * 0.018)));
      var px = lerp(from[0], slots[i2][0], k);
      var py = lerp(from[1], slots[i2][1], k);
      var sz = lerp(86, 50, k);
      (function (st2, px, py, sz, k) {
        layer(function () {
          ctx.globalAlpha = Math.min(1, gridP * 2.4) * (1 - darken * 0.25);
          ctx.font = FT.display(sz, 900);
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = mixHex(C.BLUE, C.WHITE, darken);
          drawTracked(st2.word, px, py, 1.4, 'center');
          ctx.fillStyle = rgba(C.ORANGE, 0.95);
          var uw = trackedWidth(st2.word, 1.4);
          rr(px - uw / 2, py + sz * 0.26, uw * k, 4, 2); ctx.fill();
        });
      })(st2, px, py, sz, k);
    }
    labelTrack('LES THÉMATIQUES DU JDE', CX, 232, 32, t, 21.26,
               { color: C.ORANGE, tracking: 0.24, dur: 0.45 });
  }

  vignette(0.30, CX, 520);

  // --- retour a la nuit institutionnelle ---
  if (darken > 0.002) {
    layer(function () {
      ctx.globalAlpha = darken;
      var g = ctx.createRadialGradient(CX, 540, 120, CX, 540, 1250);
      g.addColorStop(0, rgba(C.INK_2, 0.94));
      g.addColorStop(1, C.INK);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
  }

  grain(t, 0.026);
}

/* ==========================================================================
 *  SCENE 5 — LA COMMUNAUTE  (21.60 -> 26.00)
 * ======================================================================== */

var S5_N = 14;
var S5_CX = CX, S5_CY = 600;

/** Position d'une silhouette de la communaute a l'instant t. */
function s5Pos(i, t) {
  var a = (i / S5_N) * 6.2832 - 1.35;
  var rx = 560, ry = 300;
  var pin = stagger(t, 21.62, i, 0.70, 'easeOutQuint', 0.045);
  var conv = seg(t, 23.30, 0.75, 'easeInOutQuint');
  var sink = seg(t, 25.05, 0.95, 'easeInOutQuint');
  var rad = lerp(1.78, 1.0, pin) * lerp(1.0, 0.74, conv) * lerp(1, 0.06, sink);
  var breathe = 1 + 0.018 * Math.sin(t * 1.1 + i * 0.7);
  return {
    x: S5_CX + Math.cos(a) * rx * rad * breathe,
    y: S5_CY + Math.sin(a) * ry * rad * breathe,
    pin: pin, conv: conv, sink: sink, a: a
  };
}

function drawScene5(t) {
  var cam = newCam();
  cam.zoom = track(t, [[21.60, 1.08, 'easeOutCubic'], [23.30, 1.00],
                       [25.05, 1.02], [26.00, 1.14, 'easeInOutQuint']]);
  cam.y = track(t, [[21.60, 20], [23.30, 0], [26.00, -14]]);

  bgDeep(0.015);
  layer(function () {
    pushCam(cam, 0.20);
    glow(S5_CX, S5_CY, 1020, C.BLUE_LT, 0.20);
    glow(S5_CX, S5_CY, 420, C.ORANGE, 0.10);
  });
  layer(function () {
    pushCam(cam, 0.34);
    dustMotes(t, 52, S5_CX, S5_CY, 1800, C.BLUE_PALE, 0.22);
  });

  // positions
  var pts = [], i;
  for (i = 0; i < S5_N; i++) pts.push(s5Pos(i, t));

  // --- lignes de connexion (graphe de reseau) ---
  var netNodes = [], edges = [];
  for (i = 0; i < S5_N; i++) netNodes.push([pts[i].x, pts[i].y - 26]);
  for (i = 0; i < S5_N; i++) edges.push([i, (i + 1) % S5_N]);
  for (i = 0; i < S5_N; i += 2) edges.push([i, (i + 5) % S5_N]);
  for (i = 1; i < S5_N; i += 4) edges.push([i, (i + 7) % S5_N]);
  layer(function () {
    pushCam(cam, 0.92);
    networkGraph({
      nodes: netNodes, edges: edges,
      prog: clamp01((t - 22.80) / 1.9),
      edgeColor: C.ORANGE, edgeAlpha: 0.42,
      nodeColor: rgba(C.ORANGE_LT, 0.9), nodeGlow: C.ORANGE, r: 4.5,
      lw: 2.2, alpha: 1 - seg(t, 25.05, 0.7, 'easeInCubic')
    });
  });

  // --- anneau central ---
  layer(function () {
    pushCam(cam, 0.88);
    ringOrbit({
      x: S5_CX, y: S5_CY, r: 210 * (1 - seg(t, 25.05, 0.9, 'easeInOutQuint') * 0.94),
      prog: seg(t, 23.30, 1.1, 'easeInOutCubic'), t: t,
      alpha: 1 - seg(t, 25.50, 0.5, 'easeInCubic')
    });
  });

  // --- silhouettes ---
  for (i = 0; i < S5_N; i++) {
    var p = pts[i];
    if (p.pin <= 0.003) continue;
    var tone = i % 5;
    var col = tone === 0 ? C.BLUE_LT
            : tone === 1 ? mixHex(C.BLUE, C.BLUE_LT, 0.55)
            : tone === 2 ? mixHex(C.BLUE_LT, C.WHITE, 0.30)
            : tone === 3 ? mixHex(C.BLUE, C.SAND, 0.26)
            : mixHex(C.BLUE, C.BLUE_LT, 0.25);
    var hh = 112 + hash1(i) * 46;
    var depth = 0.78 + (p.y - S5_CY) / 900;
    (function (p, col, hh, depth, i) {
      layer(function () {
        pushCam(cam, depth);
        figureIcon({
          x: p.x, y: p.y, h: hh * lerp(0.6, 1, p.pin) * lerp(1, 0.4, p.sink),
          color: col, rim: i % 3 === 0 ? C.ORANGE_LT : null,
          glowA: 0.10 + 0.14 * p.conv, glowC: i % 3 === 0 ? C.ORANGE : C.BLUE_LT,
          alpha: Math.min(1, p.pin * 1.4) * (1 - p.sink * 0.65)
        });
      });
    })(p, col, hh, depth, i);
  }

  // noyau lumineux final
  var sink = seg(t, 25.05, 0.95, 'easeInOutQuint');
  if (sink > 0.01) {
    glow(S5_CX, S5_CY, lerp(40, 560, sink), C.ORANGE_LT, 0.55 * sink);
    glow(S5_CX, S5_CY, lerp(12, 190, sink), C.WHITE, 0.80 * sink);
  }

  veilTop(280, 0.50);
  veilBottom(330, 0.52);
  vignette(0.60, S5_CX, S5_CY);

  // --- typographie ---
  bulletRow(['ENTREPRENEURS', 'PORTEURS DE PROJETS', 'PROFESSIONNELS'],
            CX, 232, 40, t, 22.15,
            { step: 0.16, color: rgba(C.WHITE, 0.94), weight: 600,
              tracking: 0.11, outT0: 25.00, dur: 0.5 });

  // APPRENEZ • ECHANGEZ • AGISSEZ — trois blocs en elasticSoft,
  // positions calculees sur la chasse reelle pour un rythme regulier.
  var blocks = ['APPRENEZ', 'ÉCHANGEZ', 'AGISSEZ'];
  ctx.font = FT.display(74, 900);
  var bw = blocks.map(function (s) { return trackedWidth(s, 3); });
  var bGap = 58, bDot = 18;
  var bTot = bw[0] + bw[1] + bw[2] + 2 * (bGap * 2 + bDot);
  var bLeft = CX - bTot / 2, bx = [], bdot = [];
  for (i = 0; i < 3; i++) {
    bx.push(bLeft + bw[i] / 2);
    if (i < 2) bdot.push(bLeft + bw[i] + bGap + bDot / 2);
    bLeft += bw[i] + (i < 2 ? bGap * 2 + bDot : 0);
  }
  for (i = 0; i < 3; i++) {
    var pb = seg(t, 23.85 + i * 0.18, 0.62, function (x) { return elasticSoft(x, 0.26); });
    var ob = seg(t, 25.02 + i * 0.05, 0.34, 'easeInCubic');
    if (pb <= 0.003 || ob >= 0.997) continue;
    (function (pb, ob, cx2, txt) {
      layer(function () {
        ctx.globalAlpha = Math.min(1, pb * 1.4) * (1 - ob);
        ctx.font = FT.display(74, 900);
        ctx.textBaseline = 'alphabetic';
        softShadow('#00070F', 40, 12, 0.5);
        ctx.fillStyle = C.WHITE;
        ctx.translate(0, (1 - pb) * 46 - ob * 40);
        drawTracked(txt, cx2, 962, 3, 'center');
      });
    })(pb, ob, bx[i], blocks[i]);
    if (i < 2) {
      var pd = seg(t, 24.02 + i * 0.18, 0.4, 'easeOutCubic');
      var od = seg(t, 25.02, 0.34, 'easeInCubic');
      if (pd > 0.003 && od < 0.997) {
        (function (pd, od, x) {
          layer(function () {
            ctx.globalAlpha = pd * (1 - od);
            ctx.fillStyle = C.ORANGE;
            ctx.beginPath(); ctx.arc(x, 938, 9 * pd, 0, 6.2832); ctx.fill();
          });
        })(pd, od, bdot[i]);
      }
    }
  }

  grain(t);
}

/* ==========================================================================
 *  SCENE 6 — END CARD  (26.00 -> 30.00)
 *  Image gelee a partir de 29.70 (capture reseau social).
 * ======================================================================== */

var S6_FREEZE = 29.70;

function drawScene6(tAbs) {
  var t = Math.min(tAbs, S6_FREEZE);   // gel total de la derniere seconde

  var cam = newCam();
  cam.zoom = track(t, [[26.00, 1.05, 'easeOutQuart'], [27.00, 1.00], [29.70, 1.00]]);

  bgDeep(0.01);

  // halo issu du point lumineux de la scene 5
  var bloom = 1 - seg(t, 26.00, 0.85, 'easeOutQuart');
  layer(function () {
    pushCam(cam, 0.22);
    glow(CX, 520, 1080, C.BLUE_LT, 0.20);
    glow(CX, 470, 520, C.ORANGE, 0.085);
    if (bloom > 0.002) {
      // prolonge exactement le noyau lumineux sur lequel la scene 5 se referme
      glow(CX, 600, lerp(300, 1150, 1 - bloom), C.ORANGE_LT, 0.70 * bloom);
      glow(CX, 600, lerp(190, 620, 1 - bloom), C.WHITE, 0.92 * bloom);
    }
  });
  layer(function () {
    pushCam(cam, 0.36);
    dustMotes(t, 34, CX, 520, 1600, C.BLUE_PALE, 0.16);
  });

  // particules d'accent qui se posent puis s'immobilisent
  for (var i = 0; i < 18; i++) {
    var pp = seg(t, 29.05 + i * 0.012, 0.55, 'easeOutQuart');
    var pa = seg(t, 26.55 + i * 0.03, 0.7, 'easeOutCubic');
    if (pa <= 0.004) continue;
    var a0 = hash1(i) * 6.2832;
    var rr0 = 420 + hash2(i, 3) * 420;
    var settle = pp;
    var x = CX + Math.cos(a0) * rr0 * lerp(1.25, 1.0, pa);
    var y = 540 + Math.sin(a0) * rr0 * 0.46 * lerp(1.25, 1.0, pa);
    var drift = (1 - settle) * Math.sin(t * 0.9 + i) * 9;
    layer(function () {
      ctx.globalAlpha = (0.30 + 0.45 * hash2(i, 7)) * pa;
      ctx.fillStyle = i % 4 === 0 ? C.ORANGE : C.BLUE_PALE;
      ctx.beginPath();
      ctx.arc(x + drift, y + drift * 0.6, 1.6 + hash2(i, 9) * 2.4, 0, 6.2832);
      ctx.fill();
    });
  }

  vignette(0.66, CX, 500);
  endCardFrame(seg(t, 26.05, 1.15, 'easeInOutCubic'), 56, rgba(C.BLUE_PALE, 0.40), 0.75);

  // --- marque officielle ---
  logoMEN(CX, 352, 520, 190, seg(t, 26.20, 0.85, 'linear'), 1);

  // --- titre et signature ---
  titleAt('JEUDI DE L’ENTREPRENEUR', CX, 612, 92, t, 26.90, 0.52, { tracking: 1.6 });
  accentRule(CX, 652, 540, 7, t, 27.65, { origin: 'center', dur: 0.6 });
  bodyLine('Chaque dernier jeudi du mois', CX, 742, 48, t, 27.78,
           { color: rgba(C.WHITE, 0.92), weight: 500 });
  bodyLine('Rejoignez-nous.', CX, 846, 56, t, 28.45,
           { color: C.ORANGE_LT, weight: 700 });
  // La raison sociale n'est rappelee en pied que si le lockup de substitution
  // n'est pas a l'image (sinon elle y figure deja).
  labelTrack(LOGO.missing ? 'NIAMEY · NIGER' : 'MAISON DE L’ENTREPRISE DU NIGER',
             CX, 958, 28, t, 28.85,
             { color: rgba(C.BLUE_PALE, 0.72), tracking: 0.26, dur: 0.6 });

  grain(t);
}
