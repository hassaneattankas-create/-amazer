import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Bike, CheckCircle2, Fuel, MapPin, Moon, Navigation, Phone, Pill, XCircle } from "lucide-react";

import { formatDistance, telHref, timeAgo, whatsappHref } from "@/lib/local-services";
import { resolveImageUrl } from "@/lib/image";
import { recordOutletEvent } from "@/services/local-services-service";
import { FUEL_LABELS, type FuelKey, type LocalServiceItem, type ServiceKind } from "@/types/local-services";

type Props = {
  item: LocalServiceItem;
  kind: ServiceKind;
  distanceKm?: number | null;
  freshHours: number;
  /** Sur la vitrine elle-même : sans en-tête ni lien « Voir la vitrine ». */
  compact?: boolean;
  /** Sur la vitrine de la marque : en-tête gardé, sans lien « Voir la vitrine ». */
  inShop?: boolean;
};

const FUELS: FuelKey[] = ["super", "gasoil", "gaz"];
const actionClass =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-field px-3 text-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

/** Une pharmacie ou une station : statut en premier, puis Appeler · Itinéraire · Se faire livrer. */
export function LocalServiceCard({ item, kind, distanceKm, freshHours, compact = false, inShop = false }: Props) {
  const KindIcon = kind === "pharmacy" ? Pill : Fuel;
  const updated = timeAgo(item.fuel_updated_at);
  const from = `${item.business_name}${item.city ? ` (${item.city})` : ""}`;
  // Stations : seul le gaz s'achète et se livre.
  const deliveryMessage =
    kind === "fuel_station"
      ? `Bonjour AMAZER, je souhaite commander du gaz livré depuis ${from}. Taille de bouteille : `
      : `Bonjour AMAZER, je souhaite une livraison depuis ${from}.`;
  const logo = item.logo_url ? resolveImageUrl(item.logo_url) : null;
  // Statistiques de la station (appels, itineraires, commandes de gaz), sans donnee personnelle.
  const track = (event: "call" | "route" | "gas") => {
    if (item.outlet_id) recordOutletEvent(item.outlet_id, event);
  };

  return (
    <article className="flex flex-col rounded-card border border-border bg-card p-4 shadow-resting">
      {compact ? (
        <h2 className="text-base font-semibold text-ink-900">{kind === "pharmacy" ? "Garde et contact" : "Carburant disponible"}</h2>
      ) : (
      <header className="flex items-start gap-3">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-field bg-brand-50 text-brand-600">
          {logo ? <Image src={logo} alt="" fill sizes="48px" className="object-cover" /> : <KindIcon className="h-6 w-6" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink-900">
            <span className="truncate">{item.business_name}</span>
            {item.is_verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-label="Établissement vérifié" /> : null}
          </h2>
          <p className="mt-0.5 flex items-start gap-1 text-sm text-ink-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{[item.address, item.city].filter(Boolean).join(", ") || "Adresse non renseignée"}</span>
          </p>
        </div>
        {distanceKm != null ? (
          <span className="shrink-0 rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-700">{formatDistance(distanceKm)}</span>
        ) : null}
      </header>
      )}

      {kind === "pharmacy" ? (
        <div className="mt-3">
          {item.on_duty ? (
            <p className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-3 py-1 text-sm font-semibold text-success">
              <Moon className="h-4 w-4" aria-hidden="true" />
              {item.duty_label ?? "De garde"}
            </p>
          ) : (
            <p className="text-sm text-ink-600">Pas de garde en ce moment : horaires habituels.</p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <ul className="flex flex-wrap gap-2" aria-label="Disponibilité du carburant">
            {FUELS.map((fuel) => {
              const state = item.fuel[fuel];
              const known = item.fuel_fresh && state;
              const ok = known && state === "available";
              return (
                <li
                  key={fuel}
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-sm font-semibold ${
                    !known ? "border-border bg-surface-1 text-ink-500" : ok ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"
                  }`}
                >
                  {!known ? null : ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                  {FUEL_LABELS[fuel]}
                  <span className="font-normal">{!known ? "· ?" : ok ? "· disponible" : "· rupture"}</span>
                </li>
              );
            })}
          </ul>
          {item.fuel_fresh ? (
            <p className="mt-2 text-xs text-ink-600">Mis à jour {updated} par la station</p>
          ) : (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
              {updated ? `Dernière information ${updated} (plus de ${freshHours} h) : appelez pour confirmer.` : "Pas encore d'information : appelez pour confirmer."}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {item.phone ? (
          <a href={telHref(item.phone)} onClick={() => track("call")} className={`${actionClass} border border-border bg-card text-ink-800 hover:bg-surface-1`}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            Appeler
          </a>
        ) : null}
        <a
          href={item.maps_url}
          onClick={() => track("route")}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionClass} border border-border bg-card text-ink-800 hover:bg-surface-1`}
          aria-label={`Itinéraire vers ${item.business_name} dans Google Maps`}
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Itinéraire
        </a>
      </div>
      {item.delivery_phone ? (
        <a
          href={whatsappHref(item.delivery_phone, deliveryMessage)}
          onClick={() => track("gas")}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionClass} mt-2 bg-brand-600 text-white hover:bg-brand-700`}
        >
          <Bike className="h-4 w-4" aria-hidden="true" />
          {kind === "fuel_station" ? "Commander du gaz (livraison AMAZER)" : "Se faire livrer par AMAZER"}
        </a>
      ) : (
        <p className="mt-2 text-center text-xs text-ink-500">
          {kind === "fuel_station"
            ? "Livraison de gaz possible quand la station en a, dans les villes desservies."
            : "Livraison AMAZER bientôt disponible dans cette ville."}
        </p>
      )}
      {compact || inShop ? null : (
        <Link href={`/shop/${item.vendor_id}`} className="mt-3 text-center text-sm font-medium text-brand-700 hover:underline">
          {(item.brand_outlets ?? 0) > 1 ? `Voir les ${item.brand_outlets} stations ${item.brand_name ?? ""}`.trim() : "Voir la vitrine"}
        </Link>
      )}
    </article>
  );
}
