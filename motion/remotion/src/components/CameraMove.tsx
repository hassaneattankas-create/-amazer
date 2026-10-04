import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE } from "../lib/easing";

type Keyframe = { at: number; x?: number; y?: number; zoom?: number; rotate?: number };

/**
 * Camera virtuelle 2.5D : on deplace un point de vue dans un decor continu
 * plutot que d'animer des elements devant un fond fixe.
 *
 * `depth` (0 = lointain, 1 = premier plan) produit le parallax : plus un calque
 * est proche, plus il reagit au mouvement de camera.
 */
export const CameraMove: React.FC<{
  keyframes: Keyframe[];
  depth?: number;
  children: React.ReactNode;
}> = ({ keyframes, depth = 1, children }) => {
  const frame = useCurrentFrame();
  const at = keyframes.map((k) => k.at);
  const pick = (key: "x" | "y" | "zoom" | "rotate", fallback: number) => {
    const values = keyframes.map((k) => k[key] ?? fallback);
    if (at.length < 2) return values[0] ?? fallback;
    return interpolate(frame, at, values, {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.inOut,
    });
  };

  const zoom = 1 + (pick("zoom", 1) - 1) * depth;
  const x = -pick("x", 0) * depth;
  const y = -pick("y", 0) * depth;
  const rotate = pick("rotate", 0) * depth;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${zoom}) translate(${x}px, ${y}px) rotate(${rotate}deg)`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
};
