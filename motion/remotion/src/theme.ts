/** AMAZER — tokens video. Alignes sur frontend/src/lib/design-tokens.ts. */
export const AMAZER = {
  brand:     "#FF4D00",   // hsl(18 100% 50%) — primaire AMAZER
  brandSoft: "#FF8A4D",
  ink:       "#17202E",   // hsl(220 35% 16%)
  inkDeep:   "#0A1119",
  paper:     "#FFFFFF",
  muted:     "#6B7A8F",
  surface:   "#F6F8FB",
} as const;

export const TYPO = {
  display: '800 1em/1.05 "Inter", "Segoe UI", system-ui, sans-serif',
  body:    '500 1em/1.45 "Inter", "Segoe UI", system-ui, sans-serif',
} as const;

/** Decalage standard entre sous-elements — « Layered Time ». */
export const STAGGER_FRAMES = 3; // 0.05 s @ 60 fps
