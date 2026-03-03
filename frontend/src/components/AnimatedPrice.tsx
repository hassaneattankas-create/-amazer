"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { formatXOF } from "@/lib/currency";

type AnimatedPriceProps = {
  value: number;
  className?: string;
};

export function AnimatedPrice({ value, className }: AnimatedPriceProps) {
  const formatted = formatXOF(value);

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
