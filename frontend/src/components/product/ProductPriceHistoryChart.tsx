"use client";

import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AnimatedPrice } from "@/components/AnimatedPrice";

type PricePoint = {
  date: string;
  amount: number;
};

type ProductPriceHistoryChartProps = {
  chartData: PricePoint[];
  minAmount: number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function CustomPriceTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-[#FF4D00]/35 bg-white px-3 py-2 text-xs text-slate-800 shadow-xl"
    >
      <p className="text-slate-500">{label}</p>
      <AnimatedPrice value={Number(payload[0].value)} className="mt-1 font-semibold text-[#FF4D00]" />
    </motion.div>
  );
}

export function ProductPriceHistoryChart({ chartData, minAmount }: ProductPriceHistoryChartProps) {
  return (
    <div className="mt-6 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFillCoral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4D00" stopOpacity={0.33} />
              <stop offset="100%" stopColor="#FF4D00" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            domain={[minAmount, "auto"]}
          />
          <Tooltip cursor={{ stroke: "#FF4D00", strokeOpacity: 0.25 }} content={<CustomPriceTooltip />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#FF4D00"
            strokeWidth={1.5}
            fill="url(#priceFillCoral)"
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
