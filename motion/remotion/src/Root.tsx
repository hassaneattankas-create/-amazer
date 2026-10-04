import React from "react";
import { AbsoluteFill, Composition, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CameraMove } from "./components/CameraMove";
import { KineticText } from "./components/KineticText";
import { LogoReveal } from "./components/LogoReveal";
import { SceneTransition } from "./components/SceneTransition";
import { ProductAd, type ProductAdProps } from "./templates/ProductAd";
import { EASE } from "./lib/easing";
import { AMAZER, TYPO } from "./theme";

const FPS = 60;
const W = 1920;
const H = 1080;

/* --------------------------------------------------------------------------
 * Fond d’ambiance : deux sources lumineuses, jamais un aplat.
 * ------------------------------------------------------------------------ */
const Ambience: React.FC<{ warm?: number }> = ({ warm = 1 }) => (
  <AbsoluteFill style={{ background: AMAZER.inkDeep }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(60% 50% at 28% 36%, ${AMAZER.brand}26 0%, transparent 70%),
                     radial-gradient(55% 45% at 82% 72%, #1D6FB833 0%, transparent 72%)`,
        opacity: warm,
      }}
    />
    {/* vignettage */}
    <AbsoluteFill
      style={{
        background: "radial-gradient(70% 70% at 50% 46%, transparent 40%, rgba(0,0,0,0.62) 100%)",
      }}
    />
  </AbsoluteFill>
);

/* --------------------------------------------------------------------------
 * Grille de produits : materialise la decouverte commerciale.
 * Entree echelonnee (stagger) + parallax par profondeur.
 * ------------------------------------------------------------------------ */
const ProductGrid: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame();
  const tiles = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "repeat(4, 300px)",
        gridTemplateRows: "repeat(3, 190px)",
        gap: 26,
        alignContent: "center",
        justifyContent: "center",
      }}
    >
      {tiles.map((i) => {
        const start = from + i * 3; // stagger 0.05 s
        const p = interpolate(frame, [start, start + 30], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE.out,
        });
        const accent = i === 5 || i === 10;
        return (
          <div
            key={i}
            style={{
              borderRadius: 20,
              background: accent ? AMAZER.brand : "rgba(255,255,255,0.055)",
              border: `1px solid ${accent ? "transparent" : "rgba(255,255,255,0.10)"}`,
              transform: `translateY(${(1 - p) * 34}px) scale(${0.95 + p * 0.05})`,
              opacity: p,
              boxShadow: accent ? `0 18px 48px -12px ${AMAZER.brand}66` : "none",
              display: "flex",
              alignItems: "flex-end",
              padding: 20,
            }}
          >
            <div style={{ width: "100%" }}>
              <div
                style={{
                  height: 9,
                  width: `${46 + ((i * 13) % 34)}%`,
                  borderRadius: 5,
                  background: accent ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.28)",
                }}
              />
              <div
                style={{
                  height: 7,
                  width: "28%",
                  borderRadius: 4,
                  marginTop: 9,
                  background: accent ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.15)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* --------------------------------------------------------------------------
 * Sting de marque AMAZER — 6 s. Sert de test de bout en bout du kit.
 * ------------------------------------------------------------------------ */
export const AmazerSting: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: AMAZER.inkDeep, fontFamily: "Inter, Segoe UI, sans-serif" }}>
      {/* ---- Plan 1 : accroche (0 → 110) ---- */}
      <Sequence durationInFrames={118}>
        <CameraMove keyframes={[{ at: 0, zoom: 1.0 }, { at: 118, zoom: 1.12 }]} depth={0.35}>
          <Ambience />
        </CameraMove>
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
          <div
            style={{
              font: TYPO.body,
              fontSize: 30,
              letterSpacing: "0.22em",
              color: AMAZER.brand,
              textAlign: "center",
              marginBottom: 34,
              opacity: interpolate(frame, [8, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            COMMERCE · DÉCOUVERTE
          </div>
          <KineticText text="TROUVEZ" from={18} fontSize={150} exitAt={92} />
          <KineticText text="CE QUI COMPTE" from={30} fontSize={150} exitAt={98} color={AMAZER.brand} />
        </AbsoluteFill>
      </Sequence>

      {/* ---- Plan 2 : la grille de decouverte (110 → 250) ---- */}
      <Sequence from={110} durationInFrames={145}>
        <CameraMove
          keyframes={[{ at: 0, zoom: 1.18, y: 30 }, { at: 145, zoom: 1.0, y: -20 }]}
          depth={0.8}
        >
          <Ambience warm={0.7} />
          <ProductGrid from={10} />
        </CameraMove>
        <AbsoluteFill style={{ justifyContent: "flex-end", paddingBottom: 92 }}>
          <KineticText
            text="BOUTIQUES · RESTAURANTS · MARQUES"
            from={54}
            fontSize={42}
            tracking={0.08}
            exitAt={126}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ---- Plan 3 : end card (248 → 360) ---- */}
      <Sequence from={248} durationInFrames={112}>
        <Ambience />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <LogoReveal from={6} size={200} />
          <div style={{ height: 54 }} />
          <KineticText text="amazer.store" from={38} fontSize={44} tracking={0.02} color="#C9D4E2" />
        </AbsoluteFill>
      </Sequence>

      {/* ---- Transitions : elles portent le recit, pas de fondu paresseux ---- */}
      <SceneTransition kind="wipe" from={100} durationInFrames={22} />
      <SceneTransition kind="irisIn" from={240} durationInFrames={18} color={AMAZER.inkDeep} />
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------------------
 * Jeux de props : un template, plusieurs usages. On ne copie pas une video,
 * on la parametre.
 * ------------------------------------------------------------------------ */
const PRESETS: Record<string, ProductAdProps> = {
  produit: {
    hook: "VOUS CHERCHEZ ?",
    title: "Trouvez-le près de chez vous",
    subtitle: "Des milliers de produits chez les commerces de votre ville.",
    bullets: ["Commerces vérifiés", "Retrait ou livraison", "Paiement sécurisé"],
    price: "À partir de 2 500 FCFA",
    cta: "Découvrir",
    merchant: "AMAZER",
    imageSrc: staticFile("img/technologie.svg"),
    accent: AMAZER.brand,
  },
  vendeur: {
    hook: "VOTRE BOUTIQUE EN LIGNE",
    title: "Vendez au-delà de votre quartier",
    subtitle: "Ouvrez votre boutique AMAZER en quelques minutes.",
    bullets: ["Catalogue illimité", "Commandes centralisées", "Paiement garanti"],
    cta: "Ouvrir ma boutique",
    merchant: "ESPACE VENDEUR",
    imageSrc: staticFile("img/maison.svg"),
    accent: AMAZER.brand,
  },
  restaurant: {
    hook: "FAIM MAINTENANT ?",
    title: "Les meilleures tables, en deux clics",
    subtitle: "Commandez auprès des restaurants de votre ville.",
    bullets: ["Menus à jour", "Livraison rapide", "Avis vérifiés"],
    cta: "Commander",
    merchant: "RESTAURANTS",
    imageSrc: staticFile("img/restaurant.svg"),
    accent: AMAZER.brand,
  },
  promotion: {
    hook: "OFFRE LIMITÉE",
    title: "Jusqu’à −40 % cette semaine",
    subtitle: "Sur une sélection de commerces partenaires.",
    bullets: ["Stocks limités", "Partout au Niger"],
    price: "−40 %",
    cta: "J’en profite",
    merchant: "PROMOTIONS",
    imageSrc: staticFile("img/alimentation.svg"),
    accent: AMAZER.brand,
  },
};

/** Durees utiles par registre (voir storyboard-method.md section 3). */
const D = { social: 15 * FPS, spot: 30 * FPS } as const;

export const Root: React.FC = () => (
  <>
    {/* ---- Sting de marque ---- */}
    <Composition id="AmazerSting" component={AmazerSting}
      durationInFrames={360} fps={FPS} width={W} height={H} />
    <Composition id="AmazerStingVertical" component={AmazerSting}
      durationInFrames={360} fps={FPS} width={1080} height={1920} />

    {/* ---- Template publicitaire : meme composant, 3 formats, N jeux de props.
        Le vertical n’est PAS un 16:9 rogne : useLayout() recompose. ---- */}
    <Composition id="AdProduit" component={ProductAd}
      durationInFrames={D.spot} fps={FPS} width={W} height={H}
      defaultProps={PRESETS.produit} />
    <Composition id="AdProduitVertical" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1920}
      defaultProps={PRESETS.produit} />
    <Composition id="AdProduitCarre" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1080}
      defaultProps={PRESETS.produit} />

    <Composition id="AdVendeur" component={ProductAd}
      durationInFrames={D.spot} fps={FPS} width={W} height={H}
      defaultProps={PRESETS.vendeur} />
    <Composition id="AdVendeurVertical" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1920}
      defaultProps={PRESETS.vendeur} />

    <Composition id="AdVendeurCarre" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1080}
      defaultProps={PRESETS.vendeur} />

    <Composition id="AdRestaurant" component={ProductAd}
      durationInFrames={D.spot} fps={FPS} width={W} height={H}
      defaultProps={PRESETS.restaurant} />
    <Composition id="AdRestaurantVertical" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1920}
      defaultProps={PRESETS.restaurant} />
    <Composition id="AdRestaurantCarre" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1080}
      defaultProps={PRESETS.restaurant} />

    <Composition id="AdPromotion" component={ProductAd}
      durationInFrames={D.spot} fps={FPS} width={W} height={H}
      defaultProps={PRESETS.promotion} />
    <Composition id="AdPromotionVertical" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1920}
      defaultProps={PRESETS.promotion} />
    <Composition id="AdPromotionCarre" component={ProductAd}
      durationInFrames={D.social} fps={FPS} width={1080} height={1080}
      defaultProps={PRESETS.promotion} />
  </>
);
