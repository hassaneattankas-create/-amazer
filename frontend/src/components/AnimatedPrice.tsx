"use client";

import { motion } from "framer-motion";

import { formatMoney, SupportedCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type AnimatedPriceProps = {
  value: number;
  className?: string;
  currency?: SupportedCurrency;
};

export function AnimatedPrice({ value, className, currency }: AnimatedPriceProps) {
  const preferredCurrency = useAuthStore((state) => state.preferredCurrency);
  const formatted = formatMoney(value, currency ?? preferredCurrency);

  return (
    <span className={cn("inline-flex overflow-hidden", className)}>
      {formatted.split("").map((char, index) => (
        <motion.span
          key={`${formatted}-${index}-${char}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: index * 0.015 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
