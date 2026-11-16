/* pub5 — « Gagner avec AMAZER » (affiliation) · 21 s · 1080×1080
 * Concept : un lien partagé sur WhatsApp devient un commerçant inscrit, puis un gain — sans stock ni abonnement.
 *  0.00– 3.10  Accroche : « Partagez. Recommandez. Gagnez. »
 *  2.50–16.85  Téléphone : lien d'affilié → conversation WhatsApp → gains
 * 16.45–21.00  Balayage orange → carte de fin (image fixe à 19.6)
 */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI;
  const cues = [];
  const cue = (t, s, g = .6, p = 0) => cues.push({ t: +t.toFixed(3), s, g, p });

  const SW = [7.7, 11.9];
  const STEPS = [
    { n: '01', label: 'Votre lien', title: 'Partagez.', sub: 'Votre lien personnel,\ngratuit.', a: 3.6, b: 7.55 },
    { n: '02', label: 'Un vendeur', title: 'Invitez.', sub: 'Un commerçant s’inscrit\navec votre lien.', a: 7.75, b: 11.75 },
    { n: '03', label: 'Vos gains', title: 'Gagnez.', sub: 'Une part de ses\nabonnements payés.', a: 11.95, b: 16.4 },
  ];
  const WIPE = 16.6;

  const app = {
    id: 'app', a: 0, b: WIPE + .25,
    build(el) {
      el.classList.add('p3d');
      this.bg = A.BG.dark(el, { x1: 280, y1: -240, x2: -260, y2: 300 });
      this.hook = A.S.hook(el, [{ text: 'Partagez.', t: .2 }, { text: 'Recommandez.', t: .85 }, { text: '*Gagnez.*', t: 1.5 }], { size: 130, end: 2.55 });
      [.2, .85, 1.5].forEach((t, i) => { cue(t - .01, 'impact', .45 + i * .1); cue(t, 'whoosh', .25, (i - 1) * .5); });
      this.world = A.el('div', { cls: 'w3d' }, el);
      this.ph = A.Phone.make(this.world);
      this.fl = A.Flow.make(this.ph, [['link', UI.affLink()], ['chat', UI.affChat()], ['wallet', UI.affWallet()]], SW);
      this.cards = [
        { e: UI.card(this.world, { icon: 'copy', title: 'Lien copié', sub: 'amazer.store/?ref=FATI24', w: 500 }), a: 5.5, b: 6.6 },
        { e: UI.card(this.world, { icon: 'store', title: 'Nouveau vendeur inscrit', sub: 'Boutique Hamdallaye', tone: C.green, w: 560 }), a: 11.0, b: 11.75 },
        { e: UI.card(this.world, { icon: 'coins', title: 'Gain ajouté', sub: 'Abonnement payé', tone: C.green, w: 440 }), a: 14.4, b: 15.5 },
      ];
      this.steps = A.S.steps(el, STEPS, { size: 82 });
      this.corner = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '14px', left: '72px', top: '64px' } }, el, `<div style="width:58px;height:58px;border-radius:16px;background:${C.paper};display:grid;place-items:center"><img src="assets/logo_mark.png" style="width:46px;height:46px"></div><div style="font-size:34px;font-weight:800;letter-spacing:-.03em">AMAZER</div>`);
      // sons
      cue(2.5, 'whoosh', .5); cue(3.3, 'thud', .45); cue(3.35, 'swipe', .3, .3);
      STEPS.forEach(s => cue(s.a - .02, 'tick', .35, -.5));
      SW.forEach(s => cue(s - .12, 'swipe', .55, .35));
      cue(5.4, 'tap', .6, .2); cue(5.5, 'pop', .45, -.2); cue(6.9, 'tap', .6, .3);
      [8.2, 9.6, 10.9].forEach((t, i) => cue(t, i ? 'pop' : 'whoosh', .4, i ? -.3 : .3));
      cue(11.0, 'ding', .55, -.2);
      cue(12.9, 'scan', .25, .2); cue(14.4, 'kaching', .6, -.1); cue(15.3, 'tap', .6, .3);
    },
    seek(t) {
      A.BG.seek(this.bg, t);
      this.hook.seek(t);
      const pp = A.Flow.pose(t, { rise: 2.5, sideAt: 3.25, switches: SW });
      A.Phone.pose(this.ph, { ...pp, o: A.lin(t, 2.5, 2.65) });
      this.ph.root.style.visibility = t >= 2.5 ? 'visible' : 'hidden';
      const fl = this.fl.seek(t), S = fl.scr;
      // 1 · lien copie puis partage WhatsApp
      const copied = t >= 5.4;
      A.$('.js-copyl', S.link).textContent = copied ? 'Lien copié !' : 'Copier mon lien';
      A.$('.js-link', S.link).style.background = `rgba(255,77,0,${(.12 * A.P(t, 5.4, 5.7, E.expoOut) * (1 - A.P(t, 6.6, 7.0, E.cubicOut))).toFixed(3)})`;
      fl.tap(t, 5.4, '.js-copy', 'link'); fl.bounce(t, 5.4, '.js-copy', 'link');
      fl.tap(t, 6.9, '.js-wa', 'link'); fl.bounce(t, 6.9, '.js-wa', 'link');
      // 2 · la conversation : le message part, le commercant repond puis s'inscrit
      ['.js-b1', '.js-b2', '.js-b3'].forEach((sel, i) => {
        const k = A.P(t, [8.2, 9.6, 10.9][i], [8.2, 9.6, 10.9][i] + .4, E.expoOut);
        const b = A.$(sel, S.chat);
        b.style.opacity = k.toFixed(3);
        b.style.transform = `translateY(${((1 - k) * 18).toFixed(1)}px) scale(${(.96 + .04 * k).toFixed(3)})`;
      });
      // 3 · les gains montent, demande de paiement
      A.$('.js-gain', S.wallet).textContent = UI.money(12500 * A.P(t, 12.9, 14.4, E.expoOut));
      A.$$('.js-gl', S.wallet).forEach((r, i) => { const q = A.P(t, 12.4 + i * .1, 12.9 + i * .1, E.expoOut); r.style.opacity = q.toFixed(3); r.style.transform = `translateY(${((1 - q) * 20).toFixed(1)}px)`; });
      fl.tap(t, 15.3, '.js-ask', 'wallet'); fl.bounce(t, 15.3, '.js-ask', 'wallet');
      fl.end();
      this.cards.forEach(c => UI.pop(c.e, t, c.a, c.b, { x: 450 - c.e.offsetWidth / 2, y: 880 - c.e.offsetHeight / 2, z: 90 }));
      this.steps.seek(t);
      this.corner.style.opacity = (A.lin(t, 3.3, 3.6)).toFixed(3);
    },
  };

  const end = A.S.end({ a: WIPE - .15, b: 21.01, freeze: 19.6, wipe: WIPE, cue, tag: 'Recommandez AMAZER,\n*gagnez avec chaque vendeur.*', cta: 'amazer.store/affiliation', ctaSize: 42, foot: 'Gratuit · Sans stock · Sans abonnement' });

  window.FILM = { id: 'pub5', title: 'Gagner avec AMAZER', duration: 21, fps: 60, scenes: [app, end], cues, flashes: [] };
})(window.A);
