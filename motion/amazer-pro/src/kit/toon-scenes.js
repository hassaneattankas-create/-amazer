/* toon-scenes.js — bibliothèque de scènes des pubs à personnages (vertical 1080×1920).
 *
 * Chaque modèle : A.TS.scenes[type](P, a, b, X) -> { id, a, b, build(el), seek(t) }
 *   P = paramètres du script (textes, écrans…), [a, b[ = intervalle de la scène, X = outils du film (cue, timing).
 * Les temps internes sont relatifs au début de la scène (u = t - a) : une scène plus longue garde son jeu
 * et prolonge la tenue. Les sous-titres (« sous_titres ») sont des autocollants : [{ texte, de, a }] en secondes relatives.
 *
 * Modèles : rue_chaleur, maison_ombre, ecrans (vrais écrans d'AMAZER dans un téléphone 3D), boutique, moto, portail, fin,
 *   boutique_calme et commandes_pluie (pubs « vendeurs »).
 */
(function (A) {
  const C = A.C, E = A.E, T = A.Toon, svgEl = T.svg;
  const NAVY = '#0F172A';
  const TS = A.TS = { scenes: {} };

  /* ---------------- outils ---------------- */
  const box = TS.box = (parent, w, h, ox, oy, inner) => {
    const s = svgEl('svg', { width: w, height: h, viewBox: `${-ox} ${-oy} ${w} ${h}`, style: 'position:absolute;left:0;top:0;overflow:visible' });
    s.style.transformOrigin = `${ox}px ${oy}px`;
    s.innerHTML = inner;
    parent.appendChild(s);
    s._o = [ox, oy];
    return s;
  };
  const put = TS.put = (e, x, y, s = 1, r = 0, o = 1) => {
    e.style.transform = `translate(${(x - e._o[0]).toFixed(1)}px,${(y - e._o[1]).toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    e.style.opacity = o.toFixed(3);
  };
  const scenery = TS.scenery = (parent, inner) => {
    const d = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px' } }, parent);
    d.innerHTML = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0">${inner}</svg>`;
    return d;
  };
  const SACK = TS.SACK = `
    <path d="M -118 0 Q -130 -80 -110 -150 Q -60 -174 0 -168 Q 60 -174 110 -150 Q 130 -80 118 0 Q 0 12 -118 0 Z" fill="#F1E5C6"/>
    <path d="M 72 -162 Q 112 -150 118 0 Q 98 6 80 6 Q 94 -80 72 -162 Z" fill="#DCCBA2"/>
    <path d="M -106 -150 Q 0 -166 106 -150" stroke="#B9A57A" stroke-width="4" stroke-dasharray="10 7" fill="none"/>
    <rect x="-80" y="-122" width="160" height="82" rx="12" fill="#fff" opacity=".92"/>
    <text x="0" y="-76" text-anchor="middle" font-family="Geist" font-weight="800" font-size="44" fill="#C2410C">RIZ</text>
    <text x="0" y="-48" text-anchor="middle" font-family="Geist" font-weight="700" font-size="26" fill="#15803D">25 kg</text>`;
  const PHONE_SMALL = TS.PHONE_SMALL = `<rect x="-16" y="-66" width="44" height="80" rx="9" fill="#111827"/><rect x="-12" y="-60" width="36" height="66" rx="5" fill="#FF4D00"/><circle cx="6" cy="-28" r="9" fill="#fff"/>`;

  /** autocollant de sous-titre (carte blanche, mots qui montent) — à créer dans une scène visible */
  const sticker = TS.sticker = (parent, text, o = {}) => {
    const wrap = A.el('div', { cls: 'abs', style: { background: o.bg ?? '#fff', borderRadius: '30px', padding: '22px 36px 26px', boxShadow: '0 22px 50px -20px rgba(60,25,5,.55)', display: 'inline-block', zIndex: 50 } }, parent);
    const ty = A.Type.make(wrap, text, { size: o.size ?? 70, weight: 800, color: o.color ?? NAVY, align: 'center', accent: o.accent ?? C.orange, lh: 1.06 });
    ty.el.style.position = 'relative';
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    wrap.style.left = (540 - w / 2) + 'px';
    wrap.style.top = ((o.y ?? 300) - h / 2) + 'px';
    wrap.style.transformOrigin = '50% 50%';
    return { wrap, ty, rot: o.rot ?? -2 };
  };
  const playSticker = TS.playSticker = (st, t, tIn, tOut) => {
    const k = A.P(t, tIn, tIn + .55, E.spring), q = A.P(t, tOut, tOut + .25, E.expoIn);
    const s = (t < tIn ? .5 : .55 + .45 * k) * (1 - .25 * q);
    st.wrap.style.transform = `rotate(${(st.rot * (1 - k * .4) + (1 - k) * -6).toFixed(2)}deg) scale(${s.toFixed(3)})`;
    st.wrap.style.opacity = (A.lin(t, tIn, tIn + .1) * (1 - q)).toFixed(3);
    st.wrap.style.visibility = t >= tIn && t < tOut + .25 ? 'visible' : 'hidden';
    A.Type.play(st.ty, t, tIn + .06, 1e9, { stagger: .045, dur: .5, tilt: 4 });
  };
  /** autocollants d'une scène depuis P.sous_titres : [{texte, de, a, y, couleur:'orange'}] */
  const stickers = (el, P, d = {}) => (P.sous_titres ?? d.list ?? []).map((s, i) => ({
    st: sticker(el, s.texte, { y: s.y ?? d.y ?? 300, size: s.taille ?? d.size ?? 70, rot: i % 2 ? 2 : -2, ...(s.couleur === 'orange' ? { bg: C.orange, color: '#fff', accent: '#FFE08A' } : {}) }),
    de: s.de, a: s.a,
  }));
  const playStickers = (list, u, D) => list.forEach(s => playSticker(s.st, u, s.de ?? .15, (s.a ?? D - .35)));

  const sparks = TS.sparks = (parent, n = 8, col = '#FDE047') => {
    const g = A.el('div', { cls: 'abs', style: { zIndex: 40 } }, parent);
    const items = Array.from({ length: n }, () => A.el('div', { cls: 'abs', style: { width: '14px', height: '44px', borderRadius: '7px', background: col } }, g));
    return { g, items };
  };
  const playSparks = TS.playSparks = (sp, t, t0, x, y, rad = 140) => {
    const k = A.P(t, t0, t0 + .5, E.expoOut), o = 1 - A.lin(t, t0 + .2, t0 + .6);
    sp.items.forEach((e, i) => {
      const ang = i / sp.items.length * Math.PI * 2;
      const r = rad * (.55 + .45 * k);
      e.style.transform = `translate(${(x - 7 + Math.cos(ang) * r).toFixed(1)}px,${(y - 22 + Math.sin(ang) * r).toFixed(1)}px) rotate(${(ang * 180 / Math.PI + 90).toFixed(1)}deg) scale(${(1 - k * .5).toFixed(2)})`;
      e.style.opacity = (t >= t0 ? o : 0).toFixed(3);
    });
  };
  /** léger mouvement de caméra « à l'épaule » (déterministe) */
  const handheld = (el, t, k = 1, s = 1) => A.T(el, { x: A.wob(t, 1, .7) * 6 * k, y: A.wob(t, 2, .6) * 5 * k, r: A.wob(t, 3, .5) * .25 * k, s });

  /* ---------------- téléphone 3D + vrais écrans (réutilisé par plusieurs scènes) ---------------- */
  /** items : [{ img, de, scroll:[y0,y1,t0,t1], taps:[{x,y,at}], zoom:[s,x,y] }] (temps relatifs à la scène) */
  const BAR = TS.BAR = 50; // barre d'état du téléphone : la page commence en dessous, comme sur un vrai mobile
  TS.phoneScreens = (parent, items, o = {}) => {
    const ph = A.Phone.make(parent);
    ph.root.style.zIndex = o.z ?? 20;
    const layers = items.map((it, i) => {
      const s = A.Phone.screen(ph, 'e' + i, '', { bg: '#fff' });
      const img = A.el('img', { src: it.img, style: { position: 'absolute', left: 0, top: BAR + 'px', width: '390px', display: 'block' } }, s);
      // « marque » : [x, y, largeur, hauteur, instant] — encadré orange lumineux sur une zone de l'écran (px de la page)
      const mk = it.marque ? A.el('div', { cls: 'abs', style: { left: (it.marque[0] - 6) + 'px', top: (it.marque[1] + BAR - 6) + 'px', width: (it.marque[2] + 12) + 'px', height: (it.marque[3] + 12) + 'px', border: '4px solid #FF4D00', borderRadius: '12px', background: 'rgba(255,77,0,.12)', boxShadow: '0 0 0 6px rgba(255,77,0,.18), 0 0 26px rgba(255,77,0,.55)', zIndex: 5, opacity: 0 } }, s) : null;
      return { s, img, it, mk };
    });
    A.Phone.statusTone(ph, false);
    const ripple = A.el('div', { cls: 'abs', style: { width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,77,0,.22)', border: '5px solid rgba(255,77,0,.85)', zIndex: 50 } }, ph.screen);
    return {
      ph, layers, ripple,
      /** u = temps relatif ; renvoie l'écran visible et le décalage de défilement */
      seek(u) {
        let cur = 0;
        layers.forEach((L, i) => { if (u >= (L.it.de ?? 0)) cur = i; });
        layers.forEach((L, i) => {
          const t0 = L.it.de ?? 0, k = i === 0 ? 1 : A.P(u, t0, t0 + .38, E.expoOut);
          const next = layers[i + 1], q = next ? A.P(u, next.it.de, next.it.de + .38, E.expoOut) : 0;
          const vis = u >= (i === 0 ? -1e9 : t0) && (!next || u < next.it.de + .38);
          L.s.style.display = vis ? '' : 'none';
          L.s.style.transform = `translateX(${((1 - k) * 390 - q * 120).toFixed(1)}px)`;
          L.s.style.filter = q > .02 ? `brightness(${(1 - q * .25).toFixed(3)})` : 'none';
          L.s.style.zIndex = i;
          const sc = L.it.scroll;
          const y = sc ? A.mix(sc[0], sc[1], A.P(u, sc[2], sc[3], E.cubicInOut)) : 0;
          L.img.style.transform = `translateY(${(-y).toFixed(1)}px)`;
          L.scrollY = y;
          if (L.mk) {
            const m0 = L.it.marque[4] ?? 0, k = A.P(u, m0, m0 + .35, E.spring);
            L.mk.style.opacity = (u >= m0 ? Math.min(1, (u - m0) * 6) * (.85 + .15 * Math.sin((u - m0) * 9)) : 0).toFixed(3);
            L.mk.style.transform = `translateY(${(-y).toFixed(1)}px) scale(${(.85 + .15 * k).toFixed(3)})`;
          }
        });
        // toucher : onde à l'endroit exact du bouton
        let rp = null;
        layers.forEach(L => (L.it.taps ?? []).forEach(tp => { if (u >= tp.at && u < tp.at + .5) rp = { tp, L }; }));
        if (rp) {
          const k = A.P(u, rp.tp.at, rp.tp.at + .5, E.expoOut);
          A.T(this.ripple, { x: rp.tp.x - 60, y: rp.tp.y + BAR - (rp.L.scrollY ?? 0) - 60, s: .3 + k * 1.1, o: 1 - k });
        } else A.T(this.ripple, { o: 0 });
        return { cur, layer: layers[cur] };
      },
      /** position (scène) d'un point de l'écran (x, y en px de l'app) pour une pose donnée */
      toStage(x, y, pose) {
        const s = pose.s ?? 1, cx = pose.x ?? 540, cy = pose.y ?? 960;
        return [cx + (x + 12 - 207) * s, cy + (y + BAR + 12 - 434) * s];
      },
    };
  };
  /** main qui tient le téléphone : paume en coupe sous le téléphone, doigts qui entourent le bord gauche,
   *  pouce articulé (deux phalanges, ongle, pli) qui s'étire vers l'endroit touché ; ombre douce sur l'écran. */
  TS.hand = (parent, skin = '#8B5A3C', shade = '#6E4229', light = '#A06A48') => {
    const nail = '#E9C4A6', nailLine = '#D8A889';
    const palm = box(parent, 1080, 1920, 0, 0, '');
    const fingers = box(parent, 1080, 1920, 0, 0, '');
    const thumb = box(parent, 1080, 1920, 0, 0, '');
    palm.style.zIndex = 10; fingers.style.zIndex = 26; thumb.style.zIndex = 30;
    fingers.style.filter = 'drop-shadow(0 4px 5px rgba(40,20,10,.28))';
    thumb.style.filter = 'drop-shadow(0 14px 16px rgba(40,20,10,.32))';
    const f = (v) => v.toFixed(1);
    let frame = null, rest = null;
    return {
      palm, fingers, thumb,
      /** cadre du téléphone (gauche, haut, largeur, hauteur) en px de la scène */
      seekPalm(L, Tp, W, H) {
        frame = [L, Tp, W, H];
        rest = [L + W * .92, Tp + H * 1.02];
        const cx = L + W * .52, by = Tp + H;
        // paume et poignet derrière le téléphone (coupe sous la moitié basse), dégradé léger
        palm.innerHTML = `
          <defs><linearGradient id="hpal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${skin}"/><stop offset="1" stop-color="${shade}"/></linearGradient></defs>
          <path d="M ${f(L - W * .08)} ${f(Tp + H * .48)} Q ${f(L - W * .16)} ${f(by + H * .05)} ${f(cx - W * .1)} ${f(by + H * .2)} L ${f(cx - W * .02)} ${f(by + H * .6)} L ${f(cx + W * .62)} ${f(by + H * .6)} L ${f(cx + W * .5)} ${f(by + H * .12)} Q ${f(L + W * 1.06)} ${f(by - H * .02)} ${f(L + W * .9)} ${f(Tp + H * .7)} Z" fill="url(#hpal)"/>
          <path d="M ${f(cx - W * .08)} ${f(by + H * .16)} Q ${f(cx + W * .2)} ${f(by + H * .22)} ${f(cx + W * .45)} ${f(by + H * .1)}" stroke="${shade}" stroke-width="5" fill="none" opacity=".45"/>`;
        // quatre doigts qui entourent le bord gauche (bouts posés devant le cadre du téléphone)
        const fw = W * .17, fh = H * .068;
        fingers.innerHTML = [0, 1, 2, 3].map((k) => {
          const y = Tp + H * (.46 + k * .105), w = fw * (1 - k * .07), h = fh * (1 - k * .06), x = L - w * .62;
          return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${skin}"/>
            <rect x="${f(x)}" y="${f(y)}" width="${f(w * .55)}" height="${f(h)}" rx="${f(h / 2)}" fill="${shade}" opacity=".55"/>
            <path d="M ${f(x + w - h * .55)} ${f(y + h * .22)} q ${f(h * .3)} ${f(h * .28)} 0 ${f(h * .56)}" stroke="${nail}" stroke-width="${f(h * .16)}" stroke-linecap="round" fill="none" opacity=".9"/>
            <path d="M ${f(x + w * .42)} ${f(y + h * .25)} l 0 ${f(h * .5)}" stroke="${shade}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`;
        }).join('');
      },
      /** pouce : la base suit le mouvement (la main se déplace un peu), la phalange s'étire vers le point (px, py) */
      seekThumb(px, py, press = 0, o = 1) {
        if (!frame) return;
        const [L, Tp, W, H] = frame;
        const b0 = [L + W * 1.18, Tp + H * 1.2];
        const bx = b0[0] + (px - rest[0]) * .7, by = b0[1] + (py - rest[1]) * .7;
        const tx = px + 6, ty = py + 10 + press * 4;
        const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const s = W / 580; // échelle du téléphone
        const wB = 128 * s, wJ = 92 * s, wT = 76 * s * (1 + press * .08);
        const j = len * .52; // articulation
        thumb.style.opacity = o.toFixed(3);
        thumb.innerHTML = `<g transform="translate(${f(bx)},${f(by)}) rotate(${f(ang)})">
          <rect x="${f(-900 * s)}" y="${f(-wB * .72)}" width="${f(900 * s)}" height="${f(wB * 1.5)}" rx="${f(wB * .7)}" fill="${skin}"/>
          <rect x="${f(-900 * s)}" y="${f(wB * .12)}" width="${f(900 * s)}" height="${f(wB * .66)}" fill="${shade}" opacity=".45"/>
          <ellipse cx="${f(-wB * .1)}" cy="${f(wB * .05)}" rx="${f(wB * .85)}" ry="${f(wB * .74)}" fill="${skin}"/>
          <path d="M ${f(-wB * .7)} ${f(-wB * .2)} Q ${f(-wB * .1)} ${f(-wB * .55)} ${f(wB * .45)} ${f(-wB * .38)}" stroke="${light}" stroke-width="${f(9 * s)}" stroke-linecap="round" fill="none" opacity=".5"/>
          <path d="M 0 ${f(-wB / 2)} C ${f(j * .5)} ${f(-wB / 2)} ${f(j * .8)} ${f(-wJ / 2 - 4 * s)} ${f(j)} ${f(-wJ / 2)} L ${f(len - wT / 2)} ${f(-wT / 2)} A ${f(wT / 2)} ${f(wT / 2)} 0 0 1 ${f(len - wT / 2)} ${f(wT / 2)} L ${f(j)} ${f(wJ / 2)} C ${f(j * .8)} ${f(wJ / 2 + 4 * s)} ${f(j * .5)} ${f(wB / 2)} 0 ${f(wB / 2)} Z" fill="${skin}"/>
          <path d="M 0 ${f(wB * .12)} C ${f(j * .5)} ${f(wB * .2)} ${f(j)} ${f(wJ * .3)} ${f(len - wT / 2)} ${f(wT * .32)} L ${f(len - wT / 2)} ${f(wT / 2)} L ${f(j)} ${f(wJ / 2)} C ${f(j * .8)} ${f(wJ / 2 + 4 * s)} ${f(j * .5)} ${f(wB / 2)} 0 ${f(wB / 2)} Z" fill="${shade}" opacity=".55"/>
          <path d="M ${f(j * .2)} ${f(-wB * .3)} C ${f(j * .6)} ${f(-wB * .32)} ${f(j * 1.2)} ${f(-wJ * .32)} ${f(len - wT)} ${f(-wT * .3)}" stroke="${light}" stroke-width="${f(10 * s)}" stroke-linecap="round" fill="none" opacity=".55"/>
          <path d="M ${f(j - 6 * s)} ${f(-wJ * .32)} q ${f(8 * s)} ${f(wJ * .32)} 0 ${f(wJ * .64)}" stroke="${shade}" stroke-width="${f(4 * s)}" stroke-linecap="round" fill="none" opacity=".6"/>
          <ellipse cx="${f(len - wT * .52)}" cy="${f(-wT * .05)}" rx="${f(wT * .34)}" ry="${f(wT * .3)}" fill="${nail}"/>
          <path d="M ${f(len - wT * .8)} ${f(-wT * .3)} q ${f(-wT * .08)} ${f(wT * .25)} 0 ${f(wT * .5)}" stroke="${nailLine}" stroke-width="${f(3 * s)}" fill="none" opacity=".8"/>
        </g>`;
      },
    };
  };

  /* ======================================================================
   * rue_chaleur — Aïcha porte 25 kg de riz sur la tête en plein soleil, puis le pose
   * ====================================================================== */
  TS.scenes.rue_chaleur = (P, a, b, X) => ({
    id: 'rue', a, b,
    build(el) {
      el.style.display = 'block';
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '540px 1300px' } }, el);
      scenery(this.cam, `
        <defs><linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB547"/><stop offset=".55" stop-color="#FFD98F"/><stop offset="1" stop-color="#FFEBC2"/></linearGradient></defs>
        <rect width="1080" height="1320" fill="url(#s1sky)"/>
        <g fill="#E7B07A" opacity=".75">
          <path d="M 70 1010 L 70 900 L 110 900 L 110 860 L 300 860 L 300 1010 Z"/><path d="M 150 900 L 172 640 L 238 640 L 260 900 Z"/><path d="M 196 640 L 198 600 L 212 600 L 214 640 Z"/>
          ${[700, 740, 780, 820, 860].map(y => `<rect x="160" y="${y}" width="88" height="7" fill="#9A6237"/>`).join('')}
          ${[880, 920].map(y => `<rect x="60" y="${y}" width="250" height="6" fill="#9A6237"/>`).join('')}
        </g>
        <path d="M 0 1000 L 0 1290 L 1080 1290 L 1080 1000 L 980 1000 L 980 975 L 940 975 L 940 1000 L 620 1000 L 620 980 L 580 980 L 580 1000 L 300 1000 L 300 975 L 260 975 L 260 1000 Z" fill="#C98B5B"/>
        ${Array.from({ length: 22 }, (_, i) => `<rect x="${(i * 97) % 1060}" y="${1020 + (i * 53) % 240}" width="${54 + (i % 3) * 12}" height="18" rx="4" fill="#B57A4D" opacity=".55"/>`).join('')}
        <path d="M 760 1290 L 760 1120 Q 810 1070 860 1120 L 860 1290 Z" fill="#5B3A22"/>
        <rect x="430" y="1090" width="120" height="90" rx="6" fill="#7C4A2A"/>${[0, 1, 2, 3].map(i => `<rect x="${440 + i * 28}" y="1095" width="8" height="80" fill="#4A2E1C"/>`).join('')}
        <rect x="58" y="1050" width="34" height="250" rx="12" fill="#7A4A2A"/>
        <circle cx="40" cy="990" r="110" fill="#4D7C3A"/><circle cx="140" cy="960" r="90" fill="#5B8C43"/><circle cx="70" cy="900" r="80" fill="#3F6B30"/>
        <rect y="1290" width="1080" height="630" fill="#EBC48C"/><rect y="1290" width="1080" height="46" fill="#D9A86E"/>
        <path d="M -20 1560 Q 400 1500 1100 1590" stroke="#DDB27A" stroke-width="22" fill="none"/><path d="M -20 1720 Q 500 1650 1100 1760" stroke="#DDB27A" stroke-width="22" fill="none"/>
        ${Array.from({ length: 16 }, (_, i) => `<ellipse cx="${(i * 173) % 1080}" cy="${1380 + (i * 97) % 500}" rx="${6 + i % 4}" ry="${4 + i % 3}" fill="#C9965E"/>`).join('')}`);
      this.sun = box(this.cam, 520, 520, 260, 260, `<circle r="230" fill="#FFF3B0" opacity=".35"/><g class="rays">${Array.from({ length: 12 }, (_, i) => `<rect x="-9" y="-215" width="18" height="70" rx="9" fill="#FFF7CC" transform="rotate(${i * 30})"/>`).join('')}</g><circle r="120" fill="#FFF8D6"/><circle r="104" fill="#FFFBEA"/>`);
      this.rays = this.sun.querySelector('.rays');
      this.heat = [0, 1, 2].map(() => box(this.cam, 1080, 60, 0, 30, `<path d="M 0 0 Q 90 -22 180 0 T 360 0 T 540 0 T 720 0 T 900 0 T 1080 0" stroke="#fff" stroke-width="5" fill="none" opacity=".35"/>`));
      this.temp = A.el('div', { cls: 'abs', style: { left: '700px', top: '520px', padding: '14px 28px', borderRadius: '99px', background: '#DC2626', color: '#fff', font: '800 54px Geist', boxShadow: '0 16px 30px -14px rgba(120,20,0,.6)' } }, this.cam, P.temperature ?? '42 °C');
      this.sackG = box(this.cam, 300, 200, 150, 190, SACK);
      this.dust = [0, 1, 2, 3, 4, 5].map(() => A.el('div', { cls: 'abs', style: { width: '80px', height: '80px', borderRadius: '50%', background: '#E9CFA3' } }, this.cam));
      this.ai = T.person(this.cam, T.CAST.aicha);
      this.sackHead = svgEl('g', {}, this.ai.headItem);
      this.sackHead.innerHTML = SACK;
      this.D = b - a;
      this.st = stickers(el, P, { list: [{ texte: '25 kg de riz…\n*sous ce soleil ?*', de: .45, a: this.D - .45 }], size: 74 });
      const stop = this.stop = this.D - 1.1;
      X.cue(a + .05, 'shimmer', .35); X.cue(a + 1.25, 'pop', .5, .4); X.cue(a + stop + .05, 'scratch', .55); X.cue(a + stop + .41, 'thud', .9, .2); X.cue(a + stop + .75, 'sigh', .55);
    },
    seek(t) {
      const u = t - a, D = this.D, stop = this.stop;
      A.T(this.cam, { s: 1 + A.P(u, 0, D, E.sine) * .06, x: A.wob(u, 1, .6) * 4, y: A.wob(u, 2, .5) * 3 });
      put(this.sun, 830, 300, 1 + Math.sin(u * 3) * .03);
      this.rays.setAttribute('transform', `rotate(${(u * 12).toFixed(2)})`);
      this.heat.forEach((h, i) => { const ph = (u * .45 + i / 3) % 1; put(h, Math.sin(u * 2 + i) * 30, 1250 - ph * 520, 1, 0, Math.sin(ph * Math.PI) * .9); });
      const tk = A.P(u, 1.15, 1.6, E.spring);
      this.temp.style.transform = `scale(${(.3 + .7 * tk).toFixed(3)}) rotate(${(6 - tk * 4).toFixed(2)}deg)`;
      this.temp.style.opacity = A.lin(u, 1.15, 1.25).toFixed(2);
      const walking = u < stop;
      const x = 250 + A.P(Math.min(u, stop), 0, stop, E.sine) * 230;
      const w = walking ? T.walk(u * .62, .75) : T.walk(0, 0);
      const stag = walking ? Math.sin(u * 4.1) * 4 : 0;
      const drop = A.P(u, stop + .15, stop + .45, E.cubicIn), relief = A.lin(u, stop + .45, stop + .65);
      const s = 1.38, y = 1690, armsUp = 1 - drop;
      const fan = u > stop + .55 ? Math.sin((u - stop - .55) * 22) * 18 : 0;
      // respiration (léger gonflement) et petits sursauts d'effort
      this.ai.pose(T.merge({ x, y, s, t: u }, w, {
        sy: 1 + Math.sin(u * 5) * .006,
        lean: stag + drop * 8 - relief * 4,
        near: { sh: A.mix(174, relief > 0 ? 118 : 30, 1 - armsUp), el: A.mix(-4, relief > 0 ? 128 : 20, 1 - armsUp), wr: fan + (armsUp > .5 ? 90 : 0) },
        far: { sh: A.mix(186, -4, 1 - armsUp), el: A.mix(4, 12, 1 - armsUp), wr: armsUp > .5 ? -90 : 0 },
        mouth: u < stop + .45 ? 'effort' : u < stop + .75 ? 'o' : 'flat', brow: u < stop + .45 ? -.3 : .2, browTilt: u < stop + .45 ? 10 : -4,
        sweat: 1, blink: u > stop + .5 && u < stop + .67 ? 1 : T.blink(u, 1), look: u > stop + .65 ? [-3, 2] : [3, 0], headTilt: u > stop + .65 ? -6 : Math.sin(u * 4.1) * 2,
      }));
      const bob = w.bob ?? 0;
      const hx = x + 8 * s, hy = y + (-594 + bob) * s, gx = x + 200 * s, gy = y + 4;
      const sx = A.mix(hx, gx, drop), sy = A.mix(hy, gy, drop) - Math.sin(drop * Math.PI) * 60;
      const onHead = u < stop + .15;
      this.sackHead.setAttribute('transform', `translate(8,-594) rotate(${(Math.sin(u * 4.1) * 4).toFixed(2)}) scale(.66)`);
      this.sackHead.setAttribute('opacity', onHead ? 1 : 0);
      put(this.sackG, sx, sy, s * .66, onHead ? 0 : (1 - drop) * 12, onHead ? 0 : 1);
      const dk = A.P(u, stop + .41, stop + .95, E.expoOut);
      this.dust.forEach((d, i) => {
        const ang = (i / 6) * Math.PI, r = 40 + dk * 170;
        A.T(d, { x: gx - 40 + Math.cos(ang) * r * (i % 2 ? 1 : -1), y: gy - 60 - Math.sin(ang) * r * .35 - dk * 30, s: .6 + dk * 1.4, o: u >= stop + .41 ? (1 - dk) * .8 : 0 });
      });
      playStickers(this.st, u, D);
    },
  });

  /* ======================================================================
   * maison_ombre — elle s'affale sous le ventilateur, soupire, sort son téléphone
   * ====================================================================== */
  TS.scenes.maison_ombre = (P, a, b, X) => ({
    id: 'maison', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '600px 1150px' } }, el);
      scenery(this.cam, `
        <rect width="1080" height="1320" fill="#F6E3C6"/><rect y="1100" width="1080" height="220" fill="#EBC9A0"/><rect y="1094" width="1080" height="12" fill="#C2410C" opacity=".55"/>
        <rect x="610" y="330" width="340" height="440" rx="16" fill="#8FD3F5"/><rect x="610" y="600" width="340" height="170" fill="#F3C98B"/><circle cx="880" cy="420" r="46" fill="#FFF3B0"/>
        <rect x="602" y="322" width="356" height="456" rx="18" fill="none" stroke="#9A6237" stroke-width="16"/><rect x="772" y="322" width="16" height="456" fill="#9A6237"/>
        <rect x="520" y="330" width="80" height="440" rx="10" fill="#1D4ED8"/><rect x="960" y="330" width="80" height="440" rx="10" fill="#1D4ED8"/>
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="528" y="${350 + i * 58}" width="64" height="12" rx="5" fill="#1E40AF"/><rect x="968" y="${350 + i * 58}" width="64" height="12" rx="5" fill="#1E40AF"/>`).join('')}
        <path d="M 610 770 L 950 770 L 1080 1500 L 300 1500 Z" fill="#FFF8E6" opacity=".35"/>
        <rect x="80" y="520" width="300" height="20" rx="8" fill="#9A6237"/><rect x="110" y="440" width="90" height="80" rx="14" fill="#B91C1C"/><circle cx="140" cy="480" r="22" fill="#FDE68A"/>
        <rect x="230" y="470" width="40" height="50" rx="6" fill="#0F766E"/><rect x="280" y="455" width="60" height="65" rx="8" fill="#F5B301"/>
        <rect y="1320" width="1080" height="600" fill="#C8834F"/><ellipse cx="540" cy="1700" rx="520" ry="150" fill="#B45309"/>
        <ellipse cx="540" cy="1700" rx="470" ry="122" fill="none" stroke="#FDE68A" stroke-width="10" stroke-dasharray="26 18"/>
        <path d="M 980 1330 Q 940 1180 990 1080 Q 1030 1180 1010 1330 Z" fill="#3F6B30"/><path d="M 1000 1330 Q 1060 1200 1080 1120 L 1080 1330 Z" fill="#4D7C3A"/><rect x="950" y="1300" width="110" height="110" rx="16" fill="#C2410C"/>
        <path d="M 120 1090 Q 120 1010 200 1010 L 880 1010 Q 960 1010 960 1090 L 960 1420 L 120 1420 Z" fill="#D97706"/>
        <rect x="170" y="1050" width="230" height="200" rx="40" fill="#FDBA74"/><rect x="680" y="1050" width="230" height="200" rx="40" fill="#0F766E"/>`);
      this.fan = box(this.cam, 600, 200, 300, 60, `<rect x="-6" y="-80" width="12" height="80" fill="#64748B"/><g class="bl">${[0, 120, 240].map(r => `<ellipse cx="0" cy="-130" rx="34" ry="130" fill="#E2E8F0" transform="rotate(${r})"/>`).join('')}</g><circle r="30" fill="#94A3B8"/>`);
      this.bl = this.fan.querySelector('.bl');
      this.ai = T.person(this.cam, T.CAST.aicha);
      scenery(this.cam, `<path d="M 100 1380 Q 100 1330 160 1330 L 920 1330 Q 980 1330 980 1380 L 980 1640 L 100 1640 Z" fill="#B45309"/><rect x="100" y="1330" width="880" height="70" rx="30" fill="#F59E0B"/><rect x="130" y="1630" width="40" height="70" fill="#7C2D12"/><rect x="910" y="1630" width="40" height="70" fill="#7C2D12"/>`);
      this.phone = svgEl('g', {}, this.ai.near.item); this.phone.innerHTML = PHONE_SMALL;
      this.st = stickers(el, P, { list: [{ texte: 'Restez plutôt\n*à l’ombre !*', de: .2 }], size: 76 });
      X.cue(a + .1, 'whoosh', .5); X.cue(a + .27, 'thud', .5); X.cue(a + .4, 'sigh', .7); X.cue(a + this.D - .9, 'pop', .45, .2);
    },
    seek(t) {
      const u = t - a, D = this.D;
      const z = A.P(u, D - .3, D, E.expoIn);
      A.T(this.cam, { s: 1 + z * .9, x: A.wob(u, 4, .5) * 4, y: A.wob(u, 5, .4) * 3 });
      put(this.fan, 540, 150, 1);
      this.bl.setAttribute('transform', `rotate(${(u * 520).toFixed(1)})`);
      const fall = A.P(u, 0, .27, E.cubicIn), land = A.P(u, .27, .65, E.spring);
      const relax = A.lin(u, .35, .5) * (1 - A.lin(u, D - 1.15, D - 1.0));
      const phoneUp = A.P(u, D - 1.0, D - .7, E.expoOut);
      const fan = relax > 0 ? Math.sin(u * 20) * 20 : 0;
      this.ai.pose({
        x: 540, y: 1660 - (1 - fall) * 160, s: 1.32, t: u, sy: 1 - (1 - land) * .06 * (u > .27 ? 1 : 0) + Math.sin(u * 3) * .004, shadow: 0,
        lean: -6 * relax,
        near: { sh: A.mix(A.mix(10, 120, relax), 58, phoneUp), el: A.mix(A.mix(10, 120, relax), 108, phoneUp), wr: fan },
        far: { sh: -10 - relax * 10, el: 14 },
        blink: u > .35 && u < D - 1.2 ? 1 : T.blink(u, 2),
        mouth: u < .35 ? 'o' : u < D - 1.05 ? 'smile' : 'grin', headTilt: -8 * relax + phoneUp * 6,
        look: phoneUp > .5 ? [4, 6] : [0, 0], brow: phoneUp > .5 ? .5 : 0,
      });
      this.phone.setAttribute('transform', `rotate(-90) scale(${(phoneUp * 1.1).toFixed(3)})`);
      this.phone.setAttribute('opacity', phoneUp > 0 ? 1 : 0);
      playStickers(this.st, u, D - .25);
    },
  });

  /* ======================================================================
   * ecrans — VRAIS ÉCRANS D'AMAZER dans un téléphone 3D tenu en main (pouce qui touche, défilement)
   *   P.ecrans : [{ img:'assets/screens/…png', de, scroll:[y0,y1,t0,t1], taps:[{x,y,at}], texte }]
   * ====================================================================== */
  TS.scenes.ecrans = (P, a, b, X) => ({
    id: 'ecrans', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      el.style.background = P.fond ?? 'radial-gradient(ellipse at 50% 40%,#FFE3BF 0%,#F8C38A 60%,#EFA765 100%)';
      this.el = el;
      this.bokeh = Array.from({ length: 9 }, (_, i) => A.el('div', { cls: 'abs', style: { width: `${120 + (i % 4) * 60}px`, height: `${120 + (i % 4) * 60}px`, borderRadius: '50%', background: 'rgba(255,255,255,.28)', filter: 'blur(6px)' } }, el));
      this.rig = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', perspective: '2200px' } }, el);
      this.hand = TS.hand(this.rig, P.peau, P.peauOmbre, P.peauClair);
      this.ps = TS.phoneScreens(this.rig, P.ecrans);
      this.sp = sparks(el, 10, '#22C55E');
      // « mascotte » : { img, de, x, y, h } — la mascotte AMAZER surgit au bord de l'écran et présente le téléphone
      if (P.mascotte) {
        const m = P.mascotte;
        this.masc = A.el('img', { src: m.img ?? 'assets/persos/mascotte-assistant.png', style: { position: 'absolute', left: '0px', top: '0px', height: (m.h ?? 640) + 'px', zIndex: 34, transformOrigin: '50% 100%', filter: 'drop-shadow(0 18px 24px rgba(60,25,5,.35))' } }, el);
        X.cue(a + (m.de ?? .5), 'pop', .55, -.4);
      }
      this.st = stickers(el, P, { list: (P.ecrans ?? []).filter(e => e.texte).map((e, i, arr) => ({ texte: e.texte, de: (e.de ?? 0) + .12, a: (arr[i + 1]?.de ?? this.D) - .15 })), y: 250, size: 66 });
      X.cue(a + .02, 'whoosh', .5);
      (P.ecrans ?? []).forEach((e, i) => { if (i) X.cue(a + e.de, 'swipe', .35); (e.taps ?? []).forEach(tp => X.cue(a + tp.at, 'tap', .8)); });
      if (P.succes != null) { X.cue(a + P.succes, 'ding', .75); X.cue(a + P.succes + .03, 'shimmer', .35); }
    },
    seek(t) {
      const u = t - a, D = this.D;
      this.el.style.opacity = A.P(u, 0, .25, E.cubicOut).toFixed(3); // fondu par-dessus la scène précédente
      this.bokeh.forEach((bk, i) => A.T(bk, { x: (i * 223) % 1000 - 60 + A.wob(u, i, .3) * 40, y: (i * 389) % 1800 + A.wob(u, i + 3, .25) * 50 }));
      const enter = A.P(u, 0, .55, E.expoOut), exit = A.P(u, D - .28, D, E.expoIn);
      const s = 1.4, cx = 540 - exit * 1200, cy = 1080 + (1 - enter) * 900;
      const pose = { x: cx, y: cy, s, ry: A.mix(10, -3, enter) + A.wob(u, 2, .4) * 1.6, rx: A.wob(u, 3, .35) * 1.2, r: (1 - enter) * 8 - exit * 5 };
      A.Phone.pose(this.ps.ph, pose);
      const { layer } = this.ps.seek(u);
      // main : paume derrière le téléphone ; pouce vers le prochain toucher
      const W = 414 * s, H = 868 * s, L = cx - W / 2, Tp = cy - H / 2;
      this.hand.seekPalm(L, Tp, W, H);
      const taps = (P.ecrans ?? []).flatMap(e => (e.taps ?? []).map(tp => ({ ...tp, scr: e })));
      const rest = [cx + W * .42, cy + H * .52];
      let px = rest[0], py = rest[1], press = 0;
      for (const tp of taps) {
        const [tx, ty] = this.ps.toStage(tp.x, tp.y - (tp.scr === layer.it ? (layer.scrollY ?? 0) : 0), pose);
        const kIn = A.P(u, tp.at - .45, tp.at - .03, E.cubicInOut), kOut = A.P(u, tp.at + .12, tp.at + .5, E.cubicInOut);
        if (u > tp.at - .45 && u < tp.at + .5) { px = A.mix(A.mix(rest[0], tx, kIn), rest[0], kOut); py = A.mix(A.mix(rest[1], ty, kIn), rest[1], kOut); }
        press = Math.max(press, A.env(u, tp.at - .04, tp.at + .14, .05, .1));
      }
      this.hand.seekThumb(px, py, press, 1 - exit);
      this.hand.palm.style.opacity = this.hand.fingers.style.opacity = (1 - exit).toFixed(3);
      this.hand.palm.style.transform = `translateX(${(-exit * 0).toFixed(1)}px)`;
      if (P.succes != null) playSparks(this.sp, t, a + P.succes + .05, cx, cy - 120, 260);
      if (this.masc) {
        const m = P.mascotte, d0 = m.de ?? .5, e0 = m.a ?? D, k = A.P(u, d0, d0 + .55, E.spring), out = A.P(u, e0 - .35, e0, E.expoIn);
        const sway = Math.sin((u - d0) * 2.4) * 2.5, bob = Math.abs(Math.sin((u - d0) * 2.4)) * 10;
        this.masc.style.transform = `translate(${((m.x ?? -60) - out * 500).toFixed(1)}px,${((m.y ?? 1250) + (1 - k) * 700 - bob).toFixed(1)}px) rotate(${sway.toFixed(2)}deg)`;
        this.masc.style.opacity = (u >= d0 ? 1 - out : 0).toFixed(3);
      }
      playStickers(this.st, u, D);
    },
  });

  /* ======================================================================
   * boutique — Moussa reçoit la commande (vrai écran vendeur en insert), pose le sac, Ibrahim le prend
   *   P.ecran : capture de l'espace vendeur (ex. 'assets/screens/11-boutique-commandes.png'), P.tap : {x,y}
   * ====================================================================== */
  TS.scenes.boutique = (P, a, b, X) => ({
    id: 'boutique', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '540px 1200px' } }, el);
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
        <text x="540" y="408" text-anchor="middle" font-family="Geist" font-weight="800" font-size="58" fill="#FDE68A">${P.enseigne ?? 'Boutique Moussa'}</text>`);
      this.mo = T.person(this.cam, T.CAST.moussa);
      this.mo.near.item.innerHTML = '';
      this.moPhone = svgEl('g', {}, this.mo.near.item); this.moPhone.innerHTML = PHONE_SMALL;
      this.sackC = box(this.cam, 300, 200, 150, 190, SACK);
      scenery(this.cam, `
        <rect x="0" y="1300" width="1080" height="620" fill="#7C4A2A"/><rect x="0" y="1282" width="1080" height="44" rx="10" fill="#A86B3D"/>
        ${[0, 1, 2, 3].map(i => `<rect x="${60 + i * 260}" y="1380" width="200" height="300" rx="16" fill="#6B3F22"/>`).join('')}
        <rect x="120" y="1180" width="150" height="104" rx="14" fill="#94A3B8"/><rect x="140" y="1160" width="110" height="26" rx="10" fill="#CBD5E1"/>`);
      this.sackHand = box(this.cam, 300, 200, 150, 190, SACK);
      this.ib = T.person(this.cam, T.CAST.ibrahim);
      // insert : le vrai écran de la boutique dans son téléphone
      this.ins = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', zIndex: 30, perspective: '2200px' } }, el);
      this.insBg = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: 'rgba(15,23,42,.55)' } }, this.ins);
      this.ps = TS.phoneScreens(this.ins, [{ img: P.ecran ?? 'assets/screens/11-boutique-commandes.png', de: 0, scroll: P.scroll, taps: P.tap ? [{ ...P.tap, at: (P.insert?.[0] ?? .35) + .95 }] : [] }]);
      const [i0, i1] = this.insert = P.insert ?? [.35, 2.1];
      this.sp = sparks(el, 8, '#FDE047');
      this.st = stickers(el, P, { list: [{ texte: 'La boutique *prépare*\nvotre commande…', de: .15, a: this.D - .35 }], y: 250, size: 66 });
      X.cue(a + .02, 'swipe', .5); X.cue(a + .15, 'buzz', .5, -.4); X.cue(a + i0, 'whoosh', .45); if (P.tap) X.cue(a + i0 + .95, 'tap', .8);
      X.cue(a + i1 + .55, 'thud', .55); X.cue(a + this.D - .45, 'tap', .5, .4);
    },
    seek(t) {
      const u = t - a, D = this.D, [i0, i1] = this.insert;
      const enter = A.P(u, 0, .25, E.expoOut);
      A.T(this.cam, { x: (1 - enter) * 1080 + A.wob(u, 2, .5) * 4, y: A.wob(u, 3, .4) * 3 });
      // insert du téléphone de Moussa
      const ik = A.P(u, i0, i0 + .45, E.expoOut), iq = A.P(u, i1 - .3, i1, E.expoIn);
      const on = u >= i0 && u < i1;
      this.ins.style.display = on ? '' : 'none';
      this.insBg.style.opacity = (ik * (1 - iq)).toFixed(3);
      A.Phone.pose(this.ps.ph, { x: 540 + iq * 900, y: 1120 + (1 - ik) * 800, s: 1.32, ry: A.mix(14, -4, ik) + A.wob(u, 1, .4), r: (1 - ik) * 8 - iq * 6 });
      this.ps.seek(u - i0);
      const read = A.lin(u, .2, .3), happy = A.lin(u, i1, i1 + .1);
      const lift = A.P(u, i1 + .15, i1 + .45, E.backOut), slide = A.P(u, i1 + .5, i1 + .85, E.cubicInOut);
      const phoneUp = A.P(u, .1, .3, E.expoOut) * (1 - A.P(u, i1, i1 + .15));
      this.mo.pose({
        x: 420, y: 1690, s: 1.42, t: u, shadow: 0,
        look: phoneUp > .5 ? [4, 6] : [4, -4], brow: happy * .6, mouth: happy ? (u > i1 + .15 && u < i1 + .45 ? 'effort' : 'grin') : read ? 'o' : 'smile',
        near: phoneUp > .05 ? { sh: A.mix(20, 60, phoneUp), el: A.mix(30, 105, phoneUp) } : { sh: A.mix(20, 70, lift) + slide * 10, el: A.mix(30, 50, lift) },
        far: { sh: A.mix(-8, 40, lift), el: 40 }, blink: T.blink(u, 4), headTilt: happy * 4 + phoneUp * 5,
        talk: u > D - .8 && u < D - .3,
      });
      this.moPhone.setAttribute('opacity', phoneUp > .05 ? 1 : 0);
      this.moPhone.setAttribute('transform', 'rotate(-90) scale(1.1)');
      const grabT = D - .45;
      const grab = A.P(u, grabT - .1, grabT, E.expoOut);
      const sx = A.mix(560, 760, slide), sy = A.mix(1430, 1290, lift);
      const ibx = u < grabT ? A.mix(1260, 900, A.P(u, i1 + .7, grabT - .1, E.sine)) : A.mix(900, 1320, A.P(u, grabT + .05, D, E.cubicIn));
      const carrying = u >= grabT;
      put(this.sackC, sx, sy, 1.0, 0, carrying ? 0 : (u > i1 + .15 ? 1 : 0));
      const walk = (u > i1 + .7 && u < grabT - .1) || u > grabT + .05 ? T.walk(u * 1.2, .9) : T.walk(0, 0);
      this.ib.pose(T.merge({ x: ibx, y: 1810, s: 1.36, t: u, flip: !carrying, shadow: 0 }, walk, {
        near: carrying ? { sh: 62, el: 70 } : grab > 0 ? { sh: 50, el: 30 } : walk.near,
        far: carrying ? { sh: 56, el: 76 } : walk.far, mouth: 'grin', blink: T.blink(u, 5), look: carrying ? [4, 0] : [-2, 0],
        o: u > i1 + .6 ? 1 : 0,
      }));
      put(this.sackHand, ibx + 120 * 1.36, 1810 - 300 * 1.36, .8, -4, carrying ? 1 : 0);
      playSparks(this.sp, u, i1 + .05, 520, 820, 160);
      playStickers(this.st, u, D);
    },
  });

  /* ======================================================================
   * moto — Ibrahim prend la course (vrai écran livreur en insert) puis traverse Niamey
   *   P.ecran : 'assets/screens/13-livreur.png', P.tap : {x,y}
   * ====================================================================== */
  const houses = (n, seed, base, hMin, hMax, cols, tile) => {
    const r = A.rand(seed);
    let s = '', x = 0;
    for (let i = 0; i < n && x < tile; i++) {
      const w = 160 + r() * 160, h = hMin + r() * (hMax - hMin), c = cols[Math.floor(r() * cols.length)];
      s += `<rect x="${x.toFixed(0)}" y="${(base - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${c}"/><rect x="${x.toFixed(0)}" y="${(base - h - 14).toFixed(0)}" width="${w.toFixed(0)}" height="18" fill="${c}" opacity=".8"/>`;
      if (r() > .4) s += `<rect x="${(x + w * .3).toFixed(0)}" y="${(base - h * .55).toFixed(0)}" width="${(w * .22).toFixed(0)}" height="${(h * .3).toFixed(0)}" rx="6" fill="#5B3A22" opacity=".75"/>`;
      if (r() > .5) s += `<rect x="${(x + w * .62).toFixed(0)}" y="${(base - h * .7).toFixed(0)}" width="${(w * .2).toFixed(0)}" height="${(w * .2).toFixed(0)}" rx="4" fill="#1D4ED8" opacity=".8"/>`;
      if (r() > .7) s += `<rect x="${(x + w * .15).toFixed(0)}" y="${(base - h - 60).toFixed(0)}" width="44" height="46" rx="6" fill="#E2E8F0"/>`;
      x += w + 8 + r() * 30;
    }
    return s;
  };
  TS.scenes.moto = (P, a, b, X) => ({
    id: 'moto', a, b,
    build(el) {
      el.style.display = 'block';
      this.el = el;
      this.D = b - a;
      const TILE = this.TILE = 2400;
      const layer = inner => {
        const d = A.el('div', { cls: 'abs', style: { width: `${TILE * 2}px`, height: '1920px' } }, el);
        d.innerHTML = `<svg width="${TILE * 2}" height="1920" style="position:absolute;left:0;top:0">${inner}<g transform="translate(${TILE},0)">${inner}</g></svg>`;
        return d;
      };
      scenery(el, `<defs><linearGradient id="s5sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CC6EE"/><stop offset=".7" stop-color="#CFEAF3"/><stop offset="1" stop-color="#FFE7B0"/></linearGradient></defs><rect width="1080" height="1300" fill="url(#s5sky)"/><circle cx="880" cy="250" r="80" fill="#FFF7D6"/>`);
      this.clouds = layer(`<g fill="#fff" opacity=".85"><ellipse cx="300" cy="300" rx="130" ry="40"/><ellipse cx="360" cy="280" rx="80" ry="44"/><ellipse cx="1300" cy="420" rx="160" ry="44"/><ellipse cx="1380" cy="400" rx="90" ry="46"/><ellipse cx="2000" cy="260" rx="120" ry="36"/></g>`);
      this.far = layer(`
        <rect x="0" y="930" width="${TILE}" height="60" fill="#C8A574"/>${Array.from({ length: 30 }, (_, i) => `<circle cx="${i * 82 + 20}" cy="${925 - (i % 3) * 6}" r="${18 + (i % 4) * 5}" fill="#6E9A4E"/>`).join('')}
        <rect x="0" y="985" width="${TILE}" height="130" fill="#4E9AD8"/>${Array.from({ length: 24 }, (_, i) => `<rect x="${i * 100 + (i % 3) * 20}" y="${1010 + (i % 4) * 22}" width="${50 + (i % 3) * 20}" height="5" rx="2" fill="#A5D4F5" opacity=".8"/>`).join('')}
        <g fill="#9AA6B2"><rect x="200" y="930" width="1300" height="18"/>${Array.from({ length: 7 }, (_, i) => `<path d="M ${200 + i * 186} 948 Q ${293 + i * 186} 1010 ${386 + i * 186} 948 L ${380 + i * 186} 1000 L ${206 + i * 186} 1000 Z" opacity=".9"/>`).join('')}</g>
        <path d="M 1800 1060 Q 1880 1078 1960 1060 L 1950 1072 Q 1880 1086 1810 1072 Z" fill="#5B3A22"/><rect x="1872" y="1022" width="10" height="40" fill="#1E293B"/><circle cx="1877" cy="1016" r="9" fill="#1E293B"/>`);
      this.mid = layer(`
        ${houses(30, 7, 1250, 110, 230, ['#D9A066', '#E3B07A', '#C98B5B', '#EBC28E'], TILE)}
        <path d="M 980 1250 L 1000 900 L 1070 900 L 1090 1250 Z" fill="#C98B5B"/><rect x="1020" y="860" width="30" height="44" fill="#C98B5B"/>${[950, 1010, 1070, 1130, 1190].map(y => `<rect x="990" y="${y}" width="90" height="8" fill="#7C4A2A"/>`).join('')}
        <rect x="1640" y="1050" width="16" height="200" fill="#475569"/><rect x="1500" y="900" width="300" height="160" rx="16" fill="#FF4D00"/>
        <text x="1650" y="972" text-anchor="middle" font-family="Geist" font-weight="800" font-size="52" fill="#fff">AMAZER</text><text x="1650" y="1024" text-anchor="middle" font-family="Geist" font-weight="700" font-size="34" fill="#FFE4D1">amazer.store</text>
        ${[400, 1300, 2150].map(x => `<rect x="${x}" y="1090" width="26" height="160" fill="#7A4A2A"/><circle cx="${x + 13}" cy="1060" r="74" fill="#4D7C3A"/><circle cx="${x - 40}" cy="1090" r="52" fill="#5B8C43"/><circle cx="${x + 60}" cy="1086" r="56" fill="#3F6B30"/>`).join('')}`);
      this.road = layer(`
        <rect x="0" y="1250" width="${TILE}" height="80" fill="#E3BC86"/><rect x="0" y="1330" width="${TILE}" height="420" fill="#5B6370"/><rect x="0" y="1330" width="${TILE}" height="14" fill="#9CA3AF"/>
        ${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 200}" y="1530" width="110" height="16" rx="8" fill="#F8FAFC"/>`).join('')}
        <rect x="0" y="1750" width="${TILE}" height="170" fill="#E3BC86"/>${Array.from({ length: 20 }, (_, i) => `<ellipse cx="${i * 121 + 40}" cy="${1800 + (i % 4) * 26}" rx="${8 + i % 3 * 3}" ry="5" fill="#C9965E"/>`).join('')}`);
      this.moto = T.moto(el);
      this.ib = T.person(el, T.CAST.ibrahim);
      this.fg = layer(`${[300, 1500].map(x => `<rect x="${x}" y="980" width="30" height="940" fill="#374151"/><rect x="${x - 60}" y="980" width="150" height="16" fill="#374151"/>`).join('')}`);
      this.fg.style.filter = 'blur(5px)';
      // insert : l'espace livreur (« Prendre en charge »)
      this.hasIns = Boolean(P.ecran);
      if (this.hasIns) {
        this.ins = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', zIndex: 30, perspective: '2200px' } }, el);
        this.insBg = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: 'linear-gradient(#FF7A1A,#FF4D00)' } }, this.ins);
        this.ps = TS.phoneScreens(this.ins, [{ img: P.ecran, de: 0, scroll: P.scroll, taps: P.tap ? [{ ...P.tap, at: .75 }] : [] }]);
        this.hand = TS.hand(this.ins, '#7A4E33', '#5E3A24', '#94603F');
      }
      this.insEnd = this.hasIns ? (P.insertFin ?? 1.45) : 0;
      this.st = stickers(el, P, { list: [{ texte: 'Un livreur AMAZER\n*vous l’apporte*', de: this.insEnd + .1, a: this.D - 1.3 }, { texte: 'Partout à Niamey', de: this.D - 2.6, a: this.D - .4, y: 470, taille: 56, couleur: 'orange' }] });
      if (this.hasIns && P.tap) X.cue(a + .75, 'tap', .8);
      X.cue(a + this.insEnd - .1, 'moto', .55); X.cue(a + this.insEnd + 2.9, 'moto', .4); X.cue(a + this.insEnd, 'whoosh', .5); X.cue(b - .3, 'whoosh', .6);
    },
    seek(t) {
      const u = t - a, D = this.D, i1 = this.insEnd;
      this.el.style.transform = `translateX(${((1 - A.P(u, 0, .4, E.expoOut)) * 1080).toFixed(1)}px)`;
      const v = Math.max(0, u - i1), dist = v * 900;
      const off = k => -((dist * k) % this.TILE);
      A.T(this.clouds, { x: off(.03) - 100 }); A.T(this.far, { x: off(.1), y: -110 }); A.T(this.mid, { x: off(.38) }); A.T(this.road, { x: off(1) }); A.T(this.fg, { x: off(1.7) + 400 });
      const enter = A.P(u, i1, i1 + .5, E.expoOut), exit = A.P(u, D - .4, D, E.expoIn);
      const mx = A.mix(-320, 500, enter) + exit * 900 + Math.sin(v * 1.3) * 12, bump = Math.abs(Math.sin(v * 9)) * -4, ms = 1.5;
      this.moto.pose({ x: mx, y: 1600, s: ms, wheel: dist / 50, dust: u > i1 ? 1 : 0, t: u, bob: bump, lean: exit * -4 });
      const rs = 1.04;
      this.ib.pose({
        x: mx - 52 * ms, y: 1600 + (-132 * ms) + 206 * rs + bump * ms, s: rs, t: u, shadow: 0, farLeg: 0,
        lean: 16 + Math.sin(v * 2) * 2, legN: { hip: 86, knee: 96 }, legF: { hip: 80, knee: 100 },
        near: { sh: 78, el: 14 }, far: { sh: 72, el: 18 }, mouth: v > 1.4 && v < 2.2 ? 'grin' : 'smile', look: [5, 0], blink: T.blink(u, 6), headTilt: -4,
      });
      if (this.hasIns) {
        const ik = A.P(u, 0, .4, E.expoOut), iq = A.P(u, i1 - .3, i1, E.expoIn);
        this.ins.style.display = u < i1 ? '' : 'none';
        const pose = { x: 540 - iq * 1100, y: 1080 + (1 - ik) * 800, s: 1.36, ry: A.mix(12, -3, ik) + A.wob(u, 1, .4), r: (1 - ik) * 8 - iq * 5 };
        A.Phone.pose(this.ps.ph, pose);
        this.ps.seek(u);
        const W = 414 * pose.s, H = 868 * pose.s;
        this.hand.seekPalm(pose.x - W / 2, pose.y - H / 2, W, H);
        const rest = [pose.x + W * .42, pose.y + H * .52];
        let px = rest[0], py = rest[1], press = 0;
        if (P.tap) {
          const [tx, ty] = this.ps.toStage(P.tap.x, P.tap.y - (this.ps.layers[0].scrollY ?? 0), pose);
          const kIn = A.P(u, .3, .72, E.cubicInOut), kOut = A.P(u, .87, 1.2, E.cubicInOut);
          px = A.mix(A.mix(rest[0], tx, kIn), rest[0], kOut); py = A.mix(A.mix(rest[1], ty, kIn), rest[1], kOut);
          press = A.env(u, .71, .89, .05, .1);
        }
        this.hand.seekThumb(px, py, press);
      }
      playStickers(this.st, u, D);
    },
  });

  /* ======================================================================
   * portail — il frappe, Aïcha ouvre et montre son VRAI reçu (QR), il scanne, livraison confirmée
   *   P.recu : 'assets/screens/14-recu-qr-long.png', P.recuScroll : y du QR, P.confirme : 'assets/screens/17-commande-livree.png'
   * ====================================================================== */
  TS.scenes.portail = (P, a, b, X) => ({
    id: 'portail', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      const k0 = this.k = { knock: .52, open: .82, qr: 1.15, scan: 2.05, done: 2.5, give: 3.25 };
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '540px 1200px' } }, el);
      scenery(this.cam, `
        <rect width="1080" height="1920" fill="#BFE3F2"/><rect y="560" width="1080" height="980" fill="#D19A66"/>
        ${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 92}" y="536" width="58" height="40" rx="6" fill="#D19A66"/>`).join('')}
        ${Array.from({ length: 26 }, (_, i) => `<rect x="${(i * 131) % 1040}" y="${620 + (i * 71) % 860}" width="${50 + (i % 3) * 14}" height="18" rx="4" fill="#B97F4E" opacity=".55"/>`).join('')}
        <g>${Array.from({ length: 14 }, (_, i) => `<circle cx="${820 + (i % 5) * 50 + (i % 2) * 20}" cy="${520 + Math.floor(i / 5) * 46}" r="${28 + (i % 3) * 8}" fill="${i % 3 ? '#DB2777' : '#BE185D'}"/>`).join('')}${Array.from({ length: 8 }, (_, i) => `<ellipse cx="${800 + i * 36}" cy="${600 + (i % 3) * 30}" rx="22" ry="12" fill="#3F6B30"/>`).join('')}</g>
        <rect x="270" y="730" width="540" height="810" rx="14" fill="#5B3A22"/><rect x="300" y="760" width="480" height="780" fill="#2A1A10"/>
        <rect y="1540" width="1080" height="380" fill="#E7BE87"/><rect y="1540" width="1080" height="30" fill="#D4A56E"/>`);
      this.ai = T.person(this.cam, T.CAST.aicha);
      const leaf = flip => box(this.cam, 240, 780, flip ? 240 : 0, 0, `
        <rect x="${flip ? -240 : 0}" y="0" width="240" height="780" fill="#1D4ED8"/><rect x="${flip ? -224 : 16}" y="16" width="208" height="748" fill="none" stroke="#1E3A8A" stroke-width="8"/>
        ${[0, 1, 2].map(i => `<path d="M ${flip ? -120 : 120} ${110 + i * 220} l 60 70 l -60 70 l -60 -70 Z" fill="#FACC15"/><circle cx="${flip ? -120 : 120}" cy="${180 + i * 220}" r="16" fill="#fff"/>`).join('')}
        <rect x="${flip ? -224 : 200}" y="380" width="24" height="60" rx="10" fill="#E2E8F0"/>`);
      this.leafL = leaf(false); this.leafR = leaf(true);
      this.sackS = box(this.cam, 300, 200, 150, 190, SACK);
      this.ib = T.person(this.cam, T.CAST.ibrahim);
      this.phoneIb = svgEl('g', {}, this.ib.near.item); this.phoneIb.innerHTML = PHONE_SMALL;
      this.phoneAi = svgEl('g', {}, this.ai.near.item); this.phoneAi.innerHTML = PHONE_SMALL;
      // insert : le vrai reçu (QR) puis la confirmation
      this.ins = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', zIndex: 30, perspective: '2200px' } }, el);
      this.insBg = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: 'rgba(15,23,42,.5)' } }, this.ins);
      const items = [{ img: P.recu ?? 'assets/screens/14-recu-qr-long.png', de: 0, scroll: [P.recuScroll ?? 0, P.recuScroll ?? 0, 0, .1] }];
      if (P.confirme) items.push({ img: P.confirme, de: k0.done - k0.qr - .05 });
      this.ps = TS.phoneScreens(this.ins, items);
      this.beam = A.el('div', { cls: 'abs', style: { width: '560px', height: '10px', borderRadius: '5px', background: '#22C55E', boxShadow: '0 0 40px 8px rgba(34,197,94,.7)', zIndex: 60 } }, this.ins);
      const ok = this.ok = A.el('div', { cls: 'abs', style: { left: '0', top: '520px', padding: '24px 40px', borderRadius: '99px', background: '#16A34A', color: '#fff', font: '800 52px Geist', display: 'flex', gap: '18px', alignItems: 'center', boxShadow: '0 24px 50px -20px rgba(10,80,30,.7)', transformOrigin: '50% 50%', zIndex: 70 } }, el);
      A.el('span', {}, ok, '<svg width="58" height="58" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M6.5 12.5l3.5 3.5 7.5-8" stroke="#16A34A" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      A.el('span', {}, ok, 'Livraison confirmée');
      ok.style.left = (540 - ok.offsetWidth / 2) + 'px';
      this.sp = sparks(this.cam, 10, '#FDE047');
      this.st = stickers(el, P, { list: [{ texte: 'Montrez votre reçu :\n*c’est livré !*', de: .2, a: k0.qr + .1 }, { texte: 'Montrez votre reçu :\n*c’est livré !*', de: k0.give, a: this.D - .3 }], size: 68 });
      X.cue(a + .02, 'whoosh', .5); X.cue(a + .4, 'thud', .5, -.3); X.cue(a + k0.knock, 'knock', .8, .1); X.cue(a + k0.knock + .2, 'knock', .7, .1);
      X.cue(a + k0.open, 'swipe', .4, .2); X.cue(a + k0.qr, 'whoosh', .4); X.cue(a + k0.scan, 'scan', .7); X.cue(a + k0.done, 'beep', .7); X.cue(a + k0.done + .05, 'ding', .6); X.cue(a + k0.give + .45, 'shimmer', .5);
    },
    seek(t) {
      const u = t - a, D = this.D, k = this.k;
      const enter = A.P(u, 0, .3, E.expoOut), zoomOut = A.P(u, D - .25, D, E.expoIn);
      A.T(this.cam, { x: (1 - enter) * -1080 + A.wob(u, 1, .5) * 4, y: A.wob(u, 2, .4) * 3, s: 1 + zoomOut * .15 });
      const ix = A.mix(-200, 200, A.P(u, 0, .4, E.cubicOut)), walking = u < .4, carry = u < .4;
      const knock = A.env(u, k.knock - .08, k.knock + .32, .05, .1), knockBeat = knock * (Math.abs(Math.sin((u - k.knock) * Math.PI / .2)) * 18);
      const scanUp = A.P(u, k.scan - .3, k.scan, E.expoOut) * (1 - A.P(u, k.done + .1, k.done + .3));
      const give = A.P(u, k.give, k.give + .45, E.cubicInOut);
      const wv = walking ? T.walk(u * 1.3, .85) : T.walk(0, 0);
      this.ib.pose(T.merge({ x: ix, y: 1700, s: 1.3, t: u }, wv, {
        near: carry ? { sh: 62, el: 70 } : knock > 0 ? { sh: 82 + knockBeat, el: 70 } : scanUp > 0 ? { sh: A.mix(10, 92, scanUp), el: A.mix(10, 40, scanUp) } : give > 0 ? { sh: A.mix(40, 74, give), el: 40 } : { sh: 6, el: 8 },
        far: carry ? { sh: 56, el: 76 } : give > 0 ? { sh: A.mix(30, 66, give), el: 46 } : { sh: -6, el: 10 },
        mouth: u > k.done ? 'grin' : 'smile', blink: T.blink(u, 7), look: [4, -1], brow: u > k.done ? .5 : 0,
      }));
      this.phoneIb.setAttribute('opacity', scanUp > .05 ? 1 : 0);
      const open = A.P(u, k.open, k.open + .4, E.expoOut);
      put(this.leafL, 300, 760, 1);
      this.leafR.style.transform = `translate(540px,760px) scaleX(${(1 - open * .82).toFixed(3)})`;
      this.leafR.style.transformOrigin = '240px 0px';
      const qrUp = A.P(u, k.qr, k.qr + .3, E.backOut);
      const hop = A.P(u, k.give + .4, k.give + .65, E.sine) * (1 - A.P(u, k.give + .65, k.give + .95, E.cubicIn));
      this.ai.pose({
        x: 640, y: 1560 - hop * 60, s: 1.12, t: u, flip: true, shadow: 0,
        near: give > .6 ? { sh: 70, el: 60 } : { sh: A.mix(6, 70, qrUp), el: A.mix(8, 80, qrUp) }, far: give > .6 ? { sh: 64, el: 66 } : { sh: -6, el: 10 },
        mouth: u > k.done ? 'grin' : 'smile', blink: T.blink(u, 8), look: [3, -1], brow: hop * .8, o: open > .05 ? 1 : 0,
      });
      this.phoneAi.setAttribute('opacity', qrUp > .05 && give < .6 ? 1 : 0);
      const sxp = A.mix(ix + 150, 560, give), syp = A.mix(1700, 1420, Math.sin(give * Math.PI) * .6 + give * .4);
      put(this.sackS, carry ? ix + 120 * 1.3 : sxp, carry ? 1700 - 300 * 1.3 : syp, carry ? .8 : .85, 0, 1);
      // insert du reçu (vrai écran) pendant le scan
      const i0 = k.qr, i1 = k.give - .05;
      const ik = A.P(u, i0, i0 + .4, E.expoOut), iq = A.P(u, i1 - .3, i1, E.expoIn);
      this.ins.style.display = u >= i0 && u < i1 ? '' : 'none';
      this.insBg.style.opacity = (ik * (1 - iq)).toFixed(3);
      const pose = { x: 540, y: 1150 + (1 - ik) * 800 + iq * 900, s: 1.3, ry: A.mix(-12, 3, ik) + A.wob(u, 3, .4), r: (1 - ik) * -8 + iq * 6 };
      A.Phone.pose(this.ps.ph, pose);
      this.ps.seek(u - i0);
      const bk = A.env(u, k.scan, k.done, .08, .12), bp = (u - k.scan) / (k.done - k.scan);
      A.T(this.beam, { x: 260, y: pose.y - 300 + Math.sin(bp * Math.PI * 2) * 260, o: bk });
      const okk = A.P(u, k.done, k.done + .5, E.spring);
      this.ok.style.transform = `scale(${(u >= k.done ? .4 + .6 * okk : 0).toFixed(3)})`;
      this.ok.style.opacity = (A.lin(u, k.done, k.done + .08) * (1 - A.lin(u, D - .4, D - .2))).toFixed(2);
      playSparks(this.sp, u, k.give + .45, 640, 900, 230);
      playStickers(this.st, u, D);
    },
  });

  /* ======================================================================
   * boutique_calme — Moussa attend derrière son comptoir : personne, une mouche, l'horloge qui tourne… puis l'idée
   *   P.enseigne (nom sur l'enseigne), P.sous_titres
   * ====================================================================== */
  const shopDecor = TS.shopDecor = (cam, P) => {
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
    scenery(cam, `
      <rect width="1080" height="1920" fill="#F3E2C7"/>
      ${[620, 880, 1140].map(y => `${shelfGoods(y)}<rect x="40" y="${y}" width="1000" height="26" rx="6" fill="#9A6237"/><rect x="40" y="${y + 26}" width="1000" height="10" fill="#7C4A2A"/>`).join('')}
      <path d="M 0 0 L 1080 0 L 1080 250 ${Array.from({ length: 9 }, (_, i) => `Q ${1080 - i * 120 - 60} 310 ${1080 - (i + 1) * 120} 250`).join(' ')} Z" fill="#FF4D00"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M ${i * 120 + 30} 0 L ${i * 120 + 90} 0 L ${i * 120 + 90} 250 Q ${i * 120 + 60} 300 ${i * 120 + 30} 262 Z" fill="#fff" opacity=".92"/>`).join('')}
      <rect x="250" y="330" width="580" height="116" rx="20" fill="#0F766E"/>
      <text x="540" y="408" text-anchor="middle" font-family="Geist" font-weight="800" font-size="58" fill="#FDE68A">${P.enseigne ?? 'Boutique Moussa'}</text>`);
  };
  const counter = TS.counter = cam => scenery(cam, `
      <rect x="0" y="1300" width="1080" height="620" fill="#7C4A2A"/><rect x="0" y="1282" width="1080" height="44" rx="10" fill="#A86B3D"/>
      ${[0, 1, 2, 3].map(i => `<rect x="${60 + i * 260}" y="1380" width="200" height="300" rx="16" fill="#6B3F22"/>`).join('')}
      <rect x="120" y="1180" width="150" height="104" rx="14" fill="#94A3B8"/><rect x="140" y="1160" width="110" height="26" rx="10" fill="#CBD5E1"/>`);

  TS.scenes.boutique_calme = (P, a, b, X) => ({
    id: 'calme', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', transformOrigin: '540px 1150px' } }, el);
      shopDecor(this.cam, P);
      // horloge murale (les aiguilles tournent vite : le temps passe)
      this.clock = box(this.cam, 240, 240, 120, 120, `<circle r="92" fill="#fff" stroke="#9A6237" stroke-width="14"/>${Array.from({ length: 12 }, (_, i) => `<rect x="-3" y="-80" width="6" height="${i % 3 ? 10 : 18}" fill="#334155" transform="rotate(${i * 30})"/>`).join('')}<rect class="hh" x="-6" y="-48" width="12" height="54" rx="6" fill="#0F172A"/><rect class="mm" x="-4" y="-72" width="8" height="78" rx="4" fill="#FF4D00"/><circle r="9" fill="#0F172A"/>`);
      this.hh = this.clock.querySelector('.hh'); this.mm = this.clock.querySelector('.mm');
      this.mo = T.person(this.cam, T.CAST.moussa);
      this.mo.near.item.innerHTML = '';
      this.moPhone = svgEl('g', {}, this.mo.near.item); this.moPhone.innerHTML = PHONE_SMALL;
      counter(this.cam);
      // la mouche (corps + ailes qui battent) et sa trajectoire en pointillés
      this.fly = box(this.cam, 80, 60, 40, 30, `<ellipse class="w1" cx="-6" cy="-12" rx="12" ry="7" fill="#E2E8F0" opacity=".85"/><ellipse class="w2" cx="6" cy="-12" rx="12" ry="7" fill="#E2E8F0" opacity=".85"/><ellipse rx="12" ry="9" fill="#1F2937"/><circle cx="10" cy="-2" r="5" fill="#111827"/>`);
      this.fly.style.zIndex = 35;
      this.w = [this.fly.querySelector('.w1'), this.fly.querySelector('.w2')];
      // l'idée : ampoule au-dessus de la tête
      this.bulb = box(this.cam, 240, 260, 120, 160, `<g fill="#FDE047">${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="-6" y="-150" width="12" height="34" rx="6" transform="rotate(${-90 + i * 30})"/>`).join('')}</g><circle cy="-40" r="58" fill="#FDE047"/><circle cx="-18" cy="-58" r="16" fill="#FFF9C4"/><rect x="-26" y="12" width="52" height="30" rx="8" fill="#94A3B8"/><rect x="-20" y="40" width="40" height="12" rx="6" fill="#64748B"/>`);
      this.bulb.style.zIndex = 36;
      this.sp = sparks(el, 8, '#FDE047');
      this.st = stickers(el, P, { list: [{ texte: 'Les clients\n*se font rares ?*', de: .35, a: this.D - 1.25 }], size: 74 });
      this.idea = this.D - 1.05;
      for (let k = 0; k < Math.floor(this.idea / .5); k++) X.cue(a + .1 + k * .5, 'tick', .22, .5);
      X.cue(a + .4, 'buzz', .22, -.3); X.cue(a + 1.6, 'buzz', .2, .3);
      X.cue(a + this.idea, 'pop', .6); X.cue(a + this.idea + .05, 'shimmer', .45);
    },
    seek(t) {
      const u = t - a, D = this.D, idea = this.idea;
      const push = A.P(u, 0, D, E.sine);
      A.T(this.cam, { s: 1.04 + push * .07, x: A.wob(u, 1, .5) * 4, y: A.wob(u, 2, .4) * 3 });
      put(this.clock, 900, 520, .9);
      const spin = u < idea ? u : idea;
      this.mm.setAttribute('transform', `rotate(${(spin * 360).toFixed(1)})`);
      this.hh.setAttribute('transform', `rotate(${(spin * 30 + 40).toFixed(1)})`);
      const got = A.P(u, idea, idea + .35, E.backOut);
      // Moussa : accoudé, le menton dans la main, bâille ; puis l'idée et le téléphone
      const yawn = A.env(u, 1.3, 2.2, .25, .3);
      const phoneUp = A.P(u, idea + .25, idea + .6, E.expoOut);
      this.mo.pose({
        x: 470, y: 1690, s: 1.42, t: u, shadow: 0,
        lean: 10 * (1 - got) + Math.sin(u * 1.6) * 1.5,
        headTilt: (u < idea ? 10 + Math.sin(u * 1.2) * 3 : A.mix(10, -2, got)) + phoneUp * 5,
        near: phoneUp > .02 ? { sh: A.mix(40, 60, phoneUp), el: A.mix(120, 105, phoneUp) } : { sh: A.mix(40, 30, got), el: A.mix(138, 60, got) },
        far: { sh: A.mix(25, 150, got) * (1 - phoneUp) + phoneUp * 10, el: A.mix(60, 30, got) },
        mouth: u < idea ? (yawn > .3 ? 'open' : 'flat') : got > .5 ? 'grin' : 'o',
        brow: u < idea ? -.2 : .7, browTilt: u < idea ? -6 : 0,
        blink: u < idea ? (yawn > .3 ? 1 : .55 + .45 * T.blink(u, 3)) : T.blink(u, 3),
        look: u < idea ? [Math.sin(u * 2.3) * 3, -1 + Math.cos(u * 2.3) * 2] : phoneUp > .5 ? [4, 6] : [0, -6],
      });
      this.moPhone.setAttribute('opacity', phoneUp > .02 ? 1 : 0);
      this.moPhone.setAttribute('transform', `rotate(-90) scale(${(1.1 * phoneUp).toFixed(3)})`);
      // la mouche tourne autour de sa tête, puis s'enfuit à l'idée
      const ang = u * 3.4, flee = A.P(u, idea, idea + .5, E.cubicIn);
      const fx = 560 + Math.cos(ang) * 190 + flee * 700, fy = 920 + Math.sin(ang * 1.3) * 90 - flee * 500;
      put(this.fly, fx, fy, 1, Math.cos(ang) * 20, 1 - flee);
      const flap = Math.sin(u * 90) * 25;
      this.w[0].setAttribute('transform', `rotate(${(-20 + flap).toFixed(1)} 0 -6)`); this.w[1].setAttribute('transform', `rotate(${(20 - flap).toFixed(1)} 0 -6)`);
      const hx = 470 + 30 * 1.42, hy = 1690 - 700 * 1.42;
      put(this.bulb, hx, hy - Math.sin(u * 5) * 8 * got, got, Math.sin(u * 4) * 6 * got, u >= idea ? Math.min(1, got * 1.4) : 0);
      playSparks(this.sp, u, idea + .05, hx, hy - 40, 150);
      playStickers(this.st, u, D);
    },
  });

  /* ======================================================================
   * commandes_pluie — les notifications « Nouvelle commande » tombent sur le téléphone de Moussa, il saute de joie
   *   P.commandes : ['Riz parfumé 25 kg', …] (produits réels de la boutique), P.titre_notif, P.sous_titres
   * ====================================================================== */
  TS.scenes.commandes_pluie = (P, a, b, X) => ({
    id: 'pluie', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      this.el = el;
      el.style.background = 'radial-gradient(ellipse at 50% 35%,#FFE3BF 0%,#F8C38A 60%,#EFA765 100%)';
      this.rays = box(el, 2400, 2400, 1200, 1200, `<g fill="#fff" opacity=".22">${Array.from({ length: 16 }, (_, i) => `<path d="M 0 0 L -90 -1300 L 90 -1300 Z" transform="rotate(${i * 22.5})"/>`).join('')}</g>`);
      this.mo = T.person(el, T.CAST[P.perso ?? 'moussa']);
      this.mo.near.item.innerHTML = '';
      this.moPhone = svgEl('g', {}, this.mo.near.item); this.moPhone.innerHTML = PHONE_SMALL;
      const list = (P.commandes ?? ['Riz parfumé 25 kg', 'Huile végétale 5 L', 'Sucre en poudre 5 kg', 'Lait en poudre 400 g']).slice(0, 5);
      const n = list.length, t0 = .35, t1 = Math.max(t0 + .5, this.D - 1.6);
      this.cards = list.map((txt, i) => {
        const c = A.el('div', { cls: 'abs', style: { left: '110px', top: '0px', width: '860px', height: '150px', borderRadius: '36px', background: '#fff', boxShadow: '0 26px 50px -24px rgba(90,30,0,.55)', display: 'flex', alignItems: 'center', gap: '26px', padding: '0 34px', boxSizing: 'border-box', zIndex: 30 + i, transformOrigin: '50% 0' } }, el,
          `<div style="width:92px;height:92px;border-radius:26px;background:${C.orange};display:grid;place-items:center;flex:none"><svg width="62" height="62" viewBox="-20 -20 40 40"><path d="M -11 12 L 0 -13 L 11 12 M -6.5 4 L 6.5 4" stroke="#fff" stroke-width="5.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
           <div style="flex:1;min-width:0"><div style="font:800 40px Geist;color:${NAVY}">${P.titre_notif ?? 'Nouvelle commande'}</div><div style="font:600 34px Geist;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${txt}</div></div>
           <div style="font:600 28px Geist;color:#94A3B8;flex:none">maintenant</div>`);
        return { c, at: n > 1 ? t0 + (t1 - t0) * (i / (n - 1)) ** .85 : t0 };
      });
      this.badge = A.el('div', { cls: 'abs', style: { width: '120px', height: '120px', borderRadius: '50%', background: '#DC2626', color: '#fff', font: '800 64px Geist', display: 'grid', placeItems: 'center', zIndex: 60, boxShadow: '0 14px 30px -10px rgba(120,20,0,.6)' } }, el, '0');
      this.sp = sparks(el, 12, '#FDE047');
      this.conf = Array.from({ length: 26 }, (_, i) => A.el('div', { cls: 'abs', style: { width: `${14 + (i % 3) * 6}px`, height: `${26 + (i % 4) * 6}px`, borderRadius: '5px', background: ['#FF4D00', '#FDE047', '#22C55E', '#2563EB', '#fff'][i % 5], zIndex: 25 } }, el));
      this.st = stickers(el, P, { list: [{ texte: 'Les *commandes*\narrivent !', de: .15, a: this.D - .3 }], y: 230, size: 76 });
      this.cards.forEach((k, i) => { X.cue(a + k.at, 'ding', .55, (i % 2 ? .3 : -.3)); X.cue(a + k.at, 'buzz', .25); });
      this.joy = this.cards[Math.min(2, this.cards.length - 1)].at + .1;
      X.cue(a + this.joy, 'shimmer', .45); X.cue(a + this.D - 1.0, 'kaching', .6);
    },
    seek(t) {
      const u = t - a, D = this.D;
      this.el.style.opacity = A.P(u, 0, .25, E.cubicOut).toFixed(3);
      put(this.rays, 540, 1250, 1, u * 8);
      // pile de notifications : la plus récente en haut, les autres glissent dessous
      let count = 0;
      this.cards.forEach((k, i) => {
        if (u >= k.at) count = i + 1;
        const kin = A.P(u, k.at, k.at + .45, E.spring);
        let y = 400;
        this.cards.forEach((q, j) => { if (j > i) y += A.P(u, q.at, q.at + .4, E.expoOut) * 168; });
        const fall = (1 - A.P(u, k.at, k.at + .35, E.expoOut)) * -260;
        k.c.style.transform = `translateY(${(y + fall).toFixed(1)}px) scale(${(.85 + .15 * kin).toFixed(3)})`;
        k.c.style.opacity = (u >= k.at ? Math.min(1, A.lin(u, k.at, k.at + .12)) * (y > 1150 ? .0 : 1) : 0).toFixed(3);
        k.c.style.filter = y > 400 + 168 * 2.5 ? 'brightness(.94)' : 'none';
      });
      this.badge.textContent = String(count);
      const last = this.cards[Math.max(0, count - 1)];
      const bk = count ? A.P(u, last.at, last.at + .35, E.spring) : 0;
      A.T(this.badge, { x: 900, y: 340, s: count ? .7 + .3 * bk : 0 });
      // Moussa : surpris puis saute de joie, bras en l'air
      const joy = this.joy, up = A.P(u, joy, joy + .3, E.backOut);
      const hop = u > joy ? Math.abs(Math.sin((u - joy) * 7.5)) * 70 * (1 - A.lin(u, D - .6, D)) : 0;
      this.mo.pose({
        x: 540, y: 1880 - hop, s: 1.32, t: u, shadow: 0,
        near: u < joy ? { sh: 60, el: 105 } : { sh: A.mix(60, 165, up), el: A.mix(105, 20, up) },
        far: u < joy ? { sh: 10, el: 30 } : { sh: A.mix(10, 175, up), el: A.mix(30, 15, up) },
        mouth: u < .9 ? 'o' : 'grin', brow: .7, blink: T.blink(u, 6), look: u < joy ? [4, -8] : [0, -4],
        headTilt: u < joy ? 4 : Math.sin(u * 7) * 5, legN: hop > 10 ? { hip: 20, knee: 40 } : undefined, legF: hop > 10 ? { hip: -10, knee: 30 } : undefined,
      });
      this.moPhone.setAttribute('transform', 'rotate(-90) scale(1.1)');
      playSparks(this.sp, u, joy, 540, 1180, 220);
      this.conf.forEach((c, i) => {
        const r = (i * 97 % 100) / 100, st = joy + (i % 7) * .05, k = Math.max(0, u - st);
        A.T(c, { x: 60 + r * 960 + Math.sin(k * 4 + i) * 40, y: 1350 - k * (900 - r * 300) + k * k * 520, r: k * (200 + i * 13), o: u >= st ? 1 - A.lin(u, D - .4, D) : 0 });
      });
      playStickers(this.st, u, D);
    },
  });

  /* ======================================================================
   * fin — carte orange : logo, promesse, amazer.store, téléphone (accueil réel) et les trois personnages
   * ====================================================================== */
  TS.scenes.fin = (P, a, b, X) => ({
    id: 'fin', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      const cap = i => (X.vo && X.vo.captions && X.vo.captions[i] ? X.vo.captions[i].a - a : [.4, 1.1, 3.3][i]);
      this.caps = [cap(0), cap(1), cap(2)];
      this.wrap = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: 'radial-gradient(ellipse at 50% 30%,#FF7A1A 0%,#FF4D00 55%,#E24400 100%)' } }, el);
      A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', opacity: .14, backgroundImage: 'radial-gradient(#fff 3px,transparent 3.5px),radial-gradient(#fff 2px,transparent 2.5px)', backgroundSize: '64px 64px,64px 64px', backgroundPosition: '0 0,32px 32px' } }, this.wrap);
      this.icon = A.el('div', { cls: 'abs', style: { left: '430px', top: '230px', width: '220px', height: '220px', borderRadius: '56px', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 30px 60px -24px rgba(120,30,0,.6)' } }, this.wrap, '<svg width="140" height="140" viewBox="-20 -20 40 40"><path d="M -11 12 L 0 -13 L 11 12 M -6.5 4 L 6.5 4" stroke="#FF4D00" stroke-width="5.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      this.word = A.Type.make(this.wrap, 'AMAZER', { size: 128, weight: 800, align: 'center', color: '#fff', track: -.04 });
      A.Type.place(this.word, 540, 580);
      this.tag = A.Type.make(this.wrap, P.slogan ?? 'Commandez.\n*On vous livre.*', { size: 96, weight: 800, align: 'center', color: '#fff', accent: '#FFE08A', lh: 1.02 });
      A.Type.place(this.tag, 540, 800);
      this.pill = A.el('div', { cls: 'abs', style: { padding: '22px 56px', borderRadius: '99px', background: '#fff', color: C.orange, font: '800 62px Geist', letterSpacing: '-.02em', boxShadow: '0 24px 50px -20px rgba(120,30,0,.55)' } }, this.wrap, 'amazer.store');
      this.pill.style.left = (540 - this.pill.offsetWidth / 2) + 'px'; this.pill.style.top = '975px';
      this.small = A.el('div', { cls: 'abs', style: { left: '0', top: '1120px', width: '1080px', textAlign: 'center', font: '600 38px Geist', color: '#FFF1E8' } }, this.wrap, P.mention ?? 'Paiement Nita ou Amana · Livraison à Niamey');
      this.cast = [T.person(this.wrap, T.CAST.moussa), T.person(this.wrap, T.CAST.ibrahim), T.person(this.wrap, T.CAST.aicha)];
      X.cue(a, 'impact', .55); X.cue(a + .25, 'whoosh', .5); X.cue(a + this.caps[1] - .1, 'pop', .55); X.cue(a + this.caps[2] - .1, 'pop', .55);
      X.cue(a + .7, 'plink', .4, -.5); X.cue(a + .8, 'plink', .4, 0); X.cue(a + .9, 'plink', .4, .5);
    },
    seek(t) {
      const u = t - a, [c0, c1, c2] = this.caps;
      const ik = A.P(u, 0, .45, E.expoOut);
      this.wrap.style.clipPath = `circle(${(ik * 1150).toFixed(1)}px at 540px 1000px)`;
      const ic = A.P(u, .25, .8, E.spring);
      this.icon.style.transform = `scale(${(u > .25 ? .3 + .7 * ic : 0).toFixed(3)}) rotate(${((1 - ic) * -14).toFixed(2)}deg)`;
      A.Type.play(this.word, u, Math.max(.35, c0 - .1), 1e9, { stagger: .05 });
      A.Type.play(this.tag, u, c1 - .2, 1e9, { stagger: .07, dur: .6 });
      const pk = A.P(u, c2 - .2, c2 + .35, E.spring);
      this.pill.style.transform = `scale(${(u > c2 - .2 ? .5 + .5 * pk : 0).toFixed(3)})`;
      this.small.style.opacity = A.lin(u, c2 + .3, c2 + .6).toFixed(2);
      [[230, 0], [850, 1], [540, 2]].forEach(([x, i], k) => {
        const up = A.P(u, .5 + k * .12, 1.1 + k * .12, E.spring), wave = Math.sin(u * 7 + k) * 22;
        this.cast[i].pose({
          x, y: 2010 + (1 - up) * 500, s: i === 2 ? 1.0 : .92, t: u, flip: x > 540, shadow: 0,
          near: { sh: 150 + wave * .4, el: 40 + wave }, far: { sh: -6, el: 10 },
          mouth: 'grin', blink: T.blink(u, 9 + k), look: [x > 540 ? -2 : 2, -2], headTilt: Math.sin(u * 2 + k) * 4,
        });
      });
    },
  });

  /* ======================================================================
   * balayage — transition orange en diagonale (signature AMAZER), à poser par-dessus deux scènes
   * ====================================================================== */
  TS.scenes.balayage = (P, a, b) => ({
    id: 'balayage', a, b,
    build(el) { this.band = A.el('div', { cls: 'abs', style: { width: '2800px', height: '3000px', background: C.orange } }, el); this.band2 = A.el('div', { cls: 'abs', style: { width: '2800px', height: '170px', background: '#FFE08A' } }, el); },
    seek(t) {
      // la bande monte en diagonale ; à mi-course (instant de la coupe) elle couvre tout l'écran
      const k = A.P(t, a, b, E.cubicInOut), y = A.mix(2500, -3600, k);
      A.T(this.band, { x: -860, y, r: -24 }); A.T(this.band2, { x: -860, y: y + 3040, r: -24 });
    },
  });
})(window.A);
