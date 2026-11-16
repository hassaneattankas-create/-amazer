/* type.js — typographie cinétique HTML (Geist).
 * A.Type.make(parent, 'Tout se perd\n*entre les messages.*', {size:84, weight:800, align:'center'})
 *   '\n' = nouvelle ligne · '*…*' = accent orange.
 * A.Type.play(obj, t, tIn, tOut, {stagger, dur, mode}) — entrée par masque, sortie vers le haut.
 */
(function (A) {
  const C = A.C, E = A.E;
  const Type = A.Type = {};

  Type.make = (parent, text, o = {}) => {
    const box = A.el('div', {
      cls: 'abs', style: {
        fontFamily: 'Geist', fontWeight: o.weight ?? 800, fontSize: (o.size ?? 72) + 'px', color: o.color ?? C.white,
        letterSpacing: (o.track ?? -0.035) + 'em', lineHeight: o.lh ?? 1.04, textAlign: o.align ?? 'left',
        whiteSpace: 'nowrap', width: o.width ? o.width + 'px' : 'auto',
      }
    }, parent);
    const pieces = [];
    let accent = false;
    text.split('\n').forEach(line => {
      const ln = A.el('div', {}, box);
      const tokens = o.mode === 'chars' ? Array.from(line) : line.split(/(\s+)/);
      tokens.forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { ln.appendChild(document.createTextNode(' ')); return; }
        // les '*' basculent l'accent, ils peuvent entourer un ou plusieurs mots
        let s = tok, starts = false, ends = false;
        if (s.startsWith('*')) { starts = true; s = s.slice(1); }
        if (s.endsWith('*')) { ends = true; s = s.slice(0, -1); }
        if (starts) accent = true;
        const mk = A.el('span', { style: { display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', padding: '0 .03em .12em', margin: '0 -.03em -.12em' } }, ln);
        const inn = A.el('span', { style: { display: 'inline-block', color: accent ? (o.accent ?? C.orange) : 'inherit', willChange: 'transform' } }, mk);
        inn.textContent = s;
        pieces.push(inn);
        if (ends) accent = false;
      });
    });
    return { el: box, pieces, get w() { return box.offsetWidth; }, get h() { return box.offsetHeight; } };
  };

  /** place le bloc : ancre 'c' (centre), 'l' (gauche) */
  Type.place = (obj, x, y, anchor = 'c') => {
    const w = obj.el.offsetWidth, h = obj.el.offsetHeight;
    obj.el.style.left = (anchor === 'c' ? x - w / 2 : x) + 'px';
    obj.el.style.top = (y - h / 2) + 'px';
  };

  /** entrée mot par mot depuis un masque, sortie vers le haut (plus rapide) */
  Type.play = (obj, t, tIn, tOut = 1e9, o = {}) => {
    const st = o.stagger ?? .05, d = o.dur ?? .55, n = obj.pieces.length;
    const dOut = o.outDur ?? .32, stOut = o.outStagger ?? .025;
    obj.pieces.forEach((p, i) => {
      const k = A.P(t, tIn + i * st, tIn + i * st + d, E.expoOut);
      const q = A.P(t, tOut + i * stOut, tOut + i * stOut + dOut, E.expoIn);
      const y = (1 - k) * 105 - q * 105;
      const rot = (1 - k) * (o.tilt ?? 6);
      p.style.transform = `translateY(${y.toFixed(2)}%) rotate(${rot.toFixed(2)}deg)`;
    });
    obj.el.style.visibility = t >= tIn && t < tOut + (n - 1) * stOut + dOut ? 'visible' : 'hidden';
  };

  /** frappe : le bloc entier arrive de grand + flou, se pose net */
  Type.slam = (obj, t, tIn, tOut = 1e9, o = {}) => {
    const k = A.P(t, tIn, tIn + (o.dur ?? .38), E.expoOut);
    const q = A.P(t, tOut, tOut + .22, E.expoIn);
    const s = A.mix(o.from ?? 1.8, 1, k) * (1 + q * .15);
    obj.el.style.transform = `scale(${s.toFixed(4)})`;
    obj.el.style.transformOrigin = '50% 50%';
    obj.el.style.opacity = (A.lin(t, tIn, tIn + .08) * (1 - q)).toFixed(3);
    obj.el.style.filter = (1 - k) * (o.blur ?? 14) + q * 10 > .1 ? `blur(${((1 - k) * (o.blur ?? 14) + q * 10).toFixed(2)}px)` : 'none';
    obj.el.style.visibility = t >= tIn && t < tOut + .22 ? 'visible' : 'hidden';
  };
})(window.A);
