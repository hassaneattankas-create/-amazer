/* pub4 — « Pharmacies & Essence » · 21 s · 1080×1080
 * Concept : la nuit ou en pénurie, on ne cherche plus au hasard — la pharmacie de garde et la station
 * qui a du carburant sont sur AMAZER, avec l'appel et l'itinéraire en un geste.
 *  0.00– 3.10  Accroche : « De garde ? Du super ? Trouvé. »
 *  2.50–16.85  Téléphone : pharmacies de garde → stations (Super / Gasoil / Gaz) → appel et itinéraire
 * 16.45–21.00  Balayage orange → carte de fin (image fixe à 19.6)
 */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI;
  const cues = [];
  const cue = (t, s, g = .6, p = 0) => cues.push({ t: +t.toFixed(3), s, g, p });

  const SW = [8.0];
  const STEPS = [
    { n: '01', label: 'Pharmacies', title: 'De garde.', sub: 'Les pharmacies ouvertes\ncette nuit, près de vous.', a: 3.6, b: 7.85 },
    { n: '02', label: 'Essence', title: 'Le plein.', sub: 'Super, gasoil, gaz :\nqui en a, maintenant.', a: 8.05, b: 12.15 },
    { n: '03', label: 'Y aller', title: 'Allez-y.', sub: 'Appel et itinéraire\nen un geste.', a: 12.35, b: 16.4 },
  ];
  const WIPE = 16.6;

  const app = {
    id: 'app', a: 0, b: WIPE + .25,
    build(el) {
      el.classList.add('p3d');
      this.bg = A.BG.dark(el, { x1: 280, y1: -240, x2: -260, y2: 300 });
      this.hook = A.S.hook(el, [{ text: 'De garde ?', t: .2 }, { text: 'Du super ?', t: .85 }, { text: '*Trouvé.*', t: 1.5 }], { size: 150, end: 2.55 });
      [.2, .85, 1.5].forEach((t, i) => { cue(t - .01, 'impact', .45 + i * .1); cue(t, 'whoosh', .25, (i - 1) * .5); });
      this.world = A.el('div', { cls: 'w3d' }, el);
      this.ph = A.Phone.make(this.world);
      this.fl = A.Flow.make(this.ph, [['pharma', UI.pharma()], ['stations', UI.stations()]], SW);
      this.cards = [
        { e: UI.card(this.world, { icon: 'clock', title: 'De garde cette nuit', sub: '3 pharmacies à moins de 5 km', tone: C.green, w: 540 }), a: 5.2, b: 6.4 },
        { e: UI.card(this.world, { icon: 'bell', title: 'Appel en cours', sub: 'Pharmacie Espoir', w: 460 }), a: 7.0, b: 7.85 },
        { e: UI.card(this.world, { icon: 'check', title: 'Super disponible', sub: 'Mis à jour il y a 12 min', tone: C.green, w: 500 }), a: 9.9, b: 11.6 },
        { e: UI.card(this.world, { icon: 'pin', title: 'Itinéraire ouvert', sub: 'Station Liberté · 0,9 km', w: 500 }), a: 14.0, b: 15.4 },
      ];
      this.steps = A.S.steps(el, STEPS, { size: 82 });
      this.corner = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '14px', left: '72px', top: '64px' } }, el, `<div style="width:58px;height:58px;border-radius:16px;background:${C.paper};display:grid;place-items:center"><img src="assets/logo_mark.png" style="width:46px;height:46px"></div><div style="font-size:34px;font-weight:800;letter-spacing:-.03em">AMAZER</div>`);
      // sons
      cue(2.5, 'whoosh', .5); cue(3.3, 'thud', .45); cue(3.35, 'swipe', .3, .3);
      STEPS.forEach(s => cue(s.a - .02, 'tick', .35, -.5));
      SW.forEach(s => cue(s - .12, 'swipe', .55, .35));
      [4.0, 4.12, 4.24].forEach(t => cue(t, 'pop', .3, .3));
      cue(5.2, 'ding', .5, -.2); cue(6.9, 'tap', .6, .3); cue(7.0, 'beep', .35, -.2);
      [8.5, 8.62].forEach(t => cue(t, 'pop', .3, .3));
      cue(9.85, 'ding', .55, -.2); cue(13.0, 'tap', .6, .3); cue(13.9, 'tap', .6, .3); cue(14.0, 'whoosh', .35, -.3);
    },
    seek(t) {
      A.BG.seek(this.bg, t);
      this.hook.seek(t);
      const pp = A.Flow.pose(t, { rise: 2.5, sideAt: 3.25, switches: SW });
      A.Phone.pose(this.ph, { ...pp, o: A.lin(t, 2.5, 2.65) });
      this.ph.root.style.visibility = t >= 2.5 ? 'visible' : 'hidden';
      const fl = this.fl.seek(t), S = fl.scr;
      // 1 · pharmacies de garde : les fiches arrivent, la premiere est appelee
      A.$$('.js-svc', S.pharma).forEach((r, i) => { const k = A.P(t, 3.95 + i * .12, 4.5 + i * .12, E.expoOut); r.style.opacity = k.toFixed(3); r.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px)`; });
      fl.tap(t, 6.9, A.$$('.js-call', S.pharma)[0], 'pharma');
      fl.bounce(t, 6.9, A.$$('.js-call', S.pharma)[0], 'pharma');
      // 2 · stations : disponibilites, la premiere ressort
      A.$$('.js-svc', S.stations).forEach((r, i) => { const k = A.P(t, 8.45 + i * .12, 9.0 + i * .12, E.expoOut); r.style.opacity = k.toFixed(3); r.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px)`; });
      const glow = A.P(t, 9.8, 10.3, E.expoOut) * (1 - A.P(t, 11.8, 12.3, E.cubicOut));
      A.$$('.js-svc', S.stations)[0].style.boxShadow = `0 0 0 ${(glow * 6).toFixed(1)}px rgba(22,163,74,.18)`;
      // 3 · appel puis itineraire vers la station
      fl.tap(t, 13.0, A.$$('.js-call', S.stations)[0], 'stations');
      fl.bounce(t, 13.0, A.$$('.js-call', S.stations)[0], 'stations');
      fl.tap(t, 13.9, A.$$('.js-route', S.stations)[0], 'stations');
      fl.bounce(t, 13.9, A.$$('.js-route', S.stations)[0], 'stations');
      fl.end();
      this.cards.forEach(c => UI.pop(c.e, t, c.a, c.b, { x: 450 - c.e.offsetWidth / 2, y: 880 - c.e.offsetHeight / 2, z: 90 }));
      this.steps.seek(t);
      this.corner.style.opacity = (A.lin(t, 3.3, 3.6)).toFixed(3);
    },
  };

  const end = A.S.end({ a: WIPE - .15, b: 21.01, freeze: 19.6, wipe: WIPE, cue, tag: 'Pharmacies de garde et essence,\n*en un coup d’œil.*', foot: 'Pharmacies · Stations-essence · Gaz livré' });

  window.FILM = { id: 'pub4', title: 'Pharmacies & Essence', duration: 21, fps: 60, scenes: [app, end], cues, flashes: [] };
})(window.A);
