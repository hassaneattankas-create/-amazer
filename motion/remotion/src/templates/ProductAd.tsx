import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraMove } from "../components/CameraMove";
import { KineticText } from "../components/KineticText";
import { LogoReveal } from "../components/LogoReveal";
import { SceneTransition } from "../components/SceneTransition";
import { EASE } from "../lib/easing";
import { AMAZER, TYPO } from "../theme";

/**
 * Template publicitaire paramétrable.
 *
 * Un seul composant sert tous les registres « produit / vendeur / restaurant /
 * promotion / fonctionnalité » : on change les PROPS, pas le code. Le cadrage
 * s'adapte au format via useVideoConfig() — un 9:16 n'est pas un 16:9 rogné.
 */
export type ProductAdProps = {
  hook: string;
  title: string;
  subtitle: string;
  /** 1 à 4 arguments. Au-delà, le spectateur ne retient rien. */
  bullets: string[];
  price?: string;
  cta: string;
  merchant?: string;
  imageSrc?: string;
  accent: string;
};

/** Le vertical resserre, réduit la typo et remonte le contenu (UI basse masquée). */
const useLayout = () => {
  const { width, height } = useVideoConfig();
  const ratio = width / height;
  const vertical = ratio < 0.8;
  const square = ratio >= 0.8 && ratio < 1.2;
  return {
    vertical,
    square,
    hookSize: vertical ? 34 : 30,
    titleSize: vertical ? 96 : square ? 104 : 128,
    subSize: vertical ? 40 : 38,
    bulletSize: vertical ? 38 : 36,
    ctaSize: vertical ? 46 : 44,
    padX: vertical ? 72 : 140,
    /**
     * Sur vertical, ~12 % du bas sont couverts par l'UI des plateformes.
     * 220 px sur 1920 = 11,5 % : on réserve la zone sans créer un vide mort
     * (300 px laissait un trou visible au tiers inférieur).
     */
    safeBottom: vertical ? 220 : 110,
  };
};

const Ambience: React.FC<{ accent: string }> = ({ accent }) => (
  <AbsoluteFill style={{ background: AMAZER.inkDeep }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(62% 48% at 26% 32%, ${accent}2B 0%, transparent 70%),
                     radial-gradient(56% 44% at 80% 74%, #1D6FB82E 0%, transparent 72%)`,
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(72% 72% at 50% 46%, transparent 38%, rgba(0,0,0,0.64) 100%)",
      }}
    />
  </AbsoluteFill>
);

export const ProductAd: React.FC<ProductAdProps> = ({
  hook,
  title,
  subtitle,
  bullets,
  price,
  cta,
  merchant,
  imageSrc,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const L = useLayout();

  // Découpage proportionnel : le template tient à 15 s comme à 30 s.
  const hookEnd = Math.round(durationInFrames * 0.22);
  const bodyStart = hookEnd - 10;
  const ctaStart = Math.round(durationInFrames * 0.74);

  /**
   * ⚠️ PIÈGE REMOTION — à l'intérieur d'une <Sequence>, `useCurrentFrame()` renvoie
   * une frame LOCALE (0 au début de la séquence), pas la frame absolue du film.
   * Les repères utilisés dans les `interpolate()` et les props `from` des enfants
   * sont donc RELATIFS à leur séquence. Comparer `frame` à `ctaStart` ici donnait
   * un CTA figé et un logo jamais affiché.
   * Seuls les éléments hors <Sequence> (ex. SceneTransition en bas) utilisent des
   * repères absolus.
   */

  return (
    <AbsoluteFill style={{ background: AMAZER.inkDeep, fontFamily: "Inter, Segoe UI, sans-serif" }}>
      {/* ---- HOOK : on entre dans le sujet, pas de logo d'ouverture ---- */}
      <Sequence durationInFrames={hookEnd + 6}>
        <CameraMove keyframes={[{ at: 0, zoom: 1.0 }, { at: hookEnd, zoom: 1.14 }]} depth={0.4}>
          <Ambience accent={accent} />
        </CameraMove>
        <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${L.padX}px` }}>
          <KineticText
            text={hook}
            from={6}
            fontSize={L.titleSize}
            exitAt={hookEnd - 24}
            color={AMAZER.paper}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ---- CORPS : produit + arguments ---- */}
      <Sequence from={bodyStart} durationInFrames={durationInFrames - bodyStart}>
        <CameraMove
          keyframes={[
            { at: 0, zoom: 1.12, y: 20 },
            { at: durationInFrames - bodyStart, zoom: 1.0, y: -12 },
          ]}
          depth={0.75}
        >
          <Ambience accent={accent} />
        </CameraMove>

        <AbsoluteFill
          style={{
            flexDirection: L.vertical ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: L.vertical ? 40 : 90,
            padding: `0 ${L.padX}px ${L.safeBottom}px`,
          }}
        >
          {/* Visuel produit — Mask Reveal */}
          <div
            style={{
              width: L.vertical ? "78%" : "38%",
              aspectRatio: "1 / 1",
              borderRadius: 28,
              overflow: "hidden",
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: `0 28px 70px -22px ${accent}59`,
              clipPath: `inset(0 ${interpolate(frame, [4, 30], [100, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE.inOut,
              })}% 0 0)`,
              flexShrink: 0,
            }}
          >
            {imageSrc ? (
              /* `contain` + marge : les visuels de catégorie AMAZER sont des SVG
                 d'icône, pas des photos — `cover` les rognait en aplat blanc. */
              <Img
                src={imageSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  padding: "4%",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <AbsoluteFill
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.22)",
                  font: TYPO.body,
                  fontSize: 22,
                  letterSpacing: "0.16em",
                }}
              >
                VISUEL PRODUIT
              </AbsoluteFill>
            )}
          </div>

          {/* Texte */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: TYPO.body,
                fontSize: L.hookSize * 0.8,
                letterSpacing: "0.2em",
                color: accent,
                marginBottom: 16,
                opacity: interpolate(frame, [10, 28], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {(merchant ?? "AMAZER").toUpperCase()}
            </div>

            <KineticText
              text={title}
              from={14}
              fontSize={L.subSize * 1.7}
              align="left"
              color={AMAZER.paper}
            />

            <div
              style={{
                font: TYPO.body,
                fontSize: L.subSize,
                color: "#C9D4E2",
                marginTop: 18,
                opacity: interpolate(frame, [30, 48], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE.out,
                }),
              }}
            >
              {subtitle}
            </div>

            {/* Arguments — stagger 0.05 s */}
            <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 14 }}>
              {bullets.map((b, i) => {
                const s = 46 + i * 3;
                const p = interpolate(frame, [s, s + 22], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE.out,
                });
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      opacity: p,
                      transform: `translateY(${(1 - p) * 12}px)`,
                      font: TYPO.body,
                      fontSize: L.bulletSize,
                      color: AMAZER.paper,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 999,
                        background: accent,
                        flexShrink: 0,
                      }}
                    />
                    {b}
                  </div>
                );
              })}
            </div>

            {price ? (
              <div
                style={{
                  marginTop: 30,
                  font: TYPO.display,
                  fontSize: L.subSize * 1.5,
                  fontWeight: 800,
                  color: accent,
                  transform: `scale(${interpolate(
                    frame,
                    [62, 86],
                    [0.88, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.spring }
                  )})`,
                  transformOrigin: "left center",
                }}
              >
                {price}
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ---- CTA ---- */}
      <Sequence from={ctaStart} durationInFrames={durationInFrames - ctaStart}>
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: L.safeBottom * 0.55,
          }}
        >
          <div
            style={{
              transform: `scale(${interpolate(frame, [0, 26], [0.88, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE.spring,
              })})`,
              background: accent,
              color: "#FFFFFF",
              font: TYPO.display,
              fontWeight: 800,
              fontSize: L.ctaSize,
              padding: "20px 52px",
              borderRadius: 999,
              boxShadow: `0 22px 54px -16px ${accent}88`,
            }}
          >
            {cta}
          </div>
          <div style={{ height: 34 }} />
          <LogoReveal from={14} size={L.vertical ? 110 : 128} />
        </AbsoluteFill>
      </Sequence>

      <SceneTransition kind="wipe" from={hookEnd - 12} durationInFrames={20} color={accent} />
    </AbsoluteFill>
  );
};
