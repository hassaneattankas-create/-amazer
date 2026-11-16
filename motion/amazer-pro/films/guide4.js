/* guide4 — « Pharmacies de garde et stations » · voix off + sous-titres (guides/guide4.json) */
(function (A) {
  const C = A.C, UI = A.UI;
  const $$ = A.$$;
  const rise = (els, k0, k) => els.forEach((r, i) => { const q = A.cl((k - k0 - i * .05) / .12); r.style.opacity = q.toFixed(3); r.style.transform = `translateY(${((1 - q) * 22).toFixed(1)}px)`; });

  window.FILM = A.Guide.make({
    id: 'guide4', look: 'vert',
    title: 'Pharmacies\n*et stations*',
    screens: [['pharma', UI.pharma()], ['stations', UI.stations()], ['gerant', UI.gerant()]],
    segs: {
      pharma: {
        screen: 'pharma', label: 'Pharmacies', title: 'De garde.', sub: 'La liste officielle\nde la semaine.',
        state: (t, S, k) => rise($$('.js-svc', S.pharma), .15, k),
        actions: [{ at: .6, card: { icon: 'clock', title: 'De garde cette nuit', sub: 'Liste officielle · source affichée', tone: C.green, hold: 2.6 } }],
      },
      pharma2: {
        screen: 'pharma', label: 'Pharmacies', title: 'De garde.', sub: 'La liste officielle\nde la semaine.',
        actions: [{ at: .32, tap: S => $$('.js-call', S.pharma)[0] }, { at: .55, tap: S => $$('.js-route', S.pharma)[0] }, { at: .6, card: { icon: 'pin', title: 'Itinéraire ouvert', sub: 'Google Maps · 1,2 km', hold: 2.2 } }],
      },
      stations: {
        screen: 'stations', label: 'Stations', title: 'Le plein.', sub: 'Super, gasoil, gaz :\nqui en a, maintenant.',
        state: (t, S, k) => {
          rise($$('.js-svc', S.stations), .12, k);
          $$('.js-svc', S.stations)[0].style.boxShadow = `0 0 0 ${(6 * A.cl((k - .55) / .1)).toFixed(1)}px rgba(31,132,85,.18)`;
        },
        actions: [{ at: .62, card: { icon: 'check', title: 'Super disponible', sub: 'Mis à jour il y a 12 min', tone: C.green, hold: 2.4 } }],
      },
      fresh: {
        screen: 'stations', label: 'Stations', title: 'À jour.', sub: 'Trop ancien ?\nAppelez pour confirmer.',
        actions: [{ at: .55, card: { icon: 'alert', title: 'Non confirmé', sub: 'Information trop ancienne', tone: '#B7791F', hold: 2.4 } }],
      },
      gas: {
        screen: 'stations', label: 'Stations', title: 'Gaz livré.', sub: 'À Niamey,\npar AMAZER.',
        actions: [{ at: .2, card: { icon: 'truck', title: 'Gaz livré', sub: 'Par AMAZER, à Niamey', hold: 2.4 } }, { at: .7, card: { icon: 'flame', title: 'Signaler une erreur', sub: 'La station est prévenue', hold: 2.2 } }],
      },
      manager: {
        screen: 'gerant', label: 'Gérant', title: 'Mettez à jour.', sub: 'En un geste,\ndepuis la station.',
        state: (t, S, k) => UI.gerantState(S.gerant, k > .2),
        actions: [{ at: .2, tap: S => A.$('.js-ggasoil .js-g0', S.gerant) }, { at: .36, tap: '.js-gsame' }, { at: .8, card: { icon: 'trend', title: 'Rapport du mois', sub: '412 itinéraires · 138 appels', tone: C.green, hold: 2.4 } }],
      },
    },
    end: { tag: 'Pharmacies de garde et essence,\n*en un coup d’œil.*', foot: 'Pharmacies · Stations-essence · Gaz livré' },
  });
})(window.A);
