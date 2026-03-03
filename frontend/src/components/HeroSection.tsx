"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className="premium-card relative overflow-hidden border border-white/20 bg-white/70 px-6 py-10 sm:px-10"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-yellow-400/20" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <Image src="/logo-amazer.svg" alt="Logo AMAZER" width={180} height={52} className="h-10 w-auto" priority />
          <span className="luxury-title text-xl font-semibold tracking-tight sm:text-2xl">AMAZER</span>
        </div>
        <h1 className="luxury-title mt-4 text-3xl font-semibold sm:text-5xl">
          TITAN EDITION pour le marche nigerien
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
          Livraison rapide, comparaison intelligente et experience mobile premium.
        </p>
      </div>
    </motion.section>
  );
}
