/* ============================================================================
 *  03 — PERSONNAGES & MOBILIER  (KIT.md §4 et §5)
 *  Silhouettes stylisees : formes pleines, proportions adultes (tete ~ h/7.5),
 *  aucun visage, aucun trait caricatural. Modele par rim-light a deux sources.
 * ========================================================================== */

/** Remplit un trace avec une couleur de base + un liseré lumineux d'un cote. */
function rimFill(drawPath, bbox, base, rim, side, strength) {
  layer(function () {
    drawPath();
    ctx.fillStyle = base;
    ctx.fill();
    ctx.clip();
    var x0 = bbox[0], y0 = bbox[1], x1 = bbox[2], y1 = bbox[3];
    var g, k = 0.20;                       // liseré étroit : 20 % de la largeur
    if (side === 'l') g = ctx.createLinearGradient(x0, 0, x0 + (x1 - x0) * k, 0);
    else if (side === 't') g = ctx.createLinearGradient(0, y0, 0, y0 + (y1 - y0) * k);
    else g = ctx.createLinearGradient(x1, 0, x1 - (x1 - x0) * k, 0);
    g.addColorStop(0, rgba(rim, strength === undefined ? 0.62 : strength));
    g.addColorStop(0.45, rgba(rim, (strength === undefined ? 0.62 : strength) * 0.22));
    g.addColorStop(1, rgba(rim, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 4, y0 - 4, (x1 - x0) + 8, (y1 - y0) + 8);
  });
}

function ellipsePath(x, y, rx, ry, rot) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832);
}

/* --------------------------------------------------------------------------
 * Participant assis, vu de trois quarts dos — rang de salle.
 * p : {x, y(base des epaules), h(hauteur tete+torse), color, rim, rimSide,
 *      lean(0..1 penche vers l'avant), turn(-1..1), alpha}
 * ------------------------------------------------------------------------ */
function figureAudience(p) {
  var h = p.h, x = p.x, y = p.y;
  var headR = h * 0.142;
  var shW = h * 0.42, shH = h * 0.66;
  var lean = (p.lean || 0) * h * 0.070;
  var turn = (p.turn || 0);
  var base = p.color || C.BLUE;
  var rim = p.rim || C.BLUE_LT;
  var side = p.rimSide || 'r';
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.translate(0, lean * 0.35);
    var ty = y;
    // torse : flancs droits, epaules en pente, encolure trapezoidale
    var bbT = [x - shW, ty - shH, x + shW, ty + 12];
    rimFill(function () {
      ctx.beginPath();
      ctx.moveTo(x - shW, ty + 12);
      ctx.lineTo(x - shW * 0.94, ty - shH * 0.46);
      ctx.quadraticCurveTo(x - shW * 0.90, ty - shH * 0.73, x - shW * 0.47, ty - shH * 0.82);
      ctx.quadraticCurveTo(x - shW * 0.22 + turn * shW * 0.12, ty - shH * 0.87,
                           x + turn * shW * 0.14, ty - shH * 0.885);
      ctx.quadraticCurveTo(x + shW * 0.24 + turn * shW * 0.12, ty - shH * 0.87,
                           x + shW * 0.47, ty - shH * 0.82);
      ctx.quadraticCurveTo(x + shW * 0.90, ty - shH * 0.73, x + shW * 0.94, ty - shH * 0.46);
      ctx.lineTo(x + shW, ty + 12);
      ctx.closePath();
    }, bbT, base, rim, side, p.rimStrength);
    // cou
    ctx.fillStyle = base;
    rr(x + turn * shW * 0.20 - h * 0.062, ty - shH * 0.96, h * 0.124, h * 0.13, h * 0.045);
    ctx.fill();
    // tete
    var hx = x + turn * shW * 0.34, hy = ty - shH * 0.93 - headR * 1.00 - lean * 0.5;
    var bbH = [hx - headR, hy - headR * 1.14, hx + headR, hy + headR * 1.14];
    rimFill(function () { ellipsePath(hx, hy, headR * 0.88, headR * 1.06, turn * 0.14); },
      bbH, base, rim, side, p.rimStrength);
  });
}

/* --------------------------------------------------------------------------
 * Participant levant la main (question).
 * ------------------------------------------------------------------------ */
function figureRaisedHand(p) {
  var h = p.h, x = p.x, y = p.y;
  var raise = p.raise === undefined ? 1 : p.raise;
  var base = p.color || C.BLUE;
  var rim = p.rim || C.ORANGE_LT;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    figureAudience({ x: x, y: y, h: h, color: base, rim: rim, rimSide: p.rimSide || 'r', turn: 0.15 });
    // bras leve : epaule -> coude -> main
    var sx = x + h * 0.325, sy = y - h * 0.515;
    var ex = sx + h * 0.085 + raise * h * 0.045, ey = sy - h * 0.185 * raise - h * 0.02;
    var mx = ex + h * 0.015, my = ey - h * 0.255 * raise;
    ctx.strokeStyle = base; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = h * 0.100;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(mx, my); ctx.stroke();
    // main
    ctx.fillStyle = base;
    ellipsePath(mx, my - h * 0.032, h * 0.058, h * 0.068, 0); ctx.fill();
    // liseré lumineux sur l'arete exterieure du bras
    ctx.strokeStyle = rgba(rim, 0.45); ctx.lineWidth = h * 0.016;
    ctx.beginPath();
    ctx.moveTo(sx + h * 0.042, sy); ctx.lineTo(ex + h * 0.042, ey);
    ctx.lineTo(mx + h * 0.042, my - h * 0.02); ctx.stroke();
  });
}

/* --------------------------------------------------------------------------
 * Intervenant debout, geste de presentation.
 * p : {x, y(sol), h(hauteur totale), arm(0..1 amplitude du geste), color, rim}
 * ------------------------------------------------------------------------ */
function figureStanding(p) {
  var h = p.h, x = p.x, y = p.y;
  var base = p.color || mixHex(C.BLUE, C.INK, 0.15);
  var rim = p.rim || C.ORANGE_LT;
  var headR = h * 0.062;
  var arm = p.arm === undefined ? 0.6 : p.arm;
  var flip = p.flip ? -1 : 1;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.translate(x, y); ctx.scale(flip, 1);
    // jambes
    ctx.strokeStyle = base; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = h * 0.072;
    ctx.beginPath();
    ctx.moveTo(-h * 0.030, -h * 0.46); ctx.lineTo(-h * 0.055, -h * 0.015);
    ctx.moveTo(h * 0.034, -h * 0.46);  ctx.lineTo(h * 0.062, -h * 0.015);
    ctx.stroke();
    // torse
    var bb = [-h * 0.10, -h * 0.80, h * 0.10, -h * 0.40];
    rimFill(function () {
      ctx.beginPath();
      ctx.moveTo(-h * 0.052, -h * 0.425);
      ctx.bezierCurveTo(-h * 0.098, -h * 0.55, -h * 0.100, -h * 0.70, -h * 0.078, -h * 0.775);
      ctx.bezierCurveTo(-h * 0.030, -h * 0.805, h * 0.030, -h * 0.805, h * 0.078, -h * 0.775);
      ctx.bezierCurveTo(h * 0.100, -h * 0.70, h * 0.098, -h * 0.55, h * 0.052, -h * 0.425);
      ctx.closePath();
    }, bb, base, rim, 'r', 0.5);
    // bras de geste (vers l'ecran)
    var sx = h * 0.072, sy = -h * 0.755;
    var ex = sx + h * 0.085 + arm * h * 0.035, ey = sy + h * 0.085 - arm * h * 0.055;
    var hx = ex + h * 0.085 + arm * h * 0.055, hy = ey - h * 0.025 - arm * h * 0.085;
    ctx.strokeStyle = base; ctx.lineWidth = h * 0.044;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = rgba(rim, 0.55); ctx.lineWidth = h * 0.011;
    ctx.beginPath(); ctx.moveTo(sx, sy - 2); ctx.lineTo(ex, ey - 2); ctx.lineTo(hx, hy - 2); ctx.stroke();
    ctx.fillStyle = base; ellipsePath(hx, hy, h * 0.024, h * 0.027, 0); ctx.fill();
    // bras arriere
    ctx.strokeStyle = rgba(base, 0.9); ctx.lineWidth = h * 0.040;
    ctx.beginPath(); ctx.moveTo(-sx, sy); ctx.lineTo(-sx - h * 0.018, sy + h * 0.15); ctx.stroke();
    // cou + tete
    ctx.fillStyle = base;
    rr(-h * 0.020, -h * 0.825, h * 0.040, h * 0.035, h * 0.015); ctx.fill();
    var bbh = [-headR * 1.2, -h * 0.825 - headR * 2.2, headR * 1.2, -h * 0.80];
    rimFill(function () { ellipsePath(0, -h * 0.825 - headR * 0.95, headR * 0.94, headR * 1.08, 0); },
      bbh, base, rim, 'r', 0.5);
  });
}

/* --------------------------------------------------------------------------
 * Entrepreneur assis a son poste de travail, trois quarts (scene 1).
 * ------------------------------------------------------------------------ */
function figureSeated(p) {
  var h = p.h, x = p.x, y = p.y; // y = assise
  var base = p.color || mixHex(C.BLUE, C.INK, 0.12);
  var rim = p.rim || C.BLUE_LT;
  var rim2 = p.rim2 || C.ORANGE_LT;
  var headR = h * 0.105;
  var breathe = p.breathe || 0;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.translate(x, y + breathe);
    // torse incline vers la table
    var bb = [-h * 0.30, -h * 0.80, h * 0.30, 0];
    rimFill(function () {
      ctx.beginPath();
      ctx.moveTo(-h * 0.255, h * 0.02);
      ctx.bezierCurveTo(-h * 0.300, -h * 0.30, -h * 0.280, -h * 0.60, -h * 0.185, -h * 0.705);
      ctx.bezierCurveTo(-h * 0.080, -h * 0.780, h * 0.090, -h * 0.775, h * 0.175, -h * 0.700);
      ctx.bezierCurveTo(h * 0.268, -h * 0.58, h * 0.292, -h * 0.28, h * 0.250, h * 0.02);
      ctx.closePath();
    }, bb, base, rim, 'l', 0.46);
    // liseré chaud cote droit
    layer(function () {
      ctx.beginPath();
      ctx.moveTo(-h * 0.255, h * 0.02);
      ctx.bezierCurveTo(-h * 0.300, -h * 0.30, -h * 0.280, -h * 0.60, -h * 0.185, -h * 0.705);
      ctx.bezierCurveTo(-h * 0.080, -h * 0.780, h * 0.090, -h * 0.775, h * 0.175, -h * 0.700);
      ctx.bezierCurveTo(h * 0.268, -h * 0.58, h * 0.292, -h * 0.28, h * 0.250, h * 0.02);
      ctx.closePath(); ctx.clip();
      var g = ctx.createLinearGradient(h * 0.30, 0, h * 0.02, 0);
      g.addColorStop(0, rgba(rim2, 0.42)); g.addColorStop(1, rgba(rim2, 0));
      ctx.fillStyle = g; ctx.fillRect(-h * 0.32, -h * 0.82, h * 0.64, h * 0.9);
    });
    // bras avant-droit pose sur la table
    ctx.strokeStyle = base; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = h * 0.095;
    ctx.beginPath();
    ctx.moveTo(h * 0.195, -h * 0.605); ctx.lineTo(h * 0.330, -h * 0.330); ctx.lineTo(h * 0.470, -h * 0.250);
    ctx.stroke();
    ctx.strokeStyle = rgba(rim2, 0.42); ctx.lineWidth = h * 0.016;
    ctx.beginPath();
    ctx.moveTo(h * 0.225, -h * 0.605); ctx.lineTo(h * 0.358, -h * 0.330); ctx.lineTo(h * 0.492, -h * 0.252);
    ctx.stroke();
    // bras gauche
    ctx.strokeStyle = rgba(base, 0.95); ctx.lineWidth = h * 0.085;
    ctx.beginPath();
    ctx.moveTo(-h * 0.205, -h * 0.600); ctx.lineTo(-h * 0.300, -h * 0.330); ctx.lineTo(-h * 0.165, -h * 0.245);
    ctx.stroke();
    // cou
    ctx.fillStyle = base;
    rr(-h * 0.052, -h * 0.805, h * 0.104, h * 0.075, h * 0.035); ctx.fill();
    // tete legerement penchee
    var bbh = [-headR * 1.3, -h * 0.80 - headR * 2.3, headR * 1.3, -h * 0.76];
    rimFill(function () { ellipsePath(h * 0.012, -h * 0.805 - headR * 0.90, headR * 0.93, headR * 1.07, -0.07); },
      bbh, base, rim, 'l', 0.46);
  });
}

/* --------------------------------------------------------------------------
 * Rangee procedurale de participants (parallax de salle).
 * p : {y, h, n, x0, step, color, rim, t, alpha, depthTint}
 * ------------------------------------------------------------------------ */
function crowdRow(p) {
  var n = p.n, t = p.t || 0;
  for (var i = 0; i < n; i++) {
    var jx = (hash2(i, p.seed || 1) - 0.5) * p.step * 0.30;
    var jh = 1 + (hash2(i, (p.seed || 1) + 40) - 0.5) * 0.14;
    var ph = hash2(i, (p.seed || 1) + 80) * 6.2832;
    // prise de notes : oscillation sinusoidale dephasee (deterministe)
    var noteAmp = (hash2(i, (p.seed || 1) + 120) > 0.45) ? 1 : 0;
    var lean = noteAmp * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.15 + ph)));
    var turn = (hash2(i, (p.seed || 1) + 160) - 0.5) * 0.55;
    figureAudience({
      x: p.x0 + i * p.step + jx,
      y: p.y + (hash2(i, (p.seed || 1) + 200) - 0.5) * 6,
      h: p.h * jh,
      color: p.color, rim: p.rim,
      rimSide: (i % 2) ? 'r' : 'l',
      rimStrength: p.rimStrength,
      lean: lean, turn: turn,
      alpha: p.alpha === undefined ? 1 : p.alpha
    });
  }
}

/* --------------------------------------------------------------------------
 * Silhouette compacte pour la scene communaute (14 gabarits).
 * ------------------------------------------------------------------------ */
function figureIcon(p) {
  var h = p.h, x = p.x, y = p.y;
  var base = p.color || C.BLUE_LT;
  var sw = h * (p.shoulder || 0.40);          // demi-largeur d'epaules (variante)
  var headR = h * (p.headR || 0.235);
  var tilt = p.tilt || 0;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    if (p.glowA) { glow(x, y - h * 0.45, h * 1.1, p.glowC || C.BLUE_LT, p.glowA); }
    ctx.fillStyle = base;
    // buste : flancs droits et epaules en pente (pas de champignon)
    ctx.beginPath();
    ctx.moveTo(x - sw, y);
    ctx.lineTo(x - sw * 0.95, y - h * 0.30);
    ctx.quadraticCurveTo(x - sw * 0.92, y - h * 0.50, x - sw * 0.44, y - h * 0.57);
    ctx.quadraticCurveTo(x - sw * 0.18, y - h * 0.62, x + tilt * sw * 0.18, y - h * 0.635);
    ctx.quadraticCurveTo(x + sw * 0.20, y - h * 0.62, x + sw * 0.46, y - h * 0.57);
    ctx.quadraticCurveTo(x + sw * 0.94, y - h * 0.50, x + sw * 0.97, y - h * 0.30);
    ctx.lineTo(x + sw, y);
    ctx.closePath(); ctx.fill();
    // cou
    rr(x + tilt * sw * 0.2 - h * 0.055, y - h * 0.70, h * 0.11, h * 0.10, h * 0.04); ctx.fill();
    // tete
    var hx = x + tilt * sw * 0.30, hy = y - h * 0.685 - headR * 0.90;
    ellipsePath(hx, hy, headR * 0.86, headR, tilt * 0.12); ctx.fill();
    if (p.rim) {
      ctx.strokeStyle = rgba(p.rim, 0.5); ctx.lineWidth = Math.max(1.2, h * 0.028);
      ellipsePath(hx, hy, headR * 0.86, headR, tilt * 0.12); ctx.stroke();
    }
  });
}

/* --------------------------------------------------------------------------
 * Duo en echange + poignee de main (scene 3 networking).
 * ------------------------------------------------------------------------ */
function figurePair(p) {
  var h = p.h, x = p.x, y = p.y;
  var shake = p.shake === undefined ? 0 : p.shake;
  figureStanding({ x: x - h * 0.17, y: y, h: h, color: p.c1 || C.BLUE, rim: C.BLUE_LT, arm: 0.1 });
  figureStanding({ x: x + h * 0.17, y: y, h: h, color: p.c2 || mixHex(C.BLUE, C.SLATE, 0.5), rim: C.ORANGE_LT, arm: 0.1, flip: true });
  if (shake > 0.01) {
    layer(function () {
      ctx.globalAlpha = Math.min(1, shake);
      var yy = y - h * 0.50;
      ctx.strokeStyle = p.c1 || C.BLUE; ctx.lineCap = 'round';
      ctx.lineWidth = h * 0.040;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.095, y - h * 0.615); ctx.lineTo(x - h * 0.012, yy); ctx.stroke();
      ctx.strokeStyle = p.c2 || mixHex(C.BLUE, C.SLATE, 0.5);
      ctx.beginPath();
      ctx.moveTo(x + h * 0.095, y - h * 0.615); ctx.lineTo(x + h * 0.012, yy); ctx.stroke();
      // lueur de contact
      glow(x, yy, h * 0.17 * shake, C.ORANGE, 0.55 * shake);
      ctx.fillStyle = C.ORANGE_LT;
      ellipsePath(x, yy, h * 0.030, h * 0.026, 0); ctx.fill();
    });
  }
}

/* ==========================================================================
 * MOBILIER & OBJETS DE SCENE
 * ======================================================================== */

/** Dossier de chaise (premier plan de salle). */
function chairBack(x, y, w, h, color, alpha) {
  layer(function () {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    rr(x - w / 2, y - h, w, h, w * 0.14); ctx.fill();
    ctx.fillStyle = rgba('#000000', 0.25);
    rr(x - w / 2, y - h * 0.22, w, h * 0.22, 6); ctx.fill();
  });
}

/** Pupitre d'intervenant. */
function podium(x, y, w, h, color, rim) {
  layer(function () {
    ctx.fillStyle = color;
    poly([[x - w / 2, y], [x - w * 0.40, y - h], [x + w * 0.40, y - h], [x + w / 2, y]]);
    ctx.fill();
    var g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, rgba(rim, 0.35)); g.addColorStop(1, rgba(rim, 0));
    ctx.fillStyle = g;
    poly([[x - w / 2, y], [x - w * 0.40, y - h], [x + w * 0.40, y - h], [x + w / 2, y]]);
    ctx.fill();
    ctx.fillStyle = rgba(C.ORANGE, 0.9);
    rr(x - w * 0.14, y - h * 0.62, w * 0.28, 5, 2.5); ctx.fill();
  });
}

/**
 * Ecran de scene. `content(innerRect)` dessine le contenu projete.
 * Retourne le rectangle interieur (utile pour le portail de transition).
 */
function stageScreen(x, y, w, h, prog, content, opts) {
  opts = opts || {};
  var pw = w * prog, ph = h * prog;
  var rect = { x: x - pw / 2, y: y - ph / 2, w: pw, h: ph };
  layer(function () {
    // cadre
    softShadow('#000814', 60, 18, 0.6);
    ctx.fillStyle = mixHex(C.INK, C.BLUE, 0.35);
    rr(rect.x - 14, rect.y - 14, rect.w + 28, rect.h + 28, 10); ctx.fill();
    noShadow();
    // surface
    var g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, mixHex(C.BLUE, C.BLUE_LT, 0.30));
    g.addColorStop(1, mixHex(C.INK, C.BLUE, 0.55));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.fill();
    if (content) {
      layer(function () {
        ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
        content(rect);
      });
    }
    // reflet diagonal
    layer(function () {
      ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      var r = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.8, rect.y + rect.h);
      r.addColorStop(0, 'rgba(255,255,255,0.10)');
      r.addColorStop(0.45, 'rgba(255,255,255,0.02)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    });
    ctx.strokeStyle = rgba(C.BLUE_PALE, 0.30); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.stroke();
  });
  return rect;
}

/** Poste de travail en perspective : plateau, lampe, ecran, carnet, dossiers. */
function deskSetup(p) {
  var cx = p.x, y = p.y, w = p.w, prog = p.prog === undefined ? 1 : p.prog, t = p.t || 0;
  var pTop   = seg(prog, 0, 1, 'linear');
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    // plateau en perspective
    var pw = w * (0.55 + 0.45 * pTop);
    var depth = p.depth || 150;
    softShadow('#000510', 70, -10, 0.65);
    var g = ctx.createLinearGradient(0, y - depth, 0, y + 40);
    g.addColorStop(0, mixHex(C.BLUE, C.INK, 0.45));
    g.addColorStop(1, mixHex(C.INK, C.BLUE, 0.18));
    ctx.fillStyle = g;
    poly([[cx - pw / 2, y], [cx - pw * 0.40, y - depth], [cx + pw * 0.40, y - depth], [cx + pw / 2, y]]);
    ctx.fill();
    noShadow();
    // arête lumineuse du plateau
    ctx.strokeStyle = rgba(C.ORANGE_LT, 0.45); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - pw * 0.40, y - depth); ctx.lineTo(cx + pw * 0.40, y - depth); ctx.stroke();
    ctx.strokeStyle = rgba(C.BLUE_PALE, 0.22); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - pw / 2, y); ctx.lineTo(cx + pw / 2, y); ctx.stroke();
  });
}

/** Carnet avec lignes d'ecriture tracees progressivement. */
function notebook(p) {
  var x = p.x, y = p.y, w = p.w, h = p.h, prog = p.prog === undefined ? 1 : p.prog;
  var rot = p.rot || 0;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.translate(x, y); ctx.rotate(rot);
    softShadow('#000814', 30, 12, 0.5);
    ctx.fillStyle = p.paper || C.PAPER;
    rr(-w / 2, -h / 2, w, h, 8); ctx.fill();
    noShadow();
    ctx.fillStyle = rgba(C.ORANGE, 0.85);
    rr(-w / 2, -h / 2, w * 0.055, h, 8); ctx.fill();
    // lignes
    var nL = p.lines || 5;
    for (var i = 0; i < nL; i++) {
      var lp = clamp01((prog - i * (0.8 / nL)) / (0.8 / nL));
      if (lp <= 0) break;
      var lw = (w * (0.62 + hash2(i, 9) * 0.22)) * easeOutCubic(lp);
      ctx.fillStyle = rgba(C.SLATE, 0.55);
      rr(-w * 0.36, -h / 2 + h * (0.20 + i * (0.62 / nL)), lw, Math.max(2, h * 0.035), 2);
      ctx.fill();
    }
  });
}

/** Bulle de dialogue. */
function speechBubble(p) {
  var x = p.x, y = p.y, w = p.w, h = p.h, prog = p.prog === undefined ? 1 : p.prog;
  if (prog <= 0.01) return;
  var s = elasticSoft(prog, 0.3);
  layer(function () {
    ctx.globalAlpha = Math.min(1, prog * 1.6) * (p.alpha === undefined ? 1 : p.alpha);
    ctx.translate(x, y); ctx.scale(s, s);
    softShadow('#000814', 26, 10, 0.45);
    ctx.fillStyle = p.fill || rgba(C.WHITE, 0.95);
    rr(-w / 2, -h / 2, w, h, h * 0.30); ctx.fill();
    poly([[(p.flip ? 1 : -1) * w * 0.22, h / 2 - 2], [(p.flip ? 1 : -1) * w * 0.38, h / 2 + h * 0.34], [(p.flip ? 1 : -1) * w * 0.06, h / 2 - 2]]);
    ctx.fill();
    noShadow();
    // lignes de contenu
    for (var i = 0; i < 2; i++) {
      ctx.fillStyle = rgba(C.SLATE, 0.42);
      rr(-w * 0.34, -h * 0.18 + i * h * 0.26, w * (0.56 - i * 0.18), h * 0.11, h * 0.055);
      ctx.fill();
    }
  });
}

/** Carte de visite qui s'echange. */
function businessCard(x, y, w, rot, alpha) {
  layer(function () {
    ctx.globalAlpha = alpha;
    ctx.translate(x, y); ctx.rotate(rot);
    softShadow('#000814', 18, 6, 0.5);
    ctx.fillStyle = C.PAPER; rr(-w / 2, -w * 0.3, w, w * 0.6, 4); ctx.fill();
    noShadow();
    ctx.fillStyle = rgba(C.ORANGE, 0.9); rr(-w * 0.42, -w * 0.18, w * 0.30, w * 0.06, 3); ctx.fill();
    ctx.fillStyle = rgba(C.SLATE, 0.45); rr(-w * 0.42, -w * 0.02, w * 0.62, w * 0.05, 3); ctx.fill();
    ctx.fillStyle = rgba(C.SLATE, 0.30); rr(-w * 0.42, w * 0.10, w * 0.44, w * 0.05, 3); ctx.fill();
  });
}
