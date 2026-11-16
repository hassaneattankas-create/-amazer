/* guide5 — « Gagner de l'argent avec AMAZER » (affiliation, revente sans stock) · voix off + sous-titres */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI;
  const $ = A.$, $$ = A.$$;
  const rise = (els, k0, k) => els.forEach((r, i) => { const q = A.cl((k - k0 - i * .05) / .12); r.style.opacity = q.toFixed(3); r.style.transform = `translateY(${((1 - q) * 20).toFixed(1)}px)`; });

  window.FILM = A.Guide.make({
    id: 'guide5', look: 'sable', titleSize: 100,
    title: 'Gagner de l’argent\n*avec AMAZER*',
    screens: [['link', UI.affLink()], ['chat', UI.affChat()], ['wallet', UI.affWallet()], ['resell', UI.resell()]],
    segs: {
      aff1: {
        screen: 'link', label: 'Affiliation', title: 'Votre lien.', sub: 'Gratuit, sans stock,\nsans abonnement.',
        state: (t, S, k) => { $('.js-copyl', S.link).textContent = k > .85 ? 'Lien copié !' : 'Copier mon lien'; },
        actions: [{ at: .85, tap: '.js-copy' }, { at: .88, card: { icon: 'copy', title: 'Lien copié', sub: 'amazer.store/?ref=FATI24', hold: 1.8 } }],
      },
      aff2: {
        screen: 'chat', label: 'Affiliation', title: 'Partagez.', sub: 'Des messages\nprêts à envoyer.',
        state: (t, S, k) => ['.js-b1', '.js-b2', '.js-b3'].forEach((sel, i) => {
          const q = A.cl((k - [.12, .5, .75][i]) / .08);
          const b = $(sel, S.chat);
          b.style.opacity = q.toFixed(3);
          b.style.transform = `translateY(${((1 - q) * 18).toFixed(1)}px)`;
        }),
        actions: [{ at: .12, cue: 'whoosh', g: .3 }, { at: .5, cue: 'pop', g: .35 }, { at: .75, cue: 'pop', g: .35 }],
      },
      aff3: {
        screen: 'wallet', label: 'Affiliation', title: 'Gagnez.', sub: 'Abonnements des vendeurs\net bonus clients.',
        state: (t, S, k) => {
          $('.js-gain', S.wallet).textContent = UI.money(12500 * E.expoOut(A.cl((k - .15) / .4)));
          rise($$('.js-gl', S.wallet), .1, k);
        },
        actions: [{ at: .35, card: { icon: 'store', title: 'Vendeur inscrit', sub: 'Une part de ses abonnements', tone: C.green, hold: 2.4 } }, { at: .75, card: { icon: 'gift', title: 'Bonus client', sub: '1re commande livrée', tone: C.green, hold: 2.2 } }],
      },
      aff4: {
        screen: 'wallet', label: 'Affiliation', title: 'Retirez.', sub: 'Nita, Amana,\nAirtel ou Moov.',
        actions: [{ at: .35, tap: '.js-ask' }, { at: .4, cue: 'kaching', g: .45 }, { at: .42, card: { icon: 'wallet', title: 'Paiement demandé', sub: 'Nita · Amana · Airtel · Moov', hold: 2.2 } }],
      },
      resell1: {
        screen: 'resell', label: 'Revente', title: 'Revendez.', sub: 'Sans stock :\nvous fixez votre marge.',
        state: (t, S, k) => {
          rise($$('.js-ritem', S.resell), .15, k);
          $$('.js-rprice', S.resell).forEach((p, i) => { p.style.background = k > .65 + i * .06 && k < .8 + i * .06 ? C.peach : 'transparent'; p.style.borderRadius = '6px'; p.style.padding = '0 4px'; });
        },
        actions: [{ at: .7, card: { icon: 'tag', title: 'Votre prix', sub: 'Prix boutique + votre marge', hold: 2.4 } }],
      },
      resell2: {
        screen: 'resell', label: 'Revente', title: 'Encaissez.', sub: 'La boutique prépare,\nAMAZER livre.',
        actions: [{ at: .15, tap: '.js-rshare' }, { at: .5, card: { icon: 'truck', title: 'Livré par AMAZER', sub: 'La boutique a préparé', hold: 2 } }, { at: .78, cue: 'kaching', g: .45 }, { at: .8, card: { icon: 'coins', title: '+ 2 500 F', sub: 'Votre marge', tone: C.green, hold: 2.2 } }],
      },
    },
    end: { tag: 'Partagez, recommandez,\n*gagnez avec AMAZER.*', cta: 'amazer.store/affiliation', ctaSize: 42, foot: 'Affiliation · Revente sans stock' },
  });
})(window.A);
