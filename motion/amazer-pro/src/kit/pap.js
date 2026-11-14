/* pap.js — habillage animé des guides « pas à pas » (vertical 1080 × 1920).
 *   A.PAP.film({ kind:'intro',   duration, who, title, subtitle, chapters:[titre…] })
 *   A.PAP.film({ kind:'chapter', duration, n, total, title, sub })
 *   A.PAP.film({ kind:'outro',   duration, tag, foot, cta })
 * Registre : explainer + signature de marque. Une idée par plan, entrées expoOut, sorties ~0,6× plus rapides,
 * micro-mouvement permanent (halos qui dérivent), aucun aléatoire, tout dépend de t (window.seek).
 */
(function (A) {
  const C = A.C, E = A.E, W = 1080, H = 1920, CX = W / 2;
  const PAP = (A.PAP = {});

  /** Coupe un texte en lignes d'au plus « max » caractères, sans casser les mots ni les accents *…*. */
  PAP.wrap = (text, max) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    const len = s => s.replace(/\*/g, '').length;
    const total = len(words.join(' '));
    const greedy = target => {
      const lines = [];
      let line = '';
      for (const w of words) {
        if (line && len(`${line} ${w}`) > target) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w;
      }
      if (line) lines.push(line);
      return lines;
    };
    // le moins de lignes possible, puis des lignes de longueur équilibrée (pas de mot seul en fin de bloc)
    const n = greedy(max).length;
    for (let target = Math.ceil(total / n); target <= max; target += 1) {
      const lines = greedy(target);
      if (lines.length <= n) return lines.join('\n');
    }
    return greedy(max).join('\n');
  };
  const plain = s => String(s ?? '').replace(/\*\*/g, '').replace(/\s*→\s*/g, ' → ').trim();
  /** Accent orange sur la fin du titre (« Mes stations, *pas à pas* ») ou sur son dernier mot. */
  const accent = title => {
    const t = String(title);
    const i = t.lastIndexOf(',');
    if (i > 0 && i < t.length - 2) return `${t.slice(0, i + 1)} *${t.slice(i + 1).trim()}*`;
    const k = t.lastIndexOf(' ');
    return k > 0 ? `${t.slice(0, k)} *${t.slice(k + 1)}*` : `*${t}*`;
  };

  // ---------------------------------------------------------------- fond : nuit AMAZER, halos orange qui dérivent
  const bg = parent => {
    const el = A.el('div', { cls: 'abs', style: { width: W + 'px', height: H + 'px', background: `linear-gradient(180deg,${C.night} 0%,${C.deep} 45%,#101B33 100%)` } }, parent);
    const g1 = A.el('div', { cls: 'abs', style: { width: '1300px', height: '1300px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,77,0,.30) 0%,rgba(255,77,0,.10) 38%,rgba(255,77,0,0) 68%)' } }, el);
    const g2 = A.el('div', { cls: 'abs', style: { width: '1100px', height: '1100px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,122,26,.18) 0%,rgba(255,122,26,0) 65%)' } }, el);
    // fines lignes diagonales très discrètes : de la matière sans bruit
    const lines = A.el('div', { cls: 'abs', style: { width: W + 'px', height: H + 'px', opacity: .07, background: 'repeating-linear-gradient(118deg,rgba(255,255,255,.9) 0 1px,transparent 1px 46px)' } }, el);
    const vig = A.el('div', { cls: 'abs', style: { width: W + 'px', height: H + 'px', background: 'radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)' } }, el);
    return {
      el,
      seek(t) {
        A.T(g1, { x: 380 + A.wob(t, .3, .35) * 90, y: -360 + A.wob(t, 1.7, .3) * 70 });
        A.T(g2, { x: -520 + A.wob(t, 2.4, .28) * 80, y: 1180 + A.wob(t, .9, .33) * 90 });
        lines.style.transform = `translateX(${(-t * 14 % 46).toFixed(2)}px)`;
        void vig;
      },
    };
  };

  /** Pastille logo (jamais déformée : échelle uniforme) + anneau qui s'ouvre. */
  const logo = (parent, size = 196) => {
    const ring = A.el('div', { cls: 'abs', style: { width: size * 1.2 + 'px', height: size * 1.2 + 'px', borderRadius: '50%', border: `3px solid ${C.orange}` } }, parent);
    const tile = A.el('div', { cls: 'abs', style: { width: size + 'px', height: size + 'px', borderRadius: size * .28 + 'px', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 40px 90px -30px rgba(255,77,0,.6), 0 0 0 1px rgba(255,216,196,.9)' } }, parent, `<img src="assets/logo_mark.png" style="width:${size * .8}px;height:${size * .8}px">`);
    return {
      seek(t, t0, cy, out = 1e9) {
        const k = A.P(t, t0, t0 + .7, x => E.spring(x, 3.2, 6));
        const q = A.P(t, out, out + .3, E.expoIn);
        A.T(tile, { x: CX - size / 2, y: cy - size / 2 - q * 60, s: Math.max(.001, k) * (1 - q * .2), o: A.lin(t, t0, t0 + .1) * (1 - q) });
        const r = A.P(t, t0 + .05, t0 + 1, E.expoOut);
        A.T(ring, { x: CX - size * .6, y: cy - size * .6, s: .7 + r * 1.7, o: (1 - r) * A.lin(t, t0 + .05, t0 + .12) });
      },
    };
  };

  /** Petit libellé orange espacé, avec deux filets qui se tracent de part et d'autre. */
  const label = (parent, text) => {
    const box = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '22px', whiteSpace: 'nowrap', fontSize: '28px', fontWeight: 700, letterSpacing: '.2em', color: C.orange2 } }, parent);
    const l1 = A.el('span', { style: { display: 'block', height: '3px', width: '0', borderRadius: '2px', background: C.orange } }, box);
    const tx = A.el('span', {}, box);
    tx.textContent = text.toUpperCase();
    const l2 = A.el('span', { style: { display: 'block', height: '3px', width: '0', borderRadius: '2px', background: C.orange } }, box);
    return {
      seek(t, t0, cy, out = 1e9) {
        const k = A.P(t, t0, t0 + .5, E.expoOut), q = A.P(t, out, out + .25, E.expoIn);
        const lw = (A.P(t, t0 + .1, t0 + .7, E.expoOut) * Math.max(24, Math.min(70, (860 - tx.offsetWidth) / 2 - 22))).toFixed(1) + 'px';
        l1.style.width = lw; l2.style.width = lw;
        A.T(box, { x: CX - box.offsetWidth / 2, y: cy + (1 - k) * 18 - q * 30, o: A.lin(t, t0, t0 + .2) * (1 - q) });
      },
    };
  };

  /** Signature discrète en bas d'écran (dans la zone sûre). */
  const sign = parent => {
    const e = A.el('div', { cls: 'abs', style: { fontSize: '30px', fontWeight: 600, letterSpacing: '.04em', color: '#64748B', whiteSpace: 'nowrap' } }, parent);
    e.textContent = 'amazer.store';
    return { seek(t, t0, out = 1e9) { const k = A.P(t, t0, t0 + .5, E.expoOut), q = A.P(t, out, out + .25, E.expoIn); A.T(e, { x: CX - e.offsetWidth / 2, y: 1730 + (1 - k) * 14, o: k * (1 - q) }); } };
  };

  // ---------------------------------------------------------------- ouverture
  const intro = o => ({
    id: 'intro', a: 0, b: o.duration,
    build(el) {
      this.bg = bg(el);
      this.logo = logo(el, 188);
      this.label = label(el, `Guide pas à pas · ${o.who ?? ''}`.replace(/ · $/, ''));
      this.title = A.Type.make(el, PAP.wrap(accent(o.title), 15), { size: 104, weight: 800, align: 'center', lh: 1.02, track: -.04 });
      this.sub = A.Type.make(el, PAP.wrap(plain(o.subtitle), 34), { size: 40, weight: 500, align: 'center', color: '#CBD5E1', lh: 1.25, track: -.015 });
      this.sign = sign(el);
      this.head = A.Type.make(el, 'Au programme', { size: 34, weight: 700, color: C.orange2, track: .02 });
      const items = (o.chapters ?? []).slice(0, 6);
      this.rows = items.map((c, i) => {
        const row = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '26px', width: '860px', height: '104px', padding: '0 30px', borderRadius: '28px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)' } }, el,
          `<span style="flex:none;width:58px;height:58px;border-radius:18px;background:${C.orange};display:grid;place-items:center;font-size:30px;font-weight:800;color:#fff">${i + 1}</span><span style="font-size:34px;line-height:1.15;font-weight:700;letter-spacing:-.02em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${plain(c).replace(/</g, '&lt;')}</span>`);
        return row;
      });
    },
    seek(t) {
      const D = o.duration, out = D - .62;
      this.bg.seek(t);
      this.bg.el.style.opacity = A.lin(t, 0, .35).toFixed(3);
      // bloc entier centré verticalement (logo → liste)
      // bloc entier centré entre le haut et la signature du bas (1690)
      const blockH = 390 + this.title.h + 50 + this.sub.h + 110 + this.rows.length * 118;
      const top = Math.max(150, (1690 - blockH) / 2);
      this.logo.seek(t, .15, top + 94, out);
      this.label.seek(t, .55, top + 290, out);
      const ty = top + 390 + this.title.h / 2;
      A.Type.place(this.title, CX, ty);
      A.Type.play(this.title, t, .75, out, { stagger: .06, dur: .6 });
      A.Type.place(this.sub, CX, ty + this.title.h / 2 + 50 + this.sub.h / 2);
      A.Type.play(this.sub, t, 1.25, out + .05, { stagger: .03, dur: .5, tilt: 0 });
      this.sign.seek(t, 1.6, out);
      const y0 = ty + this.title.h / 2 + 50 + this.sub.h + 110;
      A.Type.place(this.head, 110, y0, 'l');
      A.Type.play(this.head, t, 1.9, out + .08, { stagger: .04, dur: .45, tilt: 0 });
      this.rows.forEach((row, i) => {
        const a = 2.15 + i * .11;
        const k = A.P(t, a, a + .6, E.expoOut), q = A.P(t, out + .1 + i * .025, out + .1 + i * .025 + .28, E.expoIn);
        // le rang actif respire doucement : la liste n'est jamais figée
        const glow = .06 + .035 * (0.5 + 0.5 * Math.sin(t * 2.2 - i * .9));
        row.style.background = `rgba(255,255,255,${glow.toFixed(3)})`;
        A.T(row, { x: 110 - (1 - k) * 90, y: y0 + 50 + i * 118 - q * 50, o: A.lin(t, a, a + .2) * (1 - q) });
      });
    },
  });

  // ---------------------------------------------------------------- carton de chapitre
  const chapter = o => ({
    id: 'chapter', a: 0, b: o.duration,
    build(el) {
      this.bg = bg(el);
      const n = String(o.n).padStart(2, '0');
      this.num = A.el('div', { cls: 'abs', style: { fontSize: '420px', fontWeight: 800, letterSpacing: '-.06em', lineHeight: 1, whiteSpace: 'nowrap', color: 'transparent', WebkitTextStroke: `4px ${C.orange}`, transformOrigin: '50% 50%' } }, el);
      this.num.textContent = n;
      this.fill = A.el('div', { cls: 'abs', style: { fontSize: '420px', fontWeight: 800, letterSpacing: '-.06em', lineHeight: 1, whiteSpace: 'nowrap', color: C.orange, transformOrigin: '50% 50%' } }, el);
      this.fill.textContent = n;
      this.label = label(el, `Étape ${o.n} sur ${o.total}`);
      this.title = A.Type.make(el, PAP.wrap(o.title, 17), { size: 92, weight: 800, align: 'center', lh: 1.04, track: -.035 });
      this.sub = o.sub ? A.Type.make(el, PAP.wrap(plain(o.sub), 36), { size: 38, weight: 500, align: 'center', color: '#CBD5E1', lh: 1.28, track: -.015 }) : null;
      this.sign = sign(el);
      this.bar = A.el('div', { cls: 'abs', style: { display: 'flex', gap: '12px' } }, el);
      this.dots = Array.from({ length: o.total }, (_, i) => A.el('div', { style: { width: '64px', height: '10px', borderRadius: '5px', background: i < o.n - 1 ? C.orange : 'rgba(255,255,255,.16)', overflow: 'hidden' } }, this.bar, `<div style="height:100%;width:0;background:${C.orange}"></div>`));
    },
    seek(t) {
      const D = o.duration, out = D - .5;
      this.bg.seek(t);
      // grand numéro : arrive de près et flou, se pose, puis se remplit d'orange de gauche à droite
      const k = A.P(t, .05, .55, E.expoOut), q = A.P(t, out, out + .32, E.expoIn);
      const s = A.mix(1.45, 1, k) * (1 - q * .12) * (1 + .015 * Math.sin(t * 1.6));
      const nw = this.num.offsetWidth, nh = this.num.offsetHeight;
      for (const e of [this.num, this.fill]) {
        A.T(e, { x: CX - nw / 2, y: 640 - nh / 2 - q * 40, s, o: A.lin(t, .05, .15) * (1 - q), blur: (1 - k) * 18 });
      }
      const f = A.P(t, .45, 1.05, E.cubicInOut);
      this.fill.style.clipPath = `inset(0 ${((1 - f) * 100).toFixed(2)}% 0 0)`;
      this.label.seek(t, .3, 950, out);
      const ty = 1040 + this.title.h / 2;
      A.Type.place(this.title, CX, ty);
      A.Type.play(this.title, t, .42, out, { stagger: .055, dur: .55 });
      this.sign.seek(t, .5, out);
      if (this.sub) {
        A.Type.place(this.sub, CX, ty + this.title.h / 2 + 50 + this.sub.h / 2);
        A.Type.play(this.sub, t, .7, out + .04, { stagger: .025, dur: .5, tilt: 0 });
      }
      const bw = this.bar.offsetWidth;
      A.T(this.bar, { x: CX - bw / 2, y: 1590, o: A.lin(t, .2, .45) * (1 - q) });
      const cur = this.dots[o.n - 1];
      if (cur) cur.firstChild.style.width = (A.P(t, .5, D - .3, E.cubicInOut) * 100).toFixed(1) + '%';
    },
  });

  // ---------------------------------------------------------------- carte de fin
  const outro = o => ({
    id: 'outro', a: 0, b: o.duration,
    build(el) {
      this.bg = bg(el);
      this.logo = logo(el, 230);
      this.name = A.Type.make(el, 'AMAZER', { size: 150, weight: 800, track: -.05 });
      this.tag = A.Type.make(el, PAP.wrap(accent(o.tag), 19), { size: 76, weight: 800, align: 'center', lh: 1.06, track: -.035 });
      this.cta = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '18px', height: '118px', padding: '0 50px 0 58px', borderRadius: '59px', background: C.orange, color: '#fff', fontSize: '56px', fontWeight: 800, letterSpacing: '-.03em', whiteSpace: 'nowrap', boxShadow: '0 34px 70px -24px rgba(255,77,0,.7), inset 0 -6px 0 rgba(0,0,0,.12)', overflow: 'hidden', transformOrigin: '50% 50%' } }, el,
        `${o.cta ?? 'amazer.store'} <span style="width:58px;height:58px;border-radius:29px;background:rgba(255,255,255,.22);display:grid;place-items:center">${A.icon('chevron', { size: 32, color: '#fff', sw: 3 })}</span>`);
      this.shine = A.el('div', { cls: 'abs', style: { left: 0, top: 0, width: '90px', height: '118px', background: 'linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0))' } }, this.cta);
      this.foot = A.el('div', { cls: 'abs', style: { fontSize: '38px', fontWeight: 600, color: '#CBD5E1', whiteSpace: 'nowrap', letterSpacing: '-.01em' } }, el);
      this.foot.textContent = plain(o.foot ?? '').replace(/^amazer\.store\s*·\s*/i, '');
    },
    seek(t) {
      this.bg.seek(t);
      this.bg.el.style.opacity = '1';
      this.logo.seek(t, .1, 610);
      A.Type.place(this.name, CX, 870);
      A.Type.play(this.name, t, .45, 1e9, { stagger: .045, dur: .6 });
      A.Type.place(this.tag, CX, 990 + this.tag.h / 2);
      A.Type.play(this.tag, t, .9, 1e9, { stagger: .055, dur: .55 });
      const ck = A.P(t, 1.7, 2.3, x => E.spring(x, 3.4, 6));
      const cw = this.cta.offsetWidth;
      A.T(this.cta, { x: CX - cw / 2, y: 1050 + this.tag.h + 70 + Math.sin(t * 1.8) * 4, s: Math.max(.001, A.mix(.6, 1, ck)), o: A.lin(t, 1.7, 1.8) });
      // reflet qui repasse toutes les 3 s : la tenue finale reste vivante
      const ph = ((t - 2.3) % 3 + 3) % 3;
      this.shine.style.transform = `translateX(${A.mix(-140, cw + 80, A.P(ph, 0, .8, E.cubicInOut)).toFixed(1)}px) skewX(-20deg)`;
      this.shine.style.display = t < 2.3 ? 'none' : 'block';
      const fk = A.P(t, 2.2, 2.7, E.expoOut);
      A.T(this.foot, { x: CX - this.foot.offsetWidth / 2, y: 1050 + this.tag.h + 250 + (1 - fk) * 22, o: fk });
    },
  });

  PAP.film = o => {
    const scene = { intro, chapter, outro }[o.kind](o);
    return { id: `pap-${o.kind}`, duration: o.duration, scenes: [scene], cues: [] };
  };
})(window.A);
