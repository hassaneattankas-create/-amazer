"use client";

import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPriceAlert } from "@/services/alert-service";

type PriceAlertButtonProps = {
  productId: string;
  currentPrice?: number;
};

export function PriceAlertButton({ productId, currentPrice }: PriceAlertButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState(
    currentPrice ? String(Math.max(1, Number((currentPrice * 0.95).toFixed(2)))) : ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const submitAlert = async () => {
    const parsed = Number(targetPrice);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStatus("error");
      setMessage("Prix cible invalide.");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");
    try {
      await createPriceAlert({ product_id: productId, target_price: parsed });
      setStatus("success");
      setMessage("Alerte creee avec succes.");
    } catch (error) {
      const responseMessage =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Impossible de creer l'alerte.";
      setStatus("error");
      setMessage(responseMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        animate={
          isOpen
            ? {
                rotate: [0, -16, 16, -10, 10, 0],
                scale: [1, 1.08, 1],
              }
            : { rotate: 0, scale: 1 }
        }
        transition={{ duration: 0.45, ease: "easeInOut" }}
        className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition ${
          isOpen
            ? "border-[#FF4D00]/55 bg-[#FF4D00]/10 text-[#FF4D00] shadow-[0_0_24px_rgba(255,77,0,0.45)]"
            : "border-slate-200 bg-white text-slate-700 hover:border-[#FF4D00]/40"
        }`}
      >
        <Bell className="h-4 w-4" />
        Alerte prix
      </motion.button>

      {isOpen ? (
        <div className="premium-card absolute left-0 right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-slate-200 bg-white p-3 sm:left-auto sm:right-0">
          <p className="text-xs text-slate-500">Prix cible souhaite</p>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            placeholder="Ex: 499.99"
            className="mt-2 h-10 border-slate-200 bg-white text-slate-900"
          />
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={submitAlert}
            className="primary-glow-btn mt-3 w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            {isSubmitting ? "Creation..." : "Creer l'alerte"}
          </Button>
          {isSubmitting ? <div className="mt-2 h-2 w-full animate-pulse rounded bg-orange-100" /> : null}
          {status !== "idle" ? (
            <p className={`mt-2 text-xs ${status === "success" ? "text-emerald-600" : "text-rose-500"}`}>
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
