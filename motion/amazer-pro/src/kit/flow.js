/* flow.js — enchaînement d'écrans dans le téléphone + touchers placés sur les vrais éléments.
 *   const fl = A.Flow.make(ph, [['search', UI.search()], ['product', UI.product()]], [5.3]);
 *   fl.seek(t);                              // poussée type iOS à chaque instant de changement
 *   fl.tap(t, 7.0, '.js-addcart', 'product') // toucher centré sur l'élément (un seul toucher visible à la fois)
 */
(function (A) {
  const E = A.E, UI = A.UI;
  A.Flow = {};
  const posIn = (e, stop) => { let x = 0, y = 0; while (e && e !== stop) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y }; };

  A.Flow.make = (ph, list, switches) => {
    const scr = {}, order = [];
    list.forEach(([name, html, bg]) => { scr[name] = A.Phone.screen(ph, name, html, { bg }); order.push(name); });
    const tapEl = UI.tap(ph.screen);
    let tapped = false;
    const fl = {
      scr, order, switches,
      /** centre d'un élément (sélecteur ou élément) dans le repère de l'écran */
      center(sel, name) {
        const s = scr[name], e = typeof sel === 'string' ? s.querySelector(sel) : sel;
        const p = posIn(e, s);
        return { x: p.x + e.offsetWidth / 2, y: p.y + e.offsetHeight / 2 };
      },
      seek(t) {
        tapped = false;
        order.forEach((n, i) => {
          const e = scr[n];
          const tin = i === 0 ? -1e9 : switches[i - 1], tout = i < switches.length ? switches[i] : 1e9;
          const kin = A.P(t, tin - .2, tin + .3, E.expoInOut), kout = A.P(t, tout - .2, tout + .3, E.expoInOut);
          const vis = t >= tin - .2 && t < tout + .3;
          e.style.display = vis ? 'block' : 'none';
          if (!vis) return;
          const x = (i === 0 ? 0 : (1 - kin) * 390) - kout * 120;
          e.style.transform = `translateX(${x.toFixed(1)}px)`;
          e.style.zIndex = i;
          e.style.filter = kout > .01 ? `brightness(${(1 - kout * .35).toFixed(3)})` : 'none';
          e.style.boxShadow = kin < 1 && i > 0 ? '-20px 0 40px rgba(0,0,0,.18)' : 'none';
        });
        return fl;
      },
      /** toucher à l'instant a sur l'élément sel de l'écran name */
      tap(t, a, sel, name, dx = 0, dy = 0) {
        if (tapped || t < a - .2 || t > a + .5) return fl;
        const p = fl.center(sel, name);
        UI.tapAt(tapEl, t, a, p.x + dx, p.y + dy);
        tapped = true;
        return fl;
      },
      /** à appeler en fin de seek : masque le doigt si aucun toucher n'est actif */
      end() { if (!tapped) tapEl.style.opacity = 0; },
      /** petit rebond d'un élément touché */
      bounce(t, a, sel, name) {
        const e = typeof sel === 'string' ? scr[name].querySelector(sel) : sel;
        const b = Math.sin(Math.PI * A.lin(t, a, a + .28));
        e.style.transform = `scale(${(1 - .05 * b).toFixed(3)})`;
      },
    };
    return fl;
  };

  /** pose standard « téléphone à droite » avec coups de fouet aux changements d'écran */
  A.Flow.pose = (t, o) => {
    const rise = A.P(t, o.rise, o.rise + 1.0, E.expoOut);
    const side = o.sideAt != null ? A.P(t, o.sideAt, o.sideAt + .75, E.cubicInOut) : 1;
    let x = A.mix(o.x0 ?? 540, o.x ?? 748, side), y = A.mix(1560, o.y ?? 590, rise);
    let ry = A.mix(o.flip ? 4 : -4, o.ry ?? -17, side) + A.wob(t, 2, .5) * 2.2, rx = A.mix(42, 6, rise) + A.wob(t, 5, .45) * 1.2;
    let s = A.mix(1.0, o.s ?? .93, side);
    (o.switches || []).forEach(w => { const b = Math.sin(Math.PI * A.lin(t, w - .25, w + .45)); ry += (o.flip ? 11 : -11) * b; x += (o.flip ? 14 : -14) * b; s *= 1 - .03 * b; });
    y += A.wob(t, 7, .6) * 6;
    if (o.exit != null) { const q = A.P(t, o.exit, o.exit + .6, E.expoIn); y -= q * 1300; rx -= q * 30; }
    return { x, y, ry, rx, s };
  };
})(window.A);
