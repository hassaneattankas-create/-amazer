"use client";

import { MapPin, Package, Phone, Store, Zap } from "lucide-react";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import type { CourierOrder } from "@/services/courier-service";

type DeliveryCardProps = {
  order: CourierOrder;
  busy: boolean;
  onTake?: () => void;
  onDelivered?: () => void;
  onRelease?: () => void;
  /** Valeur lue dans le QR code du reçu client (URL ou jeton). */
  onReceiptScanned?: (raw: string) => void;
};

function mapsLink(address: string, district: string | null): string {
  const query = [address, district, "Niamey"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function DeliveryCard({ order, busy, onTake, onDelivered, onRelease, onReceiptScanned }: DeliveryCardProps) {
  const delivered = order.status === "recu";
  const inProgress = order.assigned_to_me && order.status === "livraison";

  return (
    <article className="rounded-card border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink-900">#{order.tracking_code ?? order.id.slice(0, 8).toUpperCase()}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {order.delivery_type === "express_niamey" ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-600 px-2 py-0.5 font-semibold text-white">
              <Zap className="h-3 w-3" aria-hidden="true" />
              Express
            </span>
          ) : null}
          <span className="rounded-pill bg-surface-3 px-2 py-0.5 font-medium text-ink-800">
            {delivered ? "Livrée" : inProgress ? "En livraison" : "À prendre"}
          </span>
        </div>
      </header>

      <p className="mt-1 text-sm text-ink-600">
        {order.item_count} article{order.item_count > 1 ? "s" : ""} · {formatXOF(order.total_amount)} · déjà payé
      </p>

      <section className="mt-3 space-y-2" aria-label="Retrait">
        {order.pickups.map((pickup) => (
          <div key={pickup.shop_name} className="rounded-field bg-surface-1 p-3">
            <p className="flex items-center gap-1 text-sm font-semibold text-ink-900">
              <Store className="h-4 w-4 text-ink-500" aria-hidden="true" />
              Retrait : {pickup.shop_name}
            </p>
            <p className="mt-0.5 text-xs text-ink-600">{[pickup.address, pickup.city].filter(Boolean).join(", ") || "Adresse non renseignée"}</p>
            <ul className="mt-1 text-xs text-ink-700">
              {pickup.items.map((line) => (
                <li key={line} className="flex items-center gap-1">
                  <Package className="h-3 w-3" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            {pickup.phone && !delivered ? (
              <a href={`tel:${pickup.phone.replace(/\s/g, "")}`} className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-brand-700">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Appeler la boutique
              </a>
            ) : null}
          </div>
        ))}
      </section>

      <section className="mt-3" aria-label="Livraison">
        <p className="flex items-center gap-1 text-sm font-semibold text-ink-900">
          <MapPin className="h-4 w-4 text-ink-500" aria-hidden="true" />
          Livrer à : {order.customer_name}
          {order.district ? <span className="font-normal text-ink-600"> · {order.district}</span> : null}
        </p>
        {order.assigned_to_me && order.delivery_address ? (
          <p className="mt-0.5 text-sm text-ink-700">{order.delivery_address}</p>
        ) : null}
        {!order.assigned_to_me && !delivered ? (
          <>
            {order.customer_phone ? (
              <a
                href={`tel:${order.customer_phone.replace(/\s/g, "")}`}
                className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {order.customer_phone}
              </a>
            ) : null}
            <p className="mt-0.5 text-xs text-ink-600">Adresse exacte visible après la prise en charge.</p>
          </>
        ) : null}
      </section>

      {inProgress ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.customer_phone ? (
            <a
              href={`tel:${order.customer_phone.replace(/\s/g, "")}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Appeler
            </a>
          ) : null}
          {order.customer_phone ? (
            <WhatsAppButton
              phone={order.customer_phone}
              variant="outline"
              label="WhatsApp"
              message={`Bonjour, je suis votre livreur AMAZER pour la commande #${order.tracking_code ?? ""}.`}
            />
          ) : null}
          {order.delivery_address ? (
            <a
              href={mapsLink(order.delivery_address, order.district)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Itinéraire
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
        {onTake ? (
          <Button type="button" size="lg" disabled={busy} onClick={onTake}>
            Prendre en charge
          </Button>
        ) : null}
        {inProgress && onRelease ? (
          <Button type="button" variant="outline" disabled={busy} onClick={onRelease}>
            Je ne peux pas la livrer
          </Button>
        ) : null}
        {inProgress && onReceiptScanned ? (
          <BarcodeScannerDrawer
            mode="qr"
            onDetected={onReceiptScanned}
            triggerLabel="Scanner le reçu du client"
            triggerClassName="min-h-11 rounded-field bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
          />
        ) : null}
        {inProgress && onDelivered ? (
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onDelivered}>
            Marquer livrée sans scan
          </Button>
        ) : null}
      </div>
    </article>
  );
}
