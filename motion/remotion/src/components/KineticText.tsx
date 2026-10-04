import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE } from "../lib/easing";
import { STAGGER_FRAMES, TYPO } from "../theme";

type Props = {
  text: string;
  /** Frame de depart de l'animation, relative a la sequence parente. */
  from?: number;
  /** Duree d'entree d'UNE lettre, en frames. */
  durationInFrames?: number;
  /** Decalage entre lettres (« Layered Time »). */
  stagger?: number;
  /** Frame de depart de la sortie. Omise = pas de sortie. */
  exitAt?: number;
  fontSize?: number;
  color?: string;
  weight?: number;
  /** Espacement des lettres, en em. */
  tracking?: number;
  align?: "left" | "center" | "right";
};

/**
 * Typographie cinetique : les lettres montent sous un masque horizontal,
 * decalees de `stagger` frames chacune. Sortie en propulsion vers le haut.
 *
 * Le masque (overflow hidden par lettre) est ce qui distingue une vraie
 * typographie cinetique d'un simple fade-in : la lettre semble emerger
 * d'une ligne de base plutot qu'apparaitre dans le vide.
 */
export const KineticText: React.FC<Props> = ({
  text,
  from = 0,
  durationInFrames = 26,
  stagger = STAGGER_FRAMES,
  exitAt,
  fontSize = 96,
  color = "#FFFFFF",
  weight = 800,
  tracking = -0.02,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);

  /**
   * Découpage en mots : le retour à la ligne doit se faire ENTRE les mots.
   * Un simple `flexWrap` sur des lettres individuelles coupe « au-delà » en
   * « au-d / elà » — défaut constaté en format carré.
   * `globalIndex` conserve le décalage de stagger continu sur toute la ligne.
   */
  const words: { chars: string[]; start: number }[] = [];
  {
    let cur: string[] = [];
    let start = 0;
    chars.forEach((ch, i) => {
      if (ch === " ") {
        if (cur.length) words.push({ chars: cur, start });
        cur = [];
        start = i + 1;
      } else {
        cur.push(ch);
      }
    });
    if (cur.length) words.push({ chars: cur, start });
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        width: "100%",
        font: TYPO.display,
        fontSize,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        color,
      }}
    >
      {words.map((word, w) => (
        <span
          key={w}
          style={{
            display: "inline-flex",
            // flexShrink: 0 — une colonne étroite comprimait les lettres
            // jusqu'à les rendre illisibles (constaté en format carré).
            flexShrink: 0,
            marginRight: fontSize * 0.28,
          }}
        >
          {word.chars.map((ch, c) => {
            const i = word.start + c; // index global : stagger continu sur la ligne
            const start = from + i * stagger;
            const enter = interpolate(frame, [start, start + durationInFrames], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE.out,
            });
            const leave =
              exitAt === undefined
                ? 0
                : interpolate(
                    frame,
                    [exitAt + i * stagger * 0.6, exitAt + i * stagger * 0.6 + 18],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.exit }
                  );

            const y = (1 - enter) * fontSize * 1.15 - leave * fontSize * 1.3;

            return (
              <span
                key={c}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  lineHeight: 1.15,
                  height: fontSize * 1.2,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${y}px)`,
                    opacity: Math.min(1, enter * 1.3) * (1 - leave),
                  }}
                >
                  {ch}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
};
