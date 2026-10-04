import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE } from "../lib/easing";
import { AMAZER, TYPO } from "../theme";

/**
 * Revelation de marque. Echelle UNIFORME + opacite uniquement : un logo ne se
 * deforme jamais (pas de scaleX/scaleY independants, pas de skew, pas de
 * recolorisation).
 *
 * `src` absent -> lockup typographique AMAZER (placeholder assume, jamais un
 * faux logo redessine).
 */
export const LogoReveal: React.FC<{
  src?: string;
  from?: number;
  size?: number;
  label?: string;
}> = ({ src, from = 0, size = 220, label = "amazer" }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.spring,
  });
  const scale = interpolate(p, [0, 1], [0.84, 1]);
  const glow = interpolate(frame, [from, from + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale})`,
        opacity: Math.min(1, p * 1.5),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: size * 3,
          height: size * 3,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${AMAZER.brand}2E 0%, transparent 62%)`,
          opacity: glow,
        }}
      />
      {src ? (
        <img src={src} alt="" style={{ height: size, width: "auto", objectFit: "contain" }} />
      ) : (
        <div style={{ position: "relative", textAlign: "center" }}>
          <div
            style={{
              font: TYPO.display,
              fontSize: size * 0.52,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: AMAZER.paper,
            }}
          >
            {label}
            <span style={{ color: AMAZER.brand }}>.</span>
          </div>
          <div
            style={{
              height: 5,
              width: interpolate(p, [0, 1], [0, size * 0.9]),
              background: AMAZER.brand,
              borderRadius: 3,
              margin: "14px auto 0",
            }}
          />
        </div>
      )}
    </div>
  );
};
