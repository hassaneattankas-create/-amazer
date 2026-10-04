/* ============================================================================
 *  06 — SCENES 1 a 3
 *  Chaque fonction recoit le TEMPS ABSOLU `t` et lit ses bornes dans TIMELINE,
 *  exactement comme CLOCK.md. Aucun etat conserve entre les appels.
 * ========================================================================== */

var TIMELINE = {
  S1: { t0: 0.00,  t1: 4.80  },
  S2: { t0: 4.80,  t1: 9.60  },
  S3: { t0: 9.60,  t1: 15.60 },
  S4: { t0: 15.60, t1: 21.60 },
  S5: { t0: 21.60, t1: 26.00 },
  S6: { t0: 26.00, t1: 30.00 }
};

/* Voiles de lisibilite (RULES.md §5) */
function veilTop(h, a) {
  layer(function () {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(3,10,20,' + a + ')');
    g.addColorStop(1, 'rgba(3,10,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  });
}
function veilBottom(h, a) {
  layer(function () {
    var g = ctx.createLinearGradient(0, H, 0, H - h);
    g.addColorStop(0, 'rgba(3,10,20,' + a + ')');
    g.addColorStop(1, 'rgba(3,10,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, H - h, W, h);
  });
}

/* ==========================================================================
 *  SCENE 1 — ACCROCHE  (0.00 -> 4.80)
 *  « Vous etes entrepreneur ? » — la complexite autour d'une personne seule.
 * ======================================================================== */

var S1_CARDS = [
  { label: 'GESTION',        x: -500, y: -150, depth: 0.92 },
  { label: 'FISCALITÉ',      x:  470, y: -215, depth: 0.86 },
  { label: 'FINANCEMENT',    x: -575, y:   85, depth: 0.98 },
  { label: 'MARKETING',      x:  545, y:   55, depth: 1.04 },
  { label: 'DÉVELOPPEMENT',  x:   15, y: -322, depth: 0.80 }
];

function drawScene1(t) {
  var cam = newCam();
  // push-in : zoom 1 -> 2.15 (easeInOutQuint), puis derive lente
  cam.zoom = track(t, [[0.00, 1.00], [0.40, 1.025, 'easeOutCubic'], [2.55, 1.055, 'easeInOutSine'],
                       [3.15, 1.42, 'easeInOutQuint'], [4.80, 1.50, 'easeInOutSine']]);
  cam.y = track(t, [[0.00, 0], [2.55, 8], [3.15, 72, 'easeInOutQuint'], [4.80, 80]]);
  cam.x = track(t, [[0.00, -16], [2.55, 6], [3.15, 14, 'easeInOutQuint'], [4.80, 20]]);

  var build = seg(t, 0.00, 0.62, 'easeOutCubic');
  var ignite = 0.22 + 0.78 * build;   // la lumiere existe des la frame 0
  var pressure = seg(t, 2.30, 0.45, 'easeInOutSine');

  // --- fond et lumiere d'ambiance ---
  bgDeep(0);
  layer(function () {
    pushCam(cam, 0.18);
    glow(CX - 120, 470, 760 * ignite, C.BLUE_LT, 0.26 * ignite + 0.05 * pressure);
    glow(CX + 430, 760, 520 * ignite, C.ORANGE, 0.14 * ignite + 0.07 * pressure);
  });
  layer(function () {
    pushCam(cam, 0.30);
    dustMotes(t, 36, CX, 540, 1500, C.BLUE_PALE, 0.22 * build);
  });

  // --- poste de travail + entrepreneur (plan principal) ---
  layer(function () {
    pushCam(cam, 0.62);
    var breathe = Math.sin(t * 1.35) * 3.2;

    // halo rasant derriere la silhouette
    glow(CX - 30, 560, 420, C.BLUE_LT, 0.20 * build);

    // ecran d'ordinateur (lumiere froide, cote gauche)
    var scrP = seg(t, 0.30, 0.55, 'easeOutQuart');
    if (scrP > 0.002) {
      layer(function () {
        ctx.globalAlpha = scrP;
        ctx.translate(CX - 300, 690 - (1 - scrP) * 30);
        ctx.rotate(0.06);
        softShadow('#000510', 36, 14, 0.55);
        ctx.fillStyle = mixHex(C.BLUE, C.INK, 0.35);
        rr(-160, -120, 320, 212, 10); ctx.fill();
        noShadow();
        var g = ctx.createLinearGradient(0, -110, 0, 80);
        g.addColorStop(0, mixHex(C.BLUE_LT, C.BLUE, 0.35));
        g.addColorStop(1, mixHex(C.BLUE, C.INK, 0.45));
        ctx.fillStyle = g; rr(-146, -106, 292, 184, 6); ctx.fill();
        ctx.fillStyle = rgba(C.BLUE_PALE, 0.42);
        for (var i = 0; i < 5; i++) { rr(-120, -78 + i * 30, 180 - (i % 3) * 52, 9, 4.5); ctx.fill(); }
        ctx.fillStyle = rgba(C.ORANGE, 0.75); rr(-120, 44, 86, 11, 5.5); ctx.fill();
        ctx.fillStyle = mixHex(C.BLUE, C.INK, 0.35);
        rr(-26, 92, 52, 26, 5); ctx.fill();
        rr(-78, 114, 156, 14, 7); ctx.fill();
      });
      glow(CX - 300, 660, 300, C.BLUE_LT, 0.22 * scrP);
    }

    // silhouette assise
    figureSeated({
      x: CX - 20, y: 880, h: 560,
      color: mixHex(C.BLUE, C.INK, 0.52), rim: C.BLUE_LT, rim2: C.ORANGE_LT,
      breathe: breathe, alpha: build
    });

    // plan de travail au premier plan de la figure
    deskSetup({ x: CX - 10, y: 1010, w: 1500, depth: 190, prog: build, t: t, alpha: build });

    // dossiers + carnet sur la table
    var pNote = seg(t, 0.55, 0.5, 'easeOutQuart');
    notebook({ x: CX + 330, y: 905, w: 230, h: 150, rot: -0.14, prog: clamp01((t - 0.75) / 1.1), alpha: pNote });
    var pFile = seg(t, 0.46, 0.5, 'easeOutQuart');
    if (pFile > 0.002) {
      layer(function () {
        ctx.globalAlpha = pFile * 0.95;
        ctx.translate(CX - 470, 930);
        for (var i = 0; i < 3; i++) {
          softShadow('#000510', 20, 8, 0.5);
          ctx.fillStyle = i === 1 ? rgba(C.SAND, 0.92) : rgba(C.PAPER_2, 0.9);
          ctx.rotate(0.012);
          rr(-110, -14 - i * 15, 220, 18, 4); ctx.fill();
        }
      });
    }

    // lampe : halo chaud cote droit
    glow(CX + 470, 600, 360, C.ORANGE, 0.20 * build);
  });

  // --- cartes-problematiques (orbite, parallax, stagger 0.05 s) ---
  var pulse = 1 + 0.035 * Math.sin(t * 4.2) * pressure;
  for (var i = 0; i < S1_CARDS.length; i++) {
    var cd = S1_CARDS[i];
    var pin = stagger(t, 1.20, i, 0.62, 'elasticOut', 0.05);
    var pout = seg(t, 2.82 + i * 0.035, 0.52, 'backIn');
    if (pin <= 0.002 || pout >= 0.998) continue;
    var spread = lerp(1.55, 1.0, pin) + pout * 1.9;
    var alpha = Math.min(1, pin * 1.5) * (1 - pout);
    var drift = Math.sin(t * 0.85 + i * 1.7) * 14;
    (function (cd, spread, alpha, drift, i) {
      layer(function () {
        pushCam(cam, cd.depth);
        var x = CX + cd.x * spread + drift;
        var y = 520 + cd.y * spread + drift * 0.6;
        problemCard(cd.label, x, y, (0.92 + cd.depth * 0.12) * pulse, alpha,
                    i === 1 || i === 3 ? C.ORANGE : C.BLUE_LT);
      });
    })(cd, spread, alpha, drift, i);
  }

  // --- habillage ---
  veilTop(330, 0.55);
  veilBottom(300, 0.42);
  vignette(0.62, CX, 520);

  labelTrack("ENTREPRENDRE AU NIGER", CX, 168, 32, t, 0.90,
             { color: C.ORANGE, outT0: 2.62, outDur: 0.3, tracking: 0.22, shadow: true });

  // voile de lisibilite du titre
  var titleVeil = seg(t, 3.00, 0.42, 'easeOutCubic') * (1 - seg(t, 4.52, 0.3, 'easeInCubic'));
  if (titleVeil > 0.002) {
    layer(function () {
      ctx.globalAlpha = titleVeil * 0.70;
      var g = ctx.createRadialGradient(CX, 470, 60, CX, 470, 1150);
      g.addColorStop(0, 'rgba(4,14,27,0.92)');
      g.addColorStop(0.55, 'rgba(4,14,27,0.72)');
      g.addColorStop(1, 'rgba(4,14,27,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
  }

  titleAt('VOUS ÊTES', CX, 418, 124, t, 3.20, 0.52, { tracking: 2, weight: 900 });
  titleAt('ENTREPRENEUR ?', CX, 566, 124, t, 3.32, 0.52, { tracking: 2, weight: 900 });
  accentRule(CX, 622, 420, 7, t, 3.78, { origin: 'center', dur: 0.55 });
  bodyLine('Vous n’êtes pas seul.', CX, 718, 44, t, 4.05, { color: rgba(C.WHITE, 0.82), alpha: 1 });

  grain(t);
}

/* ==========================================================================
 *  SCENE 2 — REVELATION DU JDE  (4.80 -> 9.60)
 *  Pull-back : la salle se revele. Titre + signature.
 * ======================================================================== */

function screenContentS2(rect, t) {
  // contenu projete : barres + courbe, lisible mais discret
  layer(function () {
    var p = seg(t, 5.00, 1.5, 'easeOutCubic');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = rgba(C.WHITE, 0.85);
    rr(rect.x + rect.w * 0.09, rect.y + rect.h * 0.13, rect.w * 0.34, Math.max(3, rect.h * 0.052), 4);
    ctx.fill();
    ctx.fillStyle = rgba(C.ORANGE, 0.9);
    rr(rect.x + rect.w * 0.09, rect.y + rect.h * 0.24, rect.w * 0.17, Math.max(2, rect.h * 0.030), 3);
    ctx.fill();
    barChart({
      x: rect.x + rect.w * 0.33, y: rect.y + rect.h * 0.84,
      w: rect.w * 0.40, h: rect.h * 0.46, n: 5, prog: p, seed: 7, alpha: 0.95
    });
    lineChart({
      x: rect.x + rect.w * 0.72, y: rect.y + rect.h * 0.84,
      w: rect.w * 0.34, h: rect.h * 0.48, n: 6,
      prog: clamp01((t - 5.5) / 1.6), color: C.ORANGE, seed: 11, lw: 4
    });
  });
}

function drawScene2(t) {
  var cam = newCam();
  // pull-back 2.15 -> 0.92 puis respiration
  // ... puis plongee dans l'ecran de scene (zoom-into-screen) sur 8.55 -> 9.60
  cam.zoom = track(t, [[4.80, 2.15], [5.85, 0.95, 'easeInOutQuint'], [8.55, 1.00, 'easeInOutSine'],
                       [9.60, 2.90, 'easeInOutQuint']]);
  cam.x = track(t, [[4.80, 34], [5.85, -14, 'easeInOutQuint'], [8.55, 26, 'easeInOutSine'],
                    [9.60, 0, 'easeInOutQuint']]);
  cam.y = track(t, [[4.80, 128], [5.85, -6, 'easeInOutQuint'], [8.55, -18, 'easeInOutSine'],
                    [9.60, 78, 'easeInOutQuint']]);

  var rev = seg(t, 4.80, 1.05, 'easeOutCubic');
  var projector = seg(t, 5.00, 3.4, 'easeInOutSine');

  bgDeep(0.02);

  // mur de fond + lueur
  layer(function () {
    pushCam(cam, 0.16);
    glow(CX, 500, 1180, C.BLUE_LT, 0.30 + 0.10 * projector);
    glow(CX - 640, 760, 620, C.ORANGE, 0.10 + 0.05 * projector);
    // panneaux muraux
    ctx.globalAlpha = 0.55;
    for (var i = -3; i <= 3; i++) {
      ctx.fillStyle = rgba(C.BLUE, i % 2 ? 0.24 : 0.12);
      rr(CX + i * 420 - 170, 60, 340, 760, 10); ctx.fill();
    }
  });

  // ecran de scene
  var screenRect = null;
  layer(function () {
    pushCam(cam, 0.26);
    var sp2 = seg(t, 4.82, 0.7, 'easeOutQuart');
    screenRect = stageScreen(CX, 560, 900, 400, 0.6 + 0.4 * sp2, function (r) { screenContentS2(r, t); });
  });

  // faisceau du projecteur
  layer(function () {
    pushCam(cam, 0.34);
    lightShaft(CX + 40, -140, CX, 540, 80, 520, C.BLUE_PALE, 0.16 + 0.12 * projector);
  });

  // intervenant + pupitre
  layer(function () {
    pushCam(cam, 0.46);
    var arm = 0.45 + 0.42 * (0.5 + 0.5 * Math.sin(t * 1.25 + 0.7));
    podium(CX - 600, 812, 200, 150, mixHex(C.BLUE, C.INK, 0.70), C.BLUE_LT);
    figureStanding({
      x: CX - 528, y: 812, h: 420, arm: arm,
      color: mixHex(C.BLUE, C.INK, 0.66), rim: C.ORANGE_LT, alpha: rev
    });
    glow(CX - 560, 640, 300, C.ORANGE, 0.10 * rev);
  });

  // rangees de participants (3 plans de profondeur)
  layer(function () {
    pushCam(cam, 0.66);
    crowdRow({ x0: CX - 760, step: 172, n: 10, y: 858, h: 152, t: t, seed: 3,
               color: mixHex(C.BLUE, C.INK, 0.34), rim: C.BLUE_PALE, rimStrength: 0.42, alpha: rev });
  });
  layer(function () {
    pushCam(cam, 0.84);
    crowdRow({ x0: CX - 880, step: 206, n: 10, y: 962, h: 186, t: t * 1.07, seed: 17,
               color: mixHex(C.BLUE, C.INK, 0.58), rim: C.BLUE_LT, rimStrength: 0.55, alpha: rev });
  });
  layer(function () {
    pushCam(cam, 1.06);
    crowdRow({ x0: CX - 1010, step: 258, n: 10, y: 1104, h: 240, t: t * 0.93, seed: 29,
               color: mixHex(C.BLUE, C.INK, 0.80), rim: C.ORANGE_LT, rimStrength: 0.50, alpha: rev });
  });

  // premier plan : dossiers de chaises (strates d'alpha = profondeur de champ)
  layer(function () {
    pushCam(cam, 1.26);
    for (var k = 0; k < 3; k++) {
      var a = 0.26 - k * 0.07;
      for (var i = -3; i <= 3; i++) {
        chairBack(CX + i * 330 + 150 + k * 2, H + 40 + k * 2, 210, 190,
                  mixHex(C.INK, C.BLUE, 0.08), a * rev);
      }
    }
  });

  floorSheen(1000, C.BLUE_LT, 0.05);
  veilTop(430, 0.72);
  veilBottom(230, 0.40);
  vignette(0.58, CX, 520);

  // --- typographie ---
  labelTrack('MAISON DE L’ENTREPRISE DU NIGER', CX, 150, 30, t, 5.05,
             { color: C.ORANGE, tracking: 0.24, outT0: 8.95, outDur: 0.35, shadow: true });
  titleAt('JEUDI DE L’ENTREPRENEUR', CX, 282, 96, t, 5.90, 0.50,
          { tracking: 1.5, outT0: 9.02, outDur: 0.42 });
  accentRule(CX, 318, 560, 6, t, 6.92, { origin: 'center', dur: 0.6, outT0: 9.00, outDur: 0.3 });
  bodyLine('Le rendez-vous des entrepreneurs', CX, 384, 46, t, 7.08,
           { color: rgba(C.WHITE, 0.90), outT0: 9.00, outDur: 0.35 });

  grain(t);
  return screenRect;
}

/* ==========================================================================
 *  SCENE 3 — QU'EST-CE QUE LE JDE ?  (9.60 -> 15.60)
 *  Travelling lateral continu a travers 4 tableaux d'un meme espace.
 * ======================================================================== */

var S3_TAB = 1700; // ecart entre tableaux (px monde)

function drawScene3(t) {
  var cam = newCam();
  // amorce des 9.30 : recouvrement declare avec la sortie d'ecran de la scene 2
  cam.x = track(t, [
    [9.30, -60, 'easeOutCubic'], [9.60, 0], [10.68, 130, 'easeInOutSine'],
    [11.26, S3_TAB, 'easeInOutCubic'], [11.92, S3_TAB + 120, 'easeInOutSine'],
    [12.46, S3_TAB * 2, 'easeInOutCubic'], [13.04, S3_TAB * 2 + 120, 'easeInOutSine'],
    [13.58, S3_TAB * 3, 'easeInOutCubic'], [15.60, S3_TAB * 3 + 210, 'easeInOutSine']
  ]);
  cam.y = track(t, [[9.30, 18], [9.60, 0], [11.26, -22], [12.46, 16], [13.58, -10], [15.60, -26]]);
  cam.zoom = track(t, [[9.30, 1.12, 'easeOutCubic'], [9.60, 1.02], [11.26, 1.00], [12.46, 1.03], [13.58, 1.00],
                       [15.20, 1.04, 'easeInOutSine'], [15.60, 1.22, 'easeInQuad']]);

  bgDeep(0.01);

  // lueurs d'ambiance par tableau
  layer(function () {
    pushCam(cam, 0.20);
    glow(CX, 500, 820, C.BLUE_LT, 0.20);
    glow(CX + S3_TAB, 520, 760, C.ORANGE, 0.14);
    glow(CX + S3_TAB * 2, 540, 780, C.BLUE_LT, 0.18);
    glow(CX + S3_TAB * 3, 520, 820, C.ORANGE, 0.15);
    ctx.globalAlpha = 0.35;
    for (var i = 0; i < 26; i++) {
      ctx.fillStyle = rgba(C.BLUE, i % 2 ? 0.14 : 0.07);
      rr(i * 480 - 1200, 40, 380, 980, 12); ctx.fill();
    }
  });
  layer(function () {
    pushCam(cam, 0.34);
    dustMotes(t, 44, CX + S3_TAB * 1.5, 520, 6200, C.BLUE_PALE, 0.18);
  });

  // --- strate de fiches de donnees en suspension : donne de la matiere
  //     a l'espace traverse et porte le parallax (depth 0.52) ---
  layer(function () {
    pushCam(cam, 0.52);
    for (var i = 0; i < 16; i++) {
      var wx = -200 + i * 500 + hash2(i, 31) * 180;
      var wy = 150 + hash2(i, 37) * 300 + Math.sin(t * 0.4 + i) * 10;
      var cw = 170 + hash2(i, 41) * 150, ch = 96 + hash2(i, 43) * 64;
      ctx.globalAlpha = 0.5 + hash2(i, 47) * 0.3;
      ctx.fillStyle = rgba(C.BLUE_LT, 0.10);
      rr(wx, wy, cw, ch, 12); ctx.fill();
      ctx.strokeStyle = rgba(C.BLUE_PALE, 0.16); ctx.lineWidth = 1.6;
      rr(wx, wy, cw, ch, 12); ctx.stroke();
      ctx.fillStyle = rgba(i % 3 === 0 ? C.ORANGE : C.BLUE_PALE, 0.30);
      rr(wx + 18, wy + 20, cw * 0.40, 8, 4); ctx.fill();
      ctx.fillStyle = rgba(C.BLUE_PALE, 0.18);
      rr(wx + 18, wy + 44, cw * 0.66, 6, 3); ctx.fill();
      rr(wx + 18, wy + 60, cw * 0.48, 6, 3); ctx.fill();
    }
  });

  /* ---------------- Tableau A — l'expert presente ---------------- */
  layer(function () {
    pushCam(cam, 1.0);
    var pA = seg(t, 9.34, 0.8, 'easeOutQuart');
    // panneau de donnees
    layer(function () {
      ctx.globalAlpha = pA;
      ctx.translate(CX + 250, 420 - (1 - pA) * 40);
      softShadow('#000510', 50, 20, 0.55);
      ctx.fillStyle = mixHex(C.BLUE, C.INK, 0.42);
      rr(-390, -250, 780, 500, 14); ctx.fill();
      noShadow();
      ctx.fillStyle = mixHex(C.INK, C.BLUE, 0.52);
      rr(-368, -228, 736, 456, 8); ctx.fill();
      ctx.strokeStyle = rgba(C.BLUE_PALE, 0.22); ctx.lineWidth = 2;
      rr(-368, -228, 736, 456, 8); ctx.stroke();
      ctx.fillStyle = rgba(C.WHITE, 0.88); rr(-330, -192, 280, 16, 8); ctx.fill();
      ctx.fillStyle = rgba(C.ORANGE, 0.92); rr(-330, -160, 150, 9, 4.5); ctx.fill();
    });
    barChart({ x: CX + 110, y: 596, w: 420, h: 300, n: 6,
               prog: clamp01((t - 9.52) / 1.1), seed: 9, alpha: pA });
    lineChart({ x: CX + 480, y: 596, w: 300, h: 320, n: 6,
                prog: clamp01((t - 9.72) / 1.2), color: C.ORANGE, seed: 4, lw: 5, alpha: pA });
  });
  layer(function () {
    pushCam(cam, 1.0);
    var pA2 = seg(t, 9.40, 0.7, 'easeOutQuart');
    figureStanding({
      x: CX - 430, y: 840, h: 470,
      arm: 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.4)),
      color: mixHex(C.BLUE, C.INK, 0.08), rim: C.ORANGE_LT, alpha: pA2
    });
    // pointeur lumineux vers le panneau
    var pp = seg(t, 9.80, 0.5, 'easeOutCubic');
    if (pp > 0.01) {
      layer(function () {
        ctx.globalAlpha = pp * 0.55;
        ctx.strokeStyle = rgba(C.ORANGE, 0.8); ctx.lineWidth = 2.5;
        ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.moveTo(CX - 330, 470); ctx.lineTo(CX - 40, 420); ctx.stroke();
      });
    }
  });

  /* ---------------- Tableau B — la question ---------------- */
  layer(function () {
    pushCam(cam, 1.0);
    var pB = seg(t, 10.80, 0.8, 'easeOutQuart');
    var raise = seg(t, 11.02, 0.7, 'elasticOut');
    // cercle d'attention
    var ca = seg(t, 11.10, 0.9, 'easeOutCubic');
    if (ca > 0.01) {
      layer(function () {
        ctx.globalAlpha = ca * 0.85;
        ctx.strokeStyle = rgba(C.ORANGE, 0.75); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(CX + S3_TAB + 10, 600, 300 * easeOutCubic(ca), 0, 6.2832); ctx.stroke();
        glow(CX + S3_TAB + 10, 600, 340 * ca, C.ORANGE, 0.18 * ca);
      });
      ripples(CX + S3_TAB + 10, 600, clamp01((t - 11.2) / 1.4), C.ORANGE, 3, 470);
    }
    // voisins
    figureAudience({ x: CX + S3_TAB - 420, y: 800, h: 330, color: mixHex(C.BLUE, C.INK, 0.40),
                     rim: C.BLUE_LT, turn: 0.4, lean: 0.3, alpha: pB });
    figureAudience({ x: CX + S3_TAB + 440, y: 800, h: 330, color: mixHex(C.BLUE, C.INK, 0.40),
                     rim: C.BLUE_LT, turn: -0.45, lean: 0.2, alpha: pB });
    figureRaisedHand({ x: CX + S3_TAB + 10, y: 812, h: 400, raise: raise,
                       color: mixHex(C.BLUE, C.INK, 0.08), rim: C.ORANGE_LT, alpha: pB });
    speechBubble({ x: CX + S3_TAB + 300, y: 360, w: 300, h: 134,
                   prog: clamp01((t - 11.30) / 0.5), flip: false });
  });

  /* ---------------- Tableau C — la prise de notes ---------------- */
  layer(function () {
    pushCam(cam, 1.0);
    var pC = seg(t, 12.00, 0.8, 'easeOutQuart');
    layer(function () {
      ctx.globalAlpha = pC;
      // plan de table
      var g = ctx.createLinearGradient(0, 700, 0, 1080);
      g.addColorStop(0, mixHex(C.BLUE, C.INK, 0.50));
      g.addColorStop(1, mixHex(C.INK, C.BLUE, 0.10));
      ctx.fillStyle = g;
      poly([[CX + S3_TAB * 2 - 1020, 1080], [CX + S3_TAB * 2 - 790, 620],
            [CX + S3_TAB * 2 + 790, 620], [CX + S3_TAB * 2 + 1020, 1080]]);
      ctx.fill();
      ctx.strokeStyle = rgba(C.ORANGE_LT, 0.30); ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(CX + S3_TAB * 2 - 790, 620); ctx.lineTo(CX + S3_TAB * 2 + 790, 620); ctx.stroke();
    });
    notebook({ x: CX + S3_TAB * 2 - 330, y: 790, w: 440, h: 310, rot: -0.09,
               prog: clamp01((t - 12.10) / 1.5), lines: 6, alpha: pC });
    notebook({ x: CX + S3_TAB * 2 + 320, y: 812, w: 400, h: 285, rot: 0.11,
               prog: clamp01((t - 12.32) / 1.5), lines: 5, alpha: pC });
    // stylos
    layer(function () {
      ctx.globalAlpha = pC * 0.95;
      ctx.strokeStyle = C.ORANGE; ctx.lineWidth = 11; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(CX + S3_TAB * 2 - 150, 710); ctx.lineTo(CX + S3_TAB * 2 - 70, 610); ctx.stroke();
      ctx.strokeStyle = rgba(C.BLUE_PALE, 0.8); ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(CX + S3_TAB * 2 + 470, 716); ctx.lineTo(CX + S3_TAB * 2 + 560, 632); ctx.stroke();
    });
    figureAudience({ x: CX + S3_TAB * 2 - 340, y: 606, h: 350,
                     color: mixHex(C.BLUE, C.INK, 0.22), rim: C.BLUE_LT,
                     turn: 0.25, lean: 0.75 + 0.25 * Math.sin(t * 1.6), alpha: pC });
    figureAudience({ x: CX + S3_TAB * 2 + 330, y: 606, h: 350,
                     color: mixHex(C.BLUE, C.INK, 0.22), rim: C.ORANGE_LT,
                     turn: -0.25, lean: 0.70 + 0.25 * Math.sin(t * 1.6 + 1.4), alpha: pC });
  });

  /* ---------------- Tableau D — networking ---------------- */
  layer(function () {
    pushCam(cam, 1.0);
    var pD = seg(t, 13.10, 0.8, 'easeOutQuart');
    var shake = seg(t, 13.42, 0.6, 'elasticOut');
    layer(function () {
      ctx.globalAlpha = pD;
      figurePair({ x: CX + S3_TAB * 3, y: 846, h: 500, shake: shake,
                   c1: mixHex(C.BLUE, C.INK, 0.10),
                   c2: mixHex(C.BLUE, C.SLATE, 0.45) });
    });
    speechBubble({ x: CX + S3_TAB * 3 - 360, y: 350, w: 310, h: 138,
                   prog: clamp01((t - 13.55) / 0.5), flip: true, alpha: pD });
    speechBubble({ x: CX + S3_TAB * 3 + 370, y: 430, w: 280, h: 124,
                   prog: clamp01((t - 13.78) / 0.5), flip: false, alpha: pD });
    // cartes de visite qui s'echangent
    for (var i = 0; i < 3; i++) {
      var cp = clamp01((t - 14.05 - i * 0.12) / 0.9);
      if (cp <= 0.001) continue;
      var k = easeOutCubic(cp);
      businessCard(CX + S3_TAB * 3 + lerp(-120, 170, k) + i * 14,
                   640 - Math.sin(k * Math.PI) * 130 + i * 8,
                   130, lerp(-0.5, 0.42, k) + i * 0.1,
                   pD * Math.min(1, cp * 2.2) * (1 - clamp01((cp - 0.82) / 0.18)));
    }
    // petites figures autour
    figureAudience({ x: CX + S3_TAB * 3 - 700, y: 812, h: 320, color: mixHex(C.BLUE, C.INK, 0.62),
                     rim: C.BLUE_LT, turn: 0.5, alpha: pD * 0.85 });
    figureAudience({ x: CX + S3_TAB * 3 + 720, y: 830, h: 330, color: mixHex(C.BLUE, C.INK, 0.62),
                     rim: C.BLUE_LT, turn: -0.5, alpha: pD * 0.85 });
  });

  floorSheen(1010, C.BLUE_LT, 0.045);
  veilTop(300, 0.52);
  veilBottom(540, 0.90);
  vignette(0.60, CX, 520);

  // --- mots-cles cinetiques (espace ecran, pendant les temps de pause) ---
  kineticWord('APPRENEZ', CX, 980, 118, t, 10.15, 0.92, { tracking: 4 });
  kineticWord('ÉCHANGEZ', CX, 980, 118, t, 11.35, 0.90, { tracking: 4 });
  kineticWord('AGISSEZ',  CX, 980, 118, t, 12.55, 0.88, { tracking: 4 });

  // --- phrase de synthese (3 segments, stagger 0.22 s) ---
  var ph = [
    'Des connaissances pratiques.',
    'Des échanges.',
    'Des opportunités.'
  ];
  for (var i = 0; i < 3; i++) {
    bodyLine(ph[i], 170, 796 + i * 72, 46, t, 13.58 + i * 0.22,
             { align: 'left', color: i === 2 ? C.ORANGE_LT : C.WHITE,
               weight: i === 2 ? 700 : 500, outT0: 15.26, outDur: 0.3 });
  }
  accentRule(170, 716, 190, 6, t, 13.50, { origin: 'left', dur: 0.5, outT0: 15.26 });

  grain(t);
}
