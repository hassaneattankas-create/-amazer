"use client";

import { useEffect } from "react";

/**
 * Ouverture animée d'AMAZER — uniquement quand AMAZER est ouvert comme une application (Android ou installée
 * depuis le site), une fois par session. Le script d'en-tête (LAUNCH_INTRO_SCRIPT) ajoute la classe
 * `amazer-intro` à <html> avant le premier affichage : l'écran bleu nuit apparaît sans éclair blanc.
 * Sur le site ouvert dans un navigateur, rien ne s'affiche (aucun effet sur la vitesse de la page).
 * Un toucher passe l'animation ; « mouvement réduit » : simple fondu.
 */
export const LAUNCH_INTRO_SCRIPT =
  "try{var s=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone||window.Capacitor;" +
  "if(s&&!sessionStorage.getItem('amazer_intro')){var h=document.documentElement;h.classList.add('amazer-intro');" +
  // sécurité : si le site tarde, l'écran d'ouverture s'efface seul au bout de 6 s
  "setTimeout(function(){h.classList.remove('amazer-intro','amazer-intro-out')},6000)}}catch(e){}";

const LETTERS = "AMAZER".split("");
const DURATION_MS = 2000;

export function AppLaunchIntro() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("amazer-intro")) return;
    try {
      sessionStorage.setItem("amazer_intro", "1");
    } catch {
      // stockage indisponible : l'animation se rejouera, sans conséquence
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const end = () => root.classList.remove("amazer-intro", "amazer-intro-out");
    const leave = () => {
      root.classList.add("amazer-intro-out");
      window.setTimeout(end, 520);
    };
    const timer = window.setTimeout(leave, reduced ? 700 : DURATION_MS - 520);
    const skip = () => {
      window.clearTimeout(timer);
      leave();
    };
    const overlay = document.getElementById("amazer-intro");
    overlay?.addEventListener("pointerdown", skip, { once: true });
    return () => {
      window.clearTimeout(timer);
      overlay?.removeEventListener("pointerdown", skip);
    };
  }, []);

  return (
    <div id="amazer-intro" className="amz-intro" aria-hidden="true">
      <div className="amz-intro-lumiere amz-intro-lumiere-haut" />
      <div className="amz-intro-lumiere amz-intro-lumiere-bas" />
      <div className="amz-intro-motif amz-intro-motif-loin" />
      <div className="amz-intro-motif" />
      <div className="amz-intro-halo" />
      <div className="amz-intro-centre">
        <div className="amz-intro-icone">
          <svg viewBox="96 100 320 310" width="96" height="96" aria-hidden="true">
            <path d="M128 390L245 122H275L389 390H332L308 331H206L183 390H128Z" fill="currentColor" />
            <path d="M252 208L286 286H218L252 208Z" fill="white" />
          </svg>
          <span className="amz-intro-reflet" />
        </div>
        <p className="amz-intro-nom">
          {LETTERS.map((letter, i) => (
            <span key={i} style={{ animationDelay: `${450 + i * 55}ms` }}>
              {letter}
            </span>
          ))}
        </p>
        <p className="amz-intro-slogan">Achetez et vendez en toute confiance</p>
      </div>
    </div>
  );
}
