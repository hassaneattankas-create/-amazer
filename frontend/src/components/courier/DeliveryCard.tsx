"use client";

import { AlertTriangle, CheckCircle2, Clock, MapPin, Navigation, Package, Phone, Store, Wallet, Zap } from "lucide-react";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatXOF } from "@/lib/currency";
import { telHref, timeAgo } from "@/lib/local-services";
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

const linkButton =
  "inline-flex min-h-10 items-center gap-1.5 rounded-field border border-border bg-card px-3 text-sm font-semibold text-ink-900 hover:bg-surface-1";

function hour(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Statut de la part d'une boutique : prête (vert), en cours (orange), à venir (gris). */
function pickupTone(status: string | undefined): string {
  if (status === "livraison" || status === "recu") return "bg-success/10 text-success";
  if (status === "preparation") return "bg-warning/15 text-ink-800";
  if (status === "annulee") return "bg-danger/10 text-danger";
  return "bg-surface-3 text-ink-700";
}

export function DeliveryCard({ order, busy, onTake, onDelivered, onRelease, onReceiptScanned }: DeliveryCardProps) {
  const delivered = order.status === "recu";
  const inProgress = order.assigned_to_me && order.status === "livraison";
  const now = useNow();
  const late = !delivered && order.deliver_before ? new Date(order.deliver_before).getTime() < now : false;
  const tracking = order.tracking_code ?? order.id.slice(0, 8).toUpperCase();

  return (
    <article className="rounded-card border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink-900">#{tracking}</p>
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

      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-field bg-surface-1 px-3 py-2">
          <dt className="text-xs text-ink-600">Articles · total</dt>
          <dd className="font-semibold text-ink-900">
            {order.item_count} · {formatXOF(order.total_amount)}
          </dd>
        </div>
        <div className="rounded-field bg-surface-1 px-3 py-2">
          <dt className="text-xs text-ink-600">Frais de livraison</dt>
          <dd className="font-semibold text-ink-900">{formatXOF(order.delivery_fee ?? 0)}</dd>
        </div>
        <div className={`col-span-2 flex items-center gap-2 rounded-field px-3 py-2 ${late ? "bg-danger/10 text-danger" : "bg-surface-1 text-ink-800"}`}>
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Commandée {timeAgo(order.created_at, now)}
            {order.deliver_before && !delivered ? (late ? ` · en retard (prévue avant ${hour(order.deliver_before)})` : ` · à livrer avant ${hour(order.deliver_before)}`) : null}
            {delivered && order.delivered_at ? ` · livrée à ${hour(order.delivered_at)}` : null}
          </span>
        </div>
      </dl>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-success">
        <Wallet className="h-4 w-4" aria-hidden="true" />
        Déjà payé : n&apos;encaissez rien auprès du client.
      </p>

      <section className="mt-3 space-y-2" aria-label="Retrait">
        {order.pickups.map((pickup) => (
          <div key={pickup.shop_name} className="rounded-field bg-surface-1 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-sm font-semibold text-ink-900">
                <Store className="h-4 w-4 text-ink-500" aria-hidden="true" />
                Retrait : {pickup.shop_name}
              </p>
              {pickup.status_label ? (
                <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold ${pickupTone(pickup.status)}`}>
                  {pickup.status === "livraison" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  {pickup.status_label}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-ink-600">{[pickup.address, pickup.city].filter(Boolean).join(", ") || "Adresse non renseignée"}</p>
            {pickup.opening_hours ? <p className="mt-0.5 text-xs text-ink-600">Horaires : {pickup.opening_hours}</p> : null}
            <ul className="mt-1 text-xs text-ink-700">
              {pickup.items.map((line) => (
                <li key={line} className="flex items-center gap-1">
                  <Package className="h-3 w-3" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            {!delivered ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {pickup.maps_url ? (
                  <a href={pickup.maps_url} target="_blank" rel="noopener noreferrer" className={linkButton}>
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    Itinéraire boutique
                  </a>
                ) : null}
                {pickup.phone ? (
                  <a href={telHref(pickup.phone)} className={linkButton}>
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Appeler
                  </a>
                ) : null}
                {pickup.whatsapp ? (
                  <WhatsAppButton
                    phone={pickup.whatsapp}
                    variant="outline"
                    label="WhatsApp"
                    message={`Bonjour, je suis le livreur AMAZER pour la commande #${tracking}. La commande est-elle prête ?`}
                  />
                ) : null}
              </div>
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
        {order.assigned_to_me && order.delivery_address ? <p className="mt-0.5 text-sm text-ink-700">{order.delivery_address}</p> : null}
        {!order.assigned_to_me && !delivered ? (
          <>
            {order.customer_phone ? (
              <a href={telHref(order.customer_phone)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700">
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
            <a href={telHref(order.customer_phone)} className={linkButton}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Appeler le client
            </a>
          ) : null}
          {order.customer_phone ? (
            <WhatsAppButton
              phone={order.customer_phone}
              variant="outline"
              label="WhatsApp"
              message={`Bonjour, je suis votre livreur AMAZER pour la commande #${tracking}.`}
            />
          ) : null}
          {order.customer_maps_url ? (
            <a href={order.customer_maps_url} target="_blank" rel="noopener noreferrer" className={linkButton}>
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Itinéraire client
            </a>
          ) : null}
        </div>
      ) : null}

      {late && inProgress ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          Prévenez le client de votre heure d&apos;arrivée.
        </p>
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
