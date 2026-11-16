/* toon1 — « Commandez, on vous livre » · pub à personnages · 1080×1920 · 60 i/s · ≈ 27 s
 *
 * Concept : on fait ressentir la corvée (25 kg de riz sous 42 °C) pour que la livraison soit un soulagement.
 * L'application n'apparaît que 4 s (gros plan téléphone) : le reste est raconté par les personnages.
 *  S1 0.00– 4.05  Rue en plein soleil : Aïcha porte le sac sur la tête, sue, le pose. « 25 kg de riz… sous ce soleil ? »
 *  S2 3.95– 6.25  Salon à l'ombre, ventilateur : elle s'affale, soupire, sort son téléphone. « Restez plutôt à l'ombre ! »
 *  S3 6.15–10.30  Gros plan : Commander → Nita / Amana → « Paiement vérifié par AMAZER ».
 *  S4 10.25–12.50 Boutique de Moussa : « Commande payée : à préparer », il pose le sac, Ibrahim le prend.
 *  S5 12.45–16.95 Ibrahim traverse Niamey à moto (parallaxe : fleuve, pont, maisons en banco, minaret).
 *  S6 16.90–20.25 Portail bleu : il frappe, Aïcha montre son reçu, il scanne, « Livraison confirmée ».
 *  S7 20.15–27.00 Carte de fin orange : logo, « Commandez. On vous livre. », amazer.store, les trois personnages.
 * Textes de l'application repris du site (Commander, Moyen de paiement, Paiement vérifié par AMAZER,
 * Commande payée : à préparer, Livraison confirmée). Personnages, boutique et produit : fictifs.
 */
(function (A) {
  const C = A.C, E = A.E, T = A.Toon, svgEl = T.svg;
  const TM = (window.GUIDE_TIMING && window.GUIDE_TIMING.segments) || {};
  const seg = (id, k = 'start', d = 0) => (TM[id] ? TM[id][k] : d);
  const cues = [];
  const cue = (t, s, g = .6, p = 0) => cues.push({ t: +t.toFixed(3), s, g, p });
  const NAVY = '#0F172A';

  /* ---------------- outils ---------------- */
  /** svg libre : origine (0,0) au point d'ancrage (ox, oy) de la boîte w×h */
  const box = (parent, w, h, ox, oy, inner) => {
    const s = svgEl('svg', { width: w, height: h, viewBox: `${-ox} ${-oy} ${w} ${h}`, style: 'position:absolute;left:0;top:0;overflow:visible' });
    s.style.transformOrigin = `${ox}px ${oy}px`;
    s.innerHTML = inner;
    parent.appendChild(s);
    s._o = [ox, oy];
    return s;
  };
  const put = (e, x, y, s = 1, r = 0, o = 1) => {
    e.style.transform = `translate(${(x - e._o[0]).toFixed(1)}px,${(y - e._o[1]).toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    e.style.opacity = o.toFixed(3);
  };
  /** fond plein écran en SVG */
  const scenery = (parent, inner) => {
    const d = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px' } }, parent);
    d.innerHTML = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0">${inner}</svg>`;
    return d;
  };
  const SACK = `
    <path d="M -118 0 Q -130 -80 -110 -150 Q -60 -174 0 -168 Q 60 -174 110 -150 Q 130 -80 118 0 Q 0 12 -118 0 Z" fill="#F1E5C6"/>
    <path d="M 72 -162 Q 112 -150 118 0 Q 98 6 80 6 Q 94 -80 72 -162 Z" fill="#DCCBA2"/>
    <path d="M -106 -150 Q 0 -166 106 -150" stroke="#B9A57A" stroke-width="4" stroke-dasharray="10 7" fill="none"/>
    <rect x="-80" y="-122" width="160" height="82" rx="12" fill="#fff" opacity=".92"/>
    <text x="0" y="-76" text-anchor="middle" font-family="Geist" font-weight="800" font-size="44" fill="#C2410C">RIZ</text>
    <text x="0" y="-48" text-anchor="middle" font-family="Geist" font-weight="700" font-size="26" fill="#15803D">25 kg</text>`;
  const PHONE_SMALL = `<rect x="-16" y="-66" width="44" height="80" rx="9" fill="#111827"/><rect x="-12" y="-60" width="36" height="66" rx="5" fill="#FF4D00"/><circle cx="6" cy="-28" r="9" fill="#fff"/>`;

  /** autocollant de sous-titre (carte blanche, mots qui montent) */
  const sticker = (parent, text, o = {}) => {
    const wrap = A.el('div', { cls: 'abs', style: { background: o.bg ?? '#fff', borderRadius: '30px', padding: '22px 36px 26px', boxShadow: '0 22px 50px -20px rgba(60,25,5,.55)', display: 'inline-block' } }, parent);
    const ty = A.Type.make(wrap, text, { size: o.size ?? 70, weight: 800, color: o.color ?? NAVY, align: 'center', accent: o.accent ?? C.orange, lh: 1.06 });
    ty.el.style.position = 'relative';
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    wrap.style.left = (540 - w / 2) + 'px';
    wrap.style.top = ((o.y ?? 330) - h / 2) + 'px';
    wrap.style.transformOrigin = '50% 50%';
    return { wrap, ty, rot: o.rot ?? -2 };
  };
  const playSticker = (st, t, tIn, tOut) => {
    const k = A.P(t, tIn, tIn + .55, E.spring), q = A.P(t, tOut, tOut + .25, E.expoIn);
    const s = (t < tIn ? .5 : .55 + .45 * k) * (1 - .25 * q);
    st.wrap.style.transform = `rotate(${(st.rot * (1 - k * .4) + (1 - k) * -6).toFixed(2)}deg) scale(${s.toFixed(3)})`;
    st.wrap.style.opacity = (A.lin(t, tIn, tIn + .1) * (1 - q)).toFixed(3);
    st.wrap.style.visibility = t >= tIn && t < tOut + .25 ? 'visible' : 'hidden';
    A.Type.play(st.ty, t, tIn + .06, 1e9, { stagger: .045, dur: .5, tilt: 4 });
  };
  /** éclats « c'est fait » autour d'un point */
  const sparks = (parent, n = 8, col = '#FDE047') => {
    const g = A.el('div', { cls: 'abs' }, parent);
    const items = Array.from({ length: n }, () => A.el('div', { cls: 'abs', style: { width: '14px', height: '44px', borderRadius: '7px', background: col } }, g));
    return { g, items };
  };
  const playSparks = (sp, t, t0, x, y, rad = 140) => {
    const k = A.P(t, t0, t0 + .5, E.expoOut), o = 1 - A.lin(t, t0 + .2, t0 + .6);
    sp.items.forEach((e, i) => {
      const a = i / sp.items.length * 360;
      const r = rad * (.55 + .45 * k);
      e.style.transform = `translate(${(x - 7 + Math.cos(a * Math.PI / 180) * r).toFixed(1)}px,${(y - 22 + Math.sin(a * Math.PI / 180) * r).toFixed(1)}px) rotate(${(a + 90).toFixed(1)}deg) scale(${(1 - k * .5).toFixed(2)})`;
      e.style.opacity = (t >= t0 ? o : 0).toFixed(3);
    });
  };

  /* ======================================================================
   * S1 — LA RUE, EN PLEIN SOLEIL
   * ====================================================================== */
  const S1 = {
    id: 'rue', a: 0, b: 4.05,
    build(el) {
      el.style.display = 'block'; // visible pendant la construction : les textes se mesurent juste
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '540px 1300px' } }, el);
      scenery(this.cam, `
        <defs><linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB547"/><stop offset=".55" stop-color="#FFD98F"/><stop offset="1" stop-color="#FFEBC2"/></linearGradient></defs>
        <rect width="1080" height="1320" fill="url(#s1sky)"/>
        <g fill="#E7B07A" opacity=".75">
          <path d="M 70 1010 L 70 900 L 110 900 L 110 860 L 300 860 L 300 1010 Z"/>
          <path d="M 150 900 L 172 640 L 238 640 L 260 900 Z"/>
          <path d="M 196 640 L 198 600 L 212 600 L 214 640 Z"/>
          ${[700, 740, 780, 820, 860].map(y => `<rect x="160" y="${y}" width="88" height="7" fill="#9A6237"/>`).join('')}
          ${[880, 920].map(y => `<rect x="60" y="${y}" width="250" height="6" fill="#9A6237"/>`).join('')}
        </g>
        <path d="M 0 1000 L 0 1290 L 1080 1290 L 1080 1000 L 980 1000 L 980 975 L 940 975 L 940 1000 L 620 1000 L 620 980 L 580 980 L 580 1000 L 300 1000 L 300 975 L 260 975 L 260 1000 Z" fill="#C98B5B"/>
        ${Array.from({ length: 22 }, (_, i) => `<rect x="${(i * 97) % 1060}" y="${1020 + (i * 53) % 240}" width="${54 + (i % 3) * 12}" height="18" rx="4" fill="#B57A4D" opacity=".55"/>`).join('')}
        <path d="M 760 1290 L 760 1120 Q 810 1070 860 1120 L 860 1290 Z" fill="#5B3A22"/>
        <rect x="430" y="1090" width="120" height="90" rx="6" fill="#7C4A2A"/>
        ${[0, 1, 2, 3].map(i => `<rect x="${440 + i * 28}" y="1095" width="8" height="80" fill="#4A2E1C"/>`).join('')}
        <rect x="58" y="1050" width="34" height="250" rx="12" fill="#7A4A2A"/>
        <circle cx="40" cy="990" r="110" fill="#4D7C3A"/><circle cx="140" cy="960" r="90" fill="#5B8C43"/><circle cx="70" cy="900" r="80" fill="#3F6B30"/>
        <rect y="1290" width="1080" height="630" fill="#EBC48C"/>
        <rect y="1290" width="1080" height="46" fill="#D9A86E"/>
        <path d="M -20 1560 Q 400 1500 1100 1590" stroke="#DDB27A" stroke-width="22" fill="none"/>
        <path d="M -20 1720 Q 500 1650 1100 1760" stroke="#DDB27A" stroke-width="22" fill="none"/>
        ${Array.from({ length: 16 }, (_, i) => `<ellipse cx="${(i * 173) % 1080}" cy="${1380 + (i * 97) % 500}" rx="${6 + i % 4}" ry="${4 + i % 3}" fill="#C9965E"/>`).join('')}`);
      // soleil (rayons qui tournent) et chaleur
      this.sun = box(this.cam, 520, 520, 260, 260, `
        <circle r="230" fill="#FFF3B0" opacity=".35"/>
        <g class="rays">${Array.from({ length: 12 }, (_, i) => `<rect x="-9" y="-215" width="18" height="70" rx="9" fill="#FFF7CC" transform="rotate(${i * 30})"/>`).join('')}</g>
        <circle r="120" fill="#FFF8D6"/><circle r="104" fill="#FFFBEA"/>`);
      this.rays = this.sun.querySelector('.rays');
      this.heat = [0, 1, 2].map(i => box(this.cam, 1080, 60, 0, 30, `<path d="M 0 0 Q 90 -22 180 0 T 360 0 T 540 0 T 720 0 T 900 0 T 1080 0" stroke="#fff" stroke-width="5" fill="none" opacity=".35"/>`));
      this.temp = A.el('div', { cls: 'abs', style: { left: '700px', top: '520px', padding: '14px 28px', borderRadius: '99px', background: '#DC2626', color: '#fff', font: '800 54px Geist', boxShadow: '0 16px 30px -14px rgba(120,20,0,.6)' } }, this.cam, '42 °C');
      this.sackG = box(this.cam, 300, 200, 150, 190, SACK);
      this.dust = [0, 1, 2, 3, 4, 5].map(() => A.el('div', { cls: 'abs', style: { width: '80px', height: '80px', borderRadius: '50%', background: '#E9CFA3' } }, this.cam));
      this.ai = T.person(this.cam, T.CAST.aicha);
      // le sac posé sur la tête (dans le groupe de la tête : il suit chaque mouvement)
      this.sackHead = svgEl('g', {}, this.ai.headItem);
      this.sackHead.innerHTML = SACK;
      this.st = sticker(el, '25 kg de riz…\n*sous ce soleil ?*', { y: 300, size: 74 });
      cue(.05, 'shimmer', .35);
      cue(1.25, 'pop', .5, .4);
      cue(3.0, 'scratch', .55);
      cue(3.36, 'thud', .9, .2);
      cue(3.7, 'sigh', .55);
    },
    seek(t) {
      A.T(this.cam, { s: 1 + A.P(t, 0, 4, E.sine) * .06 });
      put(this.sun, 830, 300, 1 + Math.sin(t * 3) * .03);
      this.rays.setAttribute('transform', `rotate(${(t * 12).toFixed(2)})`);
      this.heat.forEach((h, i) => { const ph = (t * .45 + i / 3) % 1; put(h, 0 + Math.sin(t * 2 + i) * 30, 1250 - ph * 520, 1, 0, Math.sin(ph * Math.PI) * .9); });
      const tk = A.P(t, 1.15, 1.6, E.spring);
      this.temp.style.transform = `scale(${(.3 + .7 * tk).toFixed(3)}) rotate(${(6 - tk * 4).toFixed(2)}deg)`;
      this.temp.style.opacity = A.lin(t, 1.15, 1.25).toFixed(2);
      // marche lourde jusqu'à 2.95, puis pose du sac
      const walking = t < 2.95;
      const x = 250 + A.P(Math.min(t, 2.95), 0, 2.95, E.sine) * 230;
      const w = walking ? T.walk(t * .62, .75) : T.walk(0, 0);
      const stag = walking ? Math.sin(t * 4.1) * 4 : 0;
      const drop = A.P(t, 3.1, 3.4, E.cubicIn);
      const relief = A.lin(t, 3.4, 3.6);
      const s = 1.38, y = 1690;
      const armsUp = 1 - drop;
      const fan = t > 3.5 ? Math.sin((t - 3.5) * 22) * 18 : 0;
      this.ai.pose(T.merge({ x, y, s, t }, w, {
        lean: stag + drop * 8 - relief * 4,
        near: { sh: A.mix(174, relief > 0 ? 118 : 30, 1 - armsUp), el: A.mix(-4, relief > 0 ? 128 : 20, 1 - armsUp), wr: fan + (armsUp > .5 ? 90 : 0) },
        far: { sh: A.mix(186, -4, 1 - armsUp), el: A.mix(4, 12, 1 - armsUp), wr: armsUp > .5 ? -90 : 0 },
        mouth: t < 3.4 ? 'effort' : t < 3.7 ? 'o' : 'flat', brow: t < 3.4 ? -.3 : .2, browTilt: t < 3.4 ? 10 : -4,
        sweat: 1, blink: t > 3.45 && t < 3.62 ? 1 : T.blink(t, 1), look: t > 3.6 ? [-3, 2] : [3, 0],
        headTilt: t > 3.6 ? -6 : 0,
      }));
      // sac : sur la tête (oscille), puis glisse au sol à côté d'elle
      const bob = w.bob ?? 0;
      const hx = x + 8 * s, hy = y + (-594 + bob) * s;
      const gx = x + 200 * s, gy = y + 4;
      const sx = A.mix(hx, gx, drop), sy = A.mix(hy, gy, drop) - Math.sin(drop * Math.PI) * 60;
      const onHead = t < 3.1;
      this.sackHead.setAttribute('transform', `translate(8,-594) rotate(${(Math.sin(t * 4.1) * 4).toFixed(2)}) scale(.66)`);
      this.sackHead.setAttribute('opacity', onHead ? 1 : 0);
      put(this.sackG, sx, sy, s * .66, onHead ? 0 : (1 - drop) * 12, onHead ? 0 : 1);
      // poussière à l'impact
      const dk = A.P(t, 3.36, 3.9, E.expoOut);
      this.dust.forEach((d, i) => {
        const a = (i / 6) * Math.PI;
        const r = 40 + dk * 170;
        A.T(d, { x: gx - 40 + Math.cos(a) * r * (i % 2 ? 1 : -1), y: gy - 60 - Math.sin(a) * r * .35 - dk * 30, s: .6 + dk * 1.4, o: t >= 3.36 ? (1 - dk) * .8 : 0 });
      });
      playSticker(this.st, t, .45, 3.62);
    },
  };

  /* ======================================================================
   * S2 — À L'OMBRE, À LA MAISON
   * ====================================================================== */
  const S2 = {
    id: 'ombre', a: 3.95, b: 6.25,
    build(el) {
      el.style.display = 'block'; // visible pendant la construction : les textes se mesurent juste
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '600px 1150px' } }, el);
      scenery(this.cam, `
        <rect width="1080" height="1320" fill="#F6E3C6"/>
        <rect y="1100" width="1080" height="220" fill="#EBC9A0"/>
        <rect y="1094" width="1080" height="12" fill="#C2410C" opacity=".55"/>
        <rect x="610" y="330" width="340" height="440" rx="16" fill="#8FD3F5"/>
        <rect x="610" y="600" width="340" height="170" fill="#F3C98B"/>
        <circle cx="880" cy="420" r="46" fill="#FFF3B0"/>
        <rect x="602" y="322" width="356" height="456" rx="18" fill="none" stroke="#9A6237" stroke-width="16"/>
        <rect x="772" y="322" width="16" height="456" fill="#9A6237"/>
        <rect x="520" y="330" width="80" height="440" rx="10" fill="#1D4ED8"/>
        <rect x="960" y="330" width="80" height="440" rx="10" fill="#1D4ED8"/>
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="528" y="${350 + i * 58}" width="64" height="12" rx="5" fill="#1E40AF"/><rect x="968" y="${350 + i * 58}" width="64" height="12" rx="5" fill="#1E40AF"/>`).join('')}
        <path d="M 610 770 L 950 770 L 1080 1500 L 300 1500 Z" fill="#FFF8E6" opacity=".35"/>
        <rect x="80" y="520" width="300" height="20" rx="8" fill="#9A6237"/>
        <rect x="110" y="440" width="90" height="80" rx="14" fill="#B91C1C"/><circle cx="140" cy="480" r="22" fill="#FDE68A"/>
        <rect x="230" y="470" width="40" height="50" rx="6" fill="#0F766E"/><rect x="280" y="455" width="60" height="65" rx="8" fill="#F5B301"/>
        <rect y="1320" width="1080" height="600" fill="#C8834F"/>
        <ellipse cx="540" cy="1700" rx="520" ry="150" fill="#B45309"/>
        <ellipse cx="540" cy="1700" rx="470" ry="122" fill="none" stroke="#FDE68A" stroke-width="10" stroke-dasharray="26 18"/>
        <path d="M 980 1330 Q 940 1180 990 1080 Q 1030 1180 1010 1330 Z" fill="#3F6B30"/>
        <path d="M 1000 1330 Q 1060 1200 1080 1120 L 1080 1330 Z" fill="#4D7C3A"/>
        <rect x="950" y="1300" width="110" height="110" rx="16" fill="#C2410C"/>
        <path d="M 120 1090 Q 120 1010 200 1010 L 880 1010 Q 960 1010 960 1090 L 960 1420 L 120 1420 Z" fill="#D97706"/>
        <rect x="170" y="1050" width="230" height="200" rx="40" fill="#FDBA74"/><rect x="680" y="1050" width="230" height="200" rx="40" fill="#0F766E"/>`);
      this.fan = box(this.cam, 600, 200, 300, 60, `<rect x="-6" y="-80" width="12" height="80" fill="#64748B"/><g class="bl">${[0, 120, 240].map(a => `<ellipse cx="0" cy="-130" rx="34" ry="130" fill="#E2E8F0" transform="rotate(${a})"/>`).join('')}</g><circle r="30" fill="#94A3B8"/>`);
      this.bl = this.fan.querySelector('.bl');
      this.ai = T.person(this.cam, T.CAST.aicha);
      // devant d'assise (cache le bas du corps)
      scenery(this.cam, `<path d="M 100 1380 Q 100 1330 160 1330 L 920 1330 Q 980 1330 980 1380 L 980 1640 L 100 1640 Z" fill="#B45309"/><rect x="100" y="1330" width="880" height="70" rx="30" fill="#F59E0B"/><rect x="130" y="1630" width="40" height="70" fill="#7C2D12"/><rect x="910" y="1630" width="40" height="70" fill="#7C2D12"/>`);
      this.phone = svgEl('g', {}, this.ai.near.item);
      this.phone.innerHTML = PHONE_SMALL;
      this.st = sticker(el, 'Restez plutôt\n*à l’ombre !*', { y: 300, size: 76, rot: 2 });
      cue(4.05, 'whoosh', .5);
      cue(4.22, 'thud', .5);
      cue(4.35, 'sigh', .7);
      cue(5.35, 'pop', .45, .2);
    },
    seek(t) {
      const z = A.P(t, 5.95, 6.25, E.expoIn);
      A.T(this.cam, { s: 1 + z * .9, o: 1 });
      put(this.fan, 540, 150, 1);
      this.bl.setAttribute('transform', `rotate(${(t * 520).toFixed(1)})`);
      const fall = A.P(t, 3.95, 4.22, E.cubicIn), land = A.P(t, 4.22, 4.6, E.spring);
      const s = 1.32, y = 1660 - (1 - fall) * 160;
      const relax = A.lin(t, 4.3, 4.45) * (1 - A.lin(t, 5.1, 5.25));
      const phoneUp = A.P(t, 5.25, 5.55, E.expoOut);
      const fan = relax > 0 ? Math.sin(t * 20) * 20 : 0;
      this.ai.pose({
        x: 540, y, s, t, sy: 1 - (1 - land) * .06 * (t > 4.22 ? 1 : 0), shadow: 0,
        lean: -6 * relax,
        near: { sh: A.mix(A.mix(10, 120, relax), 58, phoneUp), el: A.mix(A.mix(10, 120, relax), 108, phoneUp), wr: fan },
        far: { sh: -10 - relax * 10, el: 14 },
        blink: t > 4.3 && t < 5.05 ? 1 : T.blink(t, 2),
        mouth: t < 4.3 ? 'o' : t < 5.2 ? 'smile' : 'grin', headTilt: -8 * relax + phoneUp * 6,
        look: phoneUp > .5 ? [4, 6] : [0, 0], brow: phoneUp > .5 ? .5 : 0,
      });
      this.phone.setAttribute('transform', `rotate(-90) scale(${(phoneUp * 1.1).toFixed(3)})`);
      this.phone.setAttribute('opacity', phoneUp > 0 ? 1 : 0);
      playSticker(this.st, t, 4.15, 5.95);
    },
  };

  /* ======================================================================
   * S3 — GROS PLAN TÉLÉPHONE (seul passage « écran », 4 s)
   * ====================================================================== */
  const T_TAP1 = 6.95, T_PAY = 7.18, T_TAP2 = 7.95, T_OK = 8.45;
  const S3 = {
    id: 'telephone', a: 6.15, b: 10.3,
    build(el) {
      el.style.display = 'block'; // visible pendant la construction : les textes se mesurent juste
      el.style.background = 'radial-gradient(ellipse at 50% 40%,#FFE3BF 0%,#F8C38A 60%,#EFA765 100%)';
      this.bokeh = Array.from({ length: 9 }, (_, i) => A.el('div', { cls: 'abs', style: { width: `${120 + (i % 4) * 60}px`, height: `${120 + (i % 4) * 60}px`, borderRadius: '50%', background: 'rgba(255,255,255,.28)', filter: 'blur(6px)' } }, el));
      this.rig = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '540px 1100px' } }, el);
      // main (doigts derrière le téléphone, pouce devant)
      this.palm = box(this.rig, 1080, 1920, 0, 0, `
        <rect x="360" y="1640" width="330" height="320" rx="80" fill="#7A4D31"/>
        <ellipse cx="520" cy="1610" rx="300" ry="190" fill="#8B5A3C"/>
        <ellipse cx="470" cy="1560" rx="190" ry="90" fill="#A06A48" opacity=".45"/>
        ${[0, 1, 2, 3].map(i => `<rect x="${196 + i * 4}" y="${1010 + i * 124}" width="128" height="88" rx="44" fill="#8B5A3C"/><rect x="${196 + i * 4}" y="${1010 + i * 124}" width="58" height="88" rx="29" fill="#A06A48"/><ellipse cx="${222 + i * 4}" cy="${1054 + i * 124}" rx="13" ry="20" fill="#E9C4A6" opacity=".8"/>`).join('')}`);
      const phone = this.phone = A.el('div', { cls: 'abs', style: { left: '270px', top: '470px', width: '540px', height: '1100px', borderRadius: '70px', background: '#0B1220', boxShadow: '0 60px 90px -40px rgba(90,40,5,.7)', padding: '22px' } }, this.rig);
      const scr = this.scr = A.el('div', { style: { position: 'relative', width: '100%', height: '100%', borderRadius: '52px', overflow: 'hidden', background: '#fff' } }, phone);
      A.el('div', { cls: 'abs', style: { left: '200px', top: '14px', width: '96px', height: '28px', borderRadius: '14px', background: '#0B1220', zIndex: 5 } }, scr);
      // écran 1 : produit + Commander
      const s1 = this.s1 = A.el('div', { cls: 'abs', style: { width: '496px', height: '1056px' } }, scr);
      A.el('div', { cls: 'abs', style: { width: '496px', height: '150px', background: C.orange, color: '#fff', font: '800 42px Geist', padding: '72px 0 0 34px', letterSpacing: '-.02em' } }, s1, 'AMAZER');
      const pic = A.el('div', { cls: 'abs', style: { left: '30px', top: '180px', width: '436px', height: '400px', borderRadius: '28px', background: '#FFF4E8' } }, s1);
      box(pic, 300, 220, 150, 200, SACK).style.transform = 'translate(68px,170px) scale(1.15)';
      A.el('div', { cls: 'abs', style: { left: '34px', top: '610px', font: '800 40px Geist', color: NAVY, letterSpacing: '-.02em' } }, s1, 'Riz parfumé · 25 kg');
      A.el('div', { cls: 'abs', style: { left: '34px', top: '668px', font: '600 30px Geist', color: '#475569' } }, s1, 'Boutique Moussa · Niamey');
      A.el('div', { cls: 'abs', style: { left: '34px', top: '728px', font: '600 28px Geist', color: '#16A34A' } }, s1, 'Livraison à Niamey');
      this.btn1 = A.el('div', { cls: 'abs', style: { left: '30px', top: '880px', width: '436px', height: '110px', borderRadius: '55px', background: C.orange, color: '#fff', font: '800 40px Geist', display: 'grid', placeItems: 'center' } }, s1, 'Commander');
      // écran 2 : moyen de paiement
      const s2 = this.s2 = A.el('div', { cls: 'abs', style: { width: '496px', height: '1056px', background: '#fff' } }, scr);
      A.el('div', { cls: 'abs', style: { left: '34px', top: '110px', font: '800 46px Geist', color: NAVY, letterSpacing: '-.02em' } }, s2, 'Moyen de paiement');
      A.el('div', { cls: 'abs', style: { left: '34px', top: '176px', font: '600 28px Geist', color: '#64748B', width: '430px', whiteSpace: 'normal' } }, s2, 'Vous envoyez l’argent, AMAZER vérifie');
      this.opt = ['Nita', 'Amana'].map((n, i) => {
        const r = A.el('div', { cls: 'abs', style: { left: '30px', top: `${300 + i * 170}px`, width: '436px', height: '140px', borderRadius: '30px', border: '4px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', gap: '24px', padding: '0 30px', font: '800 42px Geist', color: NAVY } }, s2);
        A.el('div', { style: { width: '76px', height: '76px', borderRadius: '20px', background: i ? '#0E7490' : '#7C3AED', color: '#fff', display: 'grid', placeItems: 'center', font: '800 34px Geist' } }, r, n[0]);
        A.el('span', {}, r, n);
        return r;
      });
      // écran 3 : paiement vérifié
      const s3 = this.s3 = A.el('div', { cls: 'abs', style: { width: '496px', height: '1056px', background: '#F0FDF4' } }, scr);
      this.check = A.el('div', { cls: 'abs', style: { left: '128px', top: '250px', width: '240px', height: '240px', borderRadius: '50%', background: '#16A34A', display: 'grid', placeItems: 'center' } }, s3, '<svg width="130" height="130" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      this.okTxt = A.el('div', { cls: 'abs', style: { left: '0', top: '560px', width: '496px', textAlign: 'center', font: '800 44px Geist', color: '#14532D', lineHeight: '1.12', whiteSpace: 'normal', padding: '0 30px' } }, s3, 'Paiement vérifié par AMAZER');
      A.el('div', { cls: 'abs', style: { left: '0', top: '700px', width: '496px', textAlign: 'center', font: '600 30px Geist', color: '#166534', whiteSpace: 'normal', padding: '0 40px' } }, s3, 'La boutique prépare votre commande.');
      this.ripple = A.el('div', { cls: 'abs', style: { width: '160px', height: '160px', borderRadius: '50%', border: '6px solid rgba(255,255,255,.95)', zIndex: 8 } }, scr);
      // pouce
      this.thumb = box(this.rig, 400, 600, 100, 60, `
        <g transform="rotate(-24)">
          <rect x="-50" y="-48" width="100" height="520" rx="50" fill="#7A4D31"/>
          <rect x="-46" y="-46" width="92" height="510" rx="46" fill="#8B5A3C"/>
          <rect x="-34" y="-36" width="24" height="200" rx="12" fill="#A06A48" opacity=".6"/>
          <ellipse cx="0" cy="-8" rx="28" ry="34" fill="#E9C4A6"/>
          <path d="M -50 150 Q 0 170 50 150" stroke="#6E4229" stroke-width="5" fill="none" opacity=".6"/>
        </g>`);
      this.sp = sparks(el, 10, '#22C55E');
      this.st1 = sticker(el, 'Commandez\nsur *AMAZER*', { y: 250, size: 70 });
      this.st2 = sticker(el, 'Payez par\n*Nita ou Amana*', { y: 250, size: 70, rot: 2 });
      cue(6.2, 'whoosh', .55);
      cue(T_TAP1, 'tap', .8);
      cue(T_PAY, 'swipe', .45);
      cue(T_TAP2, 'tap', .8);
      cue(T_OK + .1, 'ding', .8);
      cue(T_OK + .12, 'shimmer', .4);
    },
    seek(t) {
      this.bokeh.forEach((b, i) => A.T(b, { x: (i * 223) % 1000 - 60 + A.wob(t, i, .3) * 40, y: (i * 389) % 1800 + A.wob(t, i + 3, .25) * 50 }));
      const enter = A.P(t, 6.15, 6.7, E.expoOut), exit = A.P(t, 10.05, 10.3, E.expoIn);
      A.T(this.rig, { x: -exit * 1200, y: (1 - enter) * 900, r: (1 - enter) * 10 - exit * 6, s: .92 + enter * .08, blur: exit * 14 });
      put(this.palm, 0, 0, 1, 0);
      // écrans
      const k2 = A.P(t, T_PAY, T_PAY + .38, E.expoOut), k3 = A.P(t, T_OK, T_OK + .35, E.expoOut);
      A.T(this.s1, { x: -k2 * 496 });
      A.T(this.s2, { x: (1 - k2) * 496 - k3 * 496 });
      A.T(this.s3, { x: (1 - k3) * 496 });
      const pressed1 = A.env(t, T_TAP1 - .02, T_TAP1 + .16, .05, .1);
      this.btn1.style.transform = `scale(${(1 - pressed1 * .05).toFixed(3)})`;
      this.opt.forEach((o, i) => { const on = i === 0 && t >= T_TAP2 + .05; o.style.borderColor = on ? C.orange : '#E2E8F0'; o.style.background = on ? '#FFF1E8' : '#fff'; });
      const ck = A.P(t, T_OK + .08, T_OK + .6, E.spring);
      this.check.style.transform = `scale(${(t >= T_OK ? .2 + ck * .8 : 0).toFixed(3)})`;
      this.okTxt.style.opacity = A.lin(t, T_OK + .2, T_OK + .4).toFixed(2);
      // pouce : vers « Commander », puis vers « Nita », puis se retire
      const P1 = [540, 1430], P2 = [400, 900], OUT = [840, 1650];
      let px = OUT[0], py = OUT[1];
      const a1 = A.P(t, 6.5, T_TAP1 - .05, E.cubicInOut), b1 = A.P(t, T_TAP1 + .15, 7.6, E.cubicInOut), c1 = A.P(t, 8.15, 8.6, E.cubicInOut);
      px = A.mix(A.mix(A.mix(OUT[0], P1[0], a1), P2[0], b1), OUT[0], c1);
      py = A.mix(A.mix(A.mix(OUT[1], P1[1], a1), P2[1], b1), OUT[1], c1);
      const press = A.env(t, T_TAP1 - .04, T_TAP1 + .14, .05, .1) + A.env(t, T_TAP2 - .04, T_TAP2 + .14, .05, .1);
      put(this.thumb, px, py, 1 - press * .08, -18);
      // ondes de toucher (coordonnées de l'écran)
      const rip = (tt, x, y) => { const k = A.P(t, tt, tt + .45, E.expoOut); return { k, x, y, on: t >= tt && t < tt + .45 }; };
      const r = t < T_TAP2 - .1 ? rip(T_TAP1, 248, 935) : rip(T_TAP2, 120, 370);
      A.T(this.ripple, { x: r.x - 80, y: r.y - 80, s: .3 + r.k * 1.2, o: r.on ? (1 - r.k) : 0 });
      this.ripple.style.borderColor = t < T_TAP2 - .1 ? 'rgba(255,255,255,.95)' : 'rgba(255,77,0,.8)';
      playSparks(this.sp, t, T_OK + .15, 540 + -exit * 1200, 830, 210);
      playSticker(this.st1, t, 6.3, 7.75);
      playSticker(this.st2, t, 7.85, 9.95);
    },
  };

  /* ======================================================================
   * S4 — LA BOUTIQUE DE MOUSSA
   * ====================================================================== */
  const S4 = {
    id: 'boutique', a: 10.25, b: 12.5,
    build(el) {
      el.style.display = 'block'; // visible pendant la construction : les textes se mesurent juste
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px' } }, el);
      const shelfGoods = y => {
        let s = '';
        for (let i = 0; i < 9; i++) {
          const x = 80 + i * 105, k = (i * 7 + y) % 4;
          if (k === 0) s += `<rect x="${x}" y="${y - 120}" width="80" height="120" rx="18" fill="#F1E5C6"/><rect x="${x + 12}" y="${y - 90}" width="56" height="34" rx="6" fill="#fff"/><rect x="${x + 22}" y="${y - 82}" width="36" height="8" fill="#C2410C"/>`;
          else if (k === 1) s += `<rect x="${x + 10}" y="${y - 130}" width="34" height="130" rx="10" fill="#FACC15"/><rect x="${x + 16}" y="${y - 146}" width="22" height="20" rx="5" fill="#15803D"/><rect x="${x + 46}" y="${y - 130}" width="34" height="130" rx="10" fill="#EAB308"/><rect x="${x + 52}" y="${y - 146}" width="22" height="20" rx="5" fill="#15803D"/>`;
          else if (k === 2) s += `<rect x="${x}" y="${y - 100}" width="88" height="100" rx="8" fill="#2563EB"/><rect x="${x + 8}" y="${y - 70}" width="72" height="24" fill="#fff" opacity=".85"/>`;
          else s += `<rect x="${x + 4}" y="${y - 70}" width="38" height="70" rx="8" fill="#DC2626"/><rect x="${x + 46}" y="${y - 70}" width="38" height="70" rx="8" fill="#DC2626"/><rect x="${x + 25}" y="${y - 140}" width="38" height="70" rx="8" fill="#B91C1C"/>`;
        }
        return s;
      };
      scenery(this.cam, `
        <rect width="1080" height="1920" fill="#F3E2C7"/>
        ${[620, 880, 1140].map(y => `${shelfGoods(y)}<rect x="40" y="${y}" width="1000" height="26" rx="6" fill="#9A6237"/><rect x="40" y="${y + 26}" width="1000" height="10" fill="#7C4A2A"/>`).join('')}
        <path d="M 0 0 L 1080 0 L 1080 250 ${Array.from({ length: 9 }, (_, i) => `Q ${1080 - i * 120 - 60} 310 ${1080 - (i + 1) * 120} 250`).join(' ')} Z" fill="#FF4D00"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M ${i * 120 + 30} 0 L ${i * 120 + 90} 0 L ${i * 120 + 90} 250 Q ${i * 120 + 60} 300 ${i * 120 + 30} 262 Z" fill="#fff" opacity=".92"/>`).join('')}
        <rect x="250" y="330" width="580" height="116" rx="20" fill="#0F766E"/>
        <text x="540" y="408" text-anchor="middle" font-family="Geist" font-weight="800" font-size="58" fill="#FDE68A">Boutique Moussa</text>`);
      this.mo = T.person(this.cam, T.CAST.moussa);
      this.sackC = box(this.cam, 300, 200, 150, 190, SACK);
      scenery(this.cam, `
        <rect x="0" y="1300" width="1080" height="620" fill="#7C4A2A"/>
        <rect x="0" y="1282" width="1080" height="44" rx="10" fill="#A86B3D"/>
        ${[0, 1, 2, 3].map(i => `<rect x="${60 + i * 260}" y="1380" width="200" height="300" rx="16" fill="#6B3F22"/>`).join('')}
        <rect x="120" y="1180" width="150" height="104" rx="14" fill="#94A3B8"/><rect x="140" y="1160" width="110" height="26" rx="10" fill="#CBD5E1"/>`);
      this.phoneC = box(this.cam, 200, 200, 100, 100, `<rect x="-38" y="-70" width="76" height="140" rx="16" fill="#111827" transform="rotate(-80)"/><rect x="-30" y="-60" width="60" height="118" rx="10" fill="#FF4D00" transform="rotate(-80)"/>`);
      this.sackHand = box(this.cam, 300, 200, 150, 190, SACK);
      this.ib = T.person(this.cam, T.CAST.ibrahim);
      // notification (texte réel du site)
      const n = this.notif = A.el('div', { cls: 'abs', style: { left: '120px', top: '800px', width: '840px', padding: '28px 32px', borderRadius: '34px', background: '#fff', boxShadow: '0 30px 60px -24px rgba(60,25,5,.55)', display: 'flex', gap: '26px', alignItems: 'center', transformOrigin: '30% 100%' } }, this.cam);
      A.el('div', { style: { width: '96px', height: '96px', borderRadius: '26px', background: C.orange, display: 'grid', placeItems: 'center', flex: 'none' } }, n, '<svg width="58" height="58" viewBox="-20 -20 40 40"><path d="M -11 12 L 0 -13 L 11 12 M -6.5 4 L 6.5 4" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      const tx = A.el('div', {}, n);
      A.el('div', { style: { font: '800 42px Geist', color: NAVY, letterSpacing: '-.02em' } }, tx, 'Commande payée : à préparer');
      A.el('div', { style: { font: '600 32px Geist', color: '#475569', marginTop: '6px' } }, tx, 'Riz parfumé · 25 kg');
      this.st = sticker(el, 'La boutique *prépare*\nvotre commande…', { y: 560, size: 68, rot: -2 });
      cue(10.27, 'swipe', .5);
      cue(10.42, 'buzz', .5, -.4);
      cue(10.5, 'pop', .7);
      cue(11.15, 'thud', .55);
      cue(12.05, 'tap', .5, .4);
    },
    seek(t) {
      const enter = A.P(t, 10.25, 10.5, E.expoOut);
      A.T(this.cam, { x: (1 - enter) * 1080 });
      const buzz = t > 10.38 && t < 10.62 ? Math.sin(t * 160) * 5 : 0;
      put(this.phoneC, 330, 1255, 1, buzz);
      const read = A.lin(t, 10.5, 10.6), happy = A.lin(t, 10.75, 10.85);
      const lift = A.P(t, 10.9, 11.2, E.backOut), slide = A.P(t, 11.25, 11.6, E.cubicInOut);
      this.mo.pose({
        x: 420, y: 1690, s: 1.42, t, shadow: 0,
        look: read < 1 ? [-3, 8] : [4, -4], brow: happy * .6, mouth: happy ? (t > 11 && t < 11.25 ? 'effort' : 'grin') : read ? 'o' : 'smile',
        near: { sh: A.mix(20, 70, lift) + slide * 10, el: A.mix(30, 50, lift) }, far: { sh: A.mix(-8, 40, lift), el: 40 },
        blink: T.blink(t, 4), headTilt: happy * 4,
        talk: t > 11.7 && t < 12.2,
      });
      // sac : sort de sous le comptoir, glisse vers la droite, puis Ibrahim l'emporte
      const grab = A.P(t, 12.02, 12.15, E.expoOut);
      const sx = A.mix(560, 760, slide), sy = A.mix(1430, 1290, lift);
      const ibx = t < 12.1 ? A.mix(1260, 900, A.P(t, 11.45, 12.0, E.sine)) : A.mix(900, 1320, A.P(t, 12.15, 12.5, E.cubicIn));
      const carrying = t >= 12.1;
      put(this.sackC, sx, sy, 1.0, 0, carrying ? 0 : (t > 10.9 ? 1 : 0));
      const walk = (t > 11.45 && t < 12.0) || t > 12.15 ? T.walk(t * 1.2, .9) : T.walk(0, 0);
      this.ib.pose(T.merge({ x: ibx, y: 1810, s: 1.36, t, flip: t < 12.1, shadow: 0 }, walk, {
        near: carrying ? { sh: 62, el: 70 } : grab > 0 ? { sh: 50, el: 30 } : walk.near,
        far: carrying ? { sh: 56, el: 76 } : walk.far,
        mouth: 'grin', blink: T.blink(t, 5), look: carrying ? [4, 0] : [-2, 0],
      }));
      put(this.sackHand, ibx + 120 * 1.36, 1810 - 300 * 1.36, .8, -4, carrying ? 1 : 0);
      const nk = A.P(t, 10.45, 10.85, E.spring), nq = A.P(t, 11.9, 12.1, E.expoIn);
      this.notif.style.transform = `translateY(${((1 - nk) * 60 - nq * 40).toFixed(1)}px) scale(${(.6 + .4 * nk).toFixed(3)})`;
      this.notif.style.opacity = (A.lin(t, 10.45, 10.55) * (1 - nq)).toFixed(3);
      playSticker(this.st, t, 10.4, 12.2);
    },
  };

  /* ======================================================================
   * S5 — LA TRAVERSÉE DE NIAMEY À MOTO
   * ====================================================================== */
  const T5 = 12.45, T5E = 16.95;
  const houses = (n, seed, base, hMin, hMax, cols, tile) => {
    const r = A.rand(seed);
    let s = '', x = 0;
    for (let i = 0; i < n && x < tile; i++) {
      const w = 160 + r() * 160, h = hMin + r() * (hMax - hMin), c = cols[Math.floor(r() * cols.length)];
      s += `<rect x="${x.toFixed(0)}" y="${(base - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${c}"/>`;
      s += `<rect x="${x.toFixed(0)}" y="${(base - h - 14).toFixed(0)}" width="${w.toFixed(0)}" height="18" fill="${c}" opacity=".8"/>`;
      if (r() > .4) s += `<rect x="${(x + w * .3).toFixed(0)}" y="${(base - h * .55).toFixed(0)}" width="${(w * .22).toFixed(0)}" height="${(h * .3).toFixed(0)}" rx="6" fill="#5B3A22" opacity=".75"/>`;
      if (r() > .5) s += `<rect x="${(x + w * .62).toFixed(0)}" y="${(base - h * .7).toFixed(0)}" width="${(w * .2).toFixed(0)}" height="${(w * .2).toFixed(0)}" rx="4" fill="#1D4ED8" opacity=".8"/>`;
      if (r() > .7) s += `<rect x="${(x + w * .15).toFixed(0)}" y="${(base - h - 60).toFixed(0)}" width="44" height="46" rx="6" fill="#E2E8F0"/>`;
      x += w + 8 + r() * 30;
    }
    return s;
  };
  const S5 = {
    id: 'moto', a: T5, b: T5E,
    build(el) {
      el.style.display = 'block'; // visible pendant la construction : les textes se mesurent juste
      const TILE = 2400;
      const layer = (inner, z) => {
        const d = A.el('div', { cls: 'abs', style: { width: `${TILE * 2}px`, height: '1920px' } }, el);
        d.innerHTML = `<svg width="${TILE * 2}" height="1920" style="position:absolute;left:0;top:0">${inner}<g transform="translate(${TILE},0)">${inner}</g></svg>`;
        return d;
      };
      scenery(el, `<defs><linearGradient id="s5sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CC6EE"/><stop offset=".7" stop-color="#CFEAF3"/><stop offset="1" stop-color="#FFE7B0"/></linearGradient></defs><rect width="1080" height="1300" fill="url(#s5sky)"/><circle cx="880" cy="250" r="80" fill="#FFF7D6"/>`);
      this.clouds = layer(`<g fill="#fff" opacity=".85"><ellipse cx="300" cy="300" rx="130" ry="40"/><ellipse cx="360" cy="280" rx="80" ry="44"/><ellipse cx="1300" cy="420" rx="160" ry="44"/><ellipse cx="1380" cy="400" rx="90" ry="46"/><ellipse cx="2000" cy="260" rx="120" ry="36"/></g>`);
      // fleuve Niger, rive lointaine, pont, pirogue
      this.far = layer(`
        <rect x="0" y="930" width="${TILE}" height="60" fill="#C8A574"/>
        ${Array.from({ length: 30 }, (_, i) => `<circle cx="${i * 82 + 20}" cy="${925 - (i % 3) * 6}" r="${18 + (i % 4) * 5}" fill="#6E9A4E"/>`).join('')}
        <rect x="0" y="985" width="${TILE}" height="130" fill="#4E9AD8"/>
        ${Array.from({ length: 24 }, (_, i) => `<rect x="${i * 100 + (i % 3) * 20}" y="${1010 + (i % 4) * 22}" width="${50 + (i % 3) * 20}" height="5" rx="2" fill="#A5D4F5" opacity=".8"/>`).join('')}
        <g fill="#9AA6B2"><rect x="200" y="930" width="1300" height="18"/>${Array.from({ length: 7 }, (_, i) => `<path d="M ${200 + i * 186} 948 Q ${293 + i * 186} 1010 ${386 + i * 186} 948 L ${380 + i * 186} 1000 L ${206 + i * 186} 1000 Z" opacity=".9"/>`).join('')}</g>
        <path d="M 1800 1060 Q 1880 1078 1960 1060 L 1950 1072 Q 1880 1086 1810 1072 Z" fill="#5B3A22"/><rect x="1872" y="1022" width="10" height="40" fill="#1E293B"/><circle cx="1877" cy="1016" r="9" fill="#1E293B"/><path d="M 1882 1030 L 1930 1066" stroke="#5B3A22" stroke-width="4"/>`);
      // ville : maisons en banco, minaret, arbres, panneau AMAZER
      this.mid = layer(`
        ${houses(30, 7, 1250, 110, 230, ['#D9A066', '#E3B07A', '#C98B5B', '#EBC28E'], TILE)}
        <path d="M 980 1250 L 1000 900 L 1070 900 L 1090 1250 Z" fill="#C98B5B"/><rect x="1020" y="860" width="30" height="44" fill="#C98B5B"/>
        ${[950, 1010, 1070, 1130, 1190].map(y => `<rect x="990" y="${y}" width="90" height="8" fill="#7C4A2A"/>`).join('')}
        <rect x="1640" y="1050" width="16" height="200" fill="#475569"/><rect x="1500" y="900" width="300" height="160" rx="16" fill="#FF4D00"/>
        <text x="1650" y="972" text-anchor="middle" font-family="Geist" font-weight="800" font-size="52" fill="#fff">AMAZER</text>
        <text x="1650" y="1024" text-anchor="middle" font-family="Geist" font-weight="700" font-size="34" fill="#FFE4D1">amazer.store</text>
        ${[400, 1300, 2150].map(x => `<rect x="${x}" y="1090" width="26" height="160" fill="#7A4A2A"/><circle cx="${x + 13}" cy="1060" r="74" fill="#4D7C3A"/><circle cx="${x - 40}" cy="1090" r="52" fill="#5B8C43"/><circle cx="${x + 60}" cy="1086" r="56" fill="#3F6B30"/>`).join('')}`);
      // route
      this.road = layer(`
        <rect x="0" y="1250" width="${TILE}" height="80" fill="#E3BC86"/>
        <rect x="0" y="1330" width="${TILE}" height="420" fill="#5B6370"/>
        <rect x="0" y="1330" width="${TILE}" height="14" fill="#9CA3AF"/>
        ${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 200}" y="1530" width="110" height="16" rx="8" fill="#F8FAFC"/>`).join('')}
        <rect x="0" y="1750" width="${TILE}" height="170" fill="#E3BC86"/>
        ${Array.from({ length: 20 }, (_, i) => `<ellipse cx="${i * 121 + 40}" cy="${1800 + (i % 4) * 26}" rx="${8 + i % 3 * 3}" ry="5" fill="#C9965E"/>`).join('')}`);
      this.moto = T.moto(el);
      this.ib = T.person(el, T.CAST.ibrahim);
      // premier plan : poteaux qui défilent vite
      this.fg = layer(`${[300, 1500].map(x => `<rect x="${x}" y="980" width="30" height="940" fill="#374151"/><rect x="${x - 60}" y="980" width="150" height="16" fill="#374151"/>`).join('')}`);
      this.fg.style.filter = 'blur(5px)';
      this.TILE = TILE;
      this.st = sticker(el, 'Un livreur AMAZER\n*vous l’apporte*', { y: 300, size: 70 });
      this.st2 = sticker(el, 'Partout à Niamey', { y: 470, size: 56, bg: C.orange, color: '#fff', rot: 3 });
      cue(T5 - .05, 'moto', .55);
      cue(15.3, 'moto', .4);
      cue(T5 + .05, 'whoosh', .5);
      cue(16.7, 'whoosh', .6);
    },
    seek(t) {
      const u = t - T5;
      const dist = u * 900;
      const off = (k, L) => -((dist * k) % this.TILE);
      A.T(this.clouds, { x: off(.03) - 100 });
      A.T(this.far, { x: off(.1), y: -110 });
      A.T(this.mid, { x: off(.38) });
      A.T(this.road, { x: off(1) });
      A.T(this.fg, { x: off(1.7) + 400 });
      const enter = A.P(t, T5, T5 + .5, E.expoOut), exit = A.P(t, 16.55, T5E, E.expoIn);
      const mx = A.mix(-320, 500, enter) + exit * 900 + Math.sin(u * 1.3) * 12;
      const bump = Math.abs(Math.sin(u * 9)) * -4;
      const ms = 1.5;
      this.moto.pose({ x: mx, y: 1600, s: ms, wheel: dist / 50, dust: 1, t, bob: bump, lean: exit * -4 });
      // le pilote : hanches sur la selle, mains au guidon
      const rs = 1.04;
      this.ib.pose({
        x: mx - 52 * ms, y: 1600 + (-132 * ms) + 206 * rs + bump * ms, s: rs, t, shadow: 0, farLeg: 0,
        lean: 16 + Math.sin(u * 2) * 2, legN: { hip: 86, knee: 96 }, legF: { hip: 80, knee: 100 },
        near: { sh: 78, el: 14 }, far: { sh: 72, el: 18 }, mouth: u > 1.4 && u < 2.2 ? 'grin' : 'smile', look: [5, 0],
        blink: T.blink(t, 6), headTilt: -4,
      });
      playSticker(this.st, t, T5 + .15, 15.6);
      playSticker(this.st2, t, 14.25, 16.5);
    },
  };

  /* ======================================================================
   * S6 — LE PORTAIL BLEU : LIVRAISON
   * ====================================================================== */
  const T_KNOCK = 17.42, T_OPEN = 17.72, T_QR = 18.1, T_SCAN = 18.38, T_DONE = 18.72, T_GIVE = 18.95;
  const S6 = {
    id: 'portail', a: 16.9, b: 20.25,
    build(el) {
      el.style.display = 'block'; // visible pendant la construction : les textes se mesurent juste
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '540px 1200px' } }, el);
      scenery(this.cam, `
        <rect width="1080" height="1920" fill="#BFE3F2"/>
        <rect y="560" width="1080" height="980" fill="#D19A66"/>
        ${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 92}" y="536" width="58" height="40" rx="6" fill="#D19A66"/>`).join('')}
        ${Array.from({ length: 26 }, (_, i) => `<rect x="${(i * 131) % 1040}" y="${620 + (i * 71) % 860}" width="${50 + (i % 3) * 14}" height="18" rx="4" fill="#B97F4E" opacity=".55"/>`).join('')}
        <g>${Array.from({ length: 14 }, (_, i) => `<circle cx="${820 + (i % 5) * 50 + (i % 2) * 20}" cy="${520 + Math.floor(i / 5) * 46}" r="${28 + (i % 3) * 8}" fill="${i % 3 ? '#DB2777' : '#BE185D'}"/>`).join('')}${Array.from({ length: 8 }, (_, i) => `<ellipse cx="${800 + i * 36}" cy="${600 + (i % 3) * 30}" rx="22" ry="12" fill="#3F6B30"/>`).join('')}</g>
        <rect x="270" y="730" width="540" height="810" rx="14" fill="#5B3A22"/>
        <rect x="300" y="760" width="480" height="780" fill="#2A1A10"/>
        <rect y="1540" width="1080" height="380" fill="#E7BE87"/>
        <rect y="1540" width="1080" height="30" fill="#D4A56E"/>`);
      this.ai = T.person(this.cam, T.CAST.aicha);
      const leaf = (x, flip) => box(this.cam, 240, 780, flip ? 240 : 0, 0, `
        <rect x="${flip ? -240 : 0}" y="0" width="240" height="780" fill="#1D4ED8"/>
        <rect x="${flip ? -224 : 16}" y="16" width="208" height="748" fill="none" stroke="#1E3A8A" stroke-width="8"/>
        ${[0, 1, 2].map(i => `<path d="M ${flip ? -120 : 120} ${110 + i * 220} l 60 70 l -60 70 l -60 -70 Z" fill="#FACC15"/><circle cx="${flip ? -120 : 120}" cy="${180 + i * 220}" r="16" fill="#fff"/>`).join('')}
        <rect x="${flip ? -224 : 200}" y="380" width="24" height="60" rx="10" fill="#E2E8F0"/>`);
      this.leafL = leaf(300, false);
      this.leafR = leaf(780, true);
      this.sackS = box(this.cam, 300, 200, 150, 190, SACK);
      this.ib = T.person(this.cam, T.CAST.ibrahim);
      this.phoneIb = svgEl('g', {}, this.ib.near.item); this.phoneIb.innerHTML = PHONE_SMALL;
      this.phoneAi = svgEl('g', {}, this.ai.near.item); this.phoneAi.innerHTML = PHONE_SMALL;
      // bulle du reçu (QR) et faisceau de scan
      const qr = this.qr = A.el('div', { cls: 'abs', style: { left: '600px', top: '820px', width: '300px', padding: '22px', borderRadius: '30px', background: '#fff', boxShadow: '0 26px 50px -20px rgba(30,15,5,.6)', textAlign: 'center', transformOrigin: '20% 100%' } }, this.cam);
      A.el('div', { style: { font: '800 30px Geist', color: NAVY, marginBottom: '12px' } }, qr, 'Mon reçu');
      const grid = A.el('div', { style: { width: '220px', height: '220px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(11,1fr)', gap: '2px' } }, qr);
      const rq = A.rand(42);
      for (let i = 0; i < 121; i++) { const r0 = Math.floor(i / 11), c0 = i % 11; const finder = (r0 < 3 && c0 < 3) || (r0 < 3 && c0 > 7) || (r0 > 7 && c0 < 3); A.el('div', { style: { background: finder || rq() > .52 ? NAVY : '#fff', borderRadius: '2px' } }, grid); }
      this.beam = A.el('div', { cls: 'abs', style: { width: '10px', height: '300px', borderRadius: '5px', background: 'linear-gradient(#22C55E,rgba(34,197,94,0))', transformOrigin: '50% 0', boxShadow: '0 0 30px #22C55E' } }, this.cam);
      const ok = this.ok = A.el('div', { cls: 'abs', style: { left: '170px', top: '700px', padding: '24px 36px', borderRadius: '99px', background: '#16A34A', color: '#fff', font: '800 48px Geist', display: 'flex', gap: '18px', alignItems: 'center', boxShadow: '0 24px 50px -20px rgba(10,80,30,.7)', transformOrigin: '50% 50%' } }, this.cam);
      A.el('span', {}, ok, '<svg width="54" height="54" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M6.5 12.5l3.5 3.5 7.5-8" stroke="#16A34A" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      A.el('span', {}, ok, 'Livraison confirmée');
      this.sp = sparks(this.cam, 10, '#FDE047');
      this.st = sticker(el, 'Montrez votre reçu :\n*c’est livré !*', { y: 300, size: 70, rot: -2 });
      cue(16.92, 'whoosh', .5);
      cue(17.3, 'thud', .5, -.3);
      cue(T_KNOCK, 'knock', .8, .1); cue(T_KNOCK + .2, 'knock', .7, .1);
      cue(T_OPEN, 'swipe', .4, .2);
      cue(T_QR, 'pop', .6, .3);
      cue(T_SCAN, 'scan', .7);
      cue(T_DONE, 'beep', .7); cue(T_DONE + .05, 'ding', .6);
      cue(19.35, 'shimmer', .5);
    },
    seek(t) {
      const enter = A.P(t, 16.9, 17.2, E.expoOut), zoomOut = A.P(t, 20.0, 20.25, E.expoIn);
      A.T(this.cam, { x: (1 - enter) * -1080, s: 1 + zoomOut * .15 });
      // Ibrahim arrive avec le sac, le pose, frappe
      const ix = A.mix(-200, 200, A.P(t, 16.9, 17.3, E.cubicOut));
      const walking = t < 17.3;
      const carry = t < 17.3;
      const knock = A.env(t, T_KNOCK - .08, T_KNOCK + .32, .05, .1);
      const knockBeat = knock * (Math.abs(Math.sin((t - T_KNOCK) * Math.PI / .2)) * 18);
      const scanUp = A.P(t, T_SCAN - .25, T_SCAN, E.expoOut) * (1 - A.P(t, T_DONE + .1, T_DONE + .3));
      const give = A.P(t, T_GIVE, T_GIVE + .45, E.cubicInOut);
      const wv = walking ? T.walk(t * 1.3, .85) : T.walk(0, 0);
      this.ib.pose(T.merge({ x: ix, y: 1700, s: 1.3, t }, wv, {
        near: carry ? { sh: 62, el: 70 } : knock > 0 ? { sh: 82 + knockBeat, el: 70 } : scanUp > 0 ? { sh: A.mix(10, 92, scanUp), el: A.mix(10, 40, scanUp) } : give > 0 ? { sh: A.mix(40, 74, give), el: 40 } : { sh: 6, el: 8 },
        far: carry ? { sh: 56, el: 76 } : give > 0 ? { sh: A.mix(30, 66, give), el: 46 } : { sh: -6, el: 10 },
        mouth: t > T_DONE ? 'grin' : 'smile', blink: T.blink(t, 7), look: [4, -1], brow: t > T_DONE ? .5 : 0,
      }));
      this.phoneIb.setAttribute('opacity', scanUp > .05 ? 1 : 0);
      // la porte droite s'ouvre et révèle Aïcha
      const open = A.P(t, T_OPEN, T_OPEN + .4, E.expoOut);
      put(this.leafL, 300, 760, 1);
      this.leafR.style.transform = `translate(${(780 - 240).toFixed(1)}px,760px) scaleX(${(1 - open * .82).toFixed(3)})`;
      this.leafR.style.transformOrigin = '240px 0px';
      const qrUp = A.P(t, T_QR, T_QR + .3, E.backOut);
      const hop = A.P(t, 19.3, 19.55, E.sine) * (1 - A.P(t, 19.55, 19.85, E.cubicIn));
      this.ai.pose({
        x: 640, y: 1560 - hop * 60, s: 1.12, t, flip: true, shadow: 0,
        near: give > .6 ? { sh: 70, el: 60 } : { sh: A.mix(6, 70, qrUp), el: A.mix(8, 80, qrUp) },
        far: give > .6 ? { sh: 64, el: 66 } : { sh: -6, el: 10 },
        mouth: t > T_DONE ? 'grin' : 'smile', blink: T.blink(t, 8), look: [3, -1], brow: hop * .8,
        o: open > .05 ? 1 : 0,
      });
      this.phoneAi.setAttribute('opacity', qrUp > .05 && give < .6 ? 1 : 0);
      // sac : posé au sol à côté d'Ibrahim, puis tendu à Aïcha
      const sxp = A.mix(ix + 150, 560, give), syp = A.mix(1700, 1420, Math.sin(give * Math.PI) * .6 + give * .4);
      put(this.sackS, carry ? ix + 120 * 1.3 : sxp, carry ? 1700 - 300 * 1.3 : syp, carry ? .8 : .85, 0, 1);
      // reçu et scan
      const qk = A.P(t, T_QR + .05, T_QR + .45, E.spring), qq = A.P(t, T_DONE + .2, T_DONE + .45, E.expoIn);
      this.qr.style.transform = `scale(${(t >= T_QR ? (.4 + .6 * qk) * (1 - qq * .4) : 0).toFixed(3)})`;
      this.qr.style.opacity = (A.lin(t, T_QR, T_QR + .1) * (1 - qq)).toFixed(3);
      const bk = A.env(t, T_SCAN, T_DONE, .08, .12);
      const bp = (t - T_SCAN) / (T_DONE - T_SCAN);
      A.T(this.beam, { x: 430, y: 980, r: -62 + Math.sin(bp * Math.PI * 2) * 6, o: bk });
      const okk = A.P(t, T_DONE, T_DONE + .5, E.spring);
      this.ok.style.transform = `scale(${(t >= T_DONE ? .4 + .6 * okk : 0).toFixed(3)})`;
      this.ok.style.opacity = A.lin(t, T_DONE, T_DONE + .08).toFixed(2);
      playSparks(this.sp, t, 19.35, 640, 900, 230);
      playSticker(this.st, t, 17.05, 19.95);
    },
  };

  /* ======================================================================
   * S7 — CARTE DE FIN
   * ====================================================================== */
  const T7 = 20.15, DUR = 27.0;
  const cap = (i, d) => { const c = TM.fin && TM.fin.captions[i]; return c ? c.a : d; };
  const S7 = {
    id: 'fin', a: T7, b: DUR,
    build(el) {
      el.style.display = 'block'; // visible pendant la construction : les textes se mesurent juste
      this.wrap = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: 'radial-gradient(ellipse at 50% 30%,#FF7A1A 0%,#FF4D00 55%,#E24400 100%)' } }, el);
      A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', opacity: .14, backgroundImage: 'radial-gradient(#fff 3px,transparent 3.5px),radial-gradient(#fff 2px,transparent 2.5px)', backgroundSize: '64px 64px,64px 64px', backgroundPosition: '0 0,32px 32px' } }, this.wrap);
      this.icon = A.el('div', { cls: 'abs', style: { left: '430px', top: '250px', width: '220px', height: '220px', borderRadius: '56px', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 30px 60px -24px rgba(120,30,0,.6)' } }, this.wrap, '<svg width="140" height="140" viewBox="-20 -20 40 40"><path d="M -11 12 L 0 -13 L 11 12 M -6.5 4 L 6.5 4" stroke="#FF4D00" stroke-width="5.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      this.word = A.Type.make(this.wrap, 'AMAZER', { size: 128, weight: 800, align: 'center', color: '#fff', track: -.04 });
      A.Type.place(this.word, 540, 600);
      this.tag = A.Type.make(this.wrap, 'Commandez.\n*On vous livre.*', { size: 96, weight: 800, align: 'center', color: '#fff', accent: '#FFE08A', lh: 1.02 });
      A.Type.place(this.tag, 540, 830);
      this.pill = A.el('div', { cls: 'abs', style: { left: '0', top: '0', padding: '22px 56px', borderRadius: '99px', background: '#fff', color: C.orange, font: '800 62px Geist', letterSpacing: '-.02em', boxShadow: '0 24px 50px -20px rgba(120,30,0,.55)' } }, this.wrap, 'amazer.store');
      this.pill.style.left = (540 - this.pill.offsetWidth / 2) + 'px'; this.pill.style.top = '1010px';
      this.small = A.el('div', { cls: 'abs', style: { left: '0', top: '1160px', width: '1080px', textAlign: 'center', font: '600 38px Geist', color: '#FFF1E8' } }, this.wrap, 'Paiement Nita ou Amana · Livraison à Niamey');
      this.cast = [T.person(this.wrap, T.CAST.moussa), T.person(this.wrap, T.CAST.ibrahim), T.person(this.wrap, T.CAST.aicha)];
      this.iris = A.el('div', { cls: 'abs', style: { width: '10px', height: '10px', borderRadius: '50%', background: '#FF4D00' } }, el);
      cue(T7, 'impact', .55);
      cue(T7 + .25, 'whoosh', .5);
      cue(cap(1, 21.2) - .1, 'pop', .55);
      cue(cap(2, 23.4) - .1, 'pop', .55);
      cue(T7 + .7, 'plink', .4, -.5); cue(T7 + .8, 'plink', .4, 0); cue(T7 + .9, 'plink', .4, .5);
    },
    seek(t) {
      // ouverture en iris depuis le centre
      const ik = A.P(t, T7, T7 + .45, E.expoOut);
      this.wrap.style.clipPath = `circle(${(ik * 1150).toFixed(1)}px at 540px 1000px)`;
      const ic = A.P(t, T7 + .25, T7 + .8, E.spring);
      this.icon.style.transform = `scale(${(t > T7 + .25 ? .3 + .7 * ic : 0).toFixed(3)}) rotate(${((1 - ic) * -14).toFixed(2)}deg)`;
      A.Type.play(this.word, t, T7 + .35, 1e9, { stagger: .05 });
      A.Type.play(this.tag, t, cap(1, 21.2) - .2, 1e9, { stagger: .07, dur: .6 });
      const pk = A.P(t, cap(2, 23.4) - .2, cap(2, 23.4) + .35, E.spring);
      this.pill.style.transform = `scale(${(t > cap(2, 23.4) - .2 ? .5 + .5 * pk : 0).toFixed(3)})`;
      this.small.style.opacity = A.lin(t, cap(2, 23.4) + .3, cap(2, 23.4) + .6).toFixed(2);
      // les trois personnages surgissent du bas et saluent
      [[230, 0], [850, 1], [540, 2]].forEach(([x, i], k) => {
        const up = A.P(t, T7 + .5 + k * .12, T7 + 1.1 + k * .12, E.spring);
        const wave = Math.sin((t - T7) * 7 + k) * 22;
        this.cast[i].pose({
          x, y: 2010 + (1 - up) * 500, s: i === 2 ? 1.0 : .92, t, flip: x > 540, shadow: 0,
          near: { sh: 150 + wave * .4, el: 40 + wave }, far: { sh: -6, el: 10 },
          mouth: 'grin', blink: T.blink(t, 9 + k), look: [x > 540 ? -2 : 2, -2], headTilt: Math.sin((t - T7) * 2 + k) * 4,
        });
      });
    },
  };

  window.FILM = {
    id: 'toon1', duration: DUR, cues,
    scenes: [S1, S2, S3, S4, S5, S6, S7],
  };
  // balayage orange S1 → S2 (dans la scène S2, au-dessus de tout)
  const wipeScene = {
    id: 'balayage', a: 3.8, b: 4.4,
    build(el) { this.band = A.el('div', { cls: 'abs', style: { width: '2400px', height: '900px', background: C.orange, transformOrigin: '50% 50%' } }, el); this.band2 = A.el('div', { cls: 'abs', style: { width: '2400px', height: '160px', background: '#FFE08A' } }, el); },
    seek(t) {
      const k = A.P(t, 3.8, 4.35, E.cubicInOut);
      const y = A.mix(2300, -1300, k);
      A.T(this.band, { x: -660, y, r: -24 });
      A.T(this.band2, { x: -660, y: y + 980, r: -24 });
    },
  };
  window.FILM.scenes.push(wipeScene);
})(window.A);
