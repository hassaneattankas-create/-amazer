"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
 * Flèche « Retour » de l'en-tête, sur toutes les pages sauf l'accueil.
 * Revient à la page précédente du site ; si la personne est arrivée directement
 * (lien partagé, notification), elle mène à l'accueil au lieu de quitter AMAZER.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

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

  if (!pathname || pathname === "/") return null;

  const goBack = () => {
    if (readStack().length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Retour à la page précédente"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field text-ink-800 transition-colors duration-fast hover:bg-surface-1"
    >
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
