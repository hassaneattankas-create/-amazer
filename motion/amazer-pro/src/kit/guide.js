/* guide.js — films « guide » calés sur la voix off (window.GUIDE_TIMING, écrit par audio/voice.py).
 *
 *   window.FILM = A.Guide.make({
 *     id, title, kicker,                                  // carte d'ouverture
 *     screens: [['home', UI.home()], ...],                // écrans du téléphone, dans l'ordre d'apparition
 *     segs: { segId: { screen, n, label, title, sub,      // chapitre affiché à gauche (fusionné s'il se répète)
 *                      actions: [{ at, tap, card, cue }], // at : 0..1 dans le segment (ou { s: secondes })
 *                      state(t, S, k) } },                // animations continues (k = 0..1 dans le segment)
 *     end: { tag, cta, ctaSize, foot },
 *     look: 'nuit' | 'creme' | 'orange' | 'vert' | 'sable',   // direction artistique (fond, côté du téléphone, sous-titres)
 *   });
 * Sous-titres : chaque phrase de la voix, découpée en morceaux de 2 à 3 lignes, affichée pendant qu'elle est dite.
 */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI;
  A.Guide = {};

  /* Directions artistiques : chaque guide a sa propre identité, la grammaire AMAZER reste commune. */
  const LOOKS = {
    nuit: { bg: el => A.BG.dark(el, { x1: 280, y1: -240, x2: -260, y2: 300 }), side: 'right', open: 'center', cap: 'plain' },
    creme: {
      bg: el => A.BG.light(el), side: 'left', open: 'left', cap: 'bubble', endDark: true,
      ink: C.navy, sub: C.slate, capInk: C.ink, kicker: C.orange, track: 'rgba(15,23,42,.10)', capBg: '#FFFFFF', capShadow: '0 24px 50px -24px rgba(15,23,42,.35)',
    },
    orange: {
      bg: el => A.BG.tone(el, { base: 'radial-gradient(ellipse at 35% 25%,#FF6A1F 0%,#E84800 50%,#A93300 100%)', glows: ['rgba(255,255,255,.20)', 'rgba(255,196,120,.28)', 'rgba(110,20,0,.35)'], dot: 'rgba(255,255,255,.10)' }),
      side: 'right', open: 'center', cap: 'bubble', bigNum: true,
      sub: '#FFE4D1', label: '#FFFFFF', numBg: '#FFFFFF', kicker: '#FFFFFF', accent: C.navy, fill: '#FFFFFF', track: 'rgba(255,255,255,.28)', bar: '#FFFFFF',
      capBg: 'rgba(90,24,0,.38)',
    },
    vert: {
      bg: el => A.BG.tone(el, {
        base: 'radial-gradient(ellipse at 50% 35%,#0F4A38 0%,#08291F 58%,#04140F 100%)', glows: ['rgba(34,197,94,.26)', 'rgba(255,122,26,.20)', 'rgba(20,184,166,.20)'],
        pattern: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', patternSize: '54px 54px',
      }),
      side: 'right', open: 'left', cap: 'plain', bigNum: true, sub: '#BBF7D0', label: '#4ADE80', numBg: '#4ADE80', kicker: '#4ADE80', fill: '#4ADE80', bar: '#4ADE80',
    },
    sable: {
      bg: el => A.BG.tone(el, { base: 'radial-gradient(ellipse at 50% 30%,#FFFDF8 0%,#F7E9CF 58%,#EBD3A8 100%)', glows: ['rgba(245,179,1,.26)', 'rgba(255,122,26,.20)', 'rgba(255,255,255,.85)'], dot: 'rgba(15,23,42,.07)', pos: { x1: 300, y1: -300, x2: -320, y2: 300, x3: 0, y3: -100 } }),
      side: 'right', open: 'left', cap: 'plain', bigNum: true, endDark: true,
      ink: C.navy, sub: '#5B4A2E', capInk: C.ink, kicker: C.orangeDeep, label: C.orangeDeep, numBg: C.orangeDeep, bar: C.orangeDeep, fill: C.orangeDeep, track: 'rgba(15,23,42,.10)',
    },
  };

  /** morceaux de sous-titre (≤ max caractères), coupés aux virgules puis aux espaces, au prorata de la longueur */
  function chunks(cap, max = 78) {
    const words = cap.text.split(' ');
    const parts = [];
    let cur = '';
    words.forEach(w => {
      const next = cur ? cur + ' ' + w : w;
      if (next.length > max && cur) { parts.push(cur); cur = w; } else cur = next;
      if (/[,;:]$/.test(w) && cur.length > max * .55) { parts.push(cur); cur = ''; }
    });
    if (cur) parts.push(cur);
    const total = parts.reduce((s, p) => s + p.length, 0) || 1;
    let acc = cap.a;
    return parts.map(p => { const d = (cap.b - cap.a) * p.length / total; const r = { a: acc, b: acc + d, text: p }; acc += d; return r; });
  }

  A.Guide.make = spec => {
    const T = window.GUIDE_TIMING;
    const order = Object.keys(T.segments);
    const seg = id => T.segments[id];
    const cues = [];
    const cue = (t, s, g = .6, p = 0) => cues.push({ t: +t.toFixed(3), s, g, p });
    const intro = seg(order[0]), outro = seg(order[order.length - 1]);
    const duration = +(T.duration + 3.2).toFixed(2);
    const WIPE = outro.start - .25;
    const RISE = intro.end - .6;

    // changements d'écran : au début du segment dont l'écran diffère du précédent
    const screenOrder = spec.screens.map(s => s[0]);
    const switches = [];
    let current = screenOrder[0];
    order.forEach(id => {
      const sc = spec.segs[id]?.screen;
      if (sc && sc !== current) { switches.push(seg(id).start - .15); current = sc; }
    });

    // chapitres : segments consécutifs au même titre fusionnés
    const steps = [];
    order.forEach(id => {
      const s = spec.segs[id];
      if (!s?.title) return;
      const last = steps[steps.length - 1];
      if (last && last.title === s.title) { last.b = seg(id).end + .2; return; }
      steps.push({ n: s.n ?? String(steps.length + 1).padStart(2, '0'), label: s.label ?? '', title: s.title, sub: s.sub ?? '', a: seg(id).start - .1, b: seg(id).end + .2 });
    });
    steps.forEach((st, i) => { if (steps[i + 1]) st.b = steps[i + 1].a - .05; });

    const captions = order.slice(0, -1).flatMap(id => seg(id).captions.flatMap(c => chunks(c)));
    const L = LOOKS[spec.look ?? 'nuit'];
    const left = L.side === 'left';
    const COL = left ? 572 : 72;               // colonne de texte (étapes, sous-titres)
    const PX = left ? 332 : 748;               // centre du téléphone
    const at = (id, x) => (typeof x === 'object' ? seg(id).start + x.s : seg(id).start + (seg(id).end - seg(id).start) * x);

    const app = {
      id: 'app', a: 0, b: WIPE + .3,
      build(el) {
        el.classList.add('p3d');
        this.bg = L.bg(el);
        el.style.color = L.ink ?? C.white;
        // ouverture : titre du guide
        this.kicker = A.el('div', { cls: 'abs', style: { left: '0', width: '1080px', top: '300px', textAlign: 'center', fontSize: '34px', fontWeight: 800, letterSpacing: '.22em', color: L.kicker ?? C.orange2, ...(L.open === 'left' ? { left: '96px', width: 'auto', textAlign: 'left', top: '330px' } : {}) } }, el, spec.kicker ?? 'GUIDE AMAZER');
        this.titleCard = A.Type.make(el, spec.title, { size: spec.titleSize ?? (L.open === 'left' ? 128 : 104), weight: 800, align: L.open === 'left' ? 'left' : 'center', lh: 1.02, track: -.04, color: L.ink ?? C.white, accent: L.accent });
        this.world = A.el('div', { cls: 'w3d' }, el);
        this.ph = A.Phone.make(this.world);
        this.fl = A.Flow.make(this.ph, spec.screens, switches);
        this.cards = [];
        order.forEach(id => (spec.segs[id]?.actions ?? []).forEach(act => {
          const t0 = at(id, act.at);
          if (act.card) {
            const e = UI.card(this.world, { w: 430, ts: 24, ss: 18, ...act.card });
            this.cards.push({ e, a: t0, b: t0 + (act.card.hold ?? 2.2) });
            cue(t0, act.card.tone ? 'ding' : 'pop', .4, .3);
          }
          if (act.tap) cue(t0, 'tap', .55, .3);
          if (act.cue) cue(t0, act.cue, act.g ?? .45, .2);
        }));
        this.steps = A.S.steps(el, steps, { x: COL, size: left ? 68 : 76, subSize: left ? 32 : 36, numY: 170, titleY: 246, subY: 352, barY: 980, ink: L.ink, sub: L.sub, label: L.label, numBg: L.numBg, accent: L.accent, track: L.track, fill: L.fill, bigNum: L.bigNum });
        const bubble = L.cap === 'bubble';
        this.capBox = A.el('div', { cls: 'abs', style: { left: COL + 'px', top: '640px', width: '450px', minHeight: '10px', fontSize: '31px', lineHeight: 1.32, fontWeight: 600, color: L.capInk ?? '#F8FAFC', letterSpacing: '-.01em', boxSizing: 'border-box', ...(bubble ? { padding: '20px 26px', borderRadius: '26px 26px 26px 8px', background: L.capBg, boxShadow: L.capShadow ?? 'none' } : {}) } }, el);
        this.capBar = A.el('div', { cls: 'abs', style: { left: COL + 'px', top: '616px', width: '56px', height: '6px', borderRadius: '3px', background: L.bar ?? C.orange, display: bubble ? 'none' : 'block' } }, el);
        this.corner = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '14px', left: '72px', top: '64px' } }, el, `<div style="width:58px;height:58px;border-radius:16px;background:${C.paper};display:grid;place-items:center"><img src="assets/logo_mark.png" style="width:46px;height:46px"></div><div style="font-size:34px;font-weight:800;letter-spacing:-.03em">AMAZER</div>`);
        // sons de structure
        cue(.25, 'impact', .5); cue(.3, 'whoosh', .3);
        cue(RISE, 'whoosh', .45); cue(RISE + .8, 'thud', .4);
        switches.forEach(s => cue(s - .05, 'swipe', .5, .35));
        steps.forEach(s => cue(s.a, 'tick', .3, -.5));
      },
      seek(t) {
        A.BG.seek(this.bg, t);
        // ouverture
        const k = A.P(t, .2, .9, E.expoOut), q = A.P(t, RISE - .5, RISE, E.cubicIn);
        this.kicker.style.opacity = (k * (1 - q)).toFixed(3);
        A.T(this.kicker, { y: (1 - k) * 20 - q * 30 });
        A.Type.play(this.titleCard, t, .3, RISE - .3, { stagger: .04, dur: .6 });
        if (L.open === 'left') A.Type.place(this.titleCard, 96, 520, 'l'); else A.Type.place(this.titleCard, 540, 480);
        // téléphone
        const pp = A.Flow.pose(t, { rise: RISE, sideAt: RISE + .7, switches, x: PX, ry: left ? 17 : -17, flip: left });
        A.Phone.pose(this.ph, { ...pp, o: A.lin(t, RISE, RISE + .15) });
        this.ph.root.style.visibility = t >= RISE ? 'visible' : 'hidden';
        const fl = this.fl.seek(t), S = fl.scr;
        order.forEach(id => {
          const s = spec.segs[id];
          if (!s) return;
          const g = seg(id);
          if (s.state) s.state(t, S, A.cl((t - g.start) / (g.end - g.start)), fl);
          (s.actions ?? []).forEach(act => {
            if (!act.tap) return;
            const t0 = at(id, act.at), name = act.screen ?? s.screen;
            // cible : sélecteur, ou fonction (écrans) -> élément (ex. la 2e option de livraison)
            const target = typeof act.tap === 'function' ? act.tap(S) : act.tap;
            fl.tap(t, t0, target, name);
            fl.bounce(t, t0, target, name);
          });
        });
        fl.end();
        this.cards.forEach(c => UI.pop(c.e, t, c.a, c.b, { x: left ? Math.max(56, PX - c.e.offsetWidth / 2) : Math.min(1080 - 56 - c.e.offsetWidth, PX - c.e.offsetWidth / 2), y: 900 - c.e.offsetHeight / 2, z: 90 }));
        this.steps.seek(t);
        // sous-titres
        // ouverture : sous-titres centrés sous le titre ; ensuite, colonne de gauche
        const opening = t < RISE + .3;
        Object.assign(this.capBox.style, opening
          ? (L.open === 'left' ? { left: '96px', width: '760px', top: '700px', textAlign: 'left' } : { left: '140px', width: '800px', top: '660px', textAlign: 'center' })
          : { left: COL + 'px', width: '450px', top: '640px', textAlign: 'left' });
        const cap = captions.find(c => t >= c.a - .05 && t < c.b + .05);
        if (cap) {
          if (this.capBox.textContent !== cap.text) this.capBox.textContent = cap.text;
          const kk = A.P(t, cap.a - .05, cap.a + .2, E.expoOut);
          this.capBox.style.opacity = kk.toFixed(3);
          this.capBox.style.transform = `translateY(${((1 - kk) * 10).toFixed(1)}px)`;
        } else this.capBox.style.opacity = 0;
        const on = A.lin(t, RISE, RISE + .4) * (1 - A.lin(t, WIPE - .3, WIPE));
        this.capBar.style.opacity = on.toFixed(3);
        this.corner.style.opacity = A.lin(t, RISE + .5, RISE + .8).toFixed(3);
      },
    };

    const end = A.S.end({ dark: L.endDark, a: WIPE - .15, b: duration + .01, freeze: Math.min(duration - .4, outro.end + 1.4), wipe: WIPE, cue, ...spec.end });
    return { id: spec.id, title: spec.title, duration, fps: 60, scenes: [app, end], cues, flashes: [] };
  };
})(window.A);
