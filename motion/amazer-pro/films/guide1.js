/* guide1 — « Acheter sur AMAZER » · ~1 min 43 · voix off + sous-titres (guides/guide1.json)
 * Accueil → recherche → fiche produit (offres) → panier (livraison) → paiement mobile money → suivi → réception.
 */
(function (A) {
  const C = A.C, UI = A.UI;
  const $ = A.$, $$ = A.$$;
  const rise = (els, k0, k) => els.forEach((r, i) => { const q = A.cl((k - k0 - i * .03) / .12); r.style.opacity = q.toFixed(3); r.style.transform = `translateY(${((1 - q) * 20).toFixed(1)}px)`; });

  window.FILM = A.Guide.make({
    id: 'guide1', look: 'nuit',
    title: 'Acheter\n*sur AMAZER*',
    screens: [['home', UI.home()], ['search', UI.search()], ['product', UI.product()], ['cart', UI.cart()], ['pay', UI.pay()], ['track', UI.track()]],
    segs: {
      home: {
        screen: 'home', label: 'Accueil', title: 'Explorez.', sub: 'Toutes les rubriques\nau même endroit.',
        state: (t, S, k) => $$('.js-cat', S.home).forEach((c, i) => { const p = Math.sin(Math.PI * A.cl((k - .25 - i * .08) / .12)); c.style.transform = `scale(${(1 + .08 * p).toFixed(3)})`; }),
        actions: [{ at: .8, card: { icon: 'tag', title: 'Bonnes affaires', sub: 'Les promotions du moment' } }],
      },
      search: {
        screen: 'search', label: 'Rechercher', title: 'Cherchez.', sub: 'Le bon produit\nen quelques lettres.',
        state: (t, S, k) => {
          const n = k < .2 ? 0 : k < .26 ? 1 : k < .32 ? 2 : 3;
          $('.js-q', S.search).textContent = 'riz'.slice(0, n);
          $('.js-caret', S.search).style.opacity = n < 3 || Math.floor(t * 2.4) % 2 === 0 ? 1 : 0;
          $('.js-count', S.search).style.opacity = A.cl((k - .36) / .06).toFixed(3);
          rise($$('.js-res', S.search), .38, k);
        },
        actions: [{ at: .2, cue: 'tick' }, { at: .26, cue: 'tick' }, { at: .32, cue: 'tick' }, { at: .96, tap: '.js-res' }],
      },
      product: {
        screen: 'product', label: 'Comparer', title: 'Comparez.', sub: 'Le meilleur prix\nentre les boutiques.',
        state: (t, S, k) => { $$('.js-offer', S.product)[0].style.boxShadow = `0 0 0 ${(6 * A.cl((k - .35) / .1)).toFixed(1)}px rgba(255,77,0,.14)`; },
        actions: [{ at: .4, card: { icon: 'star', title: 'Meilleur prix', sub: 'Alimentation Baraka · 18 500 F', tone: C.green, hold: 2.4 } }, { at: .9, tap: '.js-addcart' }, { at: .93, card: { icon: 'bag', title: 'Ajouté au panier', sub: 'Riz basmati 25 kg', hold: 1.6 } }],
      },
      cart: {
        screen: 'cart', label: 'Panier', title: 'Choisissez.', sub: 'Livraison Standard\nou Express Niamey.',
        state: (t, S, k) => {
          const exp = k >= .32 ? 1 : 0;
          UI.select($$('.js-opt', S.cart), exp);
          UI.select($$('.js-pay', S.cart), 0);
          $('.js-fee', S.cart).textContent = exp ? '2 000 F' : '1 000 F';
          $('.js-sum', S.cart).textContent = exp ? '20 500 F' : '19 500 F';
          $('.js-sum', S.cart).style.transform = `scale(${(1 + .12 * Math.sin(Math.PI * A.cl((k - .32) / .06))).toFixed(3)})`;
          $('.js-sum', S.cart).style.transformOrigin = '0 50%';
        },
        actions: [{ at: .32, tap: S => $$('.js-opt', S.cart)[1] }, { at: .93, tap: '.js-cmd' }],
      },
      pay: {
        screen: 'pay', label: 'Payer', title: 'Payez.', sub: 'Mobile money,\nen toute sécurité.',
        state: (t, S, k) => {
          const ps = k < .16 ? 0 : k < .3 ? 1 : k < .44 ? 2 : 3;
          UI.payState(S.pay, ps);
          $('.js-pstate', S.pay).style.opacity = ps >= 1 && ps < 3 ? 1 : 0;
        },
        actions: [{ at: .03, card: { icon: 'wallet', title: 'Mobile money', sub: 'Nita · Amana · et bientôt d’autres', hold: 2.2 } }, { at: .2, tap: '.js-start' }, { at: .44, tap: '.js-verify' }, { at: .5, card: { icon: 'wallet', title: 'Paiement confirmé', sub: 'Amana · 20 500 F', tone: C.green } }, { at: .8, card: { icon: 'receipt', title: 'Paiement Nita', sub: 'Référence du transfert saisie', hold: 2 } }],
      },
      safe: {
        screen: 'pay', label: 'Sécurité', title: 'Protégé.', sub: 'La boutique prépare\naprès le paiement.',
        state: (t, S) => UI.payState(S.pay, 3),
        actions: [{ at: .3, card: { icon: 'shield', title: 'Paiement vérifié', sub: 'par l’équipe AMAZER', tone: C.green, hold: 3 } }],
      },
      track: {
        screen: 'track', label: 'Suivi', title: 'Suivez.', sub: 'De la boutique\njusqu’à votre porte.',
        state: (t, S, k) => UI.trackState(S.track, 1 + A.cl((k - .25) / .12) + A.cl((k - .45) / .12) + A.cl((k - .7) / .12)),
        actions: [{ at: .78, card: { icon: 'truck', title: 'En livraison', sub: 'Le livreur AMAZER arrive', hold: 2.2 } }],
      },
      recv: {
        screen: 'track', label: 'Réception', title: 'Recevez.', sub: 'Confirmez, puis\nlaissez un avis.',
        state: (t, S, k) => UI.trackState(S.track, 3 + A.cl((k - .45) / .1)),
        actions: [{ at: .45, tap: '.js-recv' }, { at: .5, card: { icon: 'package', title: 'Commande reçue', sub: 'Merci pour votre achat !', tone: C.green, hold: 1.8 } }, { at: .8, card: { icon: 'star', title: 'Laissez un avis', sub: 'Aidez les autres clients', hold: 2 } }],
      },
    },
    end: { tag: 'Trouvez, payez,\n*recevez chez vous.*' },
  });
})(window.A);
