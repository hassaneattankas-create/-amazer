/* ============================================================================
 * EASING_FUNCTIONS.js — Courbes d'inertie physiques du projet JDE
 * ----------------------------------------------------------------------------
 * Toutes les fonctions sont PURES et DETERMINISTES : f(x) avec x dans [0,1].
 * Aucune horloge, aucun etat, aucun aleatoire non seede.
 * Voir RULES.md section 4 pour la politique d'affectation des courbes.
 * ========================================================================== */
(function (root) {
  'use strict';

  var PI = Math.PI;
  var c1 = 1.70158;          // overshoot standard (back)
  var c2 = c1 * 1.525;       // overshoot inOut
  var c3 = c1 + 1;
  var c4 = (2 * PI) / 3;     // periode elastic
  var c5 = (2 * PI) / 4.5;   // periode elastic inOut
  var n1 = 7.5625, d1 = 2.75; // constantes bounce

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  var E = {

    /* ---- lineaire ---- */
    linear: function (x) { return x; },

    /* ---- quadratique ---- */
    easeInQuad: function (x) { return x * x; },
    easeOutQuad: function (x) { return 1 - (1 - x) * (1 - x); },
    easeInOutQuad: function (x) {
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    },

    /* ---- cubique : courbe de transition par defaut ---- */
    easeInCubic: function (x) { return x * x * x; },
    easeOutCubic: function (x) { return 1 - Math.pow(1 - x, 3); },
    easeInOutCubic: function (x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    },

    /* ---- quartique ---- */
    easeInQuart: function (x) { return x * x * x * x; },
    easeOutQuart: function (x) { return 1 - Math.pow(1 - x, 4); },
    easeInOutQuart: function (x) {
      return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
    },

    /* ---- quintique : mouvements de camera nerveux ---- */
    easeInQuint: function (x) { return Math.pow(x, 5); },
    easeOutQuint: function (x) { return 1 - Math.pow(1 - x, 5); },
    easeInOutQuint: function (x) {
      return x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2;
    },

    /* ---- sinus : respirations, pulsations ---- */
    easeInSine: function (x) { return 1 - Math.cos((x * PI) / 2); },
    easeOutSine: function (x) { return Math.sin((x * PI) / 2); },
    easeInOutSine: function (x) { return -(Math.cos(PI * x) - 1) / 2; },

    /* ---- exponentiel : apparitions franches ---- */
    easeInExpo: function (x) { return x === 0 ? 0 : Math.pow(2, 10 * x - 10); },
    easeOutExpo: function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    easeInOutExpo: function (x) {
      if (x === 0) return 0;
      if (x === 1) return 1;
      return x < 0.5
        ? Math.pow(2, 20 * x - 10) / 2
        : (2 - Math.pow(2, -20 * x + 10)) / 2;
    },

    /* ---- circulaire ---- */
    easeInCirc: function (x) { return 1 - Math.sqrt(1 - Math.pow(x, 2)); },
    easeOutCirc: function (x) { return Math.sqrt(1 - Math.pow(x - 1, 2)); },
    easeInOutCirc: function (x) {
      return x < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
    },

    /* ---- back : propulsions et sorties d'ecran ---- */
    backIn: function (x) { return c3 * x * x * x - c1 * x * x; },
    backOut: function (x) {
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    backInOut: function (x) {
      return x < 0.5
        ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
        : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
    },

    /* ---- elastic : rebonds UI, badges, boutons ---- */
    elasticIn: function (x) {
      if (x === 0) return 0;
      if (x === 1) return 1;
      return -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4);
    },
    elasticOut: function (x) {
      if (x === 0) return 0;
      if (x === 1) return 1;
      return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    },
    elasticInOut: function (x) {
      if (x === 0) return 0;
      if (x === 1) return 1;
      return x < 0.5
        ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
    },

    /* ---- bounce ---- */
    bounceOut: function (x) {
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    },
    bounceIn: function (x) { return 1 - E.bounceOut(1 - x); },
    bounceInOut: function (x) {
      return x < 0.5
        ? (1 - E.bounceOut(1 - 2 * x)) / 2
        : (1 + E.bounceOut(2 * x - 1)) / 2;
    }
  };

  /* ==========================================================================
   * VARIANTES AMORTIES
   * elasticOut brut depasse de ~20 % : trop pour de la typographie
   * institutionnelle. `elasticSoft` plafonne l'overshoot a ~6-12 %.
   * ======================================================================== */
  E.elasticSoft = function (x, amp) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var a = amp === undefined ? 0.35 : amp;
    return 1 - Math.pow(2, -9 * x) * Math.cos(x * PI * 2.35) * a
             - Math.pow(2, -9 * x) * (1 - a);
  };

  /* Ressort critique amorti — mouvement physique sans oscillation visible */
  E.spring = function (x, stiffness, damping) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var k = stiffness === undefined ? 9 : stiffness;
    var d = damping === undefined ? 0.62 : damping;
    var w = Math.sqrt(Math.max(k, 0.0001));
    return 1 - Math.exp(-d * w * x * 1.6) * Math.cos(w * x * (1 - d) * 1.9);
  };

  /* ==========================================================================
   * OUTILS DE SEQUENCAGE  (le coeur du determinisme)
   * ======================================================================== */

  /**
   * seg — progression normalisee d'un beat.
   * @param t     temps absolu (s)
   * @param t0    debut du beat (s)
   * @param dur   duree du beat (s)
   * @param ease  nom de courbe ou fonction (defaut easeInOutCubic)
   * @returns valeur dans [0,1]
   */
  function seg(t, t0, dur, ease) {
    if (dur <= 0) return t >= t0 ? 1 : 0;
    var x = clamp01((t - t0) / dur);
    var f = typeof ease === 'function' ? ease : (E[ease] || E.easeInOutCubic);
    return f(x);
  }

  /**
   * segRaw — progression lineaire non eased (utile pour piloter une autre courbe).
   */
  function segRaw(t, t0, dur) {
    return dur <= 0 ? (t >= t0 ? 1 : 0) : clamp01((t - t0) / dur);
  }

  /**
   * stagger — principe « Layered Time ».
   * Decale l'entree du sous-element `i` de `i * step` secondes (defaut 0.05 s).
   */
  function stagger(t, t0, i, dur, ease, step) {
    var s = step === undefined ? 0.05 : step;
    return seg(t, t0 + i * s, dur, ease);
  }

  /**
   * window01 — enveloppe entree/sortie d'un element : monte, tient, redescend.
   * @returns {in: p, out: q, v: p*(1-q)} — `v` sert d'alpha global pratique
   */
  function envelope(t, t0, tIn, hold, tOut, easeIn, easeOut) {
    var pin = seg(t, t0, tIn, easeIn || 'easeOutQuint');
    var pout = seg(t, t0 + tIn + hold, tOut, easeOut || 'backIn');
    return { in: pin, out: pout, v: pin * (1 - pout) };
  }

  /** Interpolations */
  function lerp(a, b, x) { return a + (b - a) * x; }
  function mix(a, b, x) { return a + (b - a) * x; }
  function remap(v, a, b, c, d) {
    if (b === a) return c;
    return c + ((v - a) / (b - a)) * (d - c);
  }
  function remapClamped(v, a, b, c, d) { return remap(clamp01((v - a) / (b - a)), 0, 1, c, d); }

  /** Interpolation sur plusieurs images cles : keys = [[t,val],...] */
  function track(t, keys, ease) {
    if (!keys.length) return 0;
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (t >= a[0] && t <= b[0]) {
        var e = a[2] || ease || 'easeInOutCubic';
        return lerp(a[1], b[1], seg(t, a[0], b[0] - a[0], e));
      }
    }
    return keys[keys.length - 1][1];
  }

  /* ==========================================================================
   * ALEATOIRE DETERMINISTE  (RULES.md §1)
   * ======================================================================== */

  /** mulberry32 : PRNG rapide, meme graine -> meme suite, pour toujours */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var x = a;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** hash1 : entier -> [0,1) sans allocation */
  function hash1(i) {
    var x = Math.imul(i ^ 0x9E3779B9, 0x85EBCA6B);
    x ^= x >>> 13;
    x = Math.imul(x, 0xC2B2AE35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /** hash2 : couple d'entiers -> [0,1) */
  function hash2(i, j) { return hash1(Math.imul(i, 73856093) ^ Math.imul(j, 19349663)); }

  /** valeur signee dans [-1,1] */
  function hashS(i, j) { return hash2(i, j === undefined ? 7 : j) * 2 - 1; }

  var API = {
    E: E, ease: E,
    seg: seg, segRaw: segRaw, stagger: stagger, envelope: envelope,
    lerp: lerp, mix: mix, remap: remap, remapClamped: remapClamped,
    clamp01: clamp01, track: track,
    mulberry32: mulberry32, hash1: hash1, hash2: hash2, hashS: hashS
  };

  /* Export global + nommage direct pour un usage confortable dans les scenes */
  root.EASING = API;
  for (var k in E) if (Object.prototype.hasOwnProperty.call(E, k)) root[k] = E[k];
  root.seg = seg; root.segRaw = segRaw; root.stagger = stagger; root.envelope = envelope;
  root.lerp = lerp; root.mix = mix; root.remap = remap; root.remapClamped = remapClamped;
  root.clamp01 = clamp01; root.track = track;
  root.mulberry32 = mulberry32; root.hash1 = hash1; root.hash2 = hash2; root.hashS = hashS;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : globalThis);
