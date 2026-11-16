/* toontest — planche des personnages (contrôle du style). */
(function (A) {
  const T = A.Toon;
  window.FILM = {
    id: 'toontest', duration: 4, cues: [],
    scenes: [{
      id: 'line', a: 0, b: 4,
      build(el) {
        el.style.background = 'linear-gradient(#FDE7C8,#F8C98F)';
        A.el('div', { cls: 'abs', style: { top: '1500px', width: '1080px', height: '420px', background: '#E2B27A' } }, el);
        this.ai = T.person(el, T.CAST.aicha);
        this.mo = T.person(el, T.CAST.moussa);
        this.ib = T.person(el, T.CAST.ibrahim);
        this.ai2 = T.person(el, T.CAST.aicha);
        this.moto = T.moto(el);
        this.rider = T.person(el, T.CAST.ibrahim);
      },
      seek(t) {
        this.ai.pose(T.merge({ x: 230, y: 860, s: 1.05, t, look: [3, 0], blink: T.blink(t, 1), mouth: 'grin' }, { near: { sh: 40, el: 70 } }));
        this.mo.pose({ x: 560, y: 860, s: 1.05, t, flip: true, talk: true, blink: T.blink(t, 2), near: { sh: 20, el: 40 } });
        this.ib.pose(T.merge({ x: 860, y: 860, s: 1.05, t }, T.walk(t * .9), { blink: T.blink(t, 3), mouth: 'smile' }));
        this.ai2.pose(T.merge({ x: 260, y: 1560, s: .9, t, sweat: 1, mouth: 'effort', brow: -.4, browTilt: 8 }, T.walk(t * .7, .8)));
        this.moto.pose({ x: 720, y: 1640, s: 1.1, wheel: t * 8, dust: 1, t });
        this.rider.pose({ x: 720 - 40 * 1.1, y: 1640 + 74 * 1.1, s: 1.1, t, lean: 14, legN: { hip: 84, knee: 92 }, legF: { hip: 78, knee: 96 }, near: { sh: 72, el: 18 }, far: { sh: 66, el: 22 }, mouth: 'grin', look: [4, 0] });
      },
    }],
  };
})(window.A);
