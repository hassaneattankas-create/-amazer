"use client";

import { AlertTriangle, ClipboardList, PackageCheck, TrendingUp, type LucideIcon } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import type { SellerInventoryItem, SellerShopOrder } from "@/types/seller";

type Kpi = { label: string; value: string; hint: string; icon: LucideIcon; href: string; alert?: boolean };

const LOW_STOCK = 3;
const THIRTY_DAYS = 30 * 86_400_000;

/**
 * Indicateurs d'accueil vendeur, comme l'accueil de Shopify : ce qui demande une action d'abord,
 * puis les chiffres cles. Chaque tuile mene a la section concernee.
 */
export function SellerKpis({ orders, inventory }: { orders: SellerShopOrder[]; inventory: SellerInventoryItem[] }) {
  const now = Date.now();
  const toHandle = orders.filter((order) => order.payment_status === "paid" && ["commande", "preparation"].includes(order.status));
  const recentSales = orders
    .filter((order) => order.payment_status === "paid" && order.status !== "annulee")
    .filter((order) => now - new Date(order.created_at).getTime() <= THIRTY_DAYS);
  const online = inventory.filter((item) => item.is_active);
  const lowStock = online.filter((item) => item.stock_quantity <= LOW_STOCK);

  const kpis: Kpi[] = [
    {
      label: "À préparer",
      value: String(toHandle.length),
      hint: toHandle.length ? "Commandes payées en attente" : "Rien en attente",
      icon: ClipboardList,
      href: "#commandes",
      alert: toHandle.length > 0,
    },
    {
      label: "Ventes sur 30 jours",
      value: formatXOF(recentSales.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)),
      hint: `${recentSales.length} commande${recentSales.length > 1 ? "s" : ""}`,
      icon: TrendingUp,
      href: "#commandes",
    },
    {
      label: "Produits en ligne",
      value: String(online.length),
      hint: `${inventory.length - online.length} masqué${inventory.length - online.length > 1 ? "s" : ""}`,
      icon: PackageCheck,
      href: "#catalogue",
    },
    {
      label: "Stock faible",
      value: String(lowStock.length),
      hint: lowStock.length ? `${LOW_STOCK} unités ou moins` : "Stock correct",
      icon: AlertTriangle,
      href: "#catalogue",
      alert: lowStock.length > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <a
            key={kpi.label}
            href={kpi.href}
            className={`rounded-card border bg-card p-4 transition-colors duration-fast hover:border-ink-400 ${
              kpi.alert ? "border-brand-500" : "border-border"
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-ink-600">
              <Icon className={`h-4 w-4 ${kpi.alert ? "text-brand-600" : "text-ink-500"}`} aria-hidden="true" />
              {kpi.label}
            </span>
            <span className="mt-1 block text-2xl font-bold text-ink-900">{kpi.value}</span>
            <span className="block text-xs text-ink-600">{kpi.hint}</span>
          </a>
        );
      })}
    </div>
  );
}
