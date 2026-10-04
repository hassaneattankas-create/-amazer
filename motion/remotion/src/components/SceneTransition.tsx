import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE } from "../lib/easing";
import { AMAZER } from "../theme";

type Kind = "wipe" | "flash" | "irisIn" | "push";

/**
 * Transition de plan. Une transition doit faire AVANCER le recit :
 *  - `wipe`    : lame coloree diagonale, change de sujet franchement
 *  - `flash`   : coupe energique sur un temps fort (<= 8 frames)
 *  - `irisIn`  : revelation par disque, focalise l'attention sur un point
 *  - `push`    : le plan sortant est pousse hors cadre, continuite spatiale
 *
 * Interdit : fondu enchaine paresseux pour masquer une absence d'idee.
 */
export const SceneTransition: React.FC<{
  kind?: Kind;
  from: number;
  durationInFrames?: number;
  color?: string;
  /** Centre de l'iris, en pourcentage du cadre. */
  origin?: { x: number; y: number };
}> = ({ kind = "wipe", from, durationInFrames = 20, color = AMAZER.brand, origin = { x: 50, y: 50 } }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });
  if (p <= 0 || p >= 1) return null;

  if (kind === "flash") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#FFFFFF",
          opacity: Math.sin(p * Math.PI) * 0.92,
          pointerEvents: "none",
        }}
      />
    );
  }

  if (kind === "irisIn") {
    const r = p * 120;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          clipPath: `circle(${r}% at ${origin.x}% ${origin.y}%)`,
          pointerEvents: "none",
        }}
      />
    );
  }

  if (kind === "push") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          transform: `translateX(${(1 - p) * 100}%)`,
          pointerEvents: "none",
        }}
      />
    );
  }

  // wipe : lame diagonale a 18 deg, bord adouci
  const edge = p * 150 - 25;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(105deg,
          ${color} ${edge - 12}%,
          ${color} ${edge}%,
          transparent ${edge + 0.5}%)`,
        pointerEvents: "none",
      }}
    />
  );
};
