/* guide3 — « Restaurants, hôtels et transport » · voix off + sous-titres (guides/guide3.json) */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI, I = A.icon;
  const $ = A.$, $$ = A.$$;

  window.FILM = A.Guide.make({
    id: 'guide3', look: 'orange',
    title: 'Repas, hôtels\n*et transport*',
    screens: [['resto', UI.resto()], ['hotel', UI.hotel()], ['ticket', UI.ticket()]],
    segs: {
      resto: {
        screen: 'resto', label: 'Restaurant', title: 'Commandez.', sub: 'Menu, photos, prix\net plat du jour.',
        state: (t, S, k) => {
          $$('.js-dadd', S.resto).forEach((a, i) => {
            const on = k > [.6, .78][i];
            if (i > 1) return;
            a.style.background = on ? C.green : C.navy;
            a.innerHTML = I(on ? 'check' : 'plus', { size: 16, color: '#fff', sw: 2.6 });
          });
        },
        actions: [{ at: .6, tap: S => $$('.js-dadd', S.resto)[0] }, { at: .78, tap: S => $$('.js-dadd', S.resto)[1] }],
      },
      resto2: {
        screen: 'resto', label: 'Restaurant', title: 'Commandez.', sub: 'Menu, photos, prix\net plat du jour.',
        state: (t, S, k) => {
          const segs = $$('.js-seg', S.resto);
          [.25, .38, .52].forEach((a, i) => { if (segs[i]) segs[i].style.width = (A.cl((k - a) / .1) * 100).toFixed(1) + '%'; });
          $('.js-tstate', S.resto).innerHTML = k < .55 ? UI.chip('En cuisine', { bg: C.peach, color: C.orangeDeep, dot: true }) : UI.chip('En livraison', { dot: true });
        },
        actions: [{ at: .15, card: { icon: 'wallet', title: 'Paiement confirmé', sub: 'Mobile money', tone: C.green, hold: 2 } }, { at: .78, card: { icon: 'calendar', title: 'Table réservée', sub: 'Samedi · 20 h · 4 personnes', hold: 2.4 } }],
      },
      hotel: {
        screen: 'hotel', label: 'Hôtel', title: 'Réservez.', sub: 'Vos dates,\nvotre chambre.',
        state: (t, S, k) => $$('.js-day', S.hotel).forEach(d => {
          const n = +d.dataset.d, start = k > .3 && n === 18, end = k > .5 && n === 20, mid = k > .5 && n === 19;
          d.style.background = start || end ? C.orange : mid ? C.peach : 'transparent';
          d.style.color = start || end ? '#fff' : n < 17 ? '#CBD5E1' : C.navy;
        }),
        actions: [{ at: .3, tap: S => $$('.js-day', S.hotel)[17] }, { at: .5, tap: S => $$('.js-day', S.hotel)[19] }, { at: .78, card: { icon: 'bed', title: '2 nuits', sub: 'Prix total affiché', hold: 2 } }],
      },
      hotel2: {
        screen: 'hotel', label: 'Hôtel', title: 'Réservez.', sub: 'Vos dates,\nvotre chambre.',
        state: (t, S) => $$('.js-day', S.hotel).forEach(d => {
          const n = +d.dataset.d, sel = n === 18 || n === 20;
          d.style.background = sel ? C.orange : n === 19 ? C.peach : 'transparent';
          d.style.color = sel ? '#fff' : n < 17 ? '#CBD5E1' : C.navy;
        }),
        actions: [{ at: .2, tap: '.js-book' }, { at: .26, card: { icon: 'check', title: 'Réservation envoyée', sub: 'Acompte possible selon l’hôtel', tone: C.green, hold: 2.6 } }],
      },
      ticket: {
        screen: 'ticket', label: 'Transport', title: 'Voyagez.', sub: 'Trajet, date,\nplace dans le car.',
        actions: [{ at: .55, card: { icon: 'bus', title: 'Niamey → Maradi', sub: 'Samedi 17 oct. · place 14', hold: 2.6 } }],
      },
      ticket2: {
        screen: 'ticket', label: 'Transport', title: 'Voyagez.', sub: 'Trajet, date,\nplace dans le car.',
        state: (t, S, k) => {
          const scan = $('.js-scan', S.ticket), sk = A.cl((k - .45) / .2);
          scan.style.top = (20 + 186 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * sk))).toFixed(1) + 'px';
          scan.style.opacity = sk > 0 && sk < 1 ? 1 : 0;
          const v = $('.js-valid', S.ticket), vk = E.spring(A.cl((k - .66) / .1));
          v.style.opacity = A.cl((k - .66) / .03).toFixed(3);
          v.style.transform = `translateY(${((1 - vk) * 20).toFixed(1)}px) scale(${A.mix(.9, 1, vk).toFixed(3)})`;
        },
        actions: [{ at: .45, cue: 'scan', g: .3 }, { at: .66, cue: 'beep', g: .4 }, { at: .68, card: { icon: 'qr', title: 'Billet validé', sub: 'Bon voyage !', tone: C.green, hold: 2 } }],
      },
    },
    end: { tag: 'Repas, chambres et billets,\n*tout est sur AMAZER.*', foot: 'Restaurants · Hôtels · Transport' },
  });
})(window.A);
