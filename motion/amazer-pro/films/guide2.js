/* guide2 — « Vendre sur AMAZER » · voix off + sous-titres (guides/guide2.json)
 * Formule → produit publié → commande payée → livreur → revenus → partage de la vitrine.
 */
(function (A) {
  const C = A.C, UI = A.UI;
  const $ = A.$, $$ = A.$$;
  const rise = (els, k0, k) => els.forEach((r, i) => { const q = A.cl((k - k0 - i * .04) / .12); r.style.opacity = q.toFixed(3); r.style.transform = `translateY(${((1 - q) * 20).toFixed(1)}px)`; });

  window.FILM = A.Guide.make({
    id: 'guide2', look: 'creme',
    title: 'Vendre\n*sur AMAZER*',
    screens: [['plans', UI.plans()], ['add', UI.sellAdd()], ['orders', UI.sellOrders()], ['ship', UI.sellShip()], ['money', UI.sellMoney()], ['shop', UI.shop()]],
    segs: {
      signup: {
        screen: 'plans', label: 'Inscription', title: 'Rejoignez.', sub: 'Choisissez votre\nformule.',
        state: (t, S, k) => {
          rise($$('.js-plan', S.plans), .25, k);
          $$('.js-plan', S.plans).forEach((p, i) => { const on = k > .42 + i * .14 && k < .56 + i * .14; p.style.boxShadow = on ? '0 0 0 3px rgba(255,77,0,.35)' : 'none'; });
        },
        actions: [{ at: .95, tap: '.js-open' }],
      },
      add: {
        screen: 'add', label: 'Produits', title: 'Publiez.', sub: 'Photo, nom, prix, stock :\nen ligne tout de suite.',
        state: (t, S, k) => {
          $('.js-photo', S.add).style.opacity = A.cl((k - .1) / .06).toFixed(3);
          UI.typeIn(S.add, 'js-name', 'Lait en poudre 400 g', A.cl((k - .2) / .14), k > .18 && k < .36);
          UI.typeIn(S.add, 'js-price', '3 250', A.cl((k - .38) / .06), k > .36 && k < .46);
          UI.typeIn(S.add, 'js-stock', '40', A.cl((k - .48) / .04), k > .46 && k < .54);
        },
        actions: [{ at: .1, tap: '.js-photo', cue: 'shimmer', g: .3 }, { at: .62, tap: '.js-publish' }, { at: .66, card: { icon: 'store', title: 'Produit publié', sub: 'Visible dans tout le Niger', tone: C.green, hold: 2.4 } }],
      },
      tip: {
        screen: 'add', label: 'Conseil', title: 'Astuce.', sub: 'Lumière du jour,\nfond simple.',
        actions: [{ at: .3, card: { icon: 'camera', title: 'Belles photos', sub: 'Lumière du jour · fond simple', hold: 2.6 } }],
      },
      order: {
        screen: 'orders', label: 'Commandes', title: 'Vendez.', sub: 'Des commandes\ndéjà payées.',
        state: (t, S, k) => {
          const nk = A.cl((k - .08) / .1);
          const nw = $('.js-new', S.orders);
          nw.style.opacity = nk.toFixed(3);
          nw.style.transform = `translateY(${((1 - nk) * -30).toFixed(1)}px)`;
        },
        actions: [{ at: .1, card: { icon: 'bell', title: 'Nouvelle commande', sub: 'Payée · 6 500 F', tone: C.green, hold: 2.4 } }, { at: .55, card: { icon: 'shield', title: 'Paiement vérifié', sub: 'par AMAZER', tone: C.green, hold: 2.2 } }],
      },
      ship: {
        screen: 'ship', label: 'Livraison', title: 'Confiez.', sub: 'Le livreur AMAZER\npasse chercher.',
        state: (t, S, k) => UI.trackState(S.ship, 2 + A.cl((k - .2) / .12) + A.cl((k - .5) / .12)),
        actions: [{ at: .45, tap: '.js-ready' }, { at: .62, card: { icon: 'truck', title: 'Remise au livreur', sub: 'En route vers le client', hold: 2.2 } }],
      },
      money: {
        screen: 'money', label: 'Revenus', title: 'Encaissez.', sub: 'Le prix entier,\nfrais payés par le client.',
        state: (t, S, k) => {
          $('.js-earn', S.money).textContent = UI.money(28000 + 6500 * A.cl((k - .1) / .3));
          rise($$('.js-sale', S.money), .05, k);
        },
        actions: [{ at: .4, cue: 'kaching', g: .45 }, { at: .42, card: { icon: 'wallet', title: '+ 6 500 F', sub: 'Prix entier pour vous', tone: C.green, hold: 2.4 } }],
      },
      share: {
        screen: 'shop', label: 'Partage', title: 'Partagez.', sub: 'Votre vitrine sur\nWhatsApp, Facebook, TikTok.',
        state: (t, S, k) => rise($$('.js-prod', S.shop), .05, k),
        actions: [{ at: .35, card: { icon: 'share', title: 'Lien de la boutique', sub: 'Copié · prêt à partager', hold: 2.4 } }],
      },
    },
    end: { tag: 'Votre boutique en ligne,\n*vos ventes partout.*', cta: 'amazer.store/vendre', ctaSize: 46, foot: 'Boutiques · Restaurants · Hôtels · Transport' },
  });
})(window.A);
