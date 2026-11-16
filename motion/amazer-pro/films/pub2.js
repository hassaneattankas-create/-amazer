/* pub2 — « Commander sur AMAZER » · 25 s · 1080×1080
 * Concept : du produit trouvé à la commande reçue, en quatre gestes — sans quitter l'application.
 *  0.00– 3.10  Accroche : « Trouvez. Payez. Recevez. »
 *  2.50–19.85  Téléphone : recherche → offres → panier (Express Niamey) → paiement Amana → suivi → « J'ai reçu ma commande »
 * 19.45–25.00  Balayage orange → carte de fin (image fixe à 23.4)
 */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI, I = A.icon;
  const cues = [];
  const cue = (t, s, g = .6, p = 0) => cues.push({ t: +t.toFixed(3), s, g, p });

  const SW = [5.4, 7.7, 11.2, 15.2];
  const STEPS = [
    { n: '01', label: 'Rechercher', title: 'Trouvez.', sub: 'Le bon produit,\nau meilleur prix.', a: 3.6, b: 7.55 },
    { n: '02', label: 'Panier', title: 'Choisissez.', sub: 'Livraison Standard\nou Express Niamey.', a: 7.75, b: 11.15 },
    { n: '03', label: 'Paiement', title: 'Payez.', sub: 'Nita ou Amana,\nen toute sécurité.', a: 11.35, b: 15.15 },
    { n: '04', label: 'Suivi', title: 'Suivez.', sub: 'De la boutique\njusqu’à votre porte.', a: 15.35, b: 19.4 },
  ];
  const WIPE = 19.6;

  const app = {
    id: 'app', a: 0, b: WIPE + .25,
    build(el) {
      el.classList.add('p3d');
      this.bg = A.BG.dark(el, { x1: 280, y1: -240, x2: -260, y2: 300 });
      this.hook = A.S.hook(el, [{ text: 'Trouvez.', t: .2 }, { text: 'Payez.', t: .85 }, { text: '*Recevez.*', t: 1.5 }], { size: 168, end: 2.55 });
      [.2, .85, 1.5].forEach((t, i) => { cue(t - .01, 'impact', .45 + i * .1); cue(t, 'whoosh', .25, (i - 1) * .5); });
      this.world = A.el('div', { cls: 'w3d' }, el);
      this.ph = A.Phone.make(this.world);
      this.fl = A.Flow.make(this.ph, [['search', UI.search()], ['product', UI.product()], ['cart', UI.cart()], ['pay', UI.pay()], ['track', UI.track()]], SW);
      this.cards = [
        { e: UI.card(this.world, { icon: 'bag', title: 'Ajouté au panier', sub: 'Riz basmati 25 kg · 18 500 F', w: 520 }), a: 7.0, b: 7.6 },
        { e: UI.card(this.world, { icon: 'wallet', title: 'Paiement confirmé', sub: 'Amana Transfert · 20 500 F', tone: C.green, w: 520 }), a: 14.0, b: 15.05 },
        { e: UI.card(this.world, { icon: 'package', title: 'Commande reçue', sub: 'Merci pour votre achat !', tone: C.green, w: 480 }), a: 18.35, b: 19.5 },
      ];
      this.steps = A.S.steps(el, STEPS, { size: 82 });
      this.corner = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '14px', left: '72px', top: '64px' } }, el, `<div style="width:58px;height:58px;border-radius:16px;background:${C.paper};display:grid;place-items:center"><img src="assets/logo_mark.png" style="width:46px;height:46px"></div><div style="font-size:34px;font-weight:800;letter-spacing:-.03em">AMAZER</div>`);
      // sons
      cue(2.5, 'whoosh', .5); cue(3.3, 'thud', .45); cue(3.35, 'swipe', .3, .3);
      STEPS.forEach(s => cue(s.a - .02, 'tick', .35, -.5));
      SW.forEach(s => cue(s - .12, 'swipe', .55, .35));
      [3.9, 4.1, 4.3].forEach(t => cue(t, 'tick', .3, .3));
      cue(5.15, 'tap', .6, .2); cue(6.9, 'tap', .6, .3); cue(7.02, 'pop', .5, -.2);
      cue(8.9, 'tap', .6, .3); cue(8.95, 'tick', .3, .3); cue(10.6, 'tap', .6, .4);
      cue(12.0, 'tap', .6, .3); cue(12.95, 'ding', .45, .3); cue(13.7, 'tap', .6, .3); cue(14.0, 'kaching', .65, -.2);
      cue(15.9, 'tick', .4, .3); cue(16.9, 'tick', .4, .3); cue(18.1, 'tap', .6, .3); cue(18.35, 'ding', .7, -.2);
    },
    seek(t) {
      A.BG.seek(this.bg, t);
      this.hook.seek(t);
      const pp = A.Flow.pose(t, { rise: 2.5, sideAt: 3.25, switches: SW });
      A.Phone.pose(this.ph, { ...pp, o: A.lin(t, 2.5, 2.65) });
      this.ph.root.style.visibility = t >= 2.5 ? 'visible' : 'hidden';
      const fl = this.fl.seek(t), S = fl.scr;
      // 1 · recherche : « riz » se tape, les résultats arrivent
      const q = 'riz', nq = t < 3.9 ? 0 : t < 4.1 ? 1 : t < 4.3 ? 2 : 3;
      A.$('.js-q', S.search).textContent = q.slice(0, nq);
      A.$('.js-caret', S.search).style.opacity = (Math.floor(t * 2.4) % 2 === 0 || nq < 3) ? 1 : 0;
      A.$('.js-count', S.search).style.opacity = A.lin(t, 4.4, 4.6).toFixed(3);
      A.$$('.js-res', S.search).forEach((r, i) => { const k = A.P(t, 4.45 + i * .07, 4.95 + i * .07, E.expoOut); r.style.opacity = k.toFixed(3); r.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px)`; });
      fl.tap(t, 5.15, A.$$('.js-res', S.search)[0], 'search');
      // 2 · fiche produit : la meilleure offre ressort, ajout au panier
      const ob = A.P(t, 5.9, 6.4, E.expoOut);
      A.$$('.js-offer', S.product)[0].style.boxShadow = `0 0 0 ${(ob * 6).toFixed(1)}px rgba(255,77,0,.14)`;
      fl.tap(t, 6.9, '.js-addcart', 'product');
      fl.bounce(t, 6.9, '.js-addcart', 'product');
      // 3 · panier : Express Niamey
      const exp = t >= 8.9 ? 1 : 0;
      UI.select(A.$$('.js-opt', S.cart), exp);
      UI.select(A.$$('.js-pay', S.cart), 0);
      A.$('.js-fee', S.cart).textContent = exp ? '2 000 F' : '1 000 F';
      A.$('.js-sum', S.cart).textContent = exp ? '20 500 F' : '19 500 F';
      A.$('.js-sum', S.cart).style.transform = `scale(${(1 + .12 * Math.sin(Math.PI * A.lin(t, 8.9, 9.25))).toFixed(3)})`;
      A.$('.js-sum', S.cart).style.transformOrigin = '0 50%';
      fl.tap(t, 8.9, A.$$('.js-opt', S.cart)[1], 'cart', 120, 0);
      fl.tap(t, 10.6, '.js-cmd', 'cart');
      fl.bounce(t, 10.6, '.js-cmd', 'cart');
      // 4 · paiement Amana
      const ps = t < 12.0 ? 0 : t < 12.95 ? 1 : t < 13.7 ? 2 : 3;
      UI.payState(S.pay, ps);
      A.$('.js-pstate', S.pay).style.opacity = (ps >= 1 && ps < 3 ? 1 : 0).toString();
      fl.tap(t, 12.0, '.js-start', 'pay'); fl.bounce(t, 12.0, '.js-start', 'pay');
      fl.tap(t, 13.7, '.js-verify', 'pay'); fl.bounce(t, 13.7, '.js-verify', 'pay');
      // 5 · suivi
      const k = 1 + A.P(t, 15.9, 16.4, E.cubicOut) + A.P(t, 16.9, 17.4, E.cubicOut) + A.P(t, 18.15, 18.5, E.cubicOut);
      UI.trackState(S.track, k);
      fl.tap(t, 18.1, '.js-recv', 'track'); fl.bounce(t, 18.1, '.js-recv', 'track');
      fl.end();
      // cartes flottantes
      this.cards.forEach(c => UI.pop(c.e, t, c.a, c.b, { x: 450 - c.e.offsetWidth / 2, y: 880 - c.e.offsetHeight / 2, z: 90 }));
      this.steps.seek(t);
      this.corner.style.opacity = (A.lin(t, 3.3, 3.6)).toFixed(3);
    },
  };

  const end = A.S.end({ a: WIPE - .15, b: 25.01, freeze: 23.4, wipe: WIPE, cue, tag: 'Commandez, payez,\n*recevez chez vous.*' });

  window.FILM = { id: 'pub2', title: 'Commander sur AMAZER', duration: 25, fps: 60, scenes: [app, end], cues, flashes: [] };
})(window.A);
