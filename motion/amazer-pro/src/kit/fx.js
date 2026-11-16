/* fx.js — finition d'image : grain, vignettage, flash ; fonds lumineux animés. */
(function (A) {
  const C = A.C;
  const fx = A.fx = {};
  let vig, flash;
  fx.mount = stage => {
    vig = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', zIndex: 900, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 58%,rgba(0,0,0,.28) 100%)' } }, stage);
    // le grain est ajouté à l'encodage (ffmpeg) : bien plus rapide que la fusion en direct
    flash = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', zIndex: 902, pointerEvents: 'none', background: '#fff', opacity: 0 } }, stage);
  };
  /** flashs : liste [t, intensité] fournie par le film */
  fx.seek = t => {
    let f = 0;
    for (const [ft, k] of (window.FILM.flashes || [])) f = Math.max(f, k * (1 - A.lin(t, ft, ft + .35)) * (t >= ft ? 1 : 0));
    flash.style.opacity = f.toFixed(3);
    const vk = window.FILM.vignette ? window.FILM.vignette(t) : 1;
    vig.style.opacity = vk.toFixed(3);
  };

  /* ---------- fonds ---------- */
  A.BG = {};
  /** fond sombre AMAZER avec halos orange qui dérivent lentement */
  A.BG.dark = (parent, o = {}) => {
    const el = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', background: `radial-gradient(ellipse at 50% 40%,#16213A 0%,${C.deep} 60%,${C.night} 100%)`, overflow: 'hidden' } }, parent);
    const g1 = A.el('div', { cls: 'abs', style: { width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,77,0,.34),rgba(255,77,0,0) 65%)' } }, el);
    const g2 = A.el('div', { cls: 'abs', style: { width: '760px', height: '760px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,122,26,.20),rgba(255,122,26,0) 65%)' } }, el);
    const g3 = A.el('div', { cls: 'abs', style: { width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.16),rgba(37,99,235,0) 65%)' } }, el);
    // trame fine (motif de points) pour la matière
    A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', opacity: o.dots ?? .5, backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 1.2px,transparent 1.3px)', backgroundSize: '28px 28px' } }, el);
    return { el, g: [g1, g2, g3], o };
  };
  A.BG.seek = (bg, t, k = 1) => {
    const [g1, g2, g3] = bg.g;
    A.T(g1, { x: 540 - 450 + A.wob(t, 1, .35) * 160 + (bg.o.x1 ?? 220), y: 540 - 450 + A.wob(t, 2, .3) * 120 + (bg.o.y1 ?? -260), o: k });
    A.T(g2, { x: 540 - 380 + A.wob(t, 3, .3) * 180 + (bg.o.x2 ?? -300), y: 540 - 380 + A.wob(t, 4, .35) * 140 + (bg.o.y2 ?? 280), o: k });
    A.T(g3, { x: 540 - 350 + A.wob(t, 5, .25) * 200 + (bg.o.x3 ?? -260), y: 540 - 350 + A.wob(t, 6, .3) * 100 + (bg.o.y3 ?? -300), o: k * .9 });
  };
  /** fond clair (crème) avec halos pêche */
  A.BG.light = (parent) => {
    const el = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', background: `radial-gradient(ellipse at 50% 30%,#FFFFFF 0%,${C.paper} 55%,#FCEBDD 100%)`, overflow: 'hidden' } }, parent);
    const g1 = A.el('div', { cls: 'abs', style: { width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,122,26,.22),rgba(255,122,26,0) 65%)' } }, el);
    const g2 = A.el('div', { cls: 'abs', style: { width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(253,186,116,.35),rgba(253,186,116,0) 65%)' } }, el);
    const g3 = A.el('div', { cls: 'abs', style: { width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,.9),rgba(255,255,255,0) 65%)' } }, el);
    A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', opacity: .6, backgroundImage: 'radial-gradient(rgba(15,23,42,.06) 1.2px,transparent 1.3px)', backgroundSize: '28px 28px' } }, el);
    return { el, g: [g1, g2, g3], o: { x1: 300, y1: -300, x2: -320, y2: 300, x3: 0, y3: -100 } };
  };
  /** fond teinté générique : o = { base, glows:[c1,c2,c3], dot, pos } (couleurs CSS) */
  A.BG.tone = (parent, o) => {
    const el = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', background: o.base, overflow: 'hidden' } }, parent);
    const g = [900, 780, 640].map((d, i) => A.el('div', { cls: 'abs', style: { width: d + 'px', height: d + 'px', borderRadius: '50%', background: `radial-gradient(circle,${o.glows[i]},rgba(0,0,0,0) 65%)` } }, el));
    if (o.pattern) A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', opacity: 1, backgroundImage: o.pattern, backgroundSize: o.patternSize ?? '28px 28px' } }, el);
    else A.el('div', { cls: 'abs', style: { width: '1080px', height: '1080px', backgroundImage: `radial-gradient(${o.dot} 1.2px,transparent 1.3px)`, backgroundSize: '28px 28px' } }, el);
    return { el, g, o: o.pos ?? { x1: 280, y1: -240, x2: -260, y2: 300, x3: 0, y3: -100 } };
  };
})(window.A);
