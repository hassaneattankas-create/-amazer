import { formatXOF } from "@/lib/currency";
import type { RestaurantMenuItem, RestaurantOrder } from "@/types/restaurant";

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

/** Chiffres du jour du restaurant (accueil de l'espace vendeur). */
export function RestaurantKpis({ orders, menu }: { orders: RestaurantOrder[]; menu: RestaurantMenuItem[] }) {
  const today = orders.filter((order) => isToday(order.created_at) && order.payment_status === "paid" && order.status !== "annulee");
  const revenue = today.reduce((sum, order) => sum + (order.items_subtotal ?? order.items.reduce((s, item) => s + item.subtotal, 0)), 0);
  const waiting = orders.filter((order) => order.payment_status === "paid" && order.status === "commande").length;
  const soldOut = menu.filter((dish) => dish.is_available && dish.sold_out).length;
  const stats = [
    { label: "Commandes aujourd'hui", value: String(today.length) },
    { label: "Ventes du jour (plats)", value: formatXOF(revenue) },
    { label: "À accepter", value: String(waiting), alert: waiting > 0 },
    { label: "Plats épuisés", value: String(soldOut) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className={`rounded-card border bg-card p-3 ${stat.alert ? "border-brand-500" : "border-border"}`}>
          <dt className="text-xs text-ink-600">{stat.label}</dt>
          <dd className="mt-1 text-xl font-bold text-ink-900">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
