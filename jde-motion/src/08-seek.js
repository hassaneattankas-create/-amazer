/* ============================================================================
 *  08 — DISPATCHER, TRANSITIONS INTER-SCENES ET POINT D'ENTREE
 *  window.seek(t) est l'unique fonction de rendu. Pour un meme t, l'image
 *  produite est strictement identique quel que soit l'ordre des appels.
 * ========================================================================== */

/* Fenetres de transition declarees (CLOCK.md §1) */
var TR = {
  wipe12:   { t0: 4.45,  t1: 4.95,  cut: 4.80 },   // lame orange diagonale
  portal23: { t0: 9.30,  t1: 9.60,  cut: 9.60 },   // sortie d'ecran (dissolve)
  flash34:  { t0: 15.44, t1: 15.78, cut: 15.60 },  // zoom-cut + flash
  fade45:   { t0: 21.42, t1: 21.60, cut: 21.60 }   // bascule vers la nuit
};

/** Compose une scene via le tampon hors-ecran, puis la depose avec alpha. */
function overlayScene(drawFn, t, alpha) {
  if (alpha <= 0.002) return;
  withOffscreen(function () { drawFn(t); });
  layer(function () {
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(OFF, 0, 0);
  });
}

function renderAt(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  noShadow();

  /* ---------------- SCENE 1 + wipe vers 2 ---------------- */
  if (t < TR.wipe12.t0) {
    drawScene1(t);
    return;
  }
  if (t < TR.wipe12.t1) {
    var pw = segRaw(t, TR.wipe12.t0, TR.wipe12.t1 - TR.wipe12.t0);
    var pwE = easeInOutCubic(pw);
    drawScene1(t);
    withOffscreen(function () { drawScene2(t); });
    clipDiagonal(pwE, -0.32, function () { ctx.drawImage(OFF, 0, 0); });
    wipeBlade(pwE, -0.32, C.ORANGE, 200);
    return;
  }

  /* ---------------- SCENE 2 + sortie d'ecran vers 3 ---------------- */
  if (t < TR.portal23.t0) {
    drawScene2(t);
    return;
  }
  if (t < TR.portal23.t1) {
    var pp = segRaw(t, TR.portal23.t0, TR.portal23.t1 - TR.portal23.t0);
    drawScene2(t);
    overlayScene(drawScene3, t, easeInOutCubic(pp));
    return;
  }

  /* ---------------- SCENE 3 + zoom-cut vers 4 ---------------- */
  if (t < TR.flash34.cut) {
    drawScene3(t);
    if (t >= TR.flash34.t0) {
      flash(segRaw(t, TR.flash34.t0, TR.flash34.t1 - TR.flash34.t0), C.WHITE, 0.92);
    }
    return;
  }

  /* ---------------- SCENE 4 + bascule vers 5 ---------------- */
  if (t < TR.fade45.t0) {
    drawScene4(t);
    if (t < TR.flash34.t1) {
      flash(segRaw(t, TR.flash34.t0, TR.flash34.t1 - TR.flash34.t0), C.WHITE, 0.92);
    }
    return;
  }
  if (t < TR.fade45.t1) {
    var pf = segRaw(t, TR.fade45.t0, TR.fade45.t1 - TR.fade45.t0);
    drawScene4(t);
    overlayScene(drawScene5, t, easeInOutCubic(pf));
    return;
  }

  /* ---------------- SCENE 5 ---------------- */
  if (t < TIMELINE.S6.t0) {
    drawScene5(t);
    return;
  }

  /* ---------------- SCENE 6 ---------------- */
  drawScene6(t);
}

/* ==========================================================================
 *  POINT D'ENTREE PUBLIC
 * ======================================================================== */
window.seek = function (t) {
  var tt = typeof t === 'number' && isFinite(t) ? t : 0;
  if (tt < 0) tt = 0;
  if (tt > DURATION) tt = DURATION;
  renderAt(tt);
  var hud = document.getElementById('tt');
  if (hud) hud.textContent = tt.toFixed(3);
  return tt;
};
window.seekFrame = function (i) { return window.seek(i / FPS); };
window.JDE = {
  DURATION: DURATION, FPS: FPS, W: W, H: H,
  TIMELINE: TIMELINE, TRANSITIONS: TR,
  totalFrames: Math.round(DURATION * FPS),
  logoMissing: function () { return LOGO.missing; }
};

/* ==========================================================================
 *  INITIALISATION  (polices + logo + grain) puis window.__READY__
 * ======================================================================== */
window.__READY__ = false;
window.__INIT_ERROR__ = null;

(function init() {
  buildGrain();

  var fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready.then(function () {
        // force le chargement effectif des deux familles avant la premiere frame
        return Promise.all([
          document.fonts.load('900 120px Montserrat', 'ABCDEFGHIJKLMNOPQRSTUVWXYZÉÈÊ?•'),
          document.fonts.load('800 120px Montserrat', 'ABCDEFGHIJKLMNOPQRSTUVWXYZÉÈÊ'),
          document.fonts.load('700 48px Inter', 'abcdefghijklmnopqrstuvwxyzéèêà’.'),
          document.fonts.load('500 48px Inter', 'abcdefghijklmnopqrstuvwxyzéèêà’.'),
          document.fonts.load('600 40px Inter', 'ABCDEFGHIJKLMNOPQRSTUVWXYZÉ')
        ]);
      })
    : Promise.resolve();

  Promise.all([fontsReady, loadLogo()])
    .then(function () {
      window.seek(0);
      window.__READY__ = true;
      console.log('[JDE] pret — ' + window.JDE.totalFrames + ' frames a rendre.');
    })
    .catch(function (e) {
      window.__INIT_ERROR__ = String(e && e.stack || e);
      console.error('[JDE] erreur d initialisation', e);
      try { window.seek(0); } catch (e2) {}
      window.__READY__ = true;
    });
})();

/* ==========================================================================
 *  PREVIEW INTERACTIVE (navigateur uniquement)
 *  La boucle ne fait QUE calculer t depuis une horloge et appeler seek(t).
 *  Elle n'accumule aucun etat visuel et est inactive en mode rendu
 *  (body.render), ou seul Puppeteer pilote le temps.
 * ======================================================================== */
(function preview() {
  window.__RENDER__ = /[?&]render=1/.test(location.search);
  if (window.__RENDER__) {
    document.body.classList.add('render');
    return;
  }
  if (document.body.classList.contains('render')) return;

  var playing = false, anchorWall = 0, anchorT = 0, cur = 0;

  function fit() {
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    cv.style.width = (W * s) + 'px';
    cv.style.height = (H * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  function loop() {
    if (playing) {
      var e = (performance.now() - anchorWall) / 1000;
      cur = (anchorT + e) % DURATION;
      window.seek(cur);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.addEventListener('keydown', function (ev) {
    if (ev.code === 'Space') {
      ev.preventDefault();
      playing = !playing;
      anchorWall = performance.now(); anchorT = cur;
    } else if (ev.code === 'ArrowRight') {
      playing = false; cur = Math.min(DURATION, cur + 1 / FPS); window.seek(cur);
    } else if (ev.code === 'ArrowLeft') {
      playing = false; cur = Math.max(0, cur - 1 / FPS); window.seek(cur);
    } else if (ev.code === 'Home') {
      playing = false; cur = 0; window.seek(0);
    } else if (ev.code === 'End') {
      playing = false; cur = DURATION - 1 / FPS; window.seek(cur);
    }
  });
})();
