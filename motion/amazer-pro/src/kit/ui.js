/* ui.js — interfaces AMAZER (écran 390×844) + cartes flottantes + toucher.
 * Les écrans sont des chaînes HTML ; les éléments animés portent une classe .js-* que la scène pilote.
 * Commerces, personnes et numéros sont fictifs.
 */
(function (A) {
  const C = A.C, I = A.icon;
  const UI = A.UI = {};
  const img = n => `assets/products/p${n}.jpg`;

  UI.header = (title, o = {}) => `<div style="position:absolute;left:0;top:54px;width:390px;height:56px;display:flex;align-items:center;gap:12px;padding:0 20px">
    ${o.back ? `<div style="width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid ${C.line};display:grid;place-items:center">${I('back', { size: 20, color: C.navy })}</div>` : ''}
    ${o.logo ? `<img src="assets/logo_mark.png" style="width:34px;height:34px;border-radius:10px">` : ''}
    <div style="flex:1;font-weight:700;font-size:${o.size ?? 19}px;letter-spacing:-.02em">${title}</div>
    ${o.right ?? `<div style="position:relative;width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid ${C.line};display:grid;place-items:center">${I('bell', { size: 19, color: C.navy })}<span style="position:absolute;right:8px;top:8px;width:8px;height:8px;border-radius:4px;background:${C.orange}"></span></div>`}
  </div>`;

  UI.tabbar = (active = 0) => {
    const items = [['home', 'Accueil'], ['search', 'Explorer'], ['bag', 'Panier'], ['user', 'Compte']];
    return `<div style="position:absolute;left:0;top:756px;width:390px;height:88px;background:#fff;border-top:1px solid ${C.line};display:flex;justify-content:space-around;padding-top:10px">
      ${items.map(([ic, l], i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;color:${i === active ? C.orange : '#94A3B8'};font-size:11px;font-weight:600">${I(ic, { size: 22, color: 'currentColor' })}${l}</div>`).join('')}
    </div>`;
  };

  UI.btn = (label, o = {}) => `<div class="${o.cls ?? ''}" style="height:${o.h ?? 52}px;border-radius:${o.r ?? 16}px;background:${o.bg ?? C.orange};color:${o.color ?? '#fff'};display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:${o.size ?? 16}px;box-shadow:${o.flat ? 'none' : '0 10px 24px -10px rgba(255,77,0,.7)'}">${o.icon ? I(o.icon, { size: 19, color: 'currentColor', sw: 2.4 }) : ''}${label}</div>`;

  UI.chip = (label, o = {}) => `<span style="display:inline-flex;align-items:center;gap:5px;height:${o.h ?? 26}px;padding:0 ${o.px ?? 10}px;border-radius:99px;background:${o.bg ?? C.greenSoft};color:${o.color ?? C.green};font-size:${o.size ?? 12}px;font-weight:700">${o.dot ? `<span style="width:6px;height:6px;border-radius:3px;background:currentColor"></span>` : ''}${label}</span>`;

  /* ---------- Accueil ---------- */
  UI.home = () => {
    const cats = [['store', 'Boutiques'], ['utensils', 'Restaurants'], ['bed', 'Hôtels'], ['bus', 'Transport']];
    const prods = [['030', 'Riz basmati 25 kg', '18 500 F'], ['029', 'Lait en poudre', '3 250 F'], ['016', 'Spaghetti 500 g', '450 F'], ['017', 'Mayonnaise', '1 500 F']];
    return `${UI.header('', { logo: true })}
    <div style="position:absolute;left:66px;top:62px;font-weight:800;font-size:20px;letter-spacing:-.03em">AMAZER</div>
    <div style="position:absolute;left:20px;top:122px;width:350px">
      <div style="font-size:14px;color:${C.mute};font-weight:500">Bonjour Fati,</div>
      <div style="font-size:24px;font-weight:800;letter-spacing:-.03em;margin-top:2px">Que cherchez-vous ?</div>
      <div style="margin-top:14px;height:50px;border-radius:16px;background:#fff;border:1px solid ${C.line};display:flex;align-items:center;gap:10px;padding:0 16px;color:#94A3B8;font-size:15px">${I('search', { size: 19, color: C.orange, sw: 2.4 })}Produits, plats, hôtels, trajets…</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px">
        ${cats.map(([ic, l], i) => `<div class="js-cat" style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:72px;height:72px;border-radius:22px;background:${i === 0 ? C.orange : '#fff'};border:1px solid ${i === 0 ? C.orange : C.line};display:grid;place-items:center;color:${i === 0 ? '#fff' : C.orange}">${I(ic, { size: 30, color: 'currentColor' })}</div><div style="font-size:12.5px;font-weight:600">${l}</div></div>`).join('')}
      </div>
      <div style="margin-top:20px;height:112px;border-radius:22px;background:linear-gradient(120deg,${C.navy},#1E293B);position:relative;overflow:hidden;padding:18px 20px;color:#fff">
        <div style="position:absolute;right:-30px;top:-30px;width:160px;height:160px;border-radius:80px;background:radial-gradient(${C.orange},rgba(255,77,0,0) 70%);opacity:.7"></div>
        <div style="font-size:12px;font-weight:700;color:${C.orange2};letter-spacing:.06em">PAIEMENT SÉCURISÉ</div>
        <div style="font-size:19px;font-weight:800;letter-spacing:-.02em;margin-top:6px;line-height:1.15">Payez par Nita<br>ou Amana</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:20px;font-weight:800;font-size:17px;letter-spacing:-.02em">Populaire près de vous<span style="color:${C.orange};font-size:13px;font-weight:700">Tout voir</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        ${prods.map(([n, l, p]) => `<div style="background:#fff;border-radius:18px;border:1px solid ${C.line};overflow:hidden"><div style="height:118px;background:url(${img(n)}) center/cover"></div><div style="padding:9px 11px 11px"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l}</div><div style="font-size:15px;font-weight:800;color:${C.orange};margin-top:2px">${p}</div></div></div>`).join('')}
      </div>
    </div>${UI.tabbar(0)}`;
  };

  /* ---------- Boutique (vitrine) ---------- */
  UI.shop = () => {
    const prods = [['030', 'Riz basmati 25 kg', '18 500 F'], ['029', 'Lait en poudre 400 g', '3 250 F'], ['016', 'Spaghetti 500 g', '450 F'], ['017', 'Mayonnaise 473 g', '1 500 F'], ['018', 'Ketchup 500 g', '1 200 F'], ['015', 'Thé vert 250 g', '900 F']];
    return `<div style="position:absolute;left:0;top:0;width:390px;height:210px;background:linear-gradient(140deg,#FF7A1A,#FF4D00 55%,#C93D00);overflow:hidden">
        <div style="position:absolute;inset:0;background:url(${img('023')}) center/cover;opacity:.28;mix-blend-mode:multiply"></div></div>
      ${UI.header('', { back: true, right: `<div style="width:38px;height:38px;border-radius:12px;background:#fff;display:grid;place-items:center">${I('share', { size: 18, color: C.navy })}</div>` })}
      <div style="position:absolute;left:20px;top:150px;width:350px;background:#fff;border-radius:22px;padding:16px 18px;box-shadow:0 18px 40px -18px rgba(15,23,42,.35)">
        <div style="display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;border-radius:16px;background:${C.peach};display:grid;place-items:center;color:${C.orange}">${I('store', { size: 26, color: 'currentColor' })}</div>
        <div style="flex:1"><div style="font-weight:800;font-size:18px;letter-spacing:-.02em">Alimentation Baraka</div><div style="font-size:12.5px;color:${C.mute};display:flex;gap:6px;align-items:center;margin-top:2px">${I('star', { size: 13, color: C.gold, fill: C.gold })}<b style="color:${C.navy}">4,8</b> · 126 avis · Niamey</div></div>
        ${UI.chip('Ouvert', { dot: true })}</div>
      </div>
      <div style="position:absolute;left:20px;top:262px;width:350px;display:flex;gap:8px">${['Tout', 'Épicerie', 'Boissons', 'Hygiène'].map((l, i) => `<span style="height:34px;padding:0 14px;border-radius:99px;display:flex;align-items:center;font-size:13px;font-weight:700;background:${i ? '#fff' : C.navy};color:${i ? C.slate : '#fff'};border:1px solid ${i ? C.line : C.navy}">${l}</span>`).join('')}</div>
      <div style="position:absolute;left:20px;top:312px;width:350px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${prods.map(([n, l, p], i) => `<div class="js-prod" style="background:#fff;border-radius:18px;border:1px solid ${C.line};overflow:hidden;position:relative"><div style="height:112px;background:url(${img(n)}) center/cover"></div>
          <div style="padding:8px 11px 10px"><div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px"><span style="font-size:15px;font-weight:800;color:${C.orange}">${p}</span>
          <span class="js-add" style="width:28px;height:28px;border-radius:9px;background:${C.navy};color:#fff;display:grid;place-items:center">${I('plus', { size: 16, color: '#fff', sw: 2.6 })}</span></div></div></div>`).join('')}
      </div>
      <div class="js-cartbar" style="position:absolute;left:16px;top:752px;width:358px;height:64px;border-radius:20px;background:${C.navy};color:#fff;display:flex;align-items:center;padding:0 10px 0 18px;box-shadow:0 18px 40px -12px rgba(15,23,42,.6)">
        <div style="flex:1"><div style="font-size:12px;opacity:.7;font-weight:600"><span class="js-count">2 articles</span></div><div style="font-size:18px;font-weight:800;letter-spacing:-.02em" class="js-total">21 750 F</div></div>
        <div class="js-order" style="height:46px;padding:0 18px;border-radius:14px;background:${C.orange};display:flex;align-items:center;gap:6px;font-weight:800;font-size:15px">Commander ${I('chevron', { size: 18, color: '#fff', sw: 2.6 })}</div></div>`;
  };

  /* ---------- Restaurant ---------- */
  UI.resto = () => {
    const dishes = [['Riz sauce arachide', 'Viande de bœuf, riz parfumé', '1 500 F', '#B45309'], ['Brochettes de mouton', 'Grillées au feu de bois, 6 pièces', '2 000 F', '#7C2D12'], ['Poulet braisé', 'Entier, attiéké et piment', '4 500 F', '#C2410C'], ['Jus de bissap', 'Frais, 50 cl', '500 F', '#9F1239']];
    return `${UI.header('Chez Mariama', { back: true })}
      <div style="position:absolute;left:20px;top:116px;width:350px">
        <div style="display:flex;gap:8px;align-items:center;font-size:13px;color:${C.mute};font-weight:500">${UI.chip('Ouvert · ferme à 23 h', { dot: true })}<span>${I('clock', { size: 14, color: C.mute })}</span>25–35 min</div>
        <div style="display:flex;gap:8px;margin-top:14px">${['Plats', 'Grillades', 'Boissons'].map((l, i) => `<span style="height:34px;padding:0 14px;border-radius:99px;display:flex;align-items:center;font-size:13px;font-weight:700;background:${i ? '#fff' : C.orange};color:${i ? C.slate : '#fff'};border:1px solid ${i ? C.line : C.orange}">${l}</span>`).join('')}</div>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
        ${dishes.map(([n, d, p, col], i) => `<div class="js-dish" style="background:#fff;border-radius:18px;border:1px solid ${C.line};padding:12px;display:flex;gap:12px;align-items:center">
          <div style="width:74px;height:74px;border-radius:16px;background:radial-gradient(circle at 35% 30%,#fff3 0,#fff0 40%),radial-gradient(circle at 50% 55%,${col} 0 42%,#F5E6D3 43% 60%,#E8D5BE 61%);flex:none"></div>
          <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px">${n}</div><div style="font-size:12px;color:${C.mute};margin-top:2px">${d}</div><div style="font-weight:800;color:${C.orange};margin-top:4px;font-size:15px">${p}</div></div>
          <span class="js-dadd" style="width:34px;height:34px;border-radius:11px;background:${i === 0 ? C.orange : C.navy};display:grid;place-items:center">${I(i === 0 ? 'check' : 'plus', { size: 18, color: '#fff', sw: 2.6 })}</span></div>`).join('')}
        </div>
      </div>
      <div class="js-track" style="position:absolute;left:16px;top:640px;width:358px;border-radius:22px;background:#fff;padding:16px 18px;box-shadow:0 18px 40px -14px rgba(15,23,42,.35);border:1px solid ${C.line}">
        <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:800;font-size:15px">Commande #A7F2</div><span class="js-tstate">${UI.chip('En cuisine', { bg: C.peach, color: C.orangeDeep, dot: true })}</span></div>
        <div style="display:flex;gap:6px;margin-top:14px">${[0, 1, 2, 3].map(i => `<div style="flex:1;height:6px;border-radius:3px;background:${C.line};overflow:hidden"><div class="js-seg" style="height:100%;width:0;background:${C.orange}"></div></div>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11.5px;color:${C.mute};font-weight:600"><span>Reçue</span><span>En cuisine</span><span>En livraison</span><span>Livrée</span></div>
      </div>`;
  };

  /* ---------- Hôtel ---------- */
  UI.hotel = () => {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    let cal = '';
    for (let d = 1; d <= 31; d++) {
      const off = 2; // le 1er tombe un mercredi
      cal += `<div class="js-day" data-d="${d}" style="height:38px;border-radius:12px;display:grid;place-items:center;font-size:14px;font-weight:600;${d === 1 ? `grid-column-start:${off + 1};` : ''}">${d}</div>`;
    }
    return `${UI.header('Résidence Amani', { back: true })}
      <div style="position:absolute;left:20px;top:116px;width:350px">
        <div style="height:150px;border-radius:22px;overflow:hidden;position:relative;background:linear-gradient(180deg,#F6E3D3 0%,#EED3BD 100%)">
          <div style="position:absolute;left:228px;top:16px;width:100px;height:74px;border-radius:10px;background:linear-gradient(180deg,#9FD3F0,#D9EEF8 70%,#F8D9B8);border:5px solid #FFF8F1;box-shadow:0 4px 10px rgba(120,70,40,.15)"><div style="position:absolute;right:16px;top:12px;width:20px;height:20px;border-radius:10px;background:#FFE7A3"></div><div style="position:absolute;left:44px;top:0;width:3px;height:100%;background:#FFF8F1"></div></div>
          <div style="position:absolute;left:0;top:112px;width:100%;height:38px;background:linear-gradient(180deg,#D9B08C,#C99A74)"></div>
          <div style="position:absolute;left:52px;top:46px;width:156px;height:62px;border-radius:18px 18px 6px 6px;background:linear-gradient(180deg,#24324A,#0F172A)"></div>
          <div style="position:absolute;left:40px;top:92px;width:180px;height:38px;border-radius:12px;background:linear-gradient(180deg,#FFFFFF,#EEF2F7);box-shadow:0 6px 0 #B98C68"></div>
          <div style="position:absolute;left:58px;top:78px;width:66px;height:24px;border-radius:12px;background:#fff;box-shadow:0 2px 4px rgba(15,23,42,.15)"></div>
          <div style="position:absolute;left:136px;top:78px;width:66px;height:24px;border-radius:12px;background:#fff;box-shadow:0 2px 4px rgba(15,23,42,.15)"></div>
          <div style="position:absolute;left:40px;top:108px;width:180px;height:16px;border-radius:4px;background:linear-gradient(90deg,#FF7A1A,#FF4D00)"></div>
          <div style="position:absolute;left:236px;top:96px;width:44px;height:30px;border-radius:6px;background:#8B5E3C"></div>
          <div style="position:absolute;left:248px;top:62px;width:20px;height:34px;background:#5B3A22;border-radius:2px"></div>
          <div style="position:absolute;left:236px;top:44px;width:44px;height:26px;border-radius:12px 12px 4px 4px;background:#FFE7C2;box-shadow:0 0 24px 8px rgba(255,214,150,.6)"></div>
          <div style="position:absolute;left:14px;top:14px">${UI.chip('Chambre double · 2 pers.', { bg: '#fff', color: C.navy, h: 28 })}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><div style="font-weight:800;font-size:17px">Octobre 2026</div><div style="font-size:13px;color:${C.green};font-weight:700">3 chambres libres</div></div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px;font-size:12px;color:${C.mute};font-weight:700;text-align:center">${days.map(d => `<div>${d}</div>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:6px;text-align:center">${cal}</div>
      </div>
      <div style="position:absolute;left:16px;top:690px;width:358px;display:flex;align-items:center;gap:12px">
        <div style="flex:1"><div style="font-size:12px;color:${C.mute};font-weight:600" class="js-nights">2 nuits · 18 → 20 oct.</div><div style="font-size:21px;font-weight:800;letter-spacing:-.02em">50 000 F</div></div>
        <div style="width:170px">${UI.btn('Réserver', { cls: 'js-book' })}</div></div>`;
  };

  /* ---------- Transport ---------- */
  UI.qr = (n = 25, seed = 7, size = 200, color = C.navy) => {
    const r = A.rand(seed), c = size / n; let s = '';
    const finder = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}" rx="${c * 1.2}" fill="${color}"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" rx="${c * .8}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}" rx="${c * .6}" fill="${color}"/>`;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inF && r() > .52) s += `<rect x="${x * c + .4}" y="${y * c + .4}" width="${c - .8}" height="${c - .8}" rx="${c * .3}" fill="${color}"/>`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${s}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
  };
  UI.ticket = () => `${UI.header('Mon billet', { back: true })}
    <div style="position:absolute;left:20px;top:122px;width:350px;border-radius:26px;background:${C.navy};color:#fff;overflow:hidden;box-shadow:0 24px 50px -20px rgba(15,23,42,.6)">
      <div style="padding:20px 22px 18px;background:linear-gradient(135deg,#1E293B,${C.navy})">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:${C.orange2};letter-spacing:.06em">${I('bus', { size: 16, color: C.orange2 })} VOYAGES SAHEL</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px">
          <div><div style="font-size:30px;font-weight:800;letter-spacing:-.03em">Niamey</div><div style="font-size:12.5px;opacity:.65">Départ 06:00</div></div>
          <div style="flex:1;margin:0 10px 16px;border-top:2px dashed rgba(255,255,255,.35);position:relative"><div style="position:absolute;left:50%;top:-13px;transform:translateX(-50%);color:${C.orange}">${I('bus', { size: 22, color: C.orange })}</div></div>
          <div style="text-align:right"><div style="font-size:30px;font-weight:800;letter-spacing:-.03em">Maradi</div><div style="font-size:12.5px;opacity:.65">Arrivée 15:30</div></div></div>
        <div style="display:flex;gap:22px;margin-top:16px;font-size:12px"><div><div style="opacity:.6">Date</div><b style="font-size:15px">Sam. 17 oct.</b></div><div><div style="opacity:.6">Siège</div><b style="font-size:15px">14</b></div><div><div style="opacity:.6">Passager</div><b style="font-size:15px">Ibrahim S.</b></div></div>
      </div>
      <div style="position:relative;height:0;border-top:2px dashed rgba(255,255,255,.18)"><div style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:14px;background:#F8FAFC"></div><div style="position:absolute;right:-14px;top:-14px;width:28px;height:28px;border-radius:14px;background:#F8FAFC"></div></div>
      <div style="padding:22px;display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="position:relative;padding:14px;background:#fff;border-radius:20px">${UI.qr(25, 11, 196)}<div class="js-scan" style="position:absolute;left:8px;width:calc(100% - 16px);height:3px;border-radius:2px;background:${C.orange};box-shadow:0 0 18px 4px rgba(255,77,0,.6);top:20px;opacity:0"></div></div>
        <div style="font-size:13px;opacity:.7">Montrez ce code au départ</div>
      </div>
    </div>
    <div class="js-valid" style="position:absolute;left:20px;top:716px;width:350px;opacity:0">${UI.btn('Billet validé · Bon voyage !', { bg: C.green, icon: 'check', flat: true })}</div>`;

  /* ---------- Cartes flottantes ---------- */
  UI.card = (parent, o = {}) => {
    const dark = o.dark;
    const el = A.el('div', {
      cls: 'abs', style: {
        width: (o.w ?? 420) + 'px', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px 16px 16px', borderRadius: '26px',
        background: dark ? 'rgba(30,41,59,.92)' : '#FFFFFF', color: dark ? '#fff' : C.navy, fontFamily: 'Geist',
        border: dark ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(226,232,240,.9)',
        boxShadow: '0 1px 0 rgba(255,255,255,.6) inset, 0 30px 60px -20px rgba(2,6,23,.55), 0 10px 22px -12px rgba(2,6,23,.35)',
        transformOrigin: '50% 50%',
      }
    }, parent);
    el.innerHTML = `<div style="width:60px;height:60px;border-radius:18px;flex:none;display:grid;place-items:center;background:${o.tone ?? C.orange};color:#fff">${I(o.icon ?? 'bell', { size: 30, color: '#fff', sw: 2.2 })}</div>
      <div style="flex:1;min-width:0"><div style="font-size:${o.ts ?? 25}px;font-weight:800;letter-spacing:-.025em;white-space:nowrap">${o.title ?? ''}</div>${o.sub ? `<div style="font-size:${o.ss ?? 19}px;font-weight:500;opacity:.66;margin-top:1px;white-space:nowrap">${o.sub}</div>` : ''}</div>
      ${o.right ? `<div style="font-size:${o.rs ?? 25}px;font-weight:800;letter-spacing:-.02em;color:${o.rc ?? C.orange};white-space:nowrap">${o.right}</div>` : ''}`;
    return el;
  };
  /** apparition « pop » (ressort) d'une carte, puis sortie */
  UI.pop = (el, t, a, b = 1e9, o = {}) => {
    const k = A.P(t, a, a + (o.dur ?? .55), x => A.E.spring(x));
    const q = A.P(t, b, b + .28, A.E.cubicIn);
    const s = A.mix(o.from ?? .6, 1, k) * A.mix(1, .85, q);
    A.T(el, { x: o.x ?? 0, y: (o.y ?? 0) + (1 - k) * (o.dy ?? 40) - q * 30, z: o.z ?? 0, ry: o.ry, rx: o.rx, r: o.r, s, o: A.lin(t, a, a + .12) * (1 - q), blur: (o.blurBase ?? 0) + q * 6 });
    el.style.visibility = t >= a && t < b + .28 ? 'visible' : 'hidden';
  };

  /* ---------- Toucher (doigt invisible) ---------- */
  UI.tap = parent => A.el('div', { cls: 'abs', style: { width: '64px', height: '64px', marginLeft: '-32px', marginTop: '-32px', borderRadius: '32px', background: 'rgba(15,23,42,.18)', border: '2px solid rgba(255,255,255,.9)', boxShadow: '0 0 0 1px rgba(15,23,42,.15)', zIndex: 60, pointerEvents: 'none' } }, parent);
  /** toucher à l'instant a, à (x, y) dans l'écran */
  UI.tapAt = (el, t, a, x, y) => {
    const k = A.lin(t, a - .18, a + .45);
    const press = A.P(t, a - .18, a, A.E.cubicOut) * (1 - A.P(t, a + .05, a + .45, A.E.cubicOut));
    const ring = A.P(t, a, a + .45, A.E.expoOut);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.transform = `scale(${(.7 + ring * .7 - press * .1).toFixed(3)})`;
    el.style.opacity = (k > 0 && k < 1 ? press * .9 + (1 - ring) * .35 * (t > a ? 1 : 0) : 0).toFixed(3);
  };
})(window.A);
