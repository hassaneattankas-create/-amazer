/**
 * AMAZER — miroir TypeScript des design tokens.
 *
 * La source de verite des VALEURS est `src/app/globals.css` (variables CSS).
 * Ce fichier expose :
 *   - les references `var(--token)` pour les usages programmatiques (framer-motion,
 *     canvas, styles inline, graphiques Recharts) ;
 *   - les courbes de mouvement sous forme de tableaux de bezier, format attendu
 *     par framer-motion.
 *
 * Regle : ne JAMAIS redefinir une valeur ici. On reference le token.
 * Une valeur litterale dans ce fichier est un bug de design system.
 */

/* ============================================================================
 * COULEUR
 * ==========================================================================*/

/** Reference une couleur token en CSS, avec opacite optionnelle (0 → 1). */
export const color = (token: string, alpha?: number): string =>
  alpha === undefined ? `hsl(var(--${token}))` : `hsl(var(--${token}) / ${alpha})`;

export const brand = {
  50: color("brand-50"),
  100: color("brand-100"),
  200: color("brand-200"),
  300: color("brand-300"),
  400: color("brand-400"),
  500: color("brand-500"),
  600: color("brand-600"),
  700: color("brand-700"),
  800: color("brand-800"),
  900: color("brand-900"),
} as const;

export const ink = {
  50: color("ink-50"),
  100: color("ink-100"),
  200: color("ink-200"),
  300: color("ink-300"),
  400: color("ink-400"),
  500: color("ink-500"),
  600: color("ink-600"),
  700: color("ink-700"),
  800: color("ink-800"),
  900: color("ink-900"),
} as const;

export const semantic = {
  success: color("success"),
  warning: color("warning"),
  danger: color("danger"),
  info: color("info"),
} as const;

/** Palette ordonnee pour les graphiques (Recharts). Ordre = priorite de lecture. */
export const chartSeries = [
  color("brand-500"),
  color("info"),
  color("success"),
  color("warning"),
  color("ink-400"),
] as const;

/* ============================================================================
 * MOUVEMENT — partage entre CSS et framer-motion
 * ==========================================================================*/

/** Durees en SECONDES (unite attendue par framer-motion). */
export const duration = {
  instant: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.42,
  slower: 0.64,
} as const;

/**
 * Courbes d'inertie, en bezier cubique.
 * Identiques aux `--ease-*` de globals.css : une seule verite, deux formats.
 */
export const ease = {
  /** Transitions sortantes, entrees d'elements — easeOutQuint. */
  out: [0.22, 1, 0.36, 1],
  /** Transitions de plan, mouvements continus — easeInOutCubic. */
  inOut: [0.65, 0, 0.35, 1],
  /** Rebond amorti (~8 % d'overshoot) — boutons, badges, confirmations. */
  spring: [0.34, 1.26, 0.64, 1],
  /** Sorties d'ecran, propulsions — backIn adouci. */
  exit: [0.55, 0, 1, 0.45],
} as const;

/** Decalage standard entre sous-elements d'une meme sequence (« Layered Time »). */
export const STAGGER = 0.05;

/* ============================================================================
 * PRESETS framer-motion
 * Utiliser ces variants plutot que de reecrire des transitions a la main.
 * ==========================================================================*/

export const motionPresets = {
  /** Apparition standard d'un bloc : monte et se revele. */
  rise: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: duration.base, ease: ease.out },
  },

  /** Apparition d'une carte / tuile dans une grille. */
  card: {
    initial: { opacity: 0, y: 16, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: duration.slow, ease: ease.out },
  },

  /** Confirmation / badge / compteur : rebond court et amorti. */
  pop: {
    initial: { opacity: 0, scale: 0.88 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94 },
    transition: { duration: duration.slow, ease: ease.spring },
  },

  /** Panneau lateral / drawer. */
  sheet: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: { duration: duration.slow, ease: ease.inOut },
  },

  /** Voile de modale. */
  scrim: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: duration.fast, ease: ease.inOut },
  },
} as const;

/**
 * Conteneur a apparition echelonnee.
 * @param stagger decalage par enfant, en secondes (defaut : STAGGER)
 */
export const staggerContainer = (stagger: number = STAGGER) => ({
  initial: {},
  animate: { transition: { staggerChildren: stagger } },
});

/* ============================================================================
 * GEOMETRIE
 * ==========================================================================*/

export const radius = {
  chip: "var(--radius-xs)",
  field: "var(--radius-md)",
  base: "var(--radius)",
  card: "var(--radius-xl)",
  sheet: "var(--radius-2xl)",
  pill: "var(--radius-pill)",
} as const;

export const shadow = {
  hairline: "var(--shadow-xs)",
  resting: "var(--shadow-sm)",
  raised: "var(--shadow-md)",
  floating: "var(--shadow-lg)",
  overlay: "var(--shadow-xl)",
  brandSm: "var(--shadow-brand-sm)",
  brandMd: "var(--shadow-brand-md)",
  brandLg: "var(--shadow-brand-lg)",
  focus: "var(--shadow-focus)",
} as const;

export const layer = {
  base: 0,
  sticky: 10,
  dropdown: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
} as const;

/** Point de rupture mobile du projet (aligne sur Tailwind `md`). */
export const BREAKPOINT_MD = 768;
