/* ============================================================================
 *  04 — OBJETS THEMATIQUES, DATA-VIZ ET RESEAU  (KIT.md §6 et §7)
 *  Chaque objet recoit prog dans [0,1] et s'assemble sous-element par
 *  sous-element (stagger interne 0.05 s equivalent, courbe elasticSoft).
 * ========================================================================== */

/** Progression du sous-element i (stagger interne). */
function sp(prog, i, ease) {
  var q = clamp01((prog - i * 0.085) / 0.56);
  var f = typeof ease === 'function' ? ease : null;
  return f ? f(q) : elasticSoft(q, 0.30);
}
function spL(prog, i) { return clamp01((prog - i * 0.085) / 0.56); }

/* --------------------------------------------------------------------------
 * DATA-VIZ
 * ------------------------------------------------------------------------ */

/** Histogramme a barres croissantes. */
function barChart(p) {
  var x = p.x, y = p.y, w = p.w, h = p.h, n = p.n || 5, prog = p.prog;
  var bw = w / (n * 1.75);
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    for (var i = 0; i < n; i++) {
      var q = sp(prog, i, easeOutQuart);
      if (q <= 0.001) continue;
      var bh = h * (0.30 + hash2(i, p.seed || 21) * 0.70) * q;
      var bx = x - w / 2 + i * (w / n) + (w / n - bw) / 2;
      var g = ctx.createLinearGradient(0, y - bh, 0, y);
      g.addColorStop(0, i === n - 1 ? C.ORANGE_LT : C.BLUE_LT);
      g.addColorStop(1, i === n - 1 ? C.ORANGE : mixHex(C.BLUE_LT, C.BLUE, 0.75));
      ctx.fillStyle = g;
      rr(bx, y - bh, bw, bh, Math.min(5, bw * 0.22)); ctx.fill();
    }
    ctx.strokeStyle = rgba(C.BLUE_PALE, 0.35); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y + 1); ctx.lineTo(x + w / 2, y + 1); ctx.stroke();
  });
}

/** Courbe ascendante tracee progressivement (+ point de tete lumineux). */
function lineChart(p) {
  var x = p.x, y = p.y, w = p.w, h = p.h, n = p.n || 7, prog = easeInOutCubic(clamp01(p.prog));
  if (prog <= 0.002) return;
  var pts = [];
  for (var i = 0; i < n; i++) {
    var fx = x - w / 2 + (w * i) / (n - 1);
    var fy = y - h * (0.12 + 0.88 * Math.pow(i / (n - 1), 1.35)) - (hash2(i, p.seed || 5) - 0.5) * h * 0.12;
    pts.push([fx, fy]);
  }
  var total = (n - 1) * prog;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = p.color || C.ORANGE;
    ctx.lineWidth = p.lw || 5;
    softShadow(p.color || C.ORANGE, 22, 0, 0.6);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    var k = Math.floor(total), f = total - k, hx = pts[0][0], hy = pts[0][1];
    for (var i = 1; i <= k && i < n; i++) { ctx.lineTo(pts[i][0], pts[i][1]); hx = pts[i][0]; hy = pts[i][1]; }
    if (k < n - 1) {
      hx = lerp(pts[k][0], pts[k + 1][0], f); hy = lerp(pts[k][1], pts[k + 1][1], f);
      ctx.lineTo(hx, hy);
    }
    ctx.stroke();
    noShadow();
    glow(hx, hy, 34, p.color || C.ORANGE, 0.55);
    ctx.fillStyle = C.WHITE;
    ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, 6.2832); ctx.fill();
  });
}

/** Cadran a aiguille. */
function gauge(p) {
  var x = p.x, y = p.y, r = p.r, prog = p.prog, val = p.val === undefined ? 0.72 : p.val;
  var q = elasticSoft(clamp01(prog), 0.28);
  if (q <= 0.002) return;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.translate(x, y); ctx.scale(q, q);
    ctx.fillStyle = p.bg || C.WHITE;
    softShadow('#0A2440', 26, 10, 0.22);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    noShadow();
    ctx.strokeStyle = rgba(C.BLUE, 0.16); ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.74, Math.PI * 0.82, Math.PI * 2.18); ctx.stroke();
    ctx.strokeStyle = C.ORANGE; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, Math.PI * 0.82, Math.PI * 0.82 + Math.PI * 1.36 * val * clamp01(prog * 1.4));
    ctx.stroke();
    // aiguille
    var a = Math.PI * 0.82 + Math.PI * 1.36 * val * clamp01(prog * 1.4);
    ctx.strokeStyle = C.BLUE; ctx.lineWidth = r * 0.085;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.stroke();
    ctx.fillStyle = C.BLUE;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.11, 0, 6.2832); ctx.fill();
  });
}

/** Graphe de reseau : noeuds + aretes a tracé progressif. */
function networkGraph(p) {
  var nodes = p.nodes, prog = p.prog, edges = p.edges;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.lineCap = 'round';
    for (var e = 0; e < edges.length; e++) {
      var q = clamp01((prog - e * 0.055) / 0.42);
      if (q <= 0.001) continue;
      q = easeInOutCubic(q);
      var a = nodes[edges[e][0]], b = nodes[edges[e][1]];
      ctx.strokeStyle = rgba(p.edgeColor || C.ORANGE, (p.edgeAlpha || 0.55) * q);
      ctx.lineWidth = p.lw || 2.4;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      ctx.lineTo(lerp(a[0], b[0], q), lerp(a[1], b[1], q));
      ctx.stroke();
    }
    for (var i = 0; i < nodes.length; i++) {
      var qn = elasticSoft(clamp01((prog - i * 0.04) / 0.4), 0.3);
      if (qn <= 0.001) continue;
      var r = (p.r || 7) * qn;
      glow(nodes[i][0], nodes[i][1], r * 3.2, p.nodeGlow || C.BLUE_LT, 0.30);
      ctx.fillStyle = p.nodeColor || C.WHITE;
      ctx.beginPath(); ctx.arc(nodes[i][0], nodes[i][1], r, 0, 6.2832); ctx.fill();
    }
  });
}

/** Anneau central de la scene communaute. */
function ringOrbit(p) {
  var x = p.x, y = p.y, r = p.r, prog = clamp01(p.prog), t = p.t;
  if (prog <= 0.002 || r <= 0) return;
  layer(function () {
    ctx.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    ctx.translate(x, y);
    glow(0, 0, r * 1.5, C.BLUE_LT, 0.18 * prog);
    ctx.rotate(t * 0.28);
    ctx.strokeStyle = rgba(C.ORANGE, 0.85 * prog);
    ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    var segs = 26;
    for (var i = 0; i < segs; i++) {
      var a0 = (i / segs) * 6.2832, a1 = a0 + 6.2832 / segs * 0.56;
      var vis = clamp01((prog * segs * 1.25) - i);
      if (vis <= 0) break;
      ctx.globalAlpha = (p.alpha === undefined ? 1 : p.alpha) * vis * 0.9;
      ctx.beginPath(); ctx.arc(0, 0, r, a0, lerp(a0, a1, vis)); ctx.stroke();
    }
    ctx.globalAlpha = (p.alpha === undefined ? 1 : p.alpha) * prog;
    ctx.strokeStyle = rgba(C.BLUE_PALE, 0.22); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.18, 0, 6.2832); ctx.stroke();
  });
}

/* ==========================================================================
 * OBJETS THEMATIQUES (scene 4) — univers clair, ombres douces
 * ======================================================================== */

/** 1. FISCALITE — liasse de formulaires + tampon qui frappe. */
function objForms(x, y, s, prog, t) {
  layer(function () {
    ctx.translate(x, y); ctx.scale(s, s);
    for (var i = 2; i >= 0; i--) {
      var q = sp(prog, 2 - i);
      if (q <= 0.001) continue;
      layer(function () {
        ctx.globalAlpha = Math.min(1, q * 1.4);
        ctx.translate((i - 1) * 16, -i * 12 + (1 - q) * 40);
        ctx.rotate((i - 1) * 0.045);
        softShadow('#0A2440', 30, 14, 0.20);
        ctx.fillStyle = C.WHITE;
        rr(-105, -140, 210, 280, 10); ctx.fill();
        noShadow();
        ctx.fillStyle = rgba(C.BLUE, 0.85);
        rr(-78, -112, 120, 13, 6); ctx.fill();
        ctx.fillStyle = rgba(C.SLATE, 0.28);
        for (var k = 0; k < 6; k++) { rr(-78, -78 + k * 26, 156 - (k % 3) * 34, 9, 4.5); ctx.fill(); }
        ctx.strokeStyle = rgba(C.BLUE, 0.22); ctx.lineWidth = 2;
        rr(-105, -140, 210, 280, 10); ctx.stroke();
      });
    }
    // tampon
    var ts = clamp01((prog - 0.42) / 0.34);
    if (ts > 0.001) {
      var drop = 1 - easeOutQuart(ts);
      layer(function () {
        ctx.globalAlpha = Math.min(1, ts * 2.2);
        ctx.translate(44, -34 - drop * 150);
        ctx.fillStyle = C.BLUE;
        rr(-46, 6, 92, 26, 8); ctx.fill();
        rr(-16, -42, 32, 50, 10); ctx.fill();
        rr(-30, -58, 60, 20, 9); ctx.fill();
      });
      // empreinte
      var ip = clamp01((ts - 0.78) / 0.22);
      if (ip > 0.001) {
        layer(function () {
          ctx.globalAlpha = ip * 0.95;
          ctx.translate(44, 24); ctx.rotate(-0.16); ctx.scale(1, 0.9);
          ctx.strokeStyle = C.ORANGE; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(0, 0, 44, 0, 6.2832); ctx.stroke();
          ctx.fillStyle = C.ORANGE;
          ctx.font = FT.display(26, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('OK', 0, 1);
        });
      }
    }
  });
}

/** 2. FINANCEMENT — piles de pieces + courbe ascendante. */
function objCoins(x, y, s, prog, t) {
  layer(function () {
    ctx.translate(x, y); ctx.scale(s, s);
    var cols = [3, 5, 7];
    for (var c = 0; c < 3; c++) {
      for (var i = 0; i < cols[c]; i++) {
        var q = sp(prog, c * 1.1 + i * 0.35);
        if (q <= 0.001) continue;
        var cx2 = (c - 1) * 108;
        var cy2 = -i * 24 + (1 - q) * 70;
        layer(function () {
          ctx.globalAlpha = Math.min(1, q * 1.5);
          softShadow('#0A2440', 18, 8, 0.22);
          var g = ctx.createLinearGradient(cx2 - 46, 0, cx2 + 46, 0);
          g.addColorStop(0, C.ORANGE);
          g.addColorStop(0.5, C.ORANGE_LT);
          g.addColorStop(1, mixHex(C.ORANGE, '#B45F08', 0.55));
          ctx.fillStyle = g;
          ellipsePath(cx2, cy2, 46, 15, 0); ctx.fill();
          noShadow();
          ctx.strokeStyle = rgba('#FFFFFF', 0.35); ctx.lineWidth = 1.6;
          ellipsePath(cx2, cy2 - 2.5, 30, 8.5, 0); ctx.stroke();
        });
      }
    }
    lineChart({ x: 20, y: -196, w: 300, h: 150, n: 6, prog: clamp01((prog - 0.34) / 0.6), color: C.BLUE_LT, seed: 3, lw: 6 });
  });
}

/** 3. GESTION — tableau de bord a cadrans. */
function objDashboard(x, y, s, prog, t) {
  layer(function () {
    ctx.translate(x, y); ctx.scale(s, s);
    var q0 = sp(prog, 0, easeOutQuart);
    if (q0 > 0.001) {
      layer(function () {
        ctx.globalAlpha = Math.min(1, q0 * 1.4);
        ctx.translate(0, (1 - q0) * 50);
        softShadow('#0A2440', 36, 16, 0.20);
        ctx.fillStyle = C.WHITE;
        rr(-250, -160, 500, 320, 18); ctx.fill();
        noShadow();
        ctx.strokeStyle = rgba(C.BLUE, 0.16); ctx.lineWidth = 2;
        rr(-250, -160, 500, 320, 18); ctx.stroke();
        ctx.fillStyle = rgba(C.BLUE, 0.9);
        rr(-214, -128, 150, 14, 7); ctx.fill();
      });
    }
    gauge({ x: -140, y: -22, r: 68, prog: spL(prog, 1), val: 0.74 });
    gauge({ x: 0,    y: -22, r: 68, prog: spL(prog, 2), val: 0.52 });
    gauge({ x: 140,  y: -22, r: 68, prog: spL(prog, 3), val: 0.88 });
    barChart({ x: 0, y: 118, w: 420, h: 86, n: 7, prog: clamp01((prog - 0.34) / 0.6), seed: 13 });
  });
}

/** 4. MARKETING — cible + ondes de diffusion. */
function objTarget(x, y, s, prog, t) {
  layer(function () {
    ctx.translate(x, y); ctx.scale(s, s);
    for (var i = 3; i >= 0; i--) {
      var q = elasticSoft(spL(prog, 3 - i), 0.3);
      if (q <= 0.001) continue;
      layer(function () {
        ctx.globalAlpha = Math.min(1, q * 1.4);
        ctx.scale(q, q);
        ctx.fillStyle = i % 2 ? C.WHITE : (i === 0 ? C.ORANGE : C.BLUE);
        if (i === 3) { softShadow('#0A2440', 34, 14, 0.20); }
        ctx.beginPath(); ctx.arc(0, 0, 40 + i * 48, 0, 6.2832); ctx.fill();
        noShadow();
        ctx.strokeStyle = rgba(C.BLUE, 0.18); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 40 + i * 48, 0, 6.2832); ctx.stroke();
      });
    }
    // ondes de diffusion
    var wp = clamp01((prog - 0.40) / 0.6);
    if (wp > 0.001) {
      layer(function () {
        for (var k = 0; k < 3; k++) {
          var ph = (wp * 1.5 + k * 0.33) % 1;
          ctx.globalAlpha = (1 - ph) * 0.5 * wp;
          ctx.strokeStyle = C.ORANGE; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(0, 0, 190 + ph * 180, 0, 6.2832); ctx.stroke();
        }
      });
    }
    // fleche plantee
    var ap = clamp01((prog - 0.52) / 0.3);
    if (ap > 0.001) {
      layer(function () {
        ctx.globalAlpha = Math.min(1, ap * 1.6);
        var k = easeOutQuart(ap);
        ctx.translate(lerp(240, 24, k), lerp(-250, -26, k));
        ctx.rotate(0.72);
        ctx.strokeStyle = C.BLUE; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -120); ctx.stroke();
        ctx.fillStyle = C.ORANGE;
        poly([[0, 14], [-15, -16], [15, -16]]); ctx.fill();
        ctx.fillStyle = C.BLUE;
        poly([[-6, -120], [-26, -150], [-2, -142]]); ctx.fill();
        poly([[6, -120], [26, -150], [2, -142]]); ctx.fill();
      });
    }
  });
}

/** 5. COMMERCE — devanture + store rayé + panier. */
function objShop(x, y, s, prog, t) {
  layer(function () {
    ctx.translate(x, y); ctx.scale(s, s);
    var q0 = sp(prog, 0, easeOutQuart);
    if (q0 > 0.001) {
      layer(function () {
        ctx.globalAlpha = Math.min(1, q0 * 1.4);
        ctx.translate(0, (1 - q0) * 60);
        softShadow('#0A2440', 38, 16, 0.20);
        ctx.fillStyle = C.WHITE;
        rr(-230, -150, 460, 300, 14); ctx.fill();
        noShadow();
        ctx.fillStyle = rgba(C.BLUE, 0.10);
        rr(-186, -56, 150, 206, 8); ctx.fill();
        rr(36, -56, 150, 120, 8); ctx.fill();
        ctx.strokeStyle = rgba(C.BLUE, 0.20); ctx.lineWidth = 2;
        rr(-230, -150, 460, 300, 14); ctx.stroke();
      });
    }
    // store rayé qui se deploie
    var q1 = spL(prog, 1);
    if (q1 > 0.001) {
      layer(function () {
        var k = easeOutQuart(q1);
        ctx.beginPath(); ctx.rect(-250, -186, 500, 96 * k); ctx.clip();
        for (var i = 0; i < 9; i++) {
          ctx.fillStyle = i % 2 ? C.ORANGE : C.WHITE;
          poly([[-230 + i * 52, -176], [-230 + (i + 1) * 52, -176],
                [-230 + (i + 1) * 52 - 8, -96], [-230 + i * 52 - 8, -96]]);
          ctx.fill();
        }
        ctx.fillStyle = rgba(C.BLUE, 0.22);
        rr(-240, -186, 480, 14, 7); ctx.fill();
      });
    }
    // panier
    var q2 = elasticSoft(spL(prog, 3), 0.3);
    if (q2 > 0.001) {
      layer(function () {
        ctx.globalAlpha = Math.min(1, q2 * 1.5);
        ctx.translate(126, 104); ctx.scale(q2, q2);
        ctx.strokeStyle = C.BLUE; ctx.lineWidth = 8; ctx.lineJoin = 'round';
        poly([[-52, -22], [52, -22], [38, 46], [-38, 46]]); ctx.stroke();
        ctx.fillStyle = rgba(C.ORANGE, 0.9);
        poly([[-46, -14], [46, -14], [34, 38], [-34, 38]]); ctx.fill();
        ctx.strokeStyle = C.BLUE; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, -24, 24, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      });
    }
  });
}

/** 6. DIGITAL — ecran + graphe de noeuds. */
function objScreenNet(x, y, s, prog, t) {
  layer(function () {
    ctx.translate(x, y); ctx.scale(s, s);
    var q0 = sp(prog, 0, easeOutQuart);
    if (q0 > 0.001) {
      layer(function () {
        ctx.globalAlpha = Math.min(1, q0 * 1.4);
        ctx.translate(0, (1 - q0) * 54);
        softShadow('#0A2440', 40, 18, 0.22);
        ctx.fillStyle = mixHex(C.BLUE, C.INK, 0.25);
        rr(-260, -170, 520, 310, 16); ctx.fill();
        noShadow();
        ctx.fillStyle = mixHex(C.INK, C.BLUE, 0.45);
        rr(-240, -150, 480, 268, 8); ctx.fill();
        ctx.fillStyle = mixHex(C.BLUE, C.INK, 0.25);
        rr(-60, 140, 120, 22, 6); ctx.fill();
        rr(-130, 160, 260, 16, 8); ctx.fill();
      });
    }
    var nodes = [[-150, -70], [-40, -112], [78, -56], [160, 10], [40, 42], [-96, 62], [10, -14]];
    var edges = [[6, 0], [6, 1], [6, 2], [6, 4], [0, 5], [2, 3], [4, 3], [1, 2], [5, 4]];
    networkGraph({
      nodes: nodes, edges: edges, prog: clamp01((prog - 0.26) / 0.68),
      edgeColor: C.ORANGE, edgeAlpha: 0.7, nodeColor: C.WHITE, nodeGlow: C.BLUE_LT, r: 8
    });
  });
}

/** 7. DEVELOPPEMENT — escalier + fleche montante. */
function objStairs(x, y, s, prog, t) {
  layer(function () {
    ctx.translate(x, y); ctx.scale(s, s);
    for (var i = 0; i < 5; i++) {
      var q = sp(prog, i, easeOutQuart);
      if (q <= 0.001) continue;
      var bh = 54 + i * 52;
      layer(function () {
        ctx.globalAlpha = Math.min(1, q * 1.4);
        var yy = 110 - bh * q;
        softShadow('#0A2440', 24, 10, 0.18);
        var g = ctx.createLinearGradient(0, yy, 0, 110);
        g.addColorStop(0, i === 4 ? C.ORANGE : C.WHITE);
        g.addColorStop(1, i === 4 ? C.ORANGE_LT : C.PAPER_2);
        ctx.fillStyle = g;
        rr(-230 + i * 96, yy, 84, bh * q, 8); ctx.fill();
        noShadow();
        ctx.strokeStyle = rgba(C.BLUE, 0.16); ctx.lineWidth = 2;
        rr(-230 + i * 96, yy, 84, bh * q, 8); ctx.stroke();
      });
    }
    var ap = clamp01((prog - 0.40) / 0.56);
    if (ap > 0.001) {
      layer(function () {
        var k = easeInOutCubic(ap);
        ctx.globalAlpha = Math.min(1, ap * 1.5);
        ctx.strokeStyle = C.BLUE; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        softShadow(C.BLUE_LT, 18, 0, 0.4);
        ctx.beginPath();
        ctx.moveTo(-250, 96);
        var steps = 24;
        for (var i = 1; i <= steps * k; i++) {
          var u = i / steps;
          ctx.lineTo(-250 + u * 470, 96 - Math.pow(u, 1.25) * 300);
        }
        ctx.stroke();
        noShadow();
        if (k > 0.94) {
          var hx = 220, hy = -204;
          ctx.fillStyle = C.ORANGE;
          layer(function () {
            ctx.translate(hx, hy); ctx.rotate(-0.60);
            poly([[0, -18], [22, 16], [-22, 16]]); ctx.fill();
          });
        }
      });
    }
  });
}

/** Ondes concentriques generiques (accent de transition). */
function ripples(x, y, prog, color, n, rMax) {
  if (prog <= 0.002) return;
  layer(function () {
    for (var k = 0; k < n; k++) {
      var ph = clamp01(prog * 1.4 - k * 0.18);
      if (ph <= 0 || ph >= 1) continue;
      ctx.globalAlpha = (1 - ph) * 0.45;
      ctx.strokeStyle = color; ctx.lineWidth = 3.5 * (1 - ph * 0.5);
      ctx.beginPath(); ctx.arc(x, y, easeOutCubic(ph) * rMax, 0, 6.2832); ctx.stroke();
    }
  });
}
