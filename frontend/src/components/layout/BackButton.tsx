"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useClientMounted } from "@/hooks/use-client-mounted";

const STACK_KEY = "amazer-nav-stack";

function readStack(): string[] {
  try {
    const raw = window.sessionStorage.getItem(STACK_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]): void {
  try {
    window.sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-50)));
  } catch {
    // Stockage indisponible (navigation privée) : le bouton renverra simplement à l'accueil.
  }
}

/**
 * « Retour » sur toutes les pages sauf l'accueil : flèche devant le logo sur ordinateur (variant « icon »),
 * fine ligne « ← Retour » sous l'en-tête sur téléphone (variant « bar »), sans changer l'en-tête.
 * Revient à la page précédente du site ; si la personne est arrivée directement
 * (lien partagé, notification), elle mène à l'accueil au lieu de quitter AMAZER.
 */
export function BackButton({ variant = "icon" }: { variant?: "icon" | "bar" }) {
  const pathname = usePathname();
  const router = useRouter();
  // La page d'accueil est préparée à l'avance par le serveur, qui ne connaît pas toujours l'adresse réelle :
  // on ne décide d'afficher « Retour » qu'une fois dans le navigateur (sinon erreur React #418).
  const mounted = useClientMounted();

  // Pile des pages visitées pendant la visite : sert à savoir s'il y a une page AMAZER où revenir.
  useEffect(() => {
    if (!pathname) return;
    const stack = readStack();
    if (stack.at(-1) === pathname) return;
    if (stack.at(-2) === pathname) {
      stack.pop();
    } else {
      stack.push(pathname);
    }
    writeStack(stack);
  }, [pathname]);

  const isHome = !mounted || !pathname || pathname === "/";

  const goBack = () => {
    if (readStack().length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  if (variant === "bar") {
    // Téléphone : fine ligne sous l'en-tête, pour que l'en-tête reste identique sur toutes les pages.
    if (isHome) return null;
    return (
      <div className="border-t border-border md:hidden">
        <div className="mx-auto flex h-11 w-full max-w-7xl items-center px-gutter">
          <button
            type="button"
            onClick={goBack}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-field px-2 text-sm font-semibold text-ink-800 hover:bg-surface-1"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Ordinateur : flèche devant le logo ; sur l'accueil, la place reste réservée pour que le logo ne bouge pas.
  if (isHome) return <span className="hidden h-11 w-11 shrink-0 md:inline-block" aria-hidden="true" />;
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Retour à la page précédente"
      className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-field text-ink-800 transition-colors duration-fast hover:bg-surface-1 md:inline-flex"
    >
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
