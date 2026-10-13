"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import {
  listConversationReports,
  searchModeratedProducts,
  setProductVisibility,
  type ModeratedProduct,
} from "@/services/moderation-service";

function ReportsSection() {
  const { data, isPending, isError } = useQuery({ queryKey: ["admin-reports"], queryFn: listConversationReports });

  return (
    <section aria-labelledby="reports-title" className="rounded-card border border-border bg-card p-5">
      <h2 id="reports-title" className="text-lg font-semibold text-ink-900">
        Signalements de conversations
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Le contenu des conversations reste privé : vous voyez le motif, l&apos;auteur et la boutique concernée. Pour
        sanctionner une boutique, utilisez{" "}
        <Link href="/admin/tarifs" className="font-medium text-brand-600 hover:underline">
          Tarifs &amp; Vendeurs
        </Link>
        .
      </p>
      {isPending ? <div className="mt-4 h-20 animate-pulse rounded-field bg-surface-1" aria-busy="true" /> : null}
      {isError ? <p className="mt-4 text-sm text-danger">Impossible de charger les signalements.</p> : null}
      {data && !data.length ? <p className="mt-4 text-sm text-ink-600">Aucun signalement pour le moment.</p> : null}
      {data?.length ? (
        <ul className="mt-4 divide-y divide-border">
          {data.map((report) => (
            <li key={report.id} className="py-3 text-sm">
              <p className="font-medium text-ink-900">{report.reason}</p>
              <p className="mt-1 text-xs text-ink-600">
                {new Date(report.created_at).toLocaleString("fr-FR")} · par {report.reporter_email ?? "compte supprimé"} (
                {report.reporter_role === "seller" ? "vendeur" : "client"}) · boutique {report.vendor_name ?? "inconnue"} ·
                conversation {report.conversation_id?.slice(0, 8) ?? "?"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ProductRow({ product, onToggle, busy }: { product: ModeratedProduct; onToggle: (p: ModeratedProduct) => void; busy: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-900">{product.product_name}</p>
        <p className="text-xs text-ink-600">
          {product.vendor_name} · {formatXOF(product.amount)} · stock {product.stock_quantity}
          {product.hidden_by_admin ? " · masqué par la modération" : product.is_active ? "" : " · désactivé par le vendeur"}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onToggle(product)}>
        {product.hidden_by_admin ? "Réafficher" : "Masquer"}
      </Button>
    </li>
  );
}

function ProductsSection() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [status, setStatus] = useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["admin-moderated-products", query, hiddenOnly],
    queryFn: () => searchModeratedProducts(query, hiddenOnly),
  });

  const mutation = useMutation({
    mutationFn: ({ product, reason }: { product: ModeratedProduct; reason: string }) =>
      setProductVisibility(product.price_id, product.hidden_by_admin, reason),
    onSuccess: (item) => {
      setStatus(item.hidden_by_admin ? "Annonce masquée. Le vendeur a été prévenu." : "Annonce réaffichée.");
      void queryClient.invalidateQueries({ queryKey: ["admin-moderated-products"] });
    },
    onError: (error) => setStatus(getApiErrorMessage(error, "Action impossible.")),
  });

  const onToggle = (product: ModeratedProduct) => {
    if (product.hidden_by_admin) {
      mutation.mutate({ product, reason: "" });
      return;
    }
    const reason = window.prompt("Motif du masquage (transmis au vendeur) :", "") ?? null;
    if (reason !== null) {
      mutation.mutate({ product, reason: reason.slice(0, 300) });
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(input.trim());
  };

  return (
    <section aria-labelledby="products-title" className="rounded-card border border-border bg-card p-5">
      <h2 id="products-title" className="text-lg font-semibold text-ink-900">
        Annonces produit
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Une annonce masquée disparaît du site ; le vendeur ne peut pas la réafficher lui-même.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="moderation-query" className="text-sm font-medium text-ink-800">
            Rechercher un produit
          </label>
          <input
            id="moderation-query"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="mt-1 w-full rounded-field border border-input bg-background px-3 py-2 text-sm"
            placeholder="Nom du produit"
          />
        </div>
        <Button type="submit">Rechercher</Button>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={hiddenOnly} onChange={(event) => setHiddenOnly(event.target.checked)} />
          Masquées uniquement
        </label>
      </form>
      {status ? (
        <p className="mt-3 text-sm text-ink-700" role="status">
          {status}
        </p>
      ) : null}
      {isPending ? <div className="mt-4 h-20 animate-pulse rounded-field bg-surface-1" aria-busy="true" /> : null}
      {isError ? <p className="mt-4 text-sm text-danger">Impossible de charger les annonces.</p> : null}
      {data && !data.length ? <p className="mt-4 text-sm text-ink-600">Aucune annonce trouvée.</p> : null}
      {data?.length ? (
        <ul className="mt-4 divide-y divide-border">
          {data.map((product) => (
            <ProductRow key={product.price_id} product={product} onToggle={onToggle} busy={mutation.isPending} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Modération</h1>
        <p className="mt-1 text-sm text-ink-600">Signalements des utilisateurs et visibilité des annonces.</p>
      </header>
      <ReportsSection />
      <ProductsSection />
    </div>
  );
}
