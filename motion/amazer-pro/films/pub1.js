/* pub1 — « AMAZER, la marque » · 30 s · 1080×1080 · 60 i/s
 * Concept : le chaos des messages se range d'un coup dans AMAZER.
 *  A  0.00– 4.45  Chaos : messages, appels manqués, cahier — « Tout se perd entre les messages. »
 *  B  4.30–20.45  Logo → téléphone ; quatre métiers en vraies interfaces (boutique, restaurant, hôtel, car)
 *  D 20.15–25.30  Confiance : grille (paiement, livraison suivie, avis vérifiés), entrée par balayage orange
 *  E 24.95–30.00  Fin : logo, promesse, amazer.store (image fixe à partir de 28.6)
 */
(function (A) {
  const C = A.C, E = A.E, UI = A.UI, I = A.icon;
  const cues = [];
  const cue = (t, s, g = .6, p = 0) => cues.push({ t: +t.toFixed(3), s, g, p });

  /* =====================================================================
   * A — CHAOS
   * ===================================================================== */
  const MSGS = [
    // x, y, z, texte, type, apparition
    [250, 170, -180, 'C’est encore disponible ?', 'msg', .10],
    [800, 250, -60, 'Vous livrez à Yantala ?', 'msg', .28],
    [190, 330, 80, 'Appel manqué (3)', 'call', .44],
    [860, 120, -420, 'Prix du riz 25 kg ?', 'msg', .58],
    [300, 760, 40, 'Il reste une chambre ce soir ?', 'msg', .70],
    [760, 800, -140, 'Le car part à quelle heure ?', 'msg', .84],
    [560, 960, -380, 'J’ai envoyé l’argent, vous avez vu ?', 'msg', .98],
    [870, 330, 120, 'Appel manqué (5)', 'call', 1.10],
    [950, 1000, -260, 'Cahier · page 47', 'note', 1.22],
    [640, 110, 60, 'Ma commande est où ?', 'msg', 1.34],
    [150, 90, -520, 'Envoyez la photo svp', 'msg', 1.46],
    [200, 890, -480, 'Vous êtes ouverts ?', 'msg', 1.58],
    [420, 250, -620, 'Deux places pour Zinder', 'msg', 1.70],
    [1010, 290, -100, '+99', 'badge', 1.82],
  ];
  const SUCK = 3.25;
  const sceneA = {
    id: 'chaos', a: 0, b: 4.45,
    build(el) {
      el.classList.add('p3d');
      this.bg = A.BG.dark(el, { x1: 260, y1: -300 });
      this.world = A.el('div', { cls: 'w3d' }, el);
      this.items = MSGS.map(([x, y, z, txt, type, t0], i) => {
        let html;
        if (type === 'msg') html = `<div style="display:flex;align-items:flex-end;gap:12px"><div style="width:46px;height:46px;border-radius:23px;flex:none;background:${['#FDBA74', '#93C5FD', '#FCA5A5', '#86EFAC', '#C4B5FD'][i % 5]};display:grid;place-items:center;color:${C.navy};font-weight:800;font-size:20px">${'AMFIZSKH'[i % 8]}</div>
          <div style="background:#fff;color:${C.navy};border-radius:24px 24px 24px 6px;padding:14px 20px 12px;box-shadow:0 20px 40px -18px rgba(0,0,0,.6)"><div style="font-size:27px;font-weight:600;letter-spacing:-.015em;white-space:nowrap">${txt}</div><div style="font-size:15px;color:#94A3B8;text-align:right;margin-top:2px;font-weight:600">10:${(12 + i * 3) % 60}</div></div></div>`;
        else if (type === 'call') html = `<div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,.14);border:1.5px solid rgba(248,113,113,.55);color:#FECACA;border-radius:99px;padding:12px 22px 12px 14px;font-size:26px;font-weight:700;white-space:nowrap"><span style="width:40px;height:40px;border-radius:20px;background:#EF4444;display:grid;place-items:center">${I('missed', { size: 22, color: '#fff' })}</span>${txt}</div>`;
        else if (type === 'note') html = `<div style="width:230px;height:150px;border-radius:14px;background:#FEF9C3;color:#713F12;padding:16px 18px;box-shadow:0 20px 40px -18px rgba(0,0,0,.6);background-image:repeating-linear-gradient(#FEF9C3 0 30px,#FDE68A 30px 32px);font-size:22px;font-weight:700"><div style="display:flex;gap:8px;align-items:center">${I('notebook', { size: 22, color: '#713F12' })}${txt}</div><div style="margin-top:14px;font:600 20px Geist;color:#B91C1C;text-decoration:line-through">Moussa 2 sacs riz</div><div style="font:600 20px Geist;color:#92400E">Awa ?? payé ou pas</div></div>`;
        else html = `<div style="width:120px;height:120px;border-radius:60px;background:${C.orange};display:grid;place-items:center;font-size:44px;font-weight:800;box-shadow:0 0 60px rgba(255,77,0,.6)">${txt}</div>`;
        const e = A.el('div', { cls: 'abs' }, this.world, html);
        return { e, x, y, z, t0, i, seed: A.rand(i * 97 + 5)() };
      });
      // voile sombre au centre pour la lisibilité du titre
      this.veil = A.el('div', { cls: 'abs', style: { left: '90px', top: '360px', width: '900px', height: '360px', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(7,11,20,.92) 0%,rgba(7,11,20,.7) 45%,rgba(7,11,20,0) 72%)' } }, el);
      this.h1 = A.Type.make(el, 'Tout se perd\n*entre les messages.*', { size: 92, weight: 800, align: 'center' });
      MSGS.forEach(m => cue(m[5] + .02, m[4] === 'call' ? 'buzz' : 'pop', m[4] === 'badge' ? .7 : .42, (m[0] - 540) / 600));
      cue(SUCK - .15, 'suck', .9);
    },
    seek(t) {
      A.BG.seek(this.bg, t);
      const camZ = A.P(t, 0, SUCK, E.sine) * 240;
      const ry = A.mix(-5, 5, A.P(t, 0, 4, E.sine));
      this.world.style.transform = `translateZ(${camZ.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${(A.wob(t, 1, .4) * 1.5).toFixed(2)}deg)`;
      this.world.style.transformOrigin = '540px 540px';
      this.items.forEach(it => {
        const k = A.P(t, it.t0, it.t0 + .6, x => E.spring(x, 3.6, 6));
        const s = A.P(t, SUCK + it.seed * .25, SUCK + .55 + it.seed * .25, E.expoIn);
        const drift = A.wob(t, it.i, .5);
        const x = A.mix(it.x + drift * 10, 540, s), y = A.mix(it.y + A.wob(t, it.i + 3, .45) * 12, 540, s);
        const zf = it.z + camZ;
        const blur = Math.min(5, Math.abs(zf) / 120) + s * 8;
        A.T(it.e, { x, y, z: A.mix(it.z, 0, s), c: true, r: drift * 3 + s * (it.seed > .5 ? 120 : -120), s: Math.max(.001, A.mix(.5, 1, k) * (1 - s * .9)), o: A.lin(t, it.t0, it.t0 + .1) * (1 - A.P(t, SUCK + .3 + it.seed * .25, SUCK + .6 + it.seed * .25)), blur });
      });
      A.Type.place(this.h1, 540, 540);
      A.Type.play(this.h1, t, 1.0, SUCK - .2, { stagger: .07, dur: .6 });
      this.veil.style.opacity = (A.P(t, .9, 1.5) * (1 - A.P(t, SUCK - .2, SUCK + .2))).toFixed(3);
    },
  };

  /* =====================================================================
   * B — LOGO → TÉLÉPHONE → QUATRE MÉTIERS
   * ===================================================================== */
  const SW = [7.65, 10.85, 14.05, 17.25];            // changements d'écran
  const FEAT = [
    { icon: 'store', label: 'Boutiques', key: 'Vendez.', sub: 'Votre boutique en ligne,\ncommandes en direct.', a: 7.25, b: 10.75 },
    { icon: 'utensils', label: 'Restaurants', key: 'Cuisinez.', sub: 'Menu, commandes\net suivi en cuisine.', a: 10.95, b: 13.95 },
    { icon: 'bed', label: 'Hôtels', key: 'Réservez.', sub: 'Chambres et dates,\nsans double réservation.', a: 14.15, b: 17.15 },
    { icon: 'bus', label: 'Transport', key: 'Voyagez.', sub: 'Billets et places,\nvalidés par QR code.', a: 17.35, b: 20.05 },
  ];
  const posIn = (e, stop) => { let x = 0, y = 0; while (e && e !== stop) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y }; };
  const center = (e, stop) => { const p = posIn(e, stop); return { x: p.x + e.offsetWidth / 2, y: p.y + e.offsetHeight / 2 }; };

  const sceneB = {
    id: 'app', a: 4.3, b: 20.45,
    build(el) {
      el.classList.add('p3d');
      this.bg = A.BG.dark(el, { x1: 300, y1: -200, x2: -200, y2: 320 });
      this.world = A.el('div', { cls: 'w3d' }, el);
      // logo + onde de choc
      this.ring = A.el('div', { cls: 'abs', style: { width: '200px', height: '200px', borderRadius: '50%', border: `3px solid ${C.orange}`, boxShadow: `0 0 40px rgba(255,77,0,.6)` } }, el);
      this.lock = A.el('div', { cls: 'abs', style: { zIndex: 5, display: 'flex', alignItems: 'center', gap: '28px', transformOrigin: '0 50%' } }, el);
      this.logo = A.el('div', { style: { width: '190px', height: '190px', borderRadius: '50px', background: C.paper, display: 'grid', placeItems: 'center', boxShadow: '0 30px 80px -20px rgba(255,77,0,.55)', flex: 'none' } }, this.lock, `<img src="assets/logo_mark.png" style="width:150px;height:150px">`);
      const wm = A.el('div', { style: { overflow: 'hidden', padding: '0 .04em .1em' } }, this.lock);
      this.word = A.el('div', { style: { fontSize: '128px', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 } }, wm, 'AMAZER');
      // téléphone
      this.ph = A.Phone.make(this.world);
      const P = A.Phone;
      this.scr = { home: P.screen(this.ph, 'home', UI.home()), shop: P.screen(this.ph, 'shop', UI.shop()), resto: P.screen(this.ph, 'resto', UI.resto()), hotel: P.screen(this.ph, 'hotel', UI.hotel()), ticket: P.screen(this.ph, 'ticket', UI.ticket()) };
      this.order = ['home', 'shop', 'resto', 'hotel', 'ticket'];
      this.tapEl = UI.tap(this.ph.screen);
      // cartes flottantes
      this.cards = [
        { e: UI.card(this.world, { icon: 'bag', title: 'Nouvelle commande', sub: 'Alimentation Baraka · 2 articles', right: '21 750 F', w: 560 }), a: 9.85, b: 10.7, x: 470, y: 880 },
        { e: UI.card(this.world, { icon: 'bike', title: 'En livraison', sub: 'Chez Mariama · commande #A7F2', tone: C.green, w: 500 }), a: 13.05, b: 13.9, x: 420, y: 880 },
        { e: UI.card(this.world, { icon: 'bed', title: 'Réservation confirmée', sub: 'Chambre double · 18 → 20 oct.', tone: C.green, w: 540 }), a: 16.3, b: 17.1, x: 440, y: 880 },
        { e: UI.card(this.world, { icon: 'check', title: 'Billet validé', sub: 'Niamey → Maradi · Siège 14', tone: C.green, w: 500 }), a: 19.15, b: 20.4, x: 430, y: 880 },
      ];
      // textes à gauche
      this.feats = FEAT.map(f => {
        const g = A.el('div', { cls: 'abs', style: { left: '72px', top: '0' } }, el);
        const lab = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '12px', height: '54px', padding: '0 22px 0 14px', borderRadius: '99px', background: 'rgba(255,77,0,.14)', border: '1.5px solid rgba(255,122,26,.45)', color: C.orange2, fontSize: '26px', fontWeight: 700, whiteSpace: 'nowrap', top: '290px' } }, g, `${I(f.icon, { size: 28, color: C.orange2 })}${f.label}`);
        const key = A.Type.make(g, f.key, { size: 96, weight: 800 });
        key.el.style.top = '372px';
        const sub = A.Type.make(g, f.sub, { size: 36, weight: 500, color: '#CBD5E1', lh: 1.28, track: -.015 });
        sub.el.style.top = '500px';
        return { f, g, lab, key, sub };
      });
      // logo en coin pendant la démonstration
      this.corner = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '14px', left: '72px', top: '64px' } }, el, `<div style="width:58px;height:58px;border-radius:16px;background:${C.paper};display:grid;place-items:center"><img src="assets/logo_mark.png" style="width:46px;height:46px"></div><div style="font-size:34px;font-weight:800;letter-spacing:-.03em">AMAZER</div>`);

      // sons
      cue(4.38, 'impact', .9); cue(4.4, 'shimmer', .5); cue(4.78, 'whoosh', .35, .2);
      cue(5.3, 'whoosh', .4, -.4); cue(5.65, 'whoosh', .5); cue(6.2, 'thud', .5);
      cue(6.7, 'swipe', .35, .3);
      FEAT.forEach(f => { cue(f.a - .02, 'tick', .35, -.5); });
      SW.forEach(s => cue(s - .12, 'swipe', .55, .35));
      cue(7.3, 'tap', .6, .3);
      cue(8.85, 'tap', .6, .2); cue(8.9, 'pop', .3, .2); cue(9.3, 'tap', .6, .4); cue(9.35, 'pop', .3, .4); cue(9.6, 'tap', .6, .3);
      cue(9.85, 'ding', .7, -.2);
      cue(11.6, 'tick', .4, .3); cue(12.25, 'tick', .4, .3); cue(12.95, 'tick', .4, .3); cue(13.05, 'ding', .7, -.2);
      cue(15.0, 'tap', .6, .4); cue(15.45, 'tap', .6, .2); cue(16.0, 'tap', .6, .3); cue(16.3, 'ding', .7, -.2);
      cue(18.2, 'scan', .55, .3); cue(19.1, 'beep', .6, .3); cue(19.15, 'ding', .6, -.2);
    },
    phonePose(t) {
      const rise = A.P(t, 5.6, 6.6, E.expoOut);
      const side = A.P(t, 6.6, 7.35, E.cubicInOut);
      let x = A.mix(540, 748, side), y = A.mix(1560, 590, rise);
      let ry = A.mix(-4, -17, side) + A.wob(t, 2, .5) * 2.2, rx = A.mix(42, 6, rise) + A.wob(t, 5, .45) * 1.2;
      let s = A.mix(1.0, .93, side);
      // coup de fouet à chaque changement d'écran
      SW.forEach(w => { const k = A.lin(t, w - .25, w + .45); const b = Math.sin(Math.PI * k); ry += -11 * b; x += -14 * b; s *= 1 - .03 * b; });
      y += A.wob(t, 7, .6) * 6;
      return { x, y, ry, rx, s };
    },
    seek(t) {
      A.BG.seek(this.bg, t);
      // --- logo (4.3 → 5.6) ---
      const lk = A.P(t, 4.35, 4.95, x => E.spring(x, 3.4, 6));
      const wk = A.P(t, 4.75, 5.25, E.expoOut);
      const fly = A.P(t, 5.25, 5.85, E.expoInOut);
      const lockW = 190 + 28 + this.word.offsetWidth * wk;
      const lx = A.mix(540 - lockW / 2, 72, fly), ly = A.mix(540 - 95, 64 - 95 * .305 + 29 - 29, fly);
      A.T(this.lock, { x: lx, y: A.mix(540 - 95, 64 - 66, fly), s: A.mix(Math.max(.001, lk), .305, fly), o: 1 - A.lin(t, 5.7, 5.86) });
      this.word.style.transform = `translateY(${((1 - wk) * 110).toFixed(1)}%)`;
      this.lock.style.visibility = t < 5.86 ? 'visible' : 'hidden';
      const rk = A.P(t, 4.38, 5.2, E.expoOut);
      A.T(this.ring, { x: 540 - 100, y: 540 - 100, s: .6 + rk * 3.2, o: (1 - rk) * A.lin(t, 4.36, 4.4) });
      this.corner.style.opacity = A.lin(t, 5.78, 5.86).toFixed(3);
      // --- téléphone ---
      const pp = this.phonePose(t);
      A.Phone.pose(this.ph, { ...pp, o: A.lin(t, 5.6, 5.75) });
      // écrans : poussée type iOS
      this.order.forEach((n, i) => {
        const e = this.scr[n];
        const tin = i === 0 ? -1 : SW[i - 1], tout = i < SW.length ? SW[i] : 1e9;
        const kin = A.P(t, tin - .2, tin + .3, E.expoInOut), kout = A.P(t, tout - .2, tout + .3, E.expoInOut);
        const vis = t >= tin - .2 && t < tout + .3;
        e.style.display = vis ? 'block' : 'none';
        if (!vis) return;
        const x = i === 0 ? -kout * 120 : (1 - kin) * 390 - kout * 120;
        e.style.transform = `translateX(${x.toFixed(1)}px)`;
        e.style.zIndex = i;
        e.style.filter = kout > .01 ? `brightness(${(1 - kout * .35).toFixed(3)})` : 'none';
        e.style.boxShadow = kin < 1 && i > 0 ? '-20px 0 40px rgba(0,0,0,.18)' : 'none';
      });
      A.Phone.statusTone(this.ph, false);
      this.interactions(t);
      // cartes
      this.cards.forEach(c => UI.pop(c.e, t, c.a, c.b, { x: c.x - c.e.offsetWidth / 2, y: c.y - c.e.offsetHeight / 2, z: 90 }));
      // textes
      this.feats.forEach(({ f, lab, key, sub }) => {
        const k = A.P(t, f.a, f.a + .5, E.expoOut), q = A.P(t, f.b - .05, f.b + .25, E.expoIn);
        A.T(lab, { x: 0, y: (1 - k) * 24 - q * 20, s: A.mix(.9, 1, k), o: A.lin(t, f.a, f.a + .15) * (1 - q) });
        lab.style.top = '290px';
        A.Type.play(key, t, f.a + .08, f.b - .05, { stagger: .05, dur: .55 });
        A.Type.play(sub, t, f.a + .25, f.b - .05, { stagger: .03, dur: .5, tilt: 0 });
      });
    },
    interactions(t) {
      const tap = (a, el, scr) => { const p = center(el, this.scr[scr]); UI.tapAt(this.tapEl, t, a, p.x + (parseFloat(this.scr[scr].style.transform?.match(/-?[\d.]+/)?.[0]) || 0), p.y); };
      let tapped = false;
      const tapIf = (a, el, scr) => { if (!tapped && t > a - .2 && t < a + .5) { tap(a, el, scr); tapped = true; } };
      // accueil : on touche « Boutiques »
      const cat = A.$('.js-cat', this.scr.home);
      tapIf(7.3, cat.firstElementChild, 'home');
      // boutique : deux ajouts puis « Commander »
      const adds = A.$$('.js-add', this.scr.shop);
      tapIf(8.85, adds[0], 'shop'); tapIf(9.3, adds[1], 'shop'); tapIf(9.6, A.$('.js-order', this.scr.shop), 'shop');
      const n = t < 8.85 ? 0 : t < 9.3 ? 1 : 2;
      A.$('.js-count', this.scr.shop).textContent = n === 0 ? 'Panier vide' : n === 1 ? '1 article' : '2 articles';
      A.$('.js-total', this.scr.shop).textContent = n === 0 ? '0 F' : n === 1 ? '18 500 F' : '21 750 F';
      adds.forEach((a, i) => { const on = n > i; a.style.background = on ? C.green : C.navy; a.innerHTML = I(on ? 'check' : 'plus', { size: 16, color: '#fff', sw: 2.6 }); a.style.transform = `scale(${(1 + .25 * Math.sin(Math.PI * A.lin(t, [8.85, 9.3][i] ?? 99, ([8.85, 9.3][i] ?? 99) + .3))).toFixed(3)})`; });
      // restaurant : progression de la commande
      const segs = A.$$('.js-seg', this.scr.resto);
      [11.0, 11.6, 12.25, 12.95].forEach((a, i) => { if (segs[i]) segs[i].style.width = (i === 3 ? 0 : A.P(t, a, a + .5, E.cubicOut) * 100).toFixed(1) + '%'; });
      A.$('.js-tstate', this.scr.resto).innerHTML = t < 12.95 ? UI.chip('En cuisine', { bg: C.peach, color: C.orangeDeep, dot: true }) : UI.chip('En livraison', { dot: true });
      // hôtel : 18 → 20 octobre
      const days = A.$$('.js-day', this.scr.hotel);
      days.forEach(d => {
        const n = +d.dataset.d;
        const start = t >= 15.0 && n === 18, end = t >= 15.45 && n === 20, mid = t >= 15.45 && n === 19;
        d.style.background = start || end ? C.orange : mid ? C.peach : 'transparent';
        d.style.color = start || end ? '#fff' : n < 17 ? '#CBD5E1' : C.navy;
      });
      tapIf(15.0, days[17], 'hotel'); tapIf(15.45, days[19], 'hotel'); tapIf(16.0, A.$('.js-book', this.scr.hotel), 'hotel');
      // billet : balayage puis validation
      const scan = A.$('.js-scan', this.scr.ticket);
      const sk = A.lin(t, 18.2, 19.0);
      scan.style.top = (20 + 186 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * sk))).toFixed(1) + 'px';
      scan.style.opacity = (sk > 0 && sk < 1 ? 1 : 0).toString();
      const v = A.$('.js-valid', this.scr.ticket);
      const vk = A.P(t, 19.05, 19.5, x => E.spring(x));
      v.style.opacity = A.lin(t, 19.05, 19.15).toFixed(3);
      v.style.transform = `translateY(${((1 - vk) * 20).toFixed(1)}px) scale(${A.mix(.9, 1, vk).toFixed(3)})`;
      if (!tapped) this.tapEl.style.opacity = 0;
    },
  };

  /* =====================================================================
   * D — CONFIANCE (grille)
   * ===================================================================== */
  const WIPE = 20.15;
  const sceneD = {
    id: 'trust', a: WIPE, b: 25.3,
    build(el) {
      this.bg = A.BG.light(el);
      this.h = A.Type.make(el, 'En toute *confiance.*', { size: 84, weight: 800, color: C.navy });
      const tile = (x, y, w, h) => A.el('div', { cls: 'abs', style: { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: '36px', background: '#fff', border: '1px solid rgba(226,232,240,.9)', boxShadow: '0 40px 80px -40px rgba(15,23,42,.35), 0 12px 24px -16px rgba(15,23,42,.2)', overflow: 'hidden', transformOrigin: '50% 50%', color: C.navy } }, el);
      // paiement
      this.t1 = tile(72, 300, 452, 660);
      this.t1.innerHTML = `<div style="padding:36px 34px">
        <div style="width:72px;height:72px;border-radius:22px;background:${C.orange};display:grid;place-items:center">${I('wallet', { size: 36, color: '#fff' })}</div>
        <div style="font-size:42px;font-weight:800;letter-spacing:-.03em;margin-top:24px;line-height:1.05">Paiement<br>Nita · Amana</div>
        <div style="font-size:28px;color:${C.mute};font-weight:500;margin-top:12px;line-height:1.3">Chaque paiement est<br>vérifié avant l’envoi.</div></div>
        <div class="js-rc" style="position:absolute;left:34px;top:420px;width:384px;border-radius:26px;background:${C.mist};padding:22px 24px">
          <div style="display:flex;justify-content:space-between;font-size:22px;color:${C.mute};font-weight:600"><span>Commande #B91C</span><span>Nita</span></div>
          <div style="font-size:46px;font-weight:800;letter-spacing:-.03em;margin-top:6px">21 750 F</div>
          <div class="js-paid" style="display:flex;align-items:center;gap:10px;margin-top:12px;height:52px;border-radius:16px;background:${C.green};color:#fff;font-size:23px;font-weight:700;padding:0 16px"><span class="js-pc" style="width:30px;height:30px;border-radius:15px;background:#fff;display:grid;place-items:center">${I('check', { size: 18, color: C.green, sw: 3 })}</span>Paiement confirmé</div>
        </div>`;
      // livraison
      this.t2 = tile(556, 300, 452, 314);
      this.t2.innerHTML = `<div style="padding:30px 30px 0;display:flex;gap:16px;align-items:center"><div style="width:60px;height:60px;border-radius:18px;background:${C.navy};display:grid;place-items:center">${I('truck', { size: 30, color: '#fff' })}</div><div style="font-size:36px;font-weight:800;letter-spacing:-.03em">Livraison suivie</div></div>
        <svg class="abs" style="left:30px;top:120px" width="392" height="170" viewBox="0 0 392 170"><path d="M30 130 C 110 130, 110 40, 200 40 S 300 120, 362 60" fill="none" stroke="${C.line}" stroke-width="10" stroke-linecap="round"/>
        <path class="js-route" d="M30 130 C 110 130, 110 40, 200 40 S 300 120, 362 60" fill="none" stroke="${C.orange}" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        <circle cx="30" cy="130" r="14" fill="${C.navy}"/><circle cx="362" cy="60" r="16" fill="${C.orange}"/><circle cx="362" cy="60" r="6" fill="#fff"/>
        <g class="js-bike"><circle r="22" fill="#fff" stroke="${C.orange}" stroke-width="4"/><g transform="translate(-13 -13)">${I('bike', { size: 26, color: C.orange, sw: 2.4 }).replace('<svg', '<svg x="0" y="0"')}</g></g></svg>
        <div class="js-eta" style="position:absolute;right:30px;top:244px">${UI.chip('En livraison', { h: 40, size: 20, px: 16, bg: C.peach, color: C.orangeDeep })}</div>`;
      // avis
      this.t3 = tile(556, 646, 452, 314);
      this.t3.innerHTML = `<div style="padding:30px 30px 0;display:flex;gap:16px;align-items:center"><div style="width:60px;height:60px;border-radius:18px;background:${C.gold};display:grid;place-items:center">${I('star', { size: 30, color: '#fff', fill: '#fff' })}</div><div style="font-size:36px;font-weight:800;letter-spacing:-.03em">Avis vérifiés</div></div>
        <div style="position:absolute;left:30px;top:130px;display:flex;align-items:baseline;gap:16px"><span class="js-score" style="font-size:96px;font-weight:800;letter-spacing:-.05em;line-height:1">4,8</span><span style="font-size:24px;color:${C.mute};font-weight:600">126 clients</span></div>
        <div style="position:absolute;left:30px;top:244px;display:flex;gap:10px">${[0, 1, 2, 3, 4].map(() => `<span class="js-star" style="display:inline-block">${I('star', { size: 42, color: C.gold, fill: C.gold })}</span>`).join('')}</div>`;
      // balayage orange (signature)
      this.wipe = A.el('div', { cls: 'abs', style: { width: '1900px', height: '1900px', left: '-410px', top: '-410px', background: `linear-gradient(90deg,${C.orangeDeep},${C.orange} 30%,${C.orange2} 70%,${C.orange})`, transformOrigin: '50% 50%', zIndex: 50 } }, el);
      cue(WIPE - .05, 'whoosh', .8, -.3); cue(WIPE + .3, 'swipe', .4, .3);
      cue(20.47, 'pop', .45, -.3); cue(20.62, 'pop', .45, .3); cue(20.77, 'pop', .45, .3);
      cue(21.95, 'kaching', .7, -.3); cue(22.2, 'whoosh', .25, .4);
      [23.3, 23.42, 23.54, 23.66, 23.78].forEach((s, i) => cue(s, 'plink', .35, .3 + i * .05));
    },
    seek(t) {
      A.BG.seek(this.bg, t);
      // le fond n'apparaît qu'une fois l'écran couvert par le balayage
      this.bg.el.style.opacity = t >= WIPE + .2 ? 1 : 0;
      // balayage diagonal : couvre puis découvre
      const w1 = A.P(t, WIPE - .15, WIPE + .2, E.cubicIn), w2 = A.P(t, WIPE + .2, WIPE + .6, E.expoOut);
      const off = A.mix(-1900, 0, w1) + A.mix(0, 1900, w2);
      this.wipe.style.transform = `rotate(-28deg) translateX(${off.toFixed(1)}px)`;
      this.wipe.style.display = w2 >= 1 ? 'none' : 'block';
      A.Type.place(this.h, 540, 182);
      A.Type.play(this.h, t, 20.38, 24.9, { stagger: .06, dur: .6 });
      [[this.t1, 20.45], [this.t2, 20.6], [this.t3, 20.75]].forEach(([e, a], i) => {
        const k = A.P(t, a, a + .7, x => E.spring(x, 3, 6.5));
        const q = A.P(t, 24.85 + i * .05, 25.2 + i * .05, E.expoIn);
        A.T(e, { x: 0, y: (1 - k) * 120 - q * 40, s: A.mix(.9, 1, k) * (1 - q * .1), o: A.lin(t, a, a + .15) * (1 - q), blur: q * 8 });
      });
      // paiement confirmé
      const pk = A.P(t, 21.9, 22.4, x => E.spring(x));
      const paid = A.$('.js-paid', this.t1);
      paid.style.transform = `scale(${A.mix(.85, 1, pk).toFixed(3)})`; paid.style.opacity = A.lin(t, 21.9, 22.0).toFixed(3);
      // trajet de livraison
      const rk = A.P(t, 22.1, 23.9, E.sine);
      const route = A.$('.js-route', this.t2);
      route.setAttribute('stroke-dashoffset', (1 - rk).toFixed(4));
      const L = route.getTotalLength(), p = route.getPointAtLength(L * rk);
      A.$('.js-bike', this.t2).setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      // étoiles
      A.$$('.js-star', this.t3).forEach((s, i) => { const k = A.P(t, 23.3 + i * .12, 23.65 + i * .12, x => E.spring(x)); s.style.transform = `scale(${Math.max(.001, k).toFixed(3)})`; });
    },
  };

  /* =====================================================================
   * E — FIN
   * ===================================================================== */
  const FREEZE = 28.6;
  const sceneE = {
    id: 'end', a: 24.95, b: 30.01,
    build(el) {
      this.bg = A.BG.light(el);
      this.ring = A.el('div', { cls: 'abs', style: { width: '240px', height: '240px', borderRadius: '50%', border: `3px solid ${C.orange}` } }, el);
      this.logo = A.el('div', { cls: 'abs', style: { width: '200px', height: '200px', borderRadius: '56px', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 40px 80px -30px rgba(255,77,0,.5), 0 0 0 1px rgba(255,216,196,.9)' } }, el, `<img src="assets/logo_mark.png" style="width:160px;height:160px">`);
      this.name = A.Type.make(el, 'AMAZER', { size: 132, weight: 800, color: C.navy, track: -.045 });
      this.tag = A.Type.make(el, 'Tout le Niger,\ndans une *seule application.*', { size: 54, weight: 700, color: C.navy, align: 'center', lh: 1.15, track: -.025 });
      this.cta = A.el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', gap: '16px', height: '104px', padding: '0 46px 0 52px', borderRadius: '52px', background: C.orange, color: '#fff', fontSize: '52px', fontWeight: 800, letterSpacing: '-.03em', whiteSpace: 'nowrap', boxShadow: '0 30px 60px -20px rgba(255,77,0,.65), inset 0 -6px 0 rgba(0,0,0,.12)', transformOrigin: '50% 50%' } }, el, `amazer.store <span style="width:52px;height:52px;border-radius:26px;background:rgba(255,255,255,.22);display:grid;place-items:center">${I('chevron', { size: 30, color: '#fff', sw: 3 })}</span>`);
      this.shine = A.el('div', { cls: 'abs', style: { left: 0, top: 0, width: '80px', height: '104px', background: 'linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0))', transform: 'skewX(-20deg)' } }, this.cta);
      this.cta.style.overflow = 'hidden';
      this.foot = A.el('div', { cls: 'abs', style: { fontSize: '34px', fontWeight: 600, color: C.slate, whiteSpace: 'nowrap', letterSpacing: '-.01em' } }, el, 'Boutiques · Restaurants · Hôtels · Transport');
      cue(25.2, 'impact', .55); cue(25.22, 'shimmer', .45); cue(25.6, 'whoosh', .3); cue(26.05, 'swipe', .3);
      cue(26.85, 'pop', .6); cue(27.4, 'shine', .35);
    },
    seek(T) {
      const t = Math.min(T, FREEZE);
      A.BG.seek(this.bg, t);
      this.bg.el.style.opacity = A.lin(t, 24.95, 25.25).toFixed(3);
      const lk = A.P(t, 25.1, 25.75, x => E.spring(x, 3.2, 6));
      A.T(this.logo, { x: 540 - 100, y: 210, s: Math.max(.001, lk), o: A.lin(t, 25.1, 25.2) });
      const rk = A.P(t, 25.15, 26.0, E.expoOut);
      A.T(this.ring, { x: 540 - 120, y: 310 - 120, s: .7 + rk * 1.6, o: (1 - rk) * A.lin(t, 25.15, 25.2) });
      A.Type.place(this.name, 540, 498);
      A.Type.play(this.name, t, 25.5, 99, { stagger: .04, dur: .6 });
      A.Type.place(this.tag, 540, 640);
      A.Type.play(this.tag, t, 25.95, 99, { stagger: .05, dur: .55 });
      const ck = A.P(t, 26.8, 27.35, x => E.spring(x, 3.4, 6));
      const cw = this.cta.offsetWidth;
      A.T(this.cta, { x: 540 - cw / 2, y: 790, s: Math.max(.001, A.mix(.6, 1, ck)), o: A.lin(t, 26.8, 26.9) });
      this.shine.style.transform = `translateX(${A.mix(-120, cw + 60, A.P(t, 27.4, 28.1, E.cubicInOut)).toFixed(1)}px) skewX(-20deg)`;
      const fk = A.P(t, 27.2, 27.7, E.expoOut);
      A.T(this.foot, { x: 540 - this.foot.offsetWidth / 2, y: 940 + (1 - fk) * 20, o: fk });
    },
  };

  window.FILM = {
    id: 'pub1', title: 'AMAZER, la marque', duration: 30, fps: 60,
    scenes: [sceneA, sceneB, sceneD, sceneE], cues,
    flashes: [[4.36, .35]],
  };
})(window.A);
