"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Share2 } from "lucide-react";

import { resolveImageUrl } from "@/lib/image";
import type { SellerProfile } from "@/types/seller";

/**
 * « Mon affiche » : l'affiche AMAZER du vendeur, remplie automatiquement (QR code vers sa vitrine, nom, logo).
 * Modèle selon l'abonnement : Boutique (violet), Restaurant (orange), Premium (violet et or).
 * Emplacements mesurés sur les modèles (public/affiches/*.jpg) ; l'image finale est 2 × plus grande.
 */
type Zone = { qr: [number, number, number]; field: [number, number, number]; phone: [number, number, number, number]; slogan?: [number, number, number, number]; logo: [number, number, number]; ink: string; accent: string };
const MODELS: Record<"boutique" | "restaurant" | "premium", Zone> = {
  boutique: { qr: [555, 738, 190], field: [490, 1041, 703], phone: [511, 296, 648, 318], slogan: [511, 318, 648, 337], logo: [469, 309, 40], ink: "#1E1B4B", accent: "#4C1D95" },
  restaurant: { qr: [548, 716, 180], field: [505, 1040, 668], phone: [482, 285, 622, 307], logo: [443, 320, 38], ink: "#1F1F1F", accent: "#EA580C" },
  premium: { qr: [530, 718, 172], field: [488, 1044, 662], phone: [472, 286, 608, 308], slogan: [472, 308, 608, 325], logo: [437, 310, 38], ink: "#1E1B4B", accent: "#3B0D7A" },
};

export function posterModel(profile: Pick<SellerProfile, "activity_type" | "storefront_tier">): keyof typeof MODELS {
  if (profile.activity_type === "restaurant") return "restaurant";
  if (profile.storefront_tier === "premium" || profile.activity_type === "hotel" || profile.activity_type === "enterprise") return "premium";
  return "boutique";
}

const loadImage = (src: string, cors = false) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export function SellerPosterCard({ profile }: { profile: SellerProfile }) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const model = posterModel(profile);
  const shopUrl = `https://amazer.store/shop/${encodeURIComponent(profile.vendor_id)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Z = MODELS[model];
        const tpl = await loadImage(`/affiches/${model}.jpg`);
        const k = 2;
        const canvas = document.createElement("canvas");
        canvas.width = tpl.naturalWidth * k;
        canvas.height = tpl.naturalHeight * k;
        const ctx = canvas.getContext("2d");
        if (!ctx || !qrRef.current) return;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(tpl, 0, 0, canvas.width, canvas.height);
        const font = getComputedStyle(document.body).fontFamily || "sans-serif";
        const fit = (text: string, max: number, size: number, weight = 800) => {
          let s = size;
          do {
            ctx.font = `${weight} ${s * k}px ${font}`;
            s -= 1;
          } while (ctx.measureText(text).width > max * k && s > 8);
        };
        // QR code vers la vitrine
        const [qx, qy, qs] = Z.qr;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect((qx - qs / 2 - 6) * k, (qy - qs / 2 - 6) * k, (qs + 12) * k, (qs + 12) * k);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrRef.current, (qx - qs / 2) * k, (qy - qs / 2) * k, qs * k, qs * k);
        ctx.imageSmoothingEnabled = true;
        // nom dans le champ du bas
        const name = profile.business_name.trim();
        const [fx, fy, fx2] = Z.field;
        fit(name, fx2 - fx, 20);
        ctx.fillStyle = Z.ink;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(name, fx * k, fy * k);
        // nom (et ville) dans le téléphone
        const [px, py, px2, py2] = Z.phone;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(px * k, py * k, (px2 - px) * k, (py2 - py) * k);
        fit(name, px2 - px - 4, 14);
        ctx.fillStyle = Z.ink;
        ctx.textBaseline = "middle";
        ctx.fillText(name, (px + 2) * k, ((py + py2) / 2) * k);
        if (Z.slogan) {
          const [sx, sy, sx2, sy2] = Z.slogan;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(sx * k, sy * k, (sx2 - sx) * k, (sy2 - sy) * k);
          fit(`Boutique à ${profile.city || "Niamey"}`, sx2 - sx - 4, 11, 500);
          ctx.fillStyle = "#475569";
          ctx.fillText(`Boutique à ${profile.city || "Niamey"}`, (sx + 2) * k, ((sy + sy2) / 2) * k);
        }
        // logo (rond), sinon initiales
        const [lx, ly, r] = Z.logo;
        ctx.save();
        ctx.beginPath();
        ctx.arc(lx * k, ly * k, r * k, 0, Math.PI * 2);
        ctx.clip();
        let drawn = false;
        const logoSrc = resolveImageUrl(profile.logo_url, 200);
        if (logoSrc) {
          try {
            const logo = await loadImage(logoSrc, true);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect((lx - r) * k, (ly - r) * k, 2 * r * k, 2 * r * k);
            ctx.drawImage(logo, (lx - r) * k, (ly - r) * k, 2 * r * k, 2 * r * k);
            drawn = true;
          } catch {
            drawn = false;
          }
        }
        if (!drawn) {
          ctx.fillStyle = Z.accent;
          ctx.fillRect((lx - r) * k, (ly - r) * k, 2 * r * k, 2 * r * k);
          const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
          ctx.font = `800 ${r * 0.85 * k}px ${font}`;
          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initials, lx * k, (ly + 1) * k);
          ctx.textAlign = "start";
        }
        ctx.restore();
        const out = await new Promise<string | null>((resolve) => {
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.92));
          } catch {
            resolve(null); // logo d'une autre adresse refusé : affiche sans logo au prochain essai
          }
        });
        if (!cancelled) {
          if (out) setUrl(out);
          else setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [model, profile.business_name, profile.city, profile.logo_url, profile.vendor_id]);

  const fileName = `Affiche-AMAZER-${profile.business_name.replace(/[^\p{L}\p{N}]+/gu, "-")}.jpg`;
  const share = async () => {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `Découvrez ${profile.business_name} sur AMAZER : ${shopUrl}` });
        return;
      }
    } catch {
      // partage annulé ou impossible : WhatsApp avec le lien
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`Découvrez ${profile.business_name} sur AMAZER : ${shopUrl}`)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">
        Votre affiche est prête, avec votre nom et le QR code de votre vitrine. Imprimez-la pour votre comptoir ou partagez-la sur WhatsApp et
        Facebook : vos clients scannent et arrivent directement chez vous.
      </p>
      <div className="hidden" aria-hidden="true">
        <QRCodeCanvas ref={qrRef} value={shopUrl} size={512} marginSize={1} level="M" />
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- image fabriquée dans le navigateur (data:)
        <img src={url} alt={`Affiche AMAZER de ${profile.business_name}`} className="w-full max-w-sm rounded-card border border-border" />
      ) : error ? (
        <p className="text-sm text-ink-600">L&apos;affiche n&apos;a pas pu être préparée. Rechargez la page.</p>
      ) : (
        <div className="aspect-[2/3] w-full max-w-sm animate-pulse rounded-card bg-surface-1" aria-busy="true" />
      )}
      <div className="flex flex-wrap gap-2">
        <a
          href={url ?? undefined}
          download={fileName}
          aria-disabled={!url}
          className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 aria-disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Télécharger l&apos;affiche
        </a>
        <button
          type="button"
          onClick={() => void share()}
          disabled={!url}
          className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-border bg-card px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Partager
        </button>
      </div>
    </div>
  );
}
