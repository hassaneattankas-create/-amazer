/* engine.js — moteur AMAZER Pro : temps déterministe, courbes, scènes, caméra 3D.
 * Point d'entrée unique : window.seek(t). Aucune horloge, aucun aléatoire non seedé.
 * Un film = window.FILM = { id, duration, scenes:[{id,a,b,build,seek}], cues:[{t,s,g,p}] }.
 */
window.A = window.A || {};
(function (A) {
  A.W = 1080; A.H = 1080;
  A.C = {
    navy: '#0F172A', deep: '#0B1220', night: '#070B14', ink: '#1E293B', slate: '#475569', mute: '#64748B',
    line: '#E2E8F0', mist: '#F1F5F9', paper: '#FFF7F2', white: '#FFFFFF',
    orange: '#FF4D00', orange2: '#FF7A1A', orangeDeep: '#C93D00', peach: '#FFE4D1',
    green: '#16A34A', greenSoft: '#DCFCE7', gold: '#F5B301', blue: '#2563EB',
  };
  const cl = A.cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  A.lin = (t, a, b) => cl((t - a) / (b - a));
  A.mix = (a, b, k) => a + (b - a) * k;
  const E = A.E = {
    linear: x => x,
    sine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    cubicOut: x => 1 - Math.pow(1 - x, 3),
    cubicIn: x => x * x * x,
    cubicInOut: x => x < .5 ? 4 * x ** 3 : 1 - Math.pow(-2 * x + 2, 3) / 2,
    quartOut: x => 1 - Math.pow(1 - x, 4),
    quintOut: x => 1 - Math.pow(1 - x, 5),
    quintInOut: x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2,
    expoOut: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
    expoIn: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
    expoInOut: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    backOut: (x, s = 1.5) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
    backIn: (x, s = 1.5) => (s + 1) * x * x * x - s * x * x,
    /** ressort amorti (overshoot ~8 % puis stabilisation) */
    spring: (x, f = 4.2, d = 6.5) => x >= 1 ? 1 : 1 - Math.exp(-d * x) * Math.cos(f * Math.PI * x),
  };
  A.P = (t, a, b, e = E.expoOut) => e(A.lin(t, a, b));
  /** enveloppe : 0→1 sur [a, a+fi], 1→0 sur [b-fo, b] */
  A.env = (t, a, b, fi = .4, fo = .3, ei = E.expoOut, eo = E.cubicIn) => A.P(t, a, a + fi, ei) * (1 - A.P(t, b - fo, b, eo));
  A.rand = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  /** flottement doux déterministe */
  A.wob = (t, ph = 0, f = 1) => Math.sin(t * 1.3 * f + ph) * .6 + Math.sin(t * 2.1 * f + ph * 1.7) * .3 + Math.sin(t * 3.7 * f + ph * .4) * .1;
  A.$ = (s, r = document) => r.querySelector(s);
  A.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** crée un élément HTML : A.el('div', {class, style:{}}, parent, html) */
  A.el = (tag, o = {}, parent = null, html = '') => {
    const e = document.createElement(tag);
    if (o.cls) e.className = o.cls;
    if (o.style) Object.assign(e.style, o.style);
    if (o.src) e.src = o.src;
    if (html) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  const f = (v, n = 2) => (+v).toFixed(n);
  /** transformation HTML complète (ordre : translate → translateZ → rotations → scale) */
  A.T = (e, o) => {
    if (!e) return;
    let s = `translate3d(${f(o.x ?? 0)}px,${f(o.y ?? 0)}px,${f(o.z ?? 0)}px)`;
    if (o.c) s += ' translate(-50%,-50%)';
    if (o.ry) s += ` rotateY(${f(o.ry, 3)}deg)`;
    if (o.rx) s += ` rotateX(${f(o.rx, 3)}deg)`;
    if (o.r) s += ` rotate(${f(o.r, 3)}deg)`;
    const sc = o.s ?? 1, sx = o.sx ?? sc, sy = o.sy ?? sc;
    if (sx !== 1 || sy !== 1) s += ` scale(${f(Math.max(1e-4, sx), 4)},${f(Math.max(1e-4, sy), 4)})`;
    e.style.transform = s;
    if (o.o !== undefined) e.style.opacity = f(cl(o.o), 3);
    if (o.blur !== undefined) e.style.filter = o.blur > .08 ? `blur(${f(o.blur)}px)` : 'none';
    if (o.vis !== undefined) e.style.visibility = o.vis ? 'visible' : 'hidden';
  };
  A.show = (e, on) => { if (e) e.style.display = on ? '' : 'none'; };

  // ---- scènes ---------------------------------------------------------------
  const scenes = [];
  A.mount = film => {
    const stage = A.$('#stage');
    film.scenes.forEach((sc, i) => {
      const el = A.el('div', { cls: 'scene', style: { zIndex: 10 + i } }, A.$('#scenes'));
      el.id = sc.id;
      sc.build(el);
      scenes.push({ ...sc, el });
    });
    A.fx && A.fx.mount(stage);
  };
  window.seek = t => {
    const film = window.FILM;
    t = cl(t, 0, film.duration - 1e-6);
    for (const sc of scenes) {
      const on = t >= sc.a && t < sc.b;
      if (on) { sc.el.style.display = 'block'; sc.seek(t); }
      else sc.el.style.display = 'none';
    }
    A.fx && A.fx.seek(t);
    return t;
  };
})(window.A);
