"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { getSellerStats } from "@/services/seller-service";

function trend(current: number, previous: number): { text: string; up: boolean | null } {
  if (!previous) return { text: current ? "nouveau" : "—", up: current ? true : null };
  const change = Math.round(((current - previous) / previous) * 100);
  return { text: `${change > 0 ? "+" : ""}${change} %`, up: change === 0 ? null : change > 0 };
}

/** Statistiques simples : visites, contacts, commandes (7 jours vs semaine d'avant) + graphique. */
export function SellerStatsPanel() {
  const { data } = useQuery({ queryKey: ["seller-stats"], queryFn: getSellerStats, staleTime: 60_000 });
  if (!data?.this_week || !data.last_week || !Array.isArray(data.days)) return null;
  const metrics = [
    { label: "Visites de la vitrine", now: data.this_week.views, before: data.last_week.views },
    { label: "Contacts (appel, WhatsApp, message)", now: data.this_week.contacts, before: data.last_week.contacts },
    { label: "Commandes et réservations", now: data.this_week.orders, before: data.last_week.orders },
  ];
  const peak = Math.max(1, ...data.days.map((day) => day.views));
  const conversion = data.this_week.views ? Math.round((data.this_week.orders / data.this_week.views) * 100) : null;

  return (
    <section aria-labelledby="stats-title" className="space-y-3 rounded-card border border-border bg-card p-4">
      <h2 id="stats-title" className="text-lg font-semibold text-ink-900">
        Statistiques · 7 derniers jours
      </h2>
      <dl className="grid gap-2 sm:grid-cols-3">
        {metrics.map((metric) => {
          const change = trend(metric.now, metric.before);
          return (
            <div key={metric.label} className="rounded-field bg-surface-1 p-3">
              <dt className="text-xs text-ink-600">{metric.label}</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-ink-900">{metric.now}</span>
                <span className={`text-xs font-semibold ${change.up === null ? "text-ink-500" : change.up ? "text-success" : "text-danger"}`}>
                  {change.text}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      {conversion !== null ? (
        <p className="text-sm text-ink-700">
          Sur 100 visiteurs, environ <strong>{conversion}</strong> commandent ou réservent.
        </p>
      ) : (
        <p className="text-sm text-ink-700">Partagez le lien de votre vitrine (statut WhatsApp, Facebook) pour recevoir vos premières visites.</p>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-label text-ink-600">
          Visites par jour · {data.days.length} jours
        </p>
        <div className="mt-2 flex h-24 items-end gap-0.5" role="img" aria-label={`Visites des ${data.days.length} derniers jours`}>
          {data.days.map((day) => (
            <div
              key={day.day}
              title={`${new Date(`${day.day}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${day.views} visite(s)`}
              className="flex-1 rounded-t-chip bg-brand-500"
              style={{ height: `${Math.max(4, (day.views / peak) * 100)}%`, opacity: day.views ? 1 : 0.25 }}
            />
          ))}
        </div>
      </div>
      {!data.is_premium ? (
        <p className="text-xs text-ink-600">
          Historique sur 30 jours avec la formule Premium.{" "}
          <Link href="/seller" className="font-semibold text-brand-700 hover:underline">
            Voir les formules
          </Link>
        </p>
      ) : null}
    </section>
  );
}
