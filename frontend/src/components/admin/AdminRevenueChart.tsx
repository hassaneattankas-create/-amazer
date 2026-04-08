"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RevenueChartPoint = { day: string; amount: number };

type AdminRevenueChartProps = {
  data: RevenueChartPoint[];
};

export function AdminRevenueChart({ data }: AdminRevenueChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4D00" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#FF4D00" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
          <Tooltip />
          <Area dataKey="amount" stroke="#FF4D00" fill="url(#revFill)" strokeWidth={1.8} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
