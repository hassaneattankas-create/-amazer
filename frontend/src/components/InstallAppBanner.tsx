"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

import { isMobileAppBuild } from "@/lib/mobile-app";

/** Événement « beforeinstallprompt » (Chrome, Edge, Samsung Internet) : pas encore dans les types du DOM. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "amazer_install_dismissed_until";
const DISMISS_DAYS = 14;
/** Le lien « Installer l'application » du pied de page rouvre la bannière. */
export const OPEN_INSTALL_EVENT = "amazer:open-install";

function isStandalone(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;
  // iPadOS se présente comme un Mac avec écran tactile.
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function dismissedRecently(): boolean {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Bouton « Installer l'application » sans Play Store ni App Store :
 * - Android / ordinateur : installation en un geste (fenêtre du navigateur) ;
 * - iPhone / iPad : explication en 2 gestes (Apple n'autorise pas de bouton automatique).
 */
export function InstallAppBanner() {
  const pathname = usePathname();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isMobileAppBuild() || isStandalone()) return undefined;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      if (!dismissedRecently()) setMode("android");
    };
    const onInstalled = () => {
      setMode("hidden");
      setPromptEvent(null);
    };
    const onOpen = () => {
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        // stockage indisponible : sans conséquence
      }
      if (isIos()) {
        setMode("ios");
        setIosHelp(true);
      } else {
        setMode("android");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(OPEN_INSTALL_EVENT, onOpen);

    // iPhone : pas d'événement d'installation, on propose l'explication (une fois tous les 14 jours au plus).
    const timer = isIos() && !dismissedRecently() ? window.setTimeout(() => setMode("ios"), 0) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(OPEN_INSTALL_EVENT, onOpen);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Pas pendant un paiement ni dans l'espace admin.
  if (mode === "hidden" || /^\/(admin|order|restaurant\/order)/.test(pathname ?? "")) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
    } catch {
      // stockage indisponible : la bannière reviendra à la prochaine visite
    }
    setMode("hidden");
  };

  const install = async () => {
    if (!promptEvent) {
      // Navigateur sans installation en un geste : on explique le menu du navigateur.
      setIosHelp(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "accepted") setMode("hidden");
  };

  return (
    <aside aria-label="Installer l'application AMAZER" className="border-b border-border bg-brand-50">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-gutter py-2">
        <Image src="/logo-amazer-mark-128.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-ink-900">Installez l&apos;application AMAZER</p>
          {iosHelp || (mode === "ios" && !promptEvent) ? (
            <p className="text-xs text-ink-700">
              {mode === "ios" ? (
                <>
                  Touchez <Share2 className="inline h-3.5 w-3.5 align-text-bottom" aria-label="Partager" /> (Partager), puis « Sur
                  l&apos;écran d&apos;accueil ».
                </>
              ) : (
                <>Ouvrez le menu du navigateur (⋮), puis « Installer l&apos;application » ou « Ajouter à l&apos;écran d&apos;accueil ».</>
              )}
            </p>
          ) : (
            <p className="text-xs text-ink-700">Gratuite, légère, toujours à jour. Sans passer par le Play Store.</p>
          )}
        </div>
        {mode === "android" ? (
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Installer
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-ink-600 hover:bg-card"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
