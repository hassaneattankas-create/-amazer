/* toon.js — personnages 2D AMAZER (style « flat » illustré, sans contour), articulés et déterministes.
 *
 *   const p = A.Toon.person(parent, A.Toon.CAST.aicha);
 *   p.pose({ x, y, s, flip, lean, bob, headTilt, look:[dx,dy], blink, brow, mouth, talk,
 *            near:{sh, el}, far:{sh, el}, legN:{hip, knee}, legF:{hip, knee}, feet:[dxN, dxF, liftN, liftF], sweat, t })
 *   (x, y) = position des pieds dans la scène. Angles en degrés : positif = vers l'avant (le regard).
 *
 *   const m = A.Toon.moto(parent); m.pose({ x, y, s, wheel, lean, t });
 *   A.Toon.walk(phase, amp) -> morceau de pose pour une marche (bras, jambes, rebond).
 *
 * Repère d'un personnage : pieds en (0, 0), tête vers -470 ; 3/4 de face, regard vers +x.
 */
(function (A) {
  const NS = 'http://www.w3.org/2000/svg';
  const f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2);
  const Toon = A.Toon = {};

  /* ---------- distribution ---------- */
  Toon.CAST = {
    aicha: {
      id: 'aicha', skin: '#8B5A3C', skinShade: '#6E4229', lip: '#5A2A1C',
      outfit: '#0F766E', outfitShade: '#0B5A54', trim: '#F5B301', kind: 'dress', head: 'wrap',
      wrap: ['#EA580C', '#FDBA74', '#7C2D12'], sleeve: 'three-quarter', earring: true,
    },
    moussa: {
      id: 'moussa', skin: '#6B4430', skinShade: '#52321F', lip: '#3E1E14',
      outfit: '#F4EEE2', outfitShade: '#DCD3C2', trim: '#1D4ED8', trim2: '#C8961B', kind: 'kaftan', head: 'cap', beard: true,
      sleeve: 'long',
    },
    ibrahim: {
      id: 'ibrahim', skin: '#7A4E33', skinShade: '#5E3A24', lip: '#4A2418',
      outfit: '#FF4D00', outfitShade: '#C93D00', trim: '#F1F5F9', kind: 'jacket', head: 'helmet',
      pants: '#1E293B', pantsShade: '#111827', sleeve: 'long',
    },
    // Fati : étudiante, ambassadrice (pubs affiliation)
    fati: {
      id: 'fati', skin: '#7B4B32', skinShade: '#5F3824', lip: '#4E2318',
      outfit: '#7C3AED', outfitShade: '#5B21B6', trim: '#FDE047', kind: 'dress', head: 'wrap',
      wrap: ['#16A34A', '#BBF7D0', '#14532D'], sleeve: 'three-quarter', earring: true,
    },
    // Hamza : jeune revendeur (pubs « gagner de l'argent »)
    hamza: {
      id: 'hamza', skin: '#5E3B27', skinShade: '#47291A', lip: '#3A1B12',
      outfit: '#2563EB', outfitShade: '#1D4ED8', trim: '#F1F5F9', kind: 'jacket', head: 'cap',
      pants: '#334155', pantsShade: '#1E293B', sleeve: 'long',
    },
  };

  const svgEl = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  Toon.svg = svgEl;

  /* ---------- formes de bouche (centre de la bouche = 0,0) ---------- */
  const MOUTH = {
    smile: { line: 'M -14 -2 Q 0 10 14 -2' },
    flat: { line: 'M -10 1 L 10 1' },
    sad: { line: 'M -12 5 Q 0 -5 12 5' },
    grin: { fill: 'M -17 -4 Q 0 20 17 -4 Q 0 2 -17 -4 Z', teeth: 'M -13 -2.5 Q 0 2 13 -2.5 L 12 2 Q 0 6.5 -12 2 Z' },
    open: { fill: 'M -9 -5 Q 0 -8 9 -5 Q 11 6 0 10 Q -11 6 -9 -5 Z', tongue: 'M -6 6 Q 0 2 6 6 Q 0 10 -6 6 Z' },
    o: { fill: 'M -6 -6 Q 0 -9 6 -6 Q 8 2 0 7 Q -8 2 -6 -6 Z' },
    effort: { fill: 'M -15 -6 L 15 -6 Q 17 0 15 6 L -15 6 Q -17 0 -15 -6 Z', teeth: 'M -13 -4 L 13 -4 L 13 4 L -13 4 Z', bar: 'M -13 0 L 13 0' },
  };

  /** Une personne articulée (SVG). */
  Toon.person = (parent, spec, o = {}) => {
    const S = spec, id = (o.uid ?? S.id) + '_' + (Toon._n = (Toon._n ?? 0) + 1);
    const svg = svgEl('svg', { width: 700, height: 760, viewBox: '-350 -680 700 760', style: 'position:absolute;left:0;top:0;overflow:visible' });
    svg.style.transformOrigin = '350px 680px';
    if (parent) parent.appendChild(svg);
    const defs = svgEl('defs', {}, svg);
    // Motif du foulard (wax : pois et losanges) et broderie.
    if (S.head === 'wrap') {
      const pat = svgEl('pattern', { id: id + '_wax', width: 26, height: 26, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(20)' }, defs);
      svgEl('rect', { width: 26, height: 26, fill: S.wrap[0] }, pat);
      svgEl('circle', { cx: 6, cy: 6, r: 3.6, fill: S.wrap[1] }, pat);
      svgEl('path', { d: 'M 19 13 L 23 19 L 19 25 L 15 19 Z', fill: S.wrap[2], opacity: .55 }, pat);
    }
    const pat2 = svgEl('pattern', { id: id + '_band', width: 18, height: 18, patternUnits: 'userSpaceOnUse' }, defs);
    svgEl('rect', { width: 18, height: 18, fill: S.trim }, pat2);
    svgEl('path', { d: 'M 0 9 L 9 0 L 18 9 L 9 18 Z', fill: S.trim2 ?? S.outfitShade, opacity: .55 }, pat2);

    const root = svgEl('g', {}, svg);
    const shadow = svgEl('ellipse', { cx: 6, cy: 0, rx: 100, ry: 15, fill: 'rgba(40,20,10,.22)' }, root);
    const body = svgEl('g', {}, root); // rebond + inclinaison
    const R = { svg, root, body, shadow, spec: S };

    // --- bras arrière (derrière le corps)
    const arm = (sx, sy, far) => {
      const g = svgEl('g', {}, body);
      const sleeveCol = far ? S.outfitShade : S.outfit;
      const fore = S.sleeve === 'long' ? sleeveCol : (far ? S.skinShade : S.skin);
      // liseré plus sombre sous chaque membre : le bras se détache du vêtement de la même couleur
      const edge = far ? 'rgba(20,10,5,.28)' : 'rgba(20,10,5,.2)';
      const wU = S.kind === 'kaftan' ? 40 : 31, wF = S.kind === 'kaftan' ? 34 : 26;
      svgEl('path', { d: 'M 0 0 L 0 96', stroke: edge, 'stroke-width': wU + 6, 'stroke-linecap': 'round', fill: 'none' }, g);
      svgEl('path', { d: 'M 0 0 L 0 96', stroke: sleeveCol, 'stroke-width': wU, 'stroke-linecap': 'round', fill: 'none' }, g);
      svgEl('path', { d: 'M -6 6 L -6 84', stroke: 'rgba(255,255,255,.16)', 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }, g);
      const fg = svgEl('g', { transform: 'translate(0,96)' }, g);
      svgEl('path', { d: 'M 0 0 L 0 84', stroke: edge, 'stroke-width': wF + 6, 'stroke-linecap': 'round', fill: 'none' }, fg);
      svgEl('path', { d: 'M 0 0 L 0 84', stroke: fore, 'stroke-width': wF, 'stroke-linecap': 'round', fill: 'none' }, fg);
      if (S.kind === 'jacket') svgEl('rect', { x: -14, y: 66, width: 28, height: 10, rx: 4, fill: S.outfitShade }, fg); // poignet
      if (S.sleeve === 'three-quarter') svgEl('path', { d: 'M -15 4 Q 0 12 15 4', stroke: S.trim, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, g).setAttribute('transform', 'translate(0,92)');
      const hand = svgEl('g', { transform: 'translate(0,92)' }, fg);
      svgEl('circle', { cx: 0, cy: 0, r: 15.5, fill: far ? S.skinShade : S.skin }, hand);
      svgEl('ellipse', { cx: 11, cy: -6, rx: 6, ry: 9, fill: far ? S.skinShade : S.skin, transform: 'rotate(-30 11 -6)' }, hand);
      const item = svgEl('g', {}, hand); // objet tenu (téléphone, sac…)
      return { g, fg, hand, item, sx, sy };
    };
    const leg = (hx, hy, far) => {
      const g = svgEl('g', {}, body);
      svgEl('path', { d: 'M 0 0 L 0 100', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 46, 'stroke-linecap': 'round', fill: 'none' }, g);
      svgEl('path', { d: 'M 0 0 L 0 100', stroke: far ? S.pantsShade : S.pants, 'stroke-width': 40, 'stroke-linecap': 'round', fill: 'none' }, g);
      const kg = svgEl('g', { transform: 'translate(0,100)' }, g);
      svgEl('path', { d: 'M 0 0 L 0 92', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 41, 'stroke-linecap': 'round', fill: 'none' }, kg);
      svgEl('path', { d: 'M 0 0 L 0 92', stroke: far ? S.pantsShade : S.pants, 'stroke-width': 35, 'stroke-linecap': 'round', fill: 'none' }, kg);
      const shoe = svgEl('g', { transform: 'translate(0,96)' }, kg);
      svgEl('path', { d: 'M -18 -10 Q -18 -22 2 -22 Q 30 -20 36 -4 L 36 4 L -20 4 Z', fill: far ? '#0B0F19' : '#111827' }, shoe);
      svgEl('rect', { x: -20, y: 2, width: 57, height: 6, rx: 3, fill: '#E5E7EB' }, shoe);
      return { g, kg, hx, hy };
    };

    // ordre de tracé : bras arrière, jambe arrière, robe/veste, jambe avant, tête, bras avant
    R.far = arm(-42, -386, true);
    if (S.kind === 'jacket') { R.legF = leg(-14, -206, true); R.legN = leg(16, -206, false); }
    // pieds visibles sous une robe
    if (S.kind !== 'jacket') {
      R.footF = svgEl('g', {}, body);
      svgEl('ellipse', { cx: 0, cy: 0, rx: 23, ry: 9, fill: '#3B2416' }, R.footF);
      svgEl('ellipse', { cx: 4, cy: -4, rx: 15, ry: 6, fill: S.skinShade }, R.footF);
    }
    const torso = svgEl('g', {}, body);
    if (S.kind === 'dress') {
      svgEl('path', { d: 'M -48 -398 Q 6 -410 58 -398 C 76 -390 84 -350 86 -300 L 108 -26 Q 6 -8 -100 -26 L -80 -300 C -78 -350 -68 -390 -48 -398 Z', fill: S.outfit }, torso);
      svgEl('path', { d: 'M 58 -398 C 76 -390 84 -350 86 -300 L 108 -26 Q 96 -22 84 -20 L 64 -300 C 62 -350 56 -386 44 -398 Z', fill: S.outfitShade }, torso);
      svgEl('path', { d: 'M -100 -26 Q 6 -8 108 -26 L 105 -58 Q 6 -42 -96 -58 Z', fill: `url(#${id}_band)` }, torso);
      svgEl('path', { d: 'M -6 -404 L 11 -366 L 28 -404', stroke: S.trim, 'stroke-width': 6, fill: 'none', 'stroke-linejoin': 'round' }, torso);
      for (let i = 0; i < 4; i++) svgEl('circle', { cx: 11, cy: -350 + i * 16, r: 3, fill: S.trim }, torso);
    } else if (S.kind === 'kaftan') {
      svgEl('path', { d: 'M -58 -398 Q 6 -412 66 -398 C 86 -388 90 -340 90 -300 L 98 -24 Q 6 -10 -90 -24 L -84 -300 C -84 -345 -78 -390 -58 -398 Z', fill: S.outfit }, torso);
      svgEl('path', { d: 'M 66 -398 C 86 -388 90 -340 90 -300 L 98 -24 Q 88 -20 76 -19 L 68 -300 C 66 -350 62 -388 50 -398 Z', fill: S.outfitShade }, torso);
      svgEl('path', { d: 'M 2 -404 L 36 -404 L 31 -214 Q 19 -200 7 -214 Z', fill: `url(#${id}_band)` }, torso);
      svgEl('path', { d: 'M 2 -404 L 36 -404 L 31 -214 Q 19 -200 7 -214 Z', fill: 'none', stroke: S.trim2, 'stroke-width': 3 }, torso);
    } else {
      svgEl('path', { d: 'M -54 -398 Q 6 -410 60 -398 C 76 -388 80 -340 78 -290 L 74 -196 Q 6 -184 -64 -196 L -68 -290 C -70 -340 -68 -390 -54 -398 Z', fill: S.outfit }, torso);
      svgEl('path', { d: 'M 60 -398 C 76 -388 80 -340 78 -290 L 74 -196 Q 66 -192 58 -191 L 60 -290 C 60 -340 56 -388 46 -398 Z', fill: S.outfitShade }, torso);
      svgEl('rect', { x: -68, y: -262, width: 146, height: 14, fill: S.trim, opacity: .92 }, torso);
      svgEl('path', { d: 'M 12 -404 L 14 -198', stroke: S.outfitShade, 'stroke-width': 4 }, torso);
      svgEl('path', { d: 'M -16 -404 Q 12 -388 40 -404 L 36 -414 Q 12 -404 -12 -414 Z', fill: '#1E293B' }, torso);
      // petit logo AMAZER sur la poitrine
      const badge = svgEl('g', { transform: 'translate(46,-338)' }, torso);
      svgEl('circle', { cx: 0, cy: 0, r: 15, fill: '#fff' }, badge);
      svgEl('path', { d: 'M -8 8 L 0 -9 L 8 8 M -4.5 2.5 L 4.5 2.5', stroke: '#FF4D00', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, badge);
    }
    if (S.kind !== 'jacket') {
      R.footN = svgEl('g', {}, body);
      svgEl('ellipse', { cx: 0, cy: 0, rx: 25, ry: 10, fill: '#4A2E1C' }, R.footN);
      svgEl('ellipse', { cx: 5, cy: -4, rx: 16, ry: 6.5, fill: S.skin }, R.footN);
    }
    R.torso = torso;

    // --- tête
    const neck = svgEl('g', {}, body);
    svgEl('rect', { x: -13, y: -420, width: 36, height: 34, rx: 10, fill: S.skin }, neck);
    svgEl('rect', { x: -13, y: -404, width: 36, height: 16, rx: 6, fill: S.skinShade, opacity: .7 }, neck);
    const head = svgEl('g', {}, body);
    R.head = head;
    if (S.head === 'wrap') {
      svgEl('path', { d: 'M -46 -566 C -88 -604 -48 -648 -6 -616 C 22 -660 80 -632 58 -578 Z', fill: `url(#${id}_wax)` }, head);
      svgEl('path', { d: 'M -46 -566 C -88 -604 -48 -648 -6 -616 C 22 -660 80 -632 58 -578 Z', fill: 'rgba(0,0,0,.12)' }, head).setAttribute('transform', 'translate(4,6)');
    }
    svgEl('ellipse', { cx: -44, cy: -466, rx: 11, ry: 15, fill: S.skin }, head);
    svgEl('ellipse', { cx: -44, cy: -466, rx: 5, ry: 8, fill: S.skinShade }, head);
    svgEl('ellipse', { cx: 8, cy: -468, rx: 55, ry: 62, fill: S.skin }, head);
    svgEl('path', { d: 'M -22 -524 Q -54 -470 -24 -410 Q -48 -440 -47 -470 Q -46 -505 -22 -524 Z', fill: S.skinShade, opacity: .55 }, head);
    if (S.earring) svgEl('circle', { cx: -44, cy: -444, r: 4.5, fill: '#F5B301' }, head);
    // joues
    svgEl('ellipse', { cx: 46, cy: -451, rx: 9, ry: 5, fill: '#E0603A', opacity: .22 }, head);
    svgEl('ellipse', { cx: -8, cy: -451, rx: 8, ry: 5, fill: '#E0603A', opacity: .2 }, head);
    // yeux
    const eye = cx => {
      const g = svgEl('g', {}, head);
      const pupil = svgEl('g', {}, g);
      svgEl('ellipse', { cx, cy: -474, rx: 7.2, ry: 9.6, fill: '#1A1010' }, pupil);
      svgEl('circle', { cx: cx + 2.4, cy: -477.5, r: 2.5, fill: '#fff' }, pupil);
      return { g, pupil, cx };
    };
    R.eyes = [eye(-4), eye(32)];
    R.brows = [
      svgEl('path', { d: 'M -14 -494 L 5 -497', stroke: '#1A1010', 'stroke-width': 5, 'stroke-linecap': 'round' }, head),
      svgEl('path', { d: 'M 22 -497 L 42 -494', stroke: '#1A1010', 'stroke-width': 5, 'stroke-linecap': 'round' }, head),
    ];
    svgEl('path', { d: 'M 49 -480 Q 59 -463 47 -457', stroke: S.skinShade, 'stroke-width': 4.5, fill: 'none', 'stroke-linecap': 'round' }, head);
    if (S.beard) {
      svgEl('path', { d: 'M -42 -470 Q -42 -418 -2 -404 Q 30 -398 56 -420 Q 63 -440 60 -452 Q 50 -426 28 -426 Q -2 -426 -30 -448 Z', fill: '#1C1412' }, head);
      svgEl('path', { d: 'M 12 -447 Q 30 -456 47 -446 Q 30 -441 12 -447 Z', fill: '#1C1412' }, head);
    }
    const mouth = svgEl('g', { transform: 'translate(30,-438)' }, head);
    R.mouth = {
      fill: svgEl('path', { d: '', fill: '#5A1A14' }, mouth),
      tongue: svgEl('path', { d: '', fill: '#D9534F' }, mouth),
      teeth: svgEl('path', { d: '', fill: '#fff' }, mouth),
      bar: svgEl('path', { d: '', stroke: '#5A1A14', 'stroke-width': 2, fill: 'none' }, mouth),
      line: svgEl('path', { d: '', stroke: S.lip, 'stroke-width': 4.5, fill: 'none', 'stroke-linecap': 'round' }, mouth),
    };
    if (S.head === 'wrap') {
      svgEl('path', { d: 'M -60 -468 C -74 -540 -30 -592 20 -590 C 72 -588 94 -548 80 -498 C 70 -512 42 -528 10 -527 C -20 -526 -46 -506 -60 -468 Z', fill: `url(#${id}_wax)` }, head);
      svgEl('path', { d: 'M -60 -468 C -56 -492 -40 -514 -14 -524 C -38 -506 -50 -490 -54 -466 Z', fill: 'rgba(0,0,0,.18)' }, head);
      svgEl('path', { d: 'M 80 -498 C 70 -512 42 -528 10 -527 C 40 -520 62 -508 74 -494 Z', fill: 'rgba(255,255,255,.18)' }, head);
    } else if (S.head === 'cap') {
      svgEl('path', { d: 'M -52 -488 Q -48 -546 8 -548 Q 64 -546 68 -488 Q 8 -502 -52 -488 Z', fill: '#FAFAF7' }, head);
      svgEl('path', { d: 'M -51 -498 Q 8 -512 67 -498', stroke: S.trim, 'stroke-width': 4, fill: 'none' }, head);
      svgEl('path', { d: 'M -48 -512 Q 8 -526 64 -512', stroke: S.trim2, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '6 5' }, head);
    } else if (S.head === 'helmet') {
      // casque jet : coque qui couvre le haut et l'arrière, visière courte, bande blanche
      svgEl('path', { d: 'M -66 -452 C -72 -536 -22 -578 22 -578 C 72 -578 96 -540 92 -500 Q 50 -516 6 -516 Q -30 -514 -42 -488 L -40 -440 L -66 -440 Z', fill: S.outfit }, head);
      svgEl('path', { d: 'M -66 -452 C -72 -520 -40 -560 -2 -572 C -34 -548 -50 -510 -48 -458 L -48 -440 L -66 -440 Z', fill: S.outfitShade }, head);
      svgEl('path', { d: 'M -30 -566 Q 22 -588 70 -560', stroke: '#fff', 'stroke-width': 11, fill: 'none', 'stroke-linecap': 'round' }, head);
      svgEl('path', { d: 'M 40 -512 Q 86 -514 108 -494 Q 98 -486 84 -488 Q 64 -500 38 -500 Z', fill: '#1E293B' }, head);
      svgEl('path', { d: 'M -40 -452 Q -24 -414 10 -406', stroke: '#1E293B', 'stroke-width': 4.5, fill: 'none', 'stroke-linecap': 'round' }, head);
    }
    // objet posé sur la tête (sac de riz porté à la nigérienne)
    R.headItem = svgEl('g', {}, head);
    R.near = arm(54, -384, false);
    // bras avant au-dessus de tout
    body.appendChild(R.near.g);
    // gouttes de sueur
    R.sweat = [0, 1, 2].map(i => svgEl('path', { d: 'M 0 -10 Q 7 0 0 6 Q -7 0 0 -10 Z', fill: '#7DD3FC', opacity: 0 }, root));

    /** pose complète (valeurs absentes = repos) */
    R.pose = (p = {}) => {
      const s = p.s ?? 1, fl = p.flip ? -1 : 1;
      svg.style.transform = `translate(${f1((p.x ?? 0) - 350)}px,${f1((p.y ?? 0) - 680)}px) scale(${f2(s * fl * (p.sx ?? 1))},${f2(s * (p.sy ?? 1))})`;
      svg.style.opacity = p.o ?? 1;
      const bob = p.bob ?? 0, lean = p.lean ?? 0;
      body.setAttribute('transform', `translate(0,${f1(bob)}) rotate(${f2(lean)} 0 -200)`);
      shadow.setAttribute('rx', f1(100 * (1 - Math.min(.4, Math.abs(bob) / 120))));
      shadow.setAttribute('opacity', p.shadow ?? 1);
      if (R.legF) R.legF.g.setAttribute('opacity', p.farLeg ?? 1);
      head.setAttribute('transform', `rotate(${f2(p.headTilt ?? 0)} 8 -410) translate(0,${f1(p.headY ?? 0)})`);
      // bras : épaule puis coude (positif = vers l'avant)
      for (const k of ['near', 'far']) {
        const a = R[k], q = p[k] ?? {};
        const rest = k === 'near' ? { sh: 6, el: 8 } : { sh: -6, el: 10 };
        a.g.setAttribute('transform', `translate(${a.sx},${a.sy}) rotate(${f2(-(q.sh ?? rest.sh))})`);
        a.fg.setAttribute('transform', `translate(0,96) rotate(${f2(-(q.el ?? rest.el))})`);
        a.hand.setAttribute('transform', `translate(0,92) rotate(${f2(q.wr ?? 0)})`);
      }
      if (S.kind === 'jacket') {
        for (const k of ['legN', 'legF']) {
          const L = R[k], q = p[k] ?? {};
          L.g.setAttribute('transform', `translate(${L.hx},${L.hy}) rotate(${f2(-(q.hip ?? 0))})`);
          L.kg.setAttribute('transform', `translate(0,100) rotate(${f2(q.knee ?? 0)})`);
        }
      } else {
        const [dn, df, ln, lf] = p.feet ?? [0, 0, 0, 0];
        R.footN.setAttribute('transform', `translate(${f1(26 + dn)},${f1(-6 - ln - bob)})`);
        R.footF.setAttribute('transform', `translate(${f1(-20 + df)},${f1(-8 - lf - bob)})`);
        // la robe suit la marche (léger balancement de l'ourlet)
        torso.setAttribute('transform', `translate(0,-398) skewX(${f2(p.sway ?? 0)}) translate(0,398)`);
      }
      // yeux : regard + clignement
      const [lx, ly] = p.look ?? [0, 0];
      const bl = 1 - (p.blink ?? 0) * .92;
      for (const e of R.eyes) {
        e.pupil.setAttribute('transform', `translate(${f1(lx)},${f1(ly)}) translate(${e.cx},-474) scale(1,${f2(bl * (p.eyeS ?? 1))}) translate(${-e.cx},474)`);
      }
      const br = (p.brow ?? 0) * 7;
      R.brows[0].setAttribute('transform', `translate(0,${f1(-br)}) rotate(${f2(-(p.browTilt ?? 0))} -4 -495)`);
      R.brows[1].setAttribute('transform', `translate(0,${f1(-br)}) rotate(${f2(p.browTilt ?? 0)} 32 -495)`);
      // bouche (« talk » alterne ouvert / sourire)
      let m = p.mouth ?? 'smile';
      if (p.talk) {
        const tt = (p.t ?? 0) * 11;
        const k = Math.sin(tt) * .6 + Math.sin(tt * 1.7 + 1) * .4;
        m = k > .35 ? 'open' : k > -.2 ? 'o' : 'smile';
      }
      const M = MOUTH[m] ?? MOUTH.smile;
      R.mouth.fill.setAttribute('d', M.fill ?? '');
      R.mouth.tongue.setAttribute('d', M.tongue ?? '');
      R.mouth.teeth.setAttribute('d', M.teeth ?? '');
      R.mouth.bar.setAttribute('d', M.bar ?? '');
      R.mouth.line.setAttribute('d', M.line ?? '');
      // sueur : gouttes qui perlent et glissent
      const sw = p.sweat ?? 0, tt = p.t ?? 0;
      R.sweat.forEach((d, i) => {
        const ph = ((tt * .9 + i * .37) % 1);
        const x = [-58, 74, 66][i], y0 = [-520, -540, -470][i];
        d.setAttribute('transform', `translate(${x},${f1(y0 + ph * 50 + bob)}) scale(${f2(.8 + i * .15)})`);
        d.setAttribute('opacity', f2(sw * Math.sin(ph * Math.PI)));
      });
    };
    R.pose({});
    return R;
  };

  /** marche : phase en cycles (1 = deux pas), amp 0..1 */
  Toon.walk = (ph, amp = 1) => {
    const a = Math.sin(ph * Math.PI * 2), c = Math.cos(ph * Math.PI * 2);
    return {
      bob: -Math.abs(Math.sin(ph * Math.PI * 2)) * 9 * amp,
      near: { sh: -a * 26 * amp + 4, el: 14 + Math.max(0, -a) * 18 * amp },
      far: { sh: a * 26 * amp - 4, el: 14 + Math.max(0, a) * 18 * amp },
      legN: { hip: a * 24 * amp, knee: Math.max(0, -c) * 40 * amp + 4 },
      legF: { hip: -a * 24 * amp, knee: Math.max(0, c) * 40 * amp + 4 },
      feet: [a * 30 * amp, -a * 30 * amp, Math.max(0, c) * 12 * amp, Math.max(0, -c) * 12 * amp],
      sway: -a * 3.5 * amp,
    };
  };
  /** clignement naturel, déterministe (≈ toutes les 3 s) */
  Toon.blink = (t, seed = 0) => {
    const period = 2.7 + (seed % 3) * .45, ph = (t + seed * .73) % period;
    return ph < .13 ? Math.sin(ph / .13 * Math.PI) : 0;
  };
  Toon.merge = (...ps) => Object.assign({}, ...ps);

  /** Moto de livraison (vue de profil, vers +x). Origine : sol, entre les roues. */
  Toon.moto = (parent) => {
    const svg = svgEl('svg', { width: 700, height: 420, viewBox: '-350 -380 700 420', style: 'position:absolute;left:0;top:0;overflow:visible' });
    svg.style.transformOrigin = '350px 380px';
    if (parent) parent.appendChild(svg);
    const g = svgEl('g', {}, svg);
    svgEl('ellipse', { cx: 0, cy: 0, rx: 210, ry: 16, fill: 'rgba(40,20,10,.22)' }, g);
    const wheel = cx => {
      const w = svgEl('g', { transform: `translate(${cx},-50)` }, g);
      svgEl('circle', { r: 50, fill: '#111827' }, w);
      svgEl('circle', { r: 33, fill: '#94A3B8' }, w);
      svgEl('circle', { r: 27, fill: '#334155' }, w);
      const spokes = svgEl('g', {}, w);
      for (let i = 0; i < 5; i++) svgEl('rect', { x: -3, y: -27, width: 6, height: 27, rx: 2, fill: '#CBD5E1', transform: `rotate(${i * 72})` }, spokes);
      svgEl('circle', { r: 8, fill: '#E2E8F0' }, w);
      return spokes;
    };
    const spokes = [wheel(-132), wheel(132)];
    // cadre, moteur, réservoir, garde-boue, porte-bagages
    svgEl('path', { d: 'M -132 -50 L -40 -120 L 70 -120 L 132 -50', stroke: '#1E293B', 'stroke-width': 14, fill: 'none', 'stroke-linejoin': 'round' }, g);
    svgEl('rect', { x: -40, y: -118, width: 96, height: 70, rx: 18, fill: '#334155' }, g);
    svgEl('rect', { x: -28, y: -104, width: 72, height: 14, rx: 7, fill: '#475569' }, g);
    svgEl('rect', { x: -28, y: -82, width: 72, height: 14, rx: 7, fill: '#475569' }, g);
    svgEl('circle', { cx: 6, cy: -62, r: 13, fill: '#64748B' }, g);
    svgEl('path', { d: 'M -126 -128 L -196 -128 M -170 -128 L -150 -70 M -196 -128 L -182 -96', stroke: '#1E293B', 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }, g);
    svgEl('path', { d: 'M -120 -132 Q -70 -116 -20 -128 L -14 -108 Q -70 -96 -112 -108 Z', fill: '#C93D00' }, g);
    svgEl('path', { d: 'M 92 -64 Q 132 -112 176 -66', stroke: '#FF4D00', 'stroke-width': 13, fill: 'none', 'stroke-linecap': 'round' }, g);
    svgEl('path', { d: 'M -176 -66 Q -132 -112 -88 -66', stroke: '#C93D00', 'stroke-width': 13, fill: 'none', 'stroke-linecap': 'round' }, g);
    svgEl('path', { d: 'M -10 -126 Q 0 -168 60 -166 Q 104 -164 112 -128 Q 60 -118 -10 -126 Z', fill: '#FF4D00' }, g);
    svgEl('path', { d: 'M 18 -160 Q 60 -170 96 -150', stroke: '#fff', 'stroke-width': 6, fill: 'none', opacity: .7, 'stroke-linecap': 'round' }, g);
    svgEl('path', { d: 'M -118 -132 Q -60 -146 -8 -134 L -10 -120 Q -60 -126 -116 -118 Z', fill: '#111827' }, g);
    svgEl('path', { d: 'M -150 -84 L -40 -84', stroke: '#94A3B8', 'stroke-width': 9, 'stroke-linecap': 'round' }, g); // pot
    svgEl('path', { d: 'M 112 -128 L 140 -196', stroke: '#1E293B', 'stroke-width': 10, 'stroke-linecap': 'round' }, g); // fourche
    svgEl('path', { d: 'M 120 -204 L 160 -196', stroke: '#111827', 'stroke-width': 9, 'stroke-linecap': 'round' }, g); // guidon
    svgEl('path', { d: 'M 150 -170 Q 178 -170 178 -150 Q 160 -140 150 -150 Z', fill: '#FDE68A' }, g); // phare
    svgEl('path', { d: 'M 30 -92 L 66 -92', stroke: '#64748B', 'stroke-width': 8, 'stroke-linecap': 'round' }, g); // repose-pied
    // caisse de livraison AMAZER
    const box = svgEl('g', { transform: 'translate(-160,-132)' }, g);
    svgEl('rect', { x: -58, y: -104, width: 104, height: 104, rx: 12, fill: '#FF4D00' }, box);
    svgEl('rect', { x: 26, y: -104, width: 20, height: 104, rx: 6, fill: '#C93D00' }, box);
    svgEl('rect', { x: -58, y: -104, width: 104, height: 16, rx: 8, fill: '#FF7A1A' }, box);
    svgEl('circle', { cx: -16, cy: -48, r: 26, fill: '#fff' }, box);
    svgEl('path', { d: 'M -29 -36 L -16 -63 L -3 -36 M -23.5 -45 L -8.5 -45', stroke: '#FF4D00', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, box);
    const rider = svgEl('g', {}, g);
    const dust = [0, 1, 2, 3, 4].map(i => svgEl('circle', { r: 16, fill: '#E7C9A0', opacity: 0 }, g));
    const M = { svg, g, rider, spokes, dust };
    M.pose = (p = {}) => {
      const s = p.s ?? 1;
      svg.style.transform = `translate(${f1((p.x ?? 0) - 350)}px,${f1((p.y ?? 0) - 380)}px) scale(${f2(s * (p.flip ? -1 : 1))},${f2(s)})`;
      g.setAttribute('transform', `translate(0,${f1(p.bob ?? 0)}) rotate(${f2(-(p.lean ?? 0))} 0 -50)`);
      const ang = (p.wheel ?? 0) * 180 / Math.PI;
      spokes.forEach(sp => sp.setAttribute('transform', `rotate(${f1(ang)})`));
      const t = p.t ?? 0, k = p.dust ?? 0;
      dust.forEach((d, i) => {
        const ph = (t * 2.2 + i / 5) % 1;
        d.setAttribute('cx', f1(-190 - ph * 160));
        d.setAttribute('cy', f1(-14 - ph * 40 - (i % 2) * 10));
        d.setAttribute('r', f1(10 + ph * 26));
        d.setAttribute('opacity', f2(k * (1 - ph) * .7));
      });
    };
    M.pose({});
    return M;
  };
})(window.A);
