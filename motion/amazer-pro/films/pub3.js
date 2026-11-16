/* pub3 — « Vendre sur AMAZER » · 25 s · 1080×1080
 * Concept : un commerçant met un produit en ligne, reçoit une commande déjà payée, la confie au livreur
 * et touche le prix entier — tout depuis son téléphone.
 *  0.00– 3.10  Accroche : « Publiez. Vendez. Encaissez. »
 *  2.50–19.85  Téléphone : nouveau produit → commande payée → remise au livreur → ventes du mois
 * 19.45–25.00  Balayage orange → carte de fin (image fixe à 23.4)
 */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI;
  const cues = [];
  const cue = (t, s, g = .6, p = 0) => cues.push({ t: +t.toFixed(3), s, g, p });

  const SW = [7.7, 11.2, 15.2];
  const STEPS = [
    { n: '01', label: 'Publier', title: 'Publiez.', sub: 'Photo, prix, stock :\nen ligne en 1 minute.', a: 3.6, b: 7.55 },
    { n: '02', label: 'Commande', title: 'Vendez.', sub: 'Le client paie avant,\nAMAZER vérifie.', a: 7.75, b: 11.15 },
    { n: '03', label: 'Livraison', title: 'Confiez.', sub: 'Le livreur AMAZER\npasse chercher.', a: 11.35, b: 15.15 },
    { n: '04', label: 'Revenus', title: 'Encaissez.', sub: 'Le prix entier,\nfrais payés par le client.', a: 15.35, b: 19.4 },
  ];
  const WIPE = 19.6;
  const NAME = 'Lait en poudre 400 g', PRICE = '3 250', STOCK = '40';

  const app = {
    id: 'app', a: 0, b: WIPE + .25,
    build(el) {
      el.classList.add('p3d');
      this.bg = A.BG.dark(el, { x1: 280, y1: -240, x2: -260, y2: 300 });
      this.hook = A.S.hook(el, [{ text: 'Publiez.', t: .2 }, { text: 'Vendez.', t: .85 }, { text: '*Encaissez.*', t: 1.5 }], { size: 160, end: 2.55 });
      [.2, .85, 1.5].forEach((t, i) => { cue(t - .01, 'impact', .45 + i * .1); cue(t, 'whoosh', .25, (i - 1) * .5); });
      this.world = A.el('div', { cls: 'w3d' }, el);
      this.ph = A.Phone.make(this.world);
      this.fl = A.Flow.make(this.ph, [['add', UI.sellAdd()], ['orders', UI.sellOrders()], ['ship', UI.sellShip()], ['money', UI.sellMoney()]], SW);
      this.cards = [
        { e: UI.card(this.world, { icon: 'store', title: 'Produit publié', sub: 'Visible partout au Niger', w: 500 }), a: 7.0, b: 7.6 },
        { e: UI.card(this.world, { icon: 'bell', title: 'Nouvelle commande', sub: 'Payée · 6 500 F', tone: C.green, w: 480 }), a: 8.2, b: 9.3 },
        { e: UI.card(this.world, { icon: 'truck', title: 'Remise au livreur', sub: 'En route vers le client', w: 500 }), a: 14.2, b: 15.05 },
        { e: UI.card(this.world, { icon: 'wallet', title: '+ 6 500 F', sub: 'Prix entier pour vous', tone: C.green, w: 460 }), a: 18.2, b: 19.5 },
      ];
      this.steps = A.S.steps(el, STEPS, { size: 82 });
      this.corner = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '14px', left: '72px', top: '64px' } }, el, `<div style="width:58px;height:58px;border-radius:16px;background:${C.paper};display:grid;place-items:center"><img src="assets/logo_mark.png" style="width:46px;height:46px"></div><div style="font-size:34px;font-weight:800;letter-spacing:-.03em">AMAZER</div>`);
      // sons
      cue(2.5, 'whoosh', .5); cue(3.3, 'thud', .45); cue(3.35, 'swipe', .3, .3);
      STEPS.forEach(s => cue(s.a - .02, 'tick', .35, -.5));
      SW.forEach(s => cue(s - .12, 'swipe', .55, .35));
      cue(4.0, 'tap', .55, .2); cue(4.15, 'shimmer', .3, .2);
      for (let i = 0; i < 6; i++) cue(4.75 + i * .1, 'tick', .22, .3);
      for (let i = 0; i < 3; i++) cue(5.75 + i * .12, 'tick', .22, .3);
      cue(6.9, 'tap', .6, .3); cue(7.02, 'pop', .5, -.2);
      cue(8.2, 'ding', .55, -.2); cue(10.3, 'tap', .6, .3);
      cue(12.3, 'tick', .4, .3); cue(13.6, 'tap', .6, .3); cue(14.2, 'whoosh', .35, -.3);
      cue(16.0, 'scan', .25, .2); cue(17.4, 'kaching', .6, -.1); cue(18.2, 'ding', .6, -.2);
    },
    seek(t) {
      A.BG.seek(this.bg, t);
      this.hook.seek(t);
      const pp = A.Flow.pose(t, { rise: 2.5, sideAt: 3.25, switches: SW });
      A.Phone.pose(this.ph, { ...pp, o: A.lin(t, 2.5, 2.65) });
      this.ph.root.style.visibility = t >= 2.5 ? 'visible' : 'hidden';
      const fl = this.fl.seek(t), S = fl.scr;
      // 1 · nouveau produit : photo, nom, prix, stock, publier
      A.$('.js-photo', S.add).style.opacity = A.P(t, 4.05, 4.45, E.cubicOut).toFixed(3);
      fl.tap(t, 4.0, '.js-photo', 'add');
      UI.typeIn(S.add, 'js-name', NAME, A.lin(t, 4.7, 5.4), t >= 4.6 && t < 5.55);
      UI.typeIn(S.add, 'js-price', PRICE, A.lin(t, 5.7, 6.05), t >= 5.6 && t < 6.15);
      UI.typeIn(S.add, 'js-stock', STOCK, A.lin(t, 6.2, 6.4), t >= 6.15 && t < 6.6);
      fl.tap(t, 6.9, '.js-publish', 'add');
      fl.bounce(t, 6.9, '.js-publish', 'add');
      // 2 · commande payée qui arrive
      const nk = A.P(t, 8.0, 8.5, E.expoOut);
      const nw = A.$('.js-new', S.orders);
      nw.style.opacity = nk.toFixed(3);
      nw.style.transform = `translateY(${((1 - nk) * -30).toFixed(1)}px)`;
      nw.style.boxShadow = `0 0 0 ${(5 + 4 * Math.sin(Math.PI * A.lin(t, 8.5, 9.4))).toFixed(1)}px rgba(255,77,0,.12)`;
      fl.tap(t, 10.3, '.js-prep', 'orders');
      fl.bounce(t, 10.3, '.js-prep', 'orders');
      // 3 · préparation → prête → remise au livreur
      const k = 2 + A.P(t, 12.3, 12.8, E.cubicOut) + A.P(t, 13.65, 14.1, E.cubicOut);
      UI.trackState(S.ship, k);
      fl.tap(t, 13.6, '.js-ready', 'ship'); fl.bounce(t, 13.6, '.js-ready', 'ship');
      // 4 · ventes du mois qui montent
      const m = A.P(t, 15.8, 17.4, E.expoOut);
      A.$('.js-earn', S.money).textContent = UI.money(28000 + 6500 * m + (t >= 15.8 ? 0 : 0));
      A.$('.js-earn', S.money).style.transform = `scale(${(1 + .08 * Math.sin(Math.PI * A.lin(t, 17.2, 17.6))).toFixed(3)})`;
      A.$('.js-earn', S.money).style.transformOrigin = '0 50%';
      A.$$('.js-sale', S.money).forEach((r, i) => { const q = A.P(t, 15.6 + i * .08, 16.1 + i * .08, E.expoOut); r.style.opacity = q.toFixed(3); r.style.transform = `translateY(${((1 - q) * 20).toFixed(1)}px)`; });
      fl.end();
      this.cards.forEach(c => UI.pop(c.e, t, c.a, c.b, { x: 450 - c.e.offsetWidth / 2, y: 880 - c.e.offsetHeight / 2, z: 90 }));
      this.steps.seek(t);
      this.corner.style.opacity = (A.lin(t, 3.3, 3.6)).toFixed(3);
    },
  };

  const end = A.S.end({ a: WIPE - .15, b: 25.01, freeze: 23.4, wipe: WIPE, cue, tag: 'Votre boutique en ligne,\n*vos ventes partout.*', cta: 'amazer.store/vendre', ctaSize: 46, foot: 'Boutiques · Restaurants · Hôtels · Transport' });

  window.FILM = { id: 'pub3', title: 'Vendre sur AMAZER', duration: 25, fps: 60, scenes: [app, end], cues, flashes: [] };
})(window.A);
