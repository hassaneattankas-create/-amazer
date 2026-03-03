"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { OrderStepper } from "@/components/OrderStepper";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { listActiveAlerts } from "@/services/alert-service";
import { listMyOrders } from "@/services/order-service";
import { useCartStore } from "@/store/cartStore";

function AnimatedCounter({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.2, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {value.toLocaleString("fr-FR")}
    </motion.span>
  );
}

export default function DashboardPage() {
  const savingsHistory = useCartStore((state) => state.savingsHistory);
  const { data: alerts, isPending } = useQuery({
    queryKey: ["alerts-active"],
    queryFn: listActiveAlerts,
    retry: false,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-me"],
    queryFn: listMyOrders,
    retry: false,
  });

  const totalSaved = useMemo(
    () => savingsHistory.reduce((sum, record) => sum + record.savings, 0),
    [savingsHistory]
  );

  const bestDealMonth = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthRecords = savingsHistory.filter((entry) => {
      const date = new Date(entry.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    if (!monthRecords.length) {
      return 0;
    }
    return Math.max(...monthRecords.map((record) => record.savings));
  }, [savingsHistory]);

  const chartData = useMemo(() => {
    return [...savingsHistory]
      .slice(0, 10)
      .reverse()
      .map((entry) => ({
        day: new Date(entry.createdAt).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
        savings: Number(entry.savings.toFixed(2)),
      }));
  }, [savingsHistory]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h1 className="luxury-title text-2xl font-semibold sm:text-3xl">
          Tableau de Bord Economies
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Visualise les gains de tes optimisations et tes alertes actives.
        </p>
      </header>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="premium-card rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Total Economise</p>
            <AnimatedPrice value={totalSaved} className="mt-2 text-3xl font-semibold text-[#FF4D00]" />
          </article>
          <article className="premium-card rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Alertes Actives</p>
            <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">
              <AnimatedCounter value={alerts?.length ?? 0} />
            </p>
          </article>
          <article className="premium-card rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              Meilleure Affaire du Mois
            </p>
            <AnimatedPrice value={bestDealMonth} className="mt-2 text-3xl font-semibold text-[#FF4D00]" />
          </article>
        </div>
      )}

      <article className="premium-card rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="luxury-title text-lg font-semibold">Evolution des economies</h2>
        <p className="mt-1 text-sm text-slate-500">Historique recent de tes optimisations.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF4D00" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#FF4D00" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
              <Tooltip
                formatter={(value) => [new Intl.NumberFormat("fr-NE", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(Number(value)), "Economies"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="savings"
                stroke="#FF4D00"
                strokeWidth={1.5}
                fill="url(#savingsFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="premium-card rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-2xl">
        <h2 className="luxury-title text-lg font-semibold">Suivi de commande</h2>
        <p className="mt-1 text-sm text-slate-500">
          Etapes: Commande -&gt; Preparation -&gt; Livraison -&gt; Recu
        </p>
        <div className="mt-4 space-y-4">
          {orders.slice(0, 2).map((order) => (
            <OrderStepper key={order.id} order={order} />
          ))}
          {!orders.length ? <p className="text-sm text-slate-500">Aucune commande pour le moment.</p> : null}
        </div>
      </article>
    </section>
  );
}
