import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * AMAZER — configuration Tailwind.
 *
 * REGLE DE NON-REGRESSION (verifiee par comptage d'usages le 2026-10-04)
 * ----------------------------------------------------------------------------
 * Rien de ce qui existait n'est modifie, et AUCUNE cle d'echelle Tailwind native
 * n'est ecrasee : `text-sm` (387 usages), `rounded-xl` (40), `rounded-2xl` (48),
 * `shadow-sm` (8), `shadow-xl` (5), `tracking-tight` (3) gardent leur valeur
 * d'origine.
 *
 * Les tokens AMAZER sont donc nommes par ROLE (et non par taille), ce qui evite
 * les collisions et constitue de toute facon la bonne pratique design system :
 * on ecrit `rounded-card`, pas `rounded-xl`.
 *
 * Source de verite : src/app/globals.css (variables CSS)
 *                    src/lib/design-tokens.ts (miroir TypeScript)
 */

/** Couleur token HSL exposee en utilitaire Tailwind avec support de l'opacite. */
const hsl = (token: string) => `hsl(var(--${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ================= EXISTANT — NE PAS MODIFIER ===================== */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },

        /* ================= AJOUTS (noms libres, zero collision) =========== */
        brand: {
          50: hsl("brand-50"),
          100: hsl("brand-100"),
          200: hsl("brand-200"),
          300: hsl("brand-300"),
          400: hsl("brand-400"),
          500: hsl("brand-500"),
          600: hsl("brand-600"),
          700: hsl("brand-700"),
          800: hsl("brand-800"),
          900: hsl("brand-900"),
          DEFAULT: hsl("brand-500"),
        },
        ink: {
          50: hsl("ink-50"),
          100: hsl("ink-100"),
          200: hsl("ink-200"),
          300: hsl("ink-300"),
          400: hsl("ink-400"),
          500: hsl("ink-500"),
          600: hsl("ink-600"),
          700: hsl("ink-700"),
          800: hsl("ink-800"),
          900: hsl("ink-900"),
        },
        surface: {
          0: hsl("surface-0"),
          1: hsl("surface-1"),
          2: hsl("surface-2"),
          3: hsl("surface-3"),
        },
        success: { DEFAULT: hsl("success"), foreground: hsl("success-fg") },
        warning: { DEFAULT: hsl("warning"), foreground: hsl("warning-fg") },
        danger: { DEFAULT: hsl("danger"), foreground: hsl("danger-fg") },
        info: { DEFAULT: hsl("info"), foreground: hsl("info-fg") },
      },

      /* Rayons nommes par ROLE — `lg`/`md`/`sm` natifs inchanges. */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        chip: "var(--radius-xs)",
        field: "var(--radius-md)",
        card: "var(--radius-xl)",
        sheet: "var(--radius-2xl)",
        pill: "var(--radius-pill)",
      },

      /* Ombres nommees par ROLE — `shadow-sm/md/lg/xl` natifs inchanges. */
      boxShadow: {
        hairline: "var(--shadow-xs)",
        resting: "var(--shadow-sm)",
        raised: "var(--shadow-md)",
        floating: "var(--shadow-lg)",
        overlay: "var(--shadow-xl)",
        "brand-sm": "var(--shadow-brand-sm)",
        "brand-md": "var(--shadow-brand-md)",
        "brand-lg": "var(--shadow-brand-lg)",
        focus: "var(--shadow-focus)",
      },

      /* Echelle typographique AMAZER — aucune cle native ecrasee. */
      fontSize: {
        "2xs": ["var(--text-2xs)", { lineHeight: "1.4" }],
        "display-sm": ["var(--text-2xl)", { lineHeight: "var(--leading-snug)" }],
        "display-md": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
        "display-lg": ["var(--text-4xl)", { lineHeight: "var(--leading-tight)" }],
      },

      letterSpacing: {
        display: "var(--tracking-tight)",
        label: "var(--tracking-wide)",
      },

      lineHeight: {
        "token-tight": "var(--leading-tight)",
        "token-snug": "var(--leading-snug)",
        "token-normal": "var(--leading-normal)",
      },

      spacing: {
        gutter: "var(--space-gutter)",
        "gutter-md": "var(--space-gutter-md)",
        "gutter-lg": "var(--space-gutter-lg)",
        section: "var(--space-section)",
        "section-lg": "var(--space-section-lg)",
      },

      maxWidth: {
        container: "var(--container-max)",
      },

      transitionDuration: {
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
      },

      transitionTimingFunction: {
        "out-quint": "var(--ease-out)",
        "in-out-cubic": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
        exit: "var(--ease-exit)",
      },

      zIndex: {
        sticky: "var(--z-sticky)",
        dropdown: "var(--z-dropdown)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
