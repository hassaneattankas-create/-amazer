/* ui-pro.js — écrans vendeur, pharmacies / stations et affiliation (écran 390×844).
 * Libellés repris de l'application (cartes station : « De garde », « Super · disponible », « Appeler », « Itinéraire »).
 * Commerces, personnes, montants et numéros sont fictifs.
 */
(function (A) {
  const C = A.C, I = A.icon, UI = A.UI;
  const img = n => `assets/products/p${n}.jpg`;
  const field = (label, cls, ph) => `<div style="margin-top:14px"><div style="font-size:13px;font-weight:700;color:${C.slate}">${label}</div>
    <div class="${cls}-box" style="margin-top:6px;height:50px;border-radius:14px;background:#fff;border:1px solid ${C.line};display:flex;align-items:center;padding:0 14px;font-size:16px;font-weight:600"><span class="${cls}"></span><span class="${cls}-ph" style="color:#94A3B8;font-weight:500">${ph}</span></div></div>`;

  /* ---------- Vendeur : nouveau produit ---------- */
  UI.sellAdd = () => `${UI.header('Nouveau produit', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="height:210px;border-radius:20px;border:2px dashed #CBD5E1;background:#fff;display:grid;place-items:center;position:relative;overflow:hidden">
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:${C.mute};font-weight:600;font-size:14px">${I('camera', { size: 34, color: C.orange })}Ajouter des photos</div>
        <div class="js-photo" style="position:absolute;inset:0;background:url(${img('029')}) center/cover;opacity:0"></div>
      </div>
      ${field('Nom du produit', 'js-name', 'Ex. Lait en poudre 400 g')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${field('Prix (F CFA)', 'js-price', '0')}${field('Stock', 'js-stock', '0')}</div>
      <div style="margin-top:14px;display:flex;gap:8px">${['Épicerie', 'Boissons', 'Hygiène'].map((l, i) => `<span style="height:34px;padding:0 14px;border-radius:99px;display:flex;align-items:center;font-size:13px;font-weight:700;background:${i ? '#fff' : C.navy};color:${i ? C.slate : '#fff'};border:1px solid ${i ? C.line : C.navy}">${l}</span>`).join('')}</div>
    </div>
    <div style="position:absolute;left:16px;top:752px;width:358px">${UI.btn('Publier le produit', { cls: 'js-publish', icon: 'check', h: 56 })}</div>`;
  /** remplit un champ (texte tapé jusqu'à n caractères) */
  UI.typeIn = (scr, cls, text, k, focus) => {
    const n = Math.round(text.length * A.cl(k));
    A.$('.' + cls, scr).textContent = text.slice(0, n);
    A.$('.' + cls + '-ph', scr).style.display = n ? 'none' : 'inline';
    const box = A.$('.' + cls + '-box', scr);
    box.style.border = focus ? `2px solid ${C.orange}` : `1px solid ${C.line}`;
    box.style.padding = focus ? '0 13px' : '0 14px';
  };

  /* ---------- Vendeur : commandes ---------- */
  UI.sellOrders = () => `${UI.header('Commandes', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="display:flex;gap:8px">${['À préparer', 'En livraison', 'Terminées'].map((l, i) => `<span style="height:34px;padding:0 14px;border-radius:99px;display:flex;align-items:center;font-size:13px;font-weight:700;background:${i ? '#fff' : C.navy};color:${i ? C.slate : '#fff'};border:1px solid ${i ? C.line : C.navy}">${l}</span>`).join('')}</div>
      <div class="js-new" style="margin-top:16px;background:#fff;border-radius:20px;border:2px solid ${C.orange};padding:14px;box-shadow:0 0 0 5px rgba(255,77,0,.12)">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:800;font-size:15px">Commande #A7F3</span>${UI.chip('Payée', { dot: true })}</div>
        <div style="display:flex;gap:12px;align-items:center;margin-top:12px"><div style="width:58px;height:58px;border-radius:14px;background:url(${img('029')}) center/cover;flex:none"></div>
          <div style="flex:1"><div style="font-weight:700;font-size:14.5px">Lait en poudre 400 g × 2</div><div style="font-size:12.5px;color:${C.mute}">Client à Niamey · Express</div></div>
          <div style="font-weight:800;font-size:16px;color:${C.orange}">6 500 F</div></div>
        <div style="margin-top:12px;font-size:12.5px;color:${C.green};font-weight:700;display:flex;gap:6px;align-items:center">${I('shield', { size: 15, color: C.green })}Paiement vérifié par AMAZER</div>
        <div style="margin-top:12px">${UI.btn('Commencer la préparation', { cls: 'js-prep', h: 50, size: 15 })}</div>
      </div>
      ${[['030', 'Riz basmati 25 kg', '18 500 F', 'En livraison'], ['017', 'Mayonnaise 473 g × 3', '4 500 F', 'Terminée']].map(([n, l, p, s]) => `<div style="margin-top:12px;background:#fff;border-radius:18px;border:1px solid ${C.line};padding:12px;display:flex;gap:12px;align-items:center;opacity:.75"><div style="width:48px;height:48px;border-radius:12px;background:url(${img(n)}) center/cover;flex:none"></div><div style="flex:1"><div style="font-weight:700;font-size:14px">${l}</div><div style="font-size:12px;color:${C.mute}">${s}</div></div><div style="font-weight:800;font-size:14.5px">${p}</div></div>`).join('')}
    </div>`;

  /* ---------- Vendeur : remise au livreur ---------- */
  UI.sellShip = () => {
    const steps = [['Payée', 'Vérifiée par AMAZER'], ['En préparation', 'Par votre boutique'], ['Prête', 'Le livreur AMAZER arrive'], ['Remise au livreur', 'En route vers le client']];
    return `${UI.header('Commande #A7F3', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px;display:flex;gap:12px;align-items:center"><div style="width:58px;height:58px;border-radius:14px;background:url(${img('029')}) center/cover"></div><div style="flex:1"><div style="font-weight:800;font-size:15px">Lait en poudre 400 g × 2</div><div style="font-size:12.5px;color:${C.mute}">Livraison Express · Niamey</div></div></div>
      <div style="margin-top:22px;position:relative;padding-left:4px">
        <div style="position:absolute;left:21px;top:26px;width:4px;height:270px;border-radius:2px;background:${C.line}"><div class="js-rail" style="width:100%;height:0;background:${C.orange};border-radius:2px"></div></div>
        ${steps.map(([t, d]) => `<div style="display:flex;gap:16px;align-items:center;height:90px;position:relative"><span class="js-tdot" style="width:38px;height:38px;border-radius:19px;flex:none;display:grid;place-items:center;background:#fff;border:3px solid ${C.line};z-index:2"></span><div><div class="js-tt" style="font-weight:800;font-size:16.5px;color:#94A3B8">${t}</div><div style="font-size:12.5px;color:${C.mute};margin-top:1px">${d}</div></div></div>`).join('')}
      </div>
    </div>
    <div style="position:absolute;left:16px;top:740px;width:358px">${UI.btn('Commande prête', { cls: 'js-ready', h: 56, icon: 'package' })}</div>`;
  };

  /* ---------- Vendeur : revenus ---------- */
  UI.sellMoney = () => `${UI.header('Mes ventes', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="border-radius:24px;background:${C.navy};color:#fff;padding:22px;position:relative;overflow:hidden">
        <div style="position:absolute;right:-40px;top:-40px;width:170px;height:170px;border-radius:85px;background:radial-gradient(${C.orange},rgba(255,77,0,0) 70%);opacity:.6"></div>
        <div style="font-size:13px;opacity:.7;font-weight:600">Ventes du mois</div>
        <div class="js-earn" style="font-size:42px;font-weight:800;letter-spacing:-.04em;margin-top:4px">0 F</div>
        <div style="margin-top:10px;font-size:13px;font-weight:600;color:${C.orange2}">Prix entier · frais payés par le client</div>
      </div>
      <div style="font-weight:800;font-size:16px;margin-top:20px">Dernières ventes</div>
      ${[['029', 'Lait en poudre 400 g × 2', '+ 6 500 F'], ['030', 'Riz basmati 25 kg', '+ 18 500 F'], ['017', 'Mayonnaise 473 g × 3', '+ 4 500 F'], ['016', 'Spaghetti 500 g × 10', '+ 4 500 F']].map(([n, l, p]) => `<div class="js-sale" style="margin-top:10px;background:#fff;border-radius:16px;border:1px solid ${C.line};padding:11px 12px;display:flex;gap:12px;align-items:center"><div style="width:44px;height:44px;border-radius:12px;background:url(${img(n)}) center/cover;flex:none"></div><div style="flex:1;font-weight:700;font-size:14px">${l}</div><div style="font-weight:800;font-size:14.5px;color:${C.green}">${p}</div></div>`).join('')}
    </div>`;

  /* ---------- Pharmacies et stations ---------- */
  const svcCard = (name, place, km, body) => `<div class="js-svc" style="margin-top:12px;background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px">
      <div style="display:flex;gap:12px;align-items:flex-start"><div style="width:46px;height:46px;border-radius:14px;background:${C.peach};display:grid;place-items:center;flex:none">${I('pin', { size: 22, color: C.orange })}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div><div style="font-size:12.5px;color:${C.mute};margin-top:1px">${place}</div></div>
      <span style="height:26px;padding:0 10px;border-radius:99px;background:${C.mist};font-size:12px;font-weight:700;display:flex;align-items:center">${km}</span></div>
      ${body}
      <div style="display:flex;gap:8px;margin-top:12px"><div class="js-call" style="flex:1;height:42px;border-radius:12px;background:${C.orange};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">Appeler</div><div class="js-route" style="flex:1;height:42px;border-radius:12px;border:1px solid ${C.line};display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;font-size:14px">${I('pin', { size: 16, color: C.navy })}Itinéraire</div></div>
    </div>`;
  const fuelChip = (l, ok) => `<span style="height:30px;padding:0 11px;border-radius:99px;display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;border:1px solid ${ok ? 'rgba(22,163,74,.3)' : 'rgba(220,38,38,.3)'};background:${ok ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.08)'};color:${ok ? C.green : '#DC2626'}">${I(ok ? 'check' : 'x', { size: 14, color: 'currentColor', sw: 3 })}${l}<span style="font-weight:500">· ${ok ? 'disponible' : 'rupture'}</span></span>`;

  UI.pharma = () => `${UI.header('Pharmacies', { back: true })}
    <div style="position:absolute;left:20px;top:116px;width:350px">
      <div style="display:flex;gap:8px">${['De garde', 'Près de moi', 'Niamey'].map((l, i) => `<span style="height:34px;padding:0 14px;border-radius:99px;display:flex;align-items:center;font-size:13px;font-weight:700;background:${i ? '#fff' : C.navy};color:${i ? C.slate : '#fff'};border:1px solid ${i ? C.line : C.navy}">${l}</span>`).join('')}</div>
      ${[['Pharmacie Espoir', 'Quartier Nord, Niamey', '1,2 km'], ['Pharmacie Nour', 'Quartier Centre, Niamey', '2,8 km'], ['Pharmacie Al Baraka', 'Quartier Est, Niamey', '4,1 km']].map(([n, p, k]) => svcCard(n, p, k, `<div style="margin-top:10px"><span style="height:30px;padding:0 12px;border-radius:99px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;background:rgba(22,163,74,.1);color:${C.green}">${I('clock', { size: 14, color: C.green })}De garde</span></div>`)).join('')}
    </div>`;

  UI.stations = () => `${UI.header('Stations-service', { back: true })}
    <div style="position:absolute;left:20px;top:116px;width:350px">
      <div style="display:flex;gap:8px">${['Super', 'Gasoil', 'Gaz'].map((l, i) => `<span style="height:34px;padding:0 14px;border-radius:99px;display:flex;align-items:center;font-size:13px;font-weight:700;background:${i ? '#fff' : C.navy};color:${i ? C.slate : '#fff'};border:1px solid ${i ? C.line : C.navy}">${l}</span>`).join('')}</div>
      ${svcCard('Station Liberté', 'Route de Tillabéri', '0,9 km', `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${fuelChip('Super', 1)}${fuelChip('Gasoil', 1)}${fuelChip('Gaz', 1)}</div><div style="font-size:11.5px;color:${C.mute};margin-top:6px">Mis à jour il y a 12 min par la station</div>`)}
      ${svcCard('Station du Fleuve', 'Rive droite, Niamey', '3,4 km', `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${fuelChip('Super', 1)}${fuelChip('Gasoil', 0)}</div><div style="font-size:11.5px;color:${C.mute};margin-top:6px">Mis à jour il y a 25 min par la station</div>`)}
    </div>`;

  /* ---------- Affiliation ---------- */
  UI.affLink = () => `${UI.header('Affiliation', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="border-radius:24px;background:${C.navy};color:#fff;padding:20px">
        <div style="font-size:21px;font-weight:800;letter-spacing:-.02em">Programme d’affiliation</div>
        <div style="font-size:13px;opacity:.75;margin-top:4px">Gratuit, sans stock, sans abonnement.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
          <div style="border-radius:14px;background:rgba(255,255,255,.1);padding:10px 12px;font-size:12.5px"><b>Un vendeur</b><div style="opacity:.75">une part de ses abonnements</div></div>
          <div style="border-radius:14px;background:rgba(255,255,255,.1);padding:10px 12px;font-size:12.5px"><b>Un client</b><div style="opacity:.75">un bonus à sa 1re commande</div></div>
        </div>
      </div>
      <div style="margin-top:16px;background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px">
        <div style="font-size:14px;font-weight:700">Votre code : <span style="background:${C.mist};border-radius:8px;padding:2px 8px;font-family:monospace;letter-spacing:.15em">FATI24</span></div>
        <div class="js-link" style="margin-top:10px;font-size:13px;color:${C.slate};word-break:break-all;border-radius:10px;padding:8px 10px">amazer.store/?ref=FATI24</div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <div class="js-copy" style="flex:1;height:44px;border-radius:12px;border:1px solid ${C.line};display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;font-size:14px">${I('copy', { size: 16, color: C.navy })}<span class="js-copyl">Copier mon lien</span></div>
          <div class="js-wa" style="flex:1;height:44px;border-radius:12px;border:1px solid ${C.green};color:${C.green};display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;font-size:14px">${I('message', { size: 16, color: C.green })}WhatsApp</div>
        </div>
      </div>
      <div style="margin-top:16px;background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px">
        <div style="font-weight:800;font-size:15px">Quoi dire aux vendeurs</div>
        <div style="font-size:13px;color:${C.slate};margin-top:6px;line-height:1.45">« Le client paie avant, AMAZER livre, et vous recevez le prix entier. »</div>
      </div>
    </div>`;

  UI.affChat = () => `<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:#ECE5DD"></div>
    <div style="position:absolute;left:0;top:0;width:390px;height:110px;background:#075E54;color:#fff;display:flex;align-items:flex-end;gap:12px;padding:0 18px 14px">
      <div style="width:40px;height:40px;border-radius:20px;background:${C.peach};display:grid;place-items:center">${I('store', { size: 20, color: C.orange })}</div>
      <div><div style="font-weight:700;font-size:16px">Boutique Hamdallaye</div><div style="font-size:12px;opacity:.8">en ligne</div></div></div>
    <div style="position:absolute;left:20px;top:140px;width:350px;display:flex;flex-direction:column;gap:12px">
      <div class="js-b1" style="align-self:flex-end;max-width:300px;background:#DCF8C6;border-radius:14px 14px 4px 14px;padding:10px 12px;font-size:14.5px;line-height:1.4">Bonjour ! Mettez votre boutique sur AMAZER : le client paie avant, AMAZER livre, et vous recevez le prix entier.<div style="color:#027EB5;margin-top:4px">amazer.store/vendre?ref=FATI24</div></div>
      <div class="js-b2" style="align-self:flex-start;max-width:260px;background:#fff;border-radius:14px 14px 14px 4px;padding:10px 12px;font-size:14.5px">Intéressant ! Je m’inscris ce soir.</div>
      <div class="js-b3" style="align-self:flex-start;max-width:260px;background:#fff;border-radius:14px 14px 14px 4px;padding:10px 12px;font-size:14.5px">C’est fait, ma boutique est en ligne !</div>
    </div>`;

  UI.affWallet = () => `${UI.header('Mes gains', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="border-radius:24px;background:${C.navy};color:#fff;padding:22px;position:relative;overflow:hidden">
        <div style="position:absolute;right:-40px;top:-40px;width:170px;height:170px;border-radius:85px;background:radial-gradient(${C.orange},rgba(255,77,0,0) 70%);opacity:.6"></div>
        <div style="font-size:13px;opacity:.7;font-weight:600">Gains disponibles</div>
        <div class="js-gain" style="font-size:42px;font-weight:800;letter-spacing:-.04em;margin-top:4px">0 F</div>
        <div style="margin-top:10px;font-size:13px;font-weight:600;color:${C.orange2}">Paiement par Nita, Amana, Airtel ou Moov</div>
      </div>
      <div style="font-weight:800;font-size:16px;margin-top:20px">Derniers gains</div>
      ${[['store', 'Boutique Hamdallaye', 'Abonnement payé'], ['user', 'Nouveau client', '1re commande livrée'], ['store', 'Chez Mariama', 'Abonnement payé']].map(([ic, l, d]) => `<div class="js-gl" style="margin-top:10px;background:#fff;border-radius:16px;border:1px solid ${C.line};padding:11px 12px;display:flex;gap:12px;align-items:center"><div style="width:44px;height:44px;border-radius:12px;background:${C.peach};display:grid;place-items:center;flex:none">${I(ic, { size: 22, color: C.orange })}</div><div style="flex:1"><div style="font-weight:700;font-size:14px">${l}</div><div style="font-size:12px;color:${C.mute}">${d}</div></div>${UI.chip('Gagné', { dot: true })}</div>`).join('')}
      <div style="margin-top:18px">${UI.btn('Demander mon paiement', { cls: 'js-ask', h: 54, icon: 'wallet' })}</div>
    </div>`;

  /** compteur F CFA (espaces fines à la française) */
  UI.money = v => `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;

  /* ---------- Vendre : choix de la formule ---------- */
  UI.plans = () => {
    const plans = [['store', 'Boutique', 'Vendre des produits', 'Commerces, revendeurs, artisans'], ['utensils', 'Restaurant', 'Menu et commandes', 'Restaurants, fast-food, traiteurs'], ['bed', 'Premium', 'Réservations et services', 'Hôtels, transport, entreprises']];
    return `${UI.header('Vendre sur AMAZER', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="font-size:24px;font-weight:800;letter-spacing:-.03em">Choisissez votre formule</div>
      <div style="font-size:13.5px;color:${C.mute};margin-top:4px">Inscription depuis votre téléphone, en quelques minutes.</div>
      ${plans.map(([ic, t, d, who]) => `<div class="js-plan" style="margin-top:14px;background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px;display:flex;gap:14px;align-items:center">
        <div style="width:52px;height:52px;border-radius:16px;background:${C.peach};display:grid;place-items:center;flex:none">${I(ic, { size: 26, color: C.orange })}</div>
        <div style="flex:1"><div style="font-weight:800;font-size:17px">${t}</div><div style="font-size:13px;font-weight:600">${d}</div><div style="font-size:12px;color:${C.mute}">${who}</div></div></div>`).join('')}
    </div>
    <div style="position:absolute;left:16px;top:752px;width:358px">${UI.btn('Ouvrir ma boutique', { cls: 'js-open', h: 56, icon: 'store' })}</div>`;
  };

  /* ---------- Gérant de station ---------- */
  UI.gerant = () => {
    const row = (fuel, on) => `<div style="display:flex;align-items:center;gap:8px;margin-top:10px"><span style="width:58px;font-weight:700;font-size:14px">${fuel}</span>
      ${['Disponible', 'Stock faible', 'Rupture'].map((l, i) => `<span class="js-g${i}" style="flex:1;height:44px;border-radius:12px;display:grid;place-items:center;font-size:12px;font-weight:700;border:1px solid ${i === on ? 'transparent' : C.line};background:${i === on ? ['#1F8455', '#F5B301', '#DC2626'][i] : '#fff'};color:${i === on ? (i === 1 ? C.navy : '#fff') : C.slate}">${l}</span>`).join('')}</div>`;
    return `${UI.header('Gérant de station', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px">
        <div style="font-weight:800;font-size:17px">Station Liberté</div><div style="font-size:12.5px;color:${C.mute}">Réseau Sahel Énergie · Niamey</div>
        <div class="js-gsuper">${row('Super', 0)}</div><div class="js-ggasoil">${row('Gasoil', 1)}</div><div class="js-ggaz">${row('Gaz', 0)}</div>
        <div class="js-gfresh" style="margin-top:14px;border-radius:12px;padding:10px 12px;background:${C.mist};font-size:12.5px;font-weight:600">Mis à jour il y a 3 h · à refaire bientôt</div>
        <div class="js-gsame" style="margin-top:10px;height:44px;border-radius:12px;border:1px solid ${C.line};display:grid;place-items:center;font-weight:700;font-size:14px">Rien n’a changé</div>
      </div>
      <div style="margin-top:14px;background:#fff;border-radius:20px;border:1px solid ${C.line};padding:14px">
        <div style="font-weight:800;font-size:15px">Ce mois-ci</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;text-align:center">${[['412', 'itinéraires'], ['138', 'appels'], ['56', 'gaz livré']].map(([n, l]) => `<div style="border-radius:12px;background:${C.mist};padding:8px 4px"><div style="font-weight:800;font-size:18px">${n}</div><div style="font-size:11px;color:${C.mute}">${l}</div></div>`).join('')}</div>
      </div>
    </div>`;
  };
  /** gérant : le gasoil passe de « stock faible » à « disponible » (k 0..1), fraîcheur remise à zéro */
  UI.gerantState = (scr, done) => {
    const row = A.$('.js-ggasoil', scr);
    ['js-g0', 'js-g1'].forEach((cls, i) => {
      const on = done ? i === 0 : i === 1;
      const e = A.$('.' + cls, row);
      e.style.background = on ? ['#1F8455', '#F5B301'][i] : '#fff';
      e.style.color = on ? (i === 1 ? C.navy : '#fff') : C.slate;
      e.style.borderColor = on ? 'transparent' : C.line;
    });
    const f = A.$('.js-gfresh', scr);
    f.textContent = done ? 'Mis à jour à l’instant · les clients le voient' : 'Mis à jour il y a 3 h · à refaire bientôt';
    f.style.background = done ? C.greenSoft : C.mist;
    f.style.color = done ? C.green : C.navy;
  };

  /* ---------- Revente sans stock ---------- */
  UI.resell = () => {
    const items = [['030', 'Riz basmati 25 kg', '18 500 F', '21 000 F', '+ 2 500 F'], ['029', 'Lait en poudre 400 g', '3 250 F', '3 750 F', '+ 500 F'], ['017', 'Mayonnaise 473 g', '1 500 F', '1 750 F', '+ 250 F']];
    return `${UI.header('Ma boutique de revente', { back: true })}
    <div style="position:absolute;left:20px;top:118px;width:350px">
      <div style="border-radius:20px;background:${C.navy};color:#fff;padding:16px">
        <div style="font-size:13px;opacity:.75">Vous vendez, la boutique prépare, AMAZER livre.</div>
        <div style="font-size:19px;font-weight:800;margin-top:4px">Vous gardez la marge.</div>
      </div>
      ${items.map(([n, l, base, mine, gain]) => `<div class="js-ritem" style="margin-top:12px;background:#fff;border-radius:18px;border:1px solid ${C.line};padding:12px;display:flex;gap:12px;align-items:center">
        <div style="width:54px;height:54px;border-radius:14px;background:url(assets/products/p${n}.jpg) center/cover;flex:none"></div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">${l}</div><div style="font-size:12px;color:${C.mute}">Prix boutique ${base}</div>
        <div style="font-size:13px;font-weight:700;margin-top:2px">Mon prix <span class="js-rprice" style="color:${C.orange}">${mine}</span></div></div>
        <span style="height:26px;padding:0 9px;border-radius:99px;background:${C.greenSoft};color:${C.green};font-size:12px;font-weight:800;display:flex;align-items:center">${gain}</span></div>`).join('')}
    </div>
    <div style="position:absolute;left:16px;top:752px;width:358px">${UI.btn('Partager ma boutique', { cls: 'js-rshare', h: 56, icon: 'share' })}</div>`;
  };
})(window.A);
