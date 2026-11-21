/* toon-scenes2.js — scènes « accroche » des pubs à personnages (nov. 2026) : rythme court, gros mots qui claquent,
 * chiffres qui montent, partage de lien. Mêmes conventions que toon-scenes.js : A.TS.scenes[type](P, a, b, X).
 *
 *   choc      — accroche plein écran : lignes de texte géantes qui claquent une à une (secousse), tampon rouge
 *               facultatif (« STOP ! »), un personnage surgit et réagit.
 *               P.lignes : ['Votre *téléphone*', 'peut vous *payer*.'] · P.tampon · P.fond : 'nuit' | 'orange' | 'creme'
 *               P.perso : 'aicha' | 'moussa' | 'ibrahim' | 'fati' | 'hamza' · P.humeur : 'surpris' | 'joie' | 'malin'
 *   compteur  — un montant géant qui monte (0 → P.montant), pièces qui pleuvent, le personnage saute de joie.
 *               P.montant · P.devise ('F') · P.avant (au-dessus) · P.apres (en dessous) · P.perso
 *   partage   — le personnage envoie son lien : la bulle part vers 4 amis, chacun s'inscrit (coche verte)
 *               et une pièce revient vers lui. P.lien · P.amis : ['Awa', 'Issa', …] · P.gain ('+ 500 F') · P.perso
 *   cartes    — cartes d'interface qui flottent en 3D (avantages, chiffres) autour du personnage.
 *               P.cartes : [{ titre, texte, icone: 'lien'|'zero'|'temps'|'argent'|'sac'|'moto' }] · P.perso
 */
(function (A) {
  const C = A.C, E = A.E, T = A.Toon, TS = A.TS, svgEl = T.svg;
  const NAVY = '#0F172A';
  const { box, put, sticker, playSticker, sparks, playSparks, PHONE_SMALL } = TS;
  const FONDS = {
    nuit: 'radial-gradient(ellipse at 50% 30%,#1E293B 0%,#0F172A 60%,#020617 100%)',
    orange: 'radial-gradient(ellipse at 50% 30%,#FF7A1A 0%,#FF4D00 55%,#D93F00 100%)',
    creme: 'radial-gradient(ellipse at 50% 30%,#FFF7ED 0%,#FFE8CC 60%,#FBD3A0 100%)',
  };
  const ENCRE = { nuit: '#fff', orange: '#fff', creme: NAVY };
  const ACCENT = { nuit: '#FF7A1A', orange: '#FFE08A', creme: C.orange };
  const castOf = id => T.CAST[id] ?? T.CAST.aicha;
  const stick = (el, P, D, d) => (P.sous_titres ?? d ?? []).map((s, i) => ({ st: sticker(el, s.texte, { y: s.y ?? 300, size: s.taille ?? 70, rot: i % 2 ? 2 : -2 }), de: s.de, a: s.a ?? D - .35 }));
  const playStick = (list, u) => list.forEach(s => playSticker(s.st, u, s.de ?? .15, s.a));
  const COIN = `<circle r="46" fill="#F59E0B"/><circle r="38" fill="#FCD34D"/><circle r="38" fill="none" stroke="#F59E0B" stroke-width="4" stroke-dasharray="6 6"/><text y="17" text-anchor="middle" font-family="Geist" font-weight="800" font-size="46" fill="#B45309">F</text>`;
  const fmt = n => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const holdPhone = p => { p.near.item.innerHTML = ''; const g = svgEl('g', {}, p.near.item); g.innerHTML = PHONE_SMALL; g.setAttribute('transform', 'rotate(-90) scale(1.1)'); return g; };

  /* ======================================================================
   * choc — l'accroche
   * ====================================================================== */
  TS.scenes.choc = (P, a, b, X) => ({
    id: 'choc', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      const f = P.fond ?? 'nuit';
      this.cam = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: FONDS[f], transformOrigin: '540px 960px' } }, el);
      // rayons lents derrière le texte
      this.rays = box(this.cam, 2600, 2600, 1300, 1300, `<g fill="#fff" opacity="${f === 'creme' ? .35 : .06}">${Array.from({ length: 18 }, (_, i) => `<path d="M 0 0 L -80 -1400 L 80 -1400 Z" transform="rotate(${i * 20})"/>`).join('')}</g>`);
      const lignes = P.lignes ?? ['Et si votre *téléphone*', 'vous *payait* ?'];
      const n = lignes.length;
      const t0 = P.de ?? .12, t1 = Math.max(t0 + .3, Math.min(this.D * .55, (P.fin_lignes ?? 1.6)));
      const longest = Math.max(...lignes.map(l => l.replace(/\*/g, '').length));
      const size = Math.min(P.taille ?? (n > 2 ? 120 : 138), Math.floor(1900 / Math.max(1, longest))); // la plus longue ligne tient dans l'écran
      this.lines = lignes.map((txt, i) => {
        const ty = A.Type.make(this.cam, txt, { size, weight: 800, align: 'center', color: ENCRE[f], accent: ACCENT[f], lh: 1, track: -.045 });
        return { ty, at: n > 1 ? t0 + (t1 - t0) * (i / (n - 1)) : t0, y: (P.y ?? 560) + (i - (n - 1) / 2) * size * 1.08 };
      });
      this.lines.forEach(l => { A.Type.place(l.ty, 540, l.y); l.ty.el.style.transformOrigin = '50% 50%'; X.cue(a + l.at, 'impact', .55); });
      if (P.tampon) {
        this.stamp = A.el('div', { cls: 'abs', style: { padding: '20px 54px 26px', background: '#DC2626', color: '#fff', font: '800 150px Geist', letterSpacing: '-.04em', borderRadius: '18px', border: '10px solid #fff', boxShadow: '0 30px 60px -20px rgba(0,0,0,.55)', zIndex: 40, whiteSpace: 'nowrap' } }, this.cam, P.tampon);
        this.stamp.style.left = (540 - this.stamp.offsetWidth / 2) + 'px';
        this.stamp.style.top = ((P.tampon_y ?? 1020) - this.stamp.offsetHeight / 2) + 'px';
        this.stampAt = P.tampon_de ?? t1 + .45;
        X.cue(a + this.stampAt, 'impact', .7); X.cue(a + this.stampAt + .02, 'whoosh', .3);
      }
      if (P.perso !== false) {
        this.p = T.person(this.cam, castOf(P.perso ?? 'aicha'));
        if (P.telephone) this.ph = holdPhone(this.p);
        this.pAt = P.perso_de ?? Math.max(.3, t1 - .2);
        X.cue(a + this.pAt, 'whoosh', .45);
      }
      this.sp = sparks(this.cam, 10, ACCENT[f]);
      this.st = stick(el, P, this.D);
    },
    seek(t) {
      const u = t - a, D = this.D;
      // secousse à chaque impact
      let shake = 0;
      for (const l of this.lines) shake += Math.max(0, 1 - (u - l.at) / .25) * (u >= l.at ? 1 : 0);
      if (this.stamp) shake += Math.max(0, 1 - (u - this.stampAt) / .3) * (u >= this.stampAt ? 1.4 : 0);
      const zoom = 1 + A.P(u, 0, D, E.sine) * .06;
      A.T(this.cam, { x: Math.sin(u * 83) * 16 * shake, y: Math.cos(u * 71) * 12 * shake, s: zoom, r: Math.sin(u * 57) * .6 * shake });
      put(this.rays, 540, 700, 1, u * 6);
      this.lines.forEach((l, i) => {
        const k = A.P(u, l.at, l.at + .32, E.backOut);
        const s = u < l.at ? 0 : 2.3 - 1.3 * k;
        l.ty.el.style.transform = `scale(${s.toFixed(3)}) rotate(${((1 - k) * (i % 2 ? 5 : -5)).toFixed(2)}deg)`;
        l.ty.el.style.opacity = (u >= l.at ? Math.min(1, A.lin(u, l.at, l.at + .08)) : 0).toFixed(3);
        A.Type.play(l.ty, u, l.at - .01, 1e9, { stagger: .02, dur: .25, tilt: 0 });
      });
      if (this.stamp) {
        const k = A.P(u, this.stampAt, this.stampAt + .28, E.backOut);
        this.stamp.style.transform = `rotate(${(-9 + (1 - k) * -14).toFixed(2)}deg) scale(${(u < this.stampAt ? 0 : 3 - 2 * k).toFixed(3)})`;
        this.stamp.style.opacity = (u >= this.stampAt ? Math.min(1, A.lin(u, this.stampAt, this.stampAt + .06)) : 0).toFixed(3);
        playSparks(this.sp, u, this.stampAt + .05, 540, P.tampon_y ?? 1020, 330);
      } else if (this.lines.length) {
        const last = this.lines[this.lines.length - 1];
        playSparks(this.sp, u, last.at + .05, 540, last.y, 300);
      }
      if (this.p) {
        const k = A.P(u, this.pAt, this.pAt + .5, E.spring);
        const hum = P.humeur ?? 'surpris';
        const bob = Math.sin(u * 5) * 6;
        this.p.pose({
          x: P.perso_x ?? 540, y: 2060 + (1 - k) * 700 + bob, s: P.perso_taille ?? 1.25, t: u, shadow: 0, flip: !!P.perso_flip,
          near: hum === 'malin' ? { sh: 70, el: 115 } : hum === 'joie' ? { sh: 160 + Math.sin(u * 8) * 10, el: 25 } : (this.ph ? { sh: 60, el: 105 } : { sh: 30, el: 150 }),
          far: hum === 'surpris' ? { sh: 25, el: 155 } : hum === 'joie' ? { sh: 165 + Math.cos(u * 8) * 10, el: 20 } : { sh: -6, el: 10 },
          mouth: hum === 'surpris' ? 'o' : hum === 'malin' ? 'smile' : 'grin',
          brow: hum === 'surpris' ? 1 : .5, browTilt: hum === 'malin' ? 8 : 0, blink: T.blink(u, 4), look: hum === 'malin' ? [6, 2] : [0, -6],
          headTilt: hum === 'malin' ? 8 : Math.sin(u * 3) * 3,
        });
      }
      playStick(this.st, u);
    },
  });

  /* ======================================================================
   * compteur — le montant qui monte
   * ====================================================================== */
  TS.scenes.compteur = (P, a, b, X) => ({
    id: 'compteur', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      const f = P.fond ?? 'orange';
      this.wrap = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: FONDS[f] } }, el);
      this.rays = box(this.wrap, 2600, 2600, 1300, 1300, `<g fill="#fff" opacity=".16">${Array.from({ length: 16 }, (_, i) => `<path d="M 0 0 L -90 -1400 L 90 -1400 Z" transform="rotate(${i * 22.5})"/>`).join('')}</g>`);
      this.avant = A.Type.make(this.wrap, P.avant ?? 'Vos *gains*', { size: 84, weight: 800, align: 'center', color: ENCRE[f], accent: ACCENT[f], lh: 1.05 });
      A.Type.place(this.avant, 540, 330);
      this.num = A.el('div', { cls: 'abs', style: { left: '0px', top: '430px', width: '1080px', textAlign: 'center', font: `800 ${P.taille ?? 230}px Geist`, letterSpacing: '-.05em', color: '#fff', textShadow: '0 18px 40px rgba(120,30,0,.45)', fontVariantNumeric: 'tabular-nums' } }, this.wrap, '0');
      this.apres = A.el('div', { cls: 'abs', style: { left: '50%', top: '760px', padding: '18px 44px', borderRadius: '99px', background: NAVY, color: '#fff', font: '800 52px Geist', whiteSpace: 'nowrap', transform: 'translateX(-50%)' } }, this.wrap, P.apres ?? 'sans stock, sans boutique');
      this.p = T.person(this.wrap, castOf(P.perso ?? 'fati'));
      this.ph = holdPhone(this.p);
      this.coins = Array.from({ length: 22 }, (_, i) => { const c = box(this.wrap, 100, 100, 50, 50, COIN); c.style.zIndex = 30; return c; });
      this.sp = sparks(this.wrap, 12, '#FDE047');
      this.t0 = .35; this.t1 = Math.max(this.t0 + .8, Math.min(this.D - 1.0, P.duree_compte ?? 2.2));
      for (let k = 0; k < 9; k++) X.cue(a + this.t0 + (this.t1 - this.t0) * k / 9, 'tick', .25, (k % 2 ? .3 : -.3));
      X.cue(a + this.t1, 'kaching', .7); X.cue(a + this.t1 + .05, 'shimmer', .45);
      this.st = stick(el, P, this.D);
    },
    seek(t) {
      const u = t - a, D = this.D, t0 = this.t0, t1 = this.t1;
      this.wrap.style.clipPath = `circle(${(A.P(u, 0, .4, E.expoOut) * 1200).toFixed(1)}px at 540px 960px)`;
      put(this.rays, 540, 640, 1, u * 9);
      A.Type.play(this.avant, u, .1, 1e9, { stagger: .05 });
      const k = A.P(u, t0, t1, E.expoOut);
      const v = (P.montant ?? 25000) * k;
      this.num.textContent = `${P.signe ?? '+'} ${fmt(v)} ${P.devise ?? 'F'}`;
      const pop = A.P(u, t1, t1 + .35, E.spring);
      this.num.style.transform = `scale(${(u < t0 ? .6 : u < t1 ? .9 + .1 * k : 1 + .12 * Math.sin(pop * Math.PI)).toFixed(3)})`;
      this.num.style.opacity = A.lin(u, t0 - .1, t0 + .1).toFixed(3);
      const ak = A.P(u, t1 + .1, t1 + .5, E.backOut);
      this.apres.style.transform = `translateX(-50%) scale(${(u < t1 + .1 ? 0 : ak).toFixed(3)})`;
      playSparks(this.sp, u, t1, 540, 560, 420);
      this.coins.forEach((c, i) => {
        const r = (i * 61 % 100) / 100, st = t0 + (i % 11) * .12, q = Math.max(0, u - st);
        put(c, 70 + r * 940 + Math.sin(q * 3 + i) * 30, -120 + q * q * 900 + (i % 5) * 20, .8 + (i % 3) * .15, q * (160 + i * 9), u >= st && u < D ? 1 : 0);
      });
      const joy = t1, up = A.P(u, joy, joy + .3, E.backOut);
      const hop = u > joy ? Math.abs(Math.sin((u - joy) * 7.5)) * 60 * (1 - A.lin(u, D - .6, D)) : 0;
      this.p.pose({
        x: 540, y: 1900 - hop, s: 1.2, t: u, shadow: 0,
        near: u < joy ? { sh: 60, el: 105 } : { sh: A.mix(60, 165, up), el: A.mix(105, 20, up) },
        far: u < joy ? { sh: 25, el: 150 } : { sh: A.mix(25, 172, up), el: A.mix(150, 15, up) },
        mouth: u < joy ? 'o' : 'grin', brow: .8, blink: T.blink(u, 5), look: u < joy ? [0, -8] : [0, -4], headTilt: u < joy ? 0 : Math.sin(u * 7) * 5,
        legN: hop > 10 ? { hip: 20, knee: 40 } : undefined, legF: hop > 10 ? { hip: -10, knee: 30 } : undefined,
      });
      playStick(this.st, u);
    },
  });

  /* ======================================================================
   * partage — un lien, quatre amis, des pièces qui reviennent
   * ====================================================================== */
  TS.scenes.partage = (P, a, b, X) => ({
    id: 'partage', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      this.wrap = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: FONDS.creme } }, el);
      // pointillés de la toile de partage
      const amis = (P.amis ?? ['Awa', 'Issa', 'Mariama', 'Seyni']).slice(0, 4);
      const SPOTS = [[200, 520], [880, 520], [170, 1010], [910, 1010]];
      const CX = 540, CY = 1240;
      this.web = box(this.wrap, 1080, 1920, 0, 0, SPOTS.slice(0, amis.length).map(([x, y]) => `<path d="M ${CX} ${CY - 260} Q ${(CX + x) / 2} ${Math.min(CY, y) - 160} ${x} ${y}" stroke="#FDBA74" stroke-width="8" stroke-dasharray="4 22" stroke-linecap="round" fill="none"/>`).join(''));
      const COLS = ['#16A34A', '#2563EB', '#DB2777', '#F59E0B'];
      this.friends = amis.map((nom, i) => {
        const [x, y] = SPOTS[i];
        const d = A.el('div', { cls: 'abs', style: { left: (x - 110) + 'px', top: (y - 110) + 'px', width: '220px', height: '262px', textAlign: 'center', zIndex: 20, transformOrigin: '50% 50%' } }, this.wrap,
          `<div style="width:170px;height:170px;margin:0 auto;border-radius:50%;background:${COLS[i % 4]};border:10px solid #fff;box-shadow:0 20px 40px -18px rgba(90,40,0,.5);display:grid;place-items:center;font:800 76px Geist;color:#fff">${nom[0]}</div>
           <div style="font:800 40px Geist;color:${NAVY};margin-top:12px">${nom}</div>
           <div class="ok" style="position:absolute;right:6px;top:0;width:76px;height:76px;border-radius:50%;background:#22C55E;border:6px solid #fff;display:grid;place-items:center"><svg width="40" height="40" viewBox="-10 -10 20 20"><path d="M -6 0 L -2 4.5 L 6.5 -5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`);
        return { d, ok: d.querySelector('.ok'), x, y };
      });
      this.link = A.el('div', { cls: 'abs', style: { padding: '18px 34px', borderRadius: '30px', background: '#fff', color: C.orange, font: '800 40px Geist', boxShadow: '0 20px 40px -16px rgba(90,40,0,.45)', zIndex: 25, whiteSpace: 'nowrap', border: `5px solid ${C.orange}` } }, this.wrap, `🔗 ${P.lien ?? 'amazer.store/?ref=fati'}`);
      this.lw = this.link.offsetWidth; this.lh = this.link.offsetHeight;
      this.links = this.friends.map(() => { const c = this.link.cloneNode(true); c.style.font = '800 30px Geist'; c.style.padding = '12px 22px'; c.textContent = '🔗 lien'; this.wrap.appendChild(c); return c; });
      this.coins = this.friends.map(() => { const c = box(this.wrap, 100, 100, 50, 50, COIN); c.style.zIndex = 28; return c; });
      this.gain = A.el('div', { cls: 'abs', style: { padding: '14px 30px', borderRadius: '99px', background: '#16A34A', color: '#fff', font: '800 54px Geist', zIndex: 30, whiteSpace: 'nowrap' } }, this.wrap, P.gain ?? '+ 500 F');
      this.p = T.person(this.wrap, castOf(P.perso ?? 'fati'));
      this.ph = holdPhone(this.p);
      const n = this.friends.length;
      this.send = .6; this.arrive = this.friends.map((_, i) => this.send + .35 + i * .28);
      this.back = this.arrive.map(t => t + Math.min(1.1, Math.max(.6, (this.D - 2.6) / 2)));
      X.cue(a + this.send - .05, 'whoosh', .5);
      this.arrive.forEach((t, i) => X.cue(a + t, 'pop', .5, i % 2 ? .4 : -.4));
      this.back.forEach((t, i) => X.cue(a + t + .4, 'kaching', .35, i % 2 ? .3 : -.3));
      this.st = stick(el, P, this.D);
    },
    seek(t) {
      const u = t - a, D = this.D, CX = 540, CY = 980;
      this.wrap.style.opacity = A.P(u, 0, .2, E.cubicOut).toFixed(3);
      this.web.style.opacity = A.lin(u, this.send, this.send + .4).toFixed(3);
      // le grand lien apparaît au-dessus du téléphone puis éclate en 4
      const lk = A.P(u, .05, .45, E.backOut), gone = A.P(u, this.send, this.send + .15, E.cubicIn);
      this.link.style.transform = `translate(${(CX - this.lw / 2).toFixed(1)}px,${(CY - this.lh / 2).toFixed(1)}px) scale(${(lk * (1 - gone)).toFixed(3)}) rotate(${(-3 + Math.sin(u * 4) * 2).toFixed(2)}deg)`;
      this.friends.forEach((fr, i) => {
        const fin = A.P(u, .1 + i * .08, .5 + i * .08, E.backOut);
        const arrived = u >= this.arrive[i], ok = A.P(u, this.arrive[i], this.arrive[i] + .3, E.backOut);
        fr.d.style.transform = `scale(${(fin * (arrived ? 1 + .12 * Math.sin(ok * Math.PI) : 1)).toFixed(3)}) translateY(${(Math.sin(u * 2.5 + i) * 8).toFixed(1)}px)`;
        fr.ok.style.transform = `scale(${(arrived ? ok : 0).toFixed(3)})`;
        // petit lien qui voyage du téléphone vers l'ami
        const k = A.P(u, this.send, this.arrive[i], E.cubicInOut);
        const x = A.mix(CX, fr.x, k), y = A.mix(CY, fr.y, k) - Math.sin(k * Math.PI) * 160;
        const L = this.links[i];
        L.style.transform = `translate(${(x - 70).toFixed(1)}px,${(y - 30).toFixed(1)}px) scale(${(.8 + .2 * Math.sin(k * Math.PI)).toFixed(3)})`;
        L.style.opacity = (u > this.send && u < this.arrive[i] ? 1 : 0).toFixed(2);
        // la pièce revient vers le personnage
        const c = A.P(u, this.back[i], this.back[i] + .45, E.cubicIn);
        put(this.coins[i], A.mix(fr.x, CX, c), A.mix(fr.y, 1330, c) - Math.sin(c * Math.PI) * 120, .9 - c * .3, c * 360, u > this.back[i] && c < 1 ? 1 : 0);
      });
      const got = this.back.filter(tb => u > tb + .45).length;
      const gk = got ? A.P(u, this.back[got - 1] + .45, this.back[got - 1] + .8, E.spring) : 0;
      this.gain.textContent = P.gains ? P.gains[Math.max(0, got - 1)] : (P.gain ?? '+ 500 F');
      A.T(this.gain, { x: 760, y: 1250, s: got ? .7 + .3 * gk : 0, r: -4 });
      const joy = got >= this.friends.length;
      this.p.pose({
        x: CX, y: 1920 + 40, s: 1.12, t: u, shadow: 0,
        near: { sh: 60, el: 105 },
        far: joy ? { sh: 170, el: 15 } : { sh: -6, el: 10 },
        mouth: got ? 'grin' : 'smile', brow: .6, blink: T.blink(u, 4), look: u < this.send ? [4, 6] : [0, -6], headTilt: Math.sin(u * 3) * 4,
      });
      playStick(this.st, u);
    },
  });

  /* ======================================================================
   * cartes — avantages en cartes flottantes autour du personnage
   * ====================================================================== */
  const ICO = {
    lien: '<path d="M -4 4 L 4 -4 M -7 0 L -10 3 Q -13 8 -8 13 Q -3 16 1 11 L 4 8 M 7 0 L 10 -3 Q 13 -8 8 -13 Q 3 -16 -1 -11 L -4 -8" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    zero: '<text y="10" text-anchor="middle" font-family="Geist" font-weight="800" font-size="28" fill="#fff">0 F</text>',
    temps: '<circle r="12" stroke="#fff" stroke-width="3.2" fill="none"/><path d="M 0 -7 L 0 0 L 5 4" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    argent: '<rect x="-14" y="-9" width="28" height="18" rx="4" stroke="#fff" stroke-width="3.2" fill="none"/><circle r="4.5" fill="#fff"/>',
    sac: '<path d="M -10 -4 L 10 -4 L 12 13 L -12 13 Z M -5 -4 Q -5 -12 0 -12 Q 5 -12 5 -4" stroke="#fff" stroke-width="3.2" fill="none" stroke-linejoin="round"/>',
    moto: '<circle cx="-9" cy="6" r="6" stroke="#fff" stroke-width="3" fill="none"/><circle cx="10" cy="6" r="6" stroke="#fff" stroke-width="3" fill="none"/><path d="M -9 6 L -2 -4 L 6 -4 L 10 6 M 2 -4 L 0 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
    ok: '<path d="M -11 1 L -3 9 L 12 -9" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    bulle: '<path d="M -13 -10 L 13 -10 Q 15 -10 15 -8 L 15 6 Q 15 8 13 8 L -2 8 L -9 14 L -8 8 L -13 8 Q -15 8 -15 6 L -15 -8 Q -15 -10 -13 -10 Z" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/>',
  };
  const ICOL = ['#FF4D00', '#16A34A', '#2563EB', '#7C3AED', '#DB2777'];
  TS.scenes.cartes = (P, a, b, X) => ({
    id: 'cartes', a, b,
    build(el) {
      el.style.display = 'block';
      this.D = b - a;
      this.wrap = A.el('div', { cls: 'abs', style: { width: '1080px', height: '1920px', background: FONDS[P.fond ?? 'creme'], perspective: '1400px' } }, el);
      if (P.titre) { this.titre = A.Type.make(this.wrap, P.titre, { size: 92, weight: 800, align: 'center', color: ENCRE[P.fond ?? 'creme'], accent: ACCENT[P.fond ?? 'creme'], lh: 1.02, track: -.04 }); A.Type.place(this.titre, 540, 250); }
      const list = (P.cartes ?? []).slice(0, 4);
      const n = list.length;
      this.cards = list.map((c, i) => {
        const d = A.el('div', { cls: 'abs', style: { left: '120px', top: '0px', width: '840px', minHeight: '170px', borderRadius: '40px', background: '#fff', boxShadow: '0 30px 60px -26px rgba(90,40,0,.5)', display: 'flex', alignItems: 'center', gap: '28px', padding: '24px 34px', boxSizing: 'border-box', zIndex: 20 + i, transformOrigin: '50% 50%' } }, this.wrap,
          `<div style="width:110px;height:110px;border-radius:32px;background:${ICOL[i % 5]};display:grid;place-items:center;flex:none"><svg width="76" height="76" viewBox="-18 -18 36 36">${ICO[c.icone] ?? ICO.argent}</svg></div>
           <div style="flex:1;min-width:0"><div style="font:800 50px Geist;color:${NAVY};letter-spacing:-.02em">${c.titre}</div>${c.texte ? `<div style="font:600 34px Geist;color:#475569;margin-top:4px">${c.texte}</div>` : ''}</div>`);
        const at = (P.de ?? .35) + i * Math.min(.7, Math.max(.35, (this.D - 1.6) / Math.max(1, n)));
        X.cue(a + at, 'pop', .5, i % 2 ? .35 : -.35); X.cue(a + at, 'whoosh', .25);
        return { d, at, y: (P.y ?? 430) + i * 205 };
      });
      this.p = P.perso === false ? null : T.person(this.wrap, castOf(P.perso ?? 'hamza'));
      if (this.p && P.telephone !== false) this.ph = holdPhone(this.p);
      this.st = stick(el, P, this.D);
    },
    seek(t) {
      const u = t - a, D = this.D;
      this.wrap.style.opacity = A.P(u, 0, .2, E.cubicOut).toFixed(3);
      if (this.titre) A.Type.play(this.titre, u, .05, 1e9, { stagger: .05 });
      this.cards.forEach((c, i) => {
        const k = A.P(u, c.at, c.at + .5, E.spring);
        const side = i % 2 ? 1 : -1;
        const fl = Math.sin(u * 2 + i * 1.3);
        c.d.style.transform = `translate(${((1 - k) * side * 900).toFixed(1)}px,${(c.y + fl * 8).toFixed(1)}px) rotateY(${((1 - k) * side * -40 + fl * 3).toFixed(2)}deg) rotate(${(side * 1.5 * (1 - k) + fl * .6).toFixed(2)}deg)`;
        c.d.style.opacity = (u >= c.at ? Math.min(1, A.lin(u, c.at, c.at + .15)) : 0).toFixed(3);
      });
      if (this.p) {
        const k = A.P(u, .1, .6, E.spring);
        this.p.pose({
          x: P.perso_x ?? 540, y: 2150 + (1 - k) * 500, s: 1.05, t: u, shadow: 0,
          near: { sh: 60, el: 105 }, far: { sh: 150 + Math.sin(u * 6) * 8, el: 30 },
          mouth: 'grin', brow: .6, blink: T.blink(u, 4), look: [0, -6], headTilt: Math.sin(u * 2.5) * 4,
        });
      }
      playStick(this.st, u);
    },
  });
})(window.A);
