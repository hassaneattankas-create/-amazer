/* scenes.js — scènes et gestes réutilisables d'un film à l'autre.
 *   A.S.end({a, b, freeze, tag, cta, foot, cue})      carte de fin (logo, promesse, appel à l'action)
 *   A.S.wipe(parent, cue) → {seek(t, T)}              balayage orange diagonal (signature AMAZER)
 *   A.S.steps(parent, items) → {seek(t)}              colonne d'étapes numérotées à gauche
 *   A.S.hook(parent, words, o) → {seek(t)}            mots qui frappent l'un après l'autre
 */
(function (A) {
  const C = A.C, E = A.E, I = A.icon;
  A.S = {};

  A.S.end = o => {
    const { a, b, freeze } = o;
    const T0 = o.wipe != null ? o.wipe + .3 : a + .15;
    return {
      id: o.id ?? 'end', a, b,
      build(el) {
        this.bg = o.dark ? A.BG.dark(el) : A.BG.light(el);
        this.ring = A.el('div', { cls: 'abs', style: { width: '240px', height: '240px', borderRadius: '50%', border: `3px solid ${C.orange}` } }, el);
        this.logo = A.el('div', { cls: 'abs', style: { width: '200px', height: '200px', borderRadius: '56px', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 40px 80px -30px rgba(255,77,0,.5), 0 0 0 1px rgba(255,216,196,.9)' } }, el, `<img src="assets/logo_mark.png" style="width:160px;height:160px">`);
        this.name = A.Type.make(el, 'AMAZER', { size: 132, weight: 800, color: o.dark ? C.white : C.navy, track: -.045 });
        this.tag = A.Type.make(el, o.tag ?? 'Tout le Niger,\ndans une *seule application.*', { size: 54, weight: 700, color: o.dark ? C.white : C.navy, align: 'center', lh: 1.15, track: -.025 });
        this.cta = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '16px', height: '104px', padding: '0 46px 0 52px', borderRadius: '52px', background: C.orange, color: '#fff', fontSize: (o.ctaSize ?? 52) + 'px', fontWeight: 800, letterSpacing: '-.03em', whiteSpace: 'nowrap', boxShadow: '0 30px 60px -20px rgba(255,77,0,.65), inset 0 -6px 0 rgba(0,0,0,.12)', transformOrigin: '50% 50%', overflow: 'hidden' } }, el, `${o.cta ?? 'amazer.store'} <span style="width:52px;height:52px;border-radius:26px;background:rgba(255,255,255,.22);display:grid;place-items:center">${I('chevron', { size: 30, color: '#fff', sw: 3 })}</span>`);
        this.shine = A.el('div', { cls: 'abs', style: { left: 0, top: 0, width: '80px', height: '104px', background: 'linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0))' } }, this.cta);
        this.foot = A.el('div', { cls: 'abs', style: { fontSize: '34px', fontWeight: 600, color: o.dark ? '#CBD5E1' : C.slate, whiteSpace: 'nowrap', letterSpacing: '-.01em' } }, el, o.foot ?? 'Boutiques · Restaurants · Hôtels · Transport');
        if (o.wipe != null) this.wipe = A.S.wipe(el, o.cue, o.wipe);
        if (o.cue) { o.cue(T0 + .1, 'impact', .55); o.cue(T0 + .12, 'shimmer', .45); o.cue(T0 + .5, 'whoosh', .3); o.cue(T0 + .95, 'swipe', .3); o.cue(T0 + 1.75, 'pop', .6); o.cue(T0 + 2.3, 'shine', .35); }
      },
      seek(TT) {
        const t = Math.min(TT, freeze);
        A.BG.seek(this.bg, t);
        if (this.wipe) { this.wipe.seek(TT); this.bg.el.style.opacity = this.wipe.covered(TT) ? 1 : 0; }
        else this.bg.el.style.opacity = o.fadeBg === false ? 1 : A.lin(t, a, a + .3).toFixed(3);
        const lk = A.P(t, T0, T0 + .65, x => E.spring(x, 3.2, 6));
        A.T(this.logo, { x: 540 - 100, y: 210, s: Math.max(.001, lk), o: A.lin(t, T0, T0 + .1) });
        const rk = A.P(t, T0 + .05, T0 + .9, E.expoOut);
        A.T(this.ring, { x: 540 - 120, y: 310 - 120, s: .7 + rk * 1.6, o: (1 - rk) * A.lin(t, T0 + .05, T0 + .1) });
        A.Type.place(this.name, 540, 498);
        A.Type.play(this.name, t, T0 + .4, 1e9, { stagger: .04, dur: .6 });
        A.Type.place(this.tag, 540, 640);
        A.Type.play(this.tag, t, T0 + .85, 1e9, { stagger: .05, dur: .55 });
        const ck = A.P(t, T0 + 1.7, T0 + 2.25, x => E.spring(x, 3.4, 6));
        const cw = this.cta.offsetWidth;
        A.T(this.cta, { x: 540 - cw / 2, y: 790, s: Math.max(.001, A.mix(.6, 1, ck)), o: A.lin(t, T0 + 1.7, T0 + 1.8) });
        this.shine.style.transform = `translateX(${A.mix(-120, cw + 60, A.P(t, T0 + 2.3, T0 + 3.0, E.cubicInOut)).toFixed(1)}px) skewX(-20deg)`;
        const fk = A.P(t, T0 + 2.1, T0 + 2.6, E.expoOut);
        A.T(this.foot, { x: 540 - this.foot.offsetWidth / 2, y: 940 + (1 - fk) * 20, o: fk });
      },
    };
  };

  /** balayage diagonal orange : couvre l'écran de T-.15 à T+.2, découvre de T+.2 à T+.6 */
  A.S.wipe = (parent, cue, T) => {
    const w = A.el('div', { cls: 'abs', style: { width: '1900px', height: '1900px', left: '-410px', top: '-410px', background: `linear-gradient(90deg,${C.orangeDeep},${C.orange} 30%,${C.orange2} 70%,${C.orange})`, zIndex: 50 } }, parent);
    if (cue) { cue(T - .05, 'whoosh', .8, -.3); cue(T + .3, 'swipe', .4, .3); }
    return {
      el: w, covered: t => t >= T + .2,
      seek(t) {
        const w1 = A.P(t, T - .15, T + .2, E.cubicIn), w2 = A.P(t, T + .2, T + .6, E.expoOut);
        w.style.transform = `rotate(-28deg) translateX(${(A.mix(-1900, 0, w1) + A.mix(0, 1900, w2)).toFixed(1)}px)`;
        w.style.display = t < T - .15 || w2 >= 1 ? 'none' : 'block';
      },
    };
  };

  /** colonne d'étapes : [{n:'01', title, sub, a, b}] — une étape active à la fois, les autres en rappel */
  A.S.steps = (parent, items, o = {}) => {
    const x = o.x ?? 72;
    const els = items.map((it, i) => {
      const g = A.el('div', { cls: 'abs', style: { left: x + 'px', top: '0' } }, parent);
      const num = A.el('div', { cls: 'abs', style: { top: (o.numY ?? 280) + 'px', display: 'flex', alignItems: 'center', gap: '14px', fontSize: '28px', fontWeight: 700, color: o.label ?? C.orange2, whiteSpace: 'nowrap' } }, g,
        o.bigNum
          ? `<span style="font-size:64px;font-weight:800;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:2.5px ${o.numBg ?? C.orange}">${it.n}</span><span style="width:28px;height:4px;border-radius:2px;background:${o.numBg ?? C.orange}"></span>${it.label ?? ''}`
          : `<span style="width:56px;height:56px;border-radius:18px;background:${o.numBg ?? C.orange};color:${o.numInk ?? '#fff'};display:grid;place-items:center;font-size:26px;font-weight:800">${it.n}</span>${it.label ?? ''}`);
      const title = A.Type.make(g, it.title, { size: o.size ?? 92, weight: 800, color: o.ink ?? C.white, accent: o.accent });
      title.el.style.top = (o.titleY ?? 360) + 'px';
      const sub = A.Type.make(g, it.sub, { size: o.subSize ?? 36, weight: 500, color: o.sub ?? '#CBD5E1', lh: 1.28, track: -.015 });
      sub.el.style.top = (o.subY ?? 486) + 'px';
      return { it, g, num, title, sub };
    });
    // barre de progression des étapes
    const bar = A.el('div', { cls: 'abs', style: { left: x + 'px', top: (o.barY ?? 940) + 'px', display: 'flex', gap: '10px' } }, parent);
    const dots = items.map(() => A.el('div', { style: { width: '44px', height: '8px', borderRadius: '4px', background: o.track ?? 'rgba(255,255,255,.18)', overflow: 'hidden' } }, bar, `<div style="height:100%;width:0;background:${o.fill ?? C.orange}"></div>`));
    return {
      seek(t) {
        els.forEach(({ it, num, title, sub }) => {
          const k = A.P(t, it.a, it.a + .5, E.expoOut), q = A.P(t, it.b - .05, it.b + .25, E.expoIn);
          A.T(num, { x: 0, y: (1 - k) * 24 - q * 20, o: A.lin(t, it.a, it.a + .15) * (1 - q) });
          num.style.top = (o.numY ?? 280) + 'px';
          A.Type.play(title, t, it.a + .08, it.b - .05, { stagger: .05, dur: .55 });
          A.Type.play(sub, t, it.a + .25, it.b - .05, { stagger: .03, dur: .5, tilt: 0 });
        });
        const first = items[0].a, last = items[items.length - 1].b;
        bar.style.opacity = (A.lin(t, first, first + .3) * (1 - A.lin(t, last, last + .3))).toFixed(3);
        dots.forEach((d, i) => { d.firstChild.style.width = (A.lin(t, items[i].a, items[i].b) * 100).toFixed(1) + '%'; });
      },
    };
  };

  /** mots qui frappent : [{text, t, accent}] centrés, un à la fois (le suivant chasse le précédent) */
  A.S.hook = (parent, words, o = {}) => {
    const objs = words.map(w => A.Type.make(parent, w.text, { size: o.size ?? 150, weight: 800, align: 'center', color: w.color ?? C.white }));
    return {
      seek(t) {
        objs.forEach((ob, i) => {
          const a = words[i].t, b = i < words.length - 1 ? words[i + 1].t - .02 : (o.end ?? a + 1);
          A.Type.place(ob, 540, o.y ?? 540);
          A.Type.slam(ob, t, a, b, { from: 1.7, blur: 16 });
        });
      },
    };
  };
})(window.A);
