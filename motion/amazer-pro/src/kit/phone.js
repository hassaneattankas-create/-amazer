/* phone.js — téléphone réaliste en HTML/CSS 3D.
 * Écran 390×844 (taille réelle d'un mobile) : les interfaces y sont dessinées à l'échelle de l'app.
 *   const ph = A.Phone.make(parent);  const s = A.Phone.screen(ph, 'home', html);
 *   A.Phone.pose(ph, {x, y, z, rx, ry, r, s});   // x,y = centre du téléphone sur la scène
 */
(function (A) {
  const C = A.C;
  const W = 414, H = 868, SW = 390, SH = 844;
  const Phone = A.Phone = { W, H, SW, SH };

  Phone.make = (parent, o = {}) => {
    const root = A.el('div', { cls: 'abs', style: { width: W + 'px', height: H + 'px', transformStyle: 'preserve-3d', transformOrigin: '50% 50%' } }, parent);
    // ombre portée au sol (élément séparé, sous le téléphone)
    const shadow = A.el('div', { cls: 'abs', style: { width: W + 'px', height: H + 'px', borderRadius: '64px', background: 'rgba(0,0,0,.55)', filter: 'blur(38px)', transform: 'translate3d(0,40px,-60px) scale(.92)' } }, root);
    // tranche (épaisseur simulée)
    A.el('div', { cls: 'abs', style: { width: W + 'px', height: H + 'px', borderRadius: '66px', background: 'linear-gradient(90deg,#1b1f27,#4a505c 12%,#22262e 50%,#4a505c 88%,#1b1f27)', transform: 'translateZ(-7px)' } }, root);
    const frame = A.el('div', {
      cls: 'abs', style: {
        width: W + 'px', height: H + 'px', borderRadius: '66px',
        background: 'linear-gradient(145deg,#5b616d 0%,#2a2e36 18%,#16191f 50%,#2a2e36 82%,#6b717d 100%)',
        boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.22), inset 0 0 0 4px #0d0f13, 0 2px 0 rgba(255,255,255,.08)'
      }
    }, root);
    // boutons latéraux
    [[-3, 190, 70], [-3, 280, 70], [W - 1, 230, 104]].forEach(([x, y, h]) => A.el('div', { cls: 'abs', style: { left: x + 'px', top: y + 'px', width: '4px', height: h + 'px', borderRadius: '2px', background: 'linear-gradient(90deg,#3b404a,#6b717d)' } }, frame));
    const glass = A.el('div', { cls: 'abs', style: { left: '12px', top: '12px', width: SW + 'px', height: SH + 'px', borderRadius: '54px', background: '#000', overflow: 'hidden' } }, frame);
    const screen = A.el('div', { cls: 'abs', style: { left: 0, top: 0, width: SW + 'px', height: SH + 'px', overflow: 'hidden', background: o.bg ?? '#F8FAFC', borderRadius: '54px', fontFamily: 'Geist', color: C.navy } }, glass);
    const content = A.el('div', { cls: 'abs', style: { left: 0, top: 0, width: SW + 'px', height: SH + 'px' } }, screen);
    // barre d'état
    const status = A.el('div', { cls: 'abs', style: { left: 0, top: 0, width: SW + 'px', height: '54px', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 34px 0 42px', fontWeight: 600, fontSize: '16px', letterSpacing: '-.01em' } }, screen);
    status.innerHTML = `<span class="ph-time">10:24</span><span style="display:flex;gap:6px;align-items:center">
      <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4" width="2" height="5" rx="1" fill="currentColor" opacity=".4"/></svg></span>`;
    // Dynamic Island
    A.el('div', { cls: 'abs', style: { left: (SW / 2 - 62) + 'px', top: '11px', width: '124px', height: '36px', borderRadius: '18px', background: '#000', zIndex: 30 } }, screen);
    // reflet de verre (se déplace avec la rotation)
    const glare = A.el('div', { cls: 'abs', style: { left: '-60%', top: '-20%', width: '220%', height: '140%', zIndex: 40, pointerEvents: 'none', background: 'linear-gradient(115deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.16) 46%,rgba(255,255,255,.04) 52%,rgba(255,255,255,0) 60%)' } }, glass);
    // indicateur d'accueil
    A.el('div', { cls: 'abs', style: { left: (SW / 2 - 70) + 'px', top: (SH - 14) + 'px', width: '140px', height: '5px', borderRadius: '3px', background: 'rgba(15,23,42,.85)', zIndex: 30 } }, screen);
    return { root, shadow, frame, screen, content, status, glare, screens: {} };
  };

  /** ajoute un écran (calque 390×844 dans l'écran) */
  Phone.screen = (ph, name, html = '', o = {}) => {
    const s = A.el('div', { cls: 'abs', style: { left: 0, top: 0, width: SW + 'px', height: SH + 'px', background: o.bg ?? '#F8FAFC', overflow: 'hidden' } }, ph.content, html);
    ph.screens[name] = s;
    return s;
  };

  /** barre d'état claire/sombre */
  Phone.statusTone = (ph, dark) => { ph.status.style.color = dark ? '#FFFFFF' : C.navy; };

  /** pose 3D : (x, y) = centre du téléphone sur la scène */
  Phone.pose = (ph, o) => {
    A.T(ph.root, { x: (o.x ?? 540) - W / 2, y: (o.y ?? 540) - H / 2, z: o.z ?? 0, rx: o.rx ?? 0, ry: o.ry ?? 0, r: o.r ?? 0, s: o.s ?? 1, o: o.o });
    const ry = o.ry ?? 0, rx = o.rx ?? 0;
    ph.glare.style.transform = `translate(${(-ry * 9).toFixed(1)}px,${(rx * 6).toFixed(1)}px)`;
    ph.shadow.style.opacity = (o.shadow ?? 1).toFixed(3);
  };
})(window.A);
