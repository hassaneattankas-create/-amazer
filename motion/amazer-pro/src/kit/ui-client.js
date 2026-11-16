/* ui-client.js — parcours client : recherche, fiche produit, panier, paiement, suivi (écran 390×844).
 * Libellés repris de l'application (panier, paiement, suivi). Commerces et numéros fictifs.
 */
(function (A) {
  const C = A.C, I = A.icon, UI = A.UI;
  const img = n => `assets/products/p${n}.jpg`;
  const radio = on => `<span class="js-radio" style="width:24px;height:24px;border-radius:12px;flex:none;border:2px solid ${on ? C.orange : '#CBD5E1'};display:grid;place-items:center"><span style="width:12px;height:12px;border-radius:6px;background:${C.orange};opacity:${on ? 1 : 0}"></span></span>`;
  UI.radio = radio;
  /** coche un bouton radio dans une liste d'options (index i) */
  UI.select = (opts, i) => opts.forEach((o, k) => {
    const r = o.querySelector('.js-radio');
    r.style.borderColor = k === i ? C.orange : '#CBD5E1';
    r.firstChild.style.opacity = k === i ? 1 : 0;
    o.style.border = k === i ? `2px solid ${C.orange}` : `1px solid ${C.line}`;
    o.style.padding = k === i ? '11px 13px' : '12px 14px';
  });

  UI.search = () => {
    const res = [['030', 'Riz basmati 25 kg', 'Alimentation Baraka', '18 500 F'], ['023', 'Riz parfumé 5 kg', 'Supérette Al Nour', '4 750 F'], ['019', 'Coquillettes 500 g', 'Boutique Hamdallaye', '400 F'], ['016', 'Spaghetti 500 g', 'Alimentation Baraka', '450 F']];
    return `${UI.header('Explorer', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="height:52px;border-radius:16px;background:#fff;border:2px solid ${C.orange};display:flex;align-items:center;gap:10px;padding:0 16px;font-size:17px;font-weight:600;box-shadow:0 0 0 4px rgba(255,77,0,.12)">${I('search', { size: 20, color: C.orange, sw: 2.4 })}<span class="js-q"></span><span class="js-caret" style="width:2px;height:22px;background:${C.orange};margin-left:-8px"></span></div>
      <div style="display:flex;gap:8px;margin-top:12px">${['Pertinence', 'Prix', 'En stock', 'Niamey'].map((l, i) => `<span style="height:32px;padding:0 13px;border-radius:99px;display:flex;align-items:center;font-size:12.5px;font-weight:700;background:${i ? '#fff' : C.navy};color:${i ? C.slate : '#fff'};border:1px solid ${i ? C.line : C.navy}">${l}</span>`).join('')}</div>
      <div class="js-count" style="margin-top:14px;font-size:13px;color:${C.mute};font-weight:600">24 résultats pour « riz »</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
        ${res.map(([n, l, s, p]) => `<div class="js-res" style="background:#fff;border-radius:18px;border:1px solid ${C.line};overflow:hidden"><div style="height:124px;background:url(${img(n)}) center/cover"></div><div style="padding:9px 11px 11px"><div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l}</div><div style="font-size:11.5px;color:${C.mute};margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</div><div style="font-size:15px;font-weight:800;color:${C.orange};margin-top:3px">${p}</div></div></div>`).join('')}
      </div>
    </div>`;
  };

  UI.product = () => {
    const offers = [['Alimentation Baraka', '18 500 F', 'En stock · 12', true], ['Supérette Al Nour', '19 000 F', 'En stock · 4', false], ['Boutique Hamdallaye', '19 250 F', 'En stock · 7', false]];
    return `<div style="position:absolute;left:0;top:0;width:390px;height:330px;background:url(${img('030')}) center/cover"></div>
      <div style="position:absolute;left:0;top:250px;width:390px;height:80px;background:linear-gradient(rgba(248,250,252,0),#F8FAFC)"></div>
      ${UI.header('', { back: true, right: `<div style="width:38px;height:38px;border-radius:12px;background:#fff;display:grid;place-items:center">${I('share', { size: 18, color: C.navy })}</div>` })}
      <div style="position:absolute;left:20px;top:300px;width:350px">
        <div style="font-size:23px;font-weight:800;letter-spacing:-.03em">Riz basmati 25 kg</div>
        <div style="font-size:13px;color:${C.mute};margin-top:4px;display:flex;gap:6px;align-items:center">${I('star', { size: 14, color: C.gold, fill: C.gold })}<b style="color:${C.navy}">4,7</b> · 3 boutiques le vendent</div>
        <div style="font-weight:800;font-size:16px;margin-top:16px">Offres des boutiques</div>
        <div style="display:flex;flex-direction:column;gap:9px;margin-top:10px">
        ${offers.map(([s, p, st, best]) => `<div class="js-offer" style="background:#fff;border-radius:16px;border:${best ? `2px solid ${C.orange}` : `1px solid ${C.line}`};padding:${best ? '11px 13px' : '12px 14px'};display:flex;align-items:center;gap:12px">
          ${radio(best)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14.5px">${s}</div><div style="font-size:12px;color:${C.green};font-weight:600;margin-top:1px">${st}</div></div>
          <div style="text-align:right"><div style="font-weight:800;font-size:16px;color:${best ? C.orange : C.navy}">${p}</div>${best ? `<div style="font-size:10.5px;font-weight:800;color:${C.orangeDeep};letter-spacing:.04em">MEILLEUR PRIX</div>` : ''}</div></div>`).join('')}
        </div>
      </div>
      <div style="position:absolute;left:16px;top:756px;width:358px">${UI.btn('Ajouter au panier intelligent', { cls: 'js-addcart', icon: 'bag', h: 56, size: 16 })}</div>`;
  };

  UI.cart = () => `${UI.header('Mon panier', { back: true })}
    <div style="position:absolute;left:20px;top:116px;width:350px;display:flex;flex-direction:column;gap:12px">
      <div style="background:#fff;border-radius:18px;border:1px solid ${C.line};padding:12px;display:flex;gap:12px;align-items:center"><div style="width:62px;height:62px;border-radius:14px;background:url(${img('030')}) center/cover;flex:none"></div><div style="flex:1"><div style="font-weight:700;font-size:14.5px">Riz basmati 25 kg</div><div style="font-size:12px;color:${C.mute}">Alimentation Baraka</div><div style="font-weight:800;color:${C.orange};margin-top:2px">18 500 F</div></div><div style="display:flex;align-items:center;gap:10px;font-weight:800"><span style="width:28px;height:28px;border-radius:9px;border:1px solid ${C.line};display:grid;place-items:center">−</span>1<span style="width:28px;height:28px;border-radius:9px;background:${C.navy};color:#fff;display:grid;place-items:center">+</span></div></div>
      <div style="font-weight:800;font-size:16px;margin-top:4px">Livraison</div>
      ${[['Standard', 'Livraison à Niamey sous quelques heures', '1 000 F'], ['Express Niamey', 'Livraison prioritaire en ville', '2 000 F']].map(([t, d, p], i) => `<div class="js-opt" style="background:#fff;border-radius:16px;border:1px solid ${C.line};padding:12px 14px;display:flex;align-items:center;gap:12px">${radio(i === 0)}<div style="flex:1"><div style="font-weight:700;font-size:14.5px">${t}</div><div style="font-size:12px;color:${C.mute}">${d}</div></div><div style="font-weight:800;font-size:14.5px">${p}</div></div>`).join('')}
      <div style="font-weight:800;font-size:16px;margin-top:4px">Paiement</div>
      ${[['Amana Transfert', 'Validation dans l’application AmanaTa'], ['Nita Transfert', 'Transfert au numéro AMAZER, vérifié par l’équipe']].map(([t, d], i) => `<div class="js-pay" style="background:#fff;border-radius:16px;border:1px solid ${C.line};padding:12px 14px;display:flex;align-items:center;gap:12px">${radio(i === 0)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14.5px">${t}</div><div style="font-size:12px;color:${C.mute};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d}</div></div></div>`).join('')}
    </div>
    <div style="position:absolute;left:0;top:676px;width:390px;height:168px;background:#fff;border-top:1px solid ${C.line};padding:14px 20px">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:${C.mute};font-weight:600"><span>Sous-total</span><span>18 500 F</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:${C.mute};font-weight:600;margin-top:3px"><span>Livraison</span><span class="js-fee">1 000 F</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><div><div style="font-size:12px;color:${C.mute};font-weight:600">Total</div><div class="js-sum" style="font-size:22px;font-weight:800;letter-spacing:-.02em">19 500 F</div></div><div style="width:180px">${UI.btn('Commander', { cls: 'js-cmd', h: 52 })}</div></div>
    </div>`;

  UI.pay = () => `${UI.header('Paiement', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="border-radius:24px;background:${C.navy};color:#fff;padding:22px;position:relative;overflow:hidden">
        <div style="position:absolute;right:-40px;top:-40px;width:170px;height:170px;border-radius:85px;background:radial-gradient(${C.orange},rgba(255,77,0,0) 70%);opacity:.6"></div>
        <div style="font-size:12.5px;opacity:.7;font-weight:600">Commande #C4D2 · montant exact</div>
        <div style="font-size:40px;font-weight:800;letter-spacing:-.04em;margin-top:4px">20 500 F</div>
        <div style="display:flex;gap:8px;margin-top:12px">${UI.chip('Amana Transfert', { bg: 'rgba(255,255,255,.12)', color: '#fff', h: 30 })}</div>
      </div>
      <div style="margin-top:18px;display:flex;flex-direction:column;gap:12px">
        ${[['1', 'Démarrez le paiement Amana'], ['2', 'Validez le montant dans AmanaTa'], ['3', 'Vérifiez le paiement']].map(([n, l]) => `<div class="js-pstep" style="display:flex;gap:12px;align-items:center;background:#fff;border:1px solid ${C.line};border-radius:16px;padding:12px 14px"><span class="js-pn" style="width:30px;height:30px;border-radius:10px;background:${C.mist};color:${C.navy};display:grid;place-items:center;font-weight:800;font-size:14px">${n}</span><span style="font-weight:600;font-size:14.5px">${l}</span></div>`).join('')}
      </div>
      <div class="js-pstate" style="margin-top:16px;border-radius:16px;padding:12px 14px;background:${C.peach};color:${C.orangeDeep};font-size:13px;font-weight:600;opacity:0">Paiement initialisé. Validez dans AmanaTa, puis cliquez sur « Vérifier le paiement ».</div>
    </div>
    <div style="position:absolute;left:16px;top:690px;width:358px;display:flex;flex-direction:column;gap:10px">
      <div class="js-start">${UI.btn('Démarrer le paiement Amana', { h: 54 })}</div>
      <div class="js-verify">${UI.btn('Vérifier le paiement', { h: 54, bg: C.navy, flat: true })}</div>
    </div>`;
  /** k = nombre d'étapes de paiement faites (0..3) */
  UI.payState = (scr, k) => {
    A.$$('.js-pn', scr).forEach((n, i) => {
      const on = k > i;
      n.style.background = on ? C.green : C.mist;
      n.innerHTML = on ? I('check', { size: 16, color: '#fff', sw: 3 }) : String(i + 1);
    });
  };

  UI.track = () => {
    const steps = [['Commande', 'Payée · 10:31'], ['Préparation', 'Alimentation Baraka'], ['En livraison', 'Le livreur est en route'], ['Reçu', 'Confirmé par vous']];
    return `${UI.header('Ma commande', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px;display:flex;gap:12px;align-items:center"><div style="width:58px;height:58px;border-radius:14px;background:url(${img('030')}) center/cover"></div><div style="flex:1"><div style="font-weight:800;font-size:15px">Commande #C4D2</div><div style="font-size:12.5px;color:${C.mute}">1 article · 20 500 F · Express</div></div>${UI.chip('Payée', { dot: true })}</div>
      <div style="margin-top:22px;position:relative;padding-left:4px">
        <div style="position:absolute;left:21px;top:26px;width:4px;height:270px;border-radius:2px;background:${C.line}"><div class="js-rail" style="width:100%;height:0;background:${C.orange};border-radius:2px"></div></div>
        ${steps.map(([t, d]) => `<div class="js-tstep" style="display:flex;gap:16px;align-items:center;height:90px;position:relative"><span class="js-tdot" style="width:38px;height:38px;border-radius:19px;flex:none;display:grid;place-items:center;background:#fff;border:3px solid ${C.line};z-index:2"></span><div><div class="js-tt" style="font-weight:800;font-size:16.5px;color:#94A3B8">${t}</div><div style="font-size:12.5px;color:${C.mute};margin-top:1px">${d}</div></div></div>`).join('')}
      </div>
    </div>
    <div style="position:absolute;left:16px;top:740px;width:358px">${UI.btn('J’ai reçu ma commande', { cls: 'js-recv', h: 56, icon: 'check' })}</div>`;
  };
  /** k = étapes atteintes (1..4), fractionnaire pour animer le rail */
  UI.trackState = (scr, k) => {
    const dots = A.$$('.js-tdot', scr), tt = A.$$('.js-tt', scr);
    A.$('.js-rail', scr).style.height = (A.cl((k - 1) / 3) * 100).toFixed(1) + '%';
    dots.forEach((d, i) => {
      const on = k >= i + 1, cur = on && k < i + 2 && i < 3;
      d.style.background = on ? C.orange : '#fff';
      d.style.borderColor = on ? C.orange : C.line;
      d.innerHTML = on ? I(cur ? 'clock' : 'check', { size: 18, color: '#fff', sw: 3 }) : '';
      d.style.boxShadow = cur ? '0 0 0 6px rgba(255,77,0,.18)' : 'none';
      tt[i].style.color = on ? C.navy : '#94A3B8';
    });
  };
})(window.A);
