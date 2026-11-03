"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type StationDataStateProps<T> = {
  items: T[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Texte de l'état vide : dire pourquoi c'est vide et quoi faire ensuite. */
  emptyText: ReactNode;
  /** Message d'erreur (défaut : « Données indisponibles pour le moment. »). */
  errorText?: string;
  skeletonRows?: number;
  children: (items: T[]) => ReactNode;
};

/** Chargement (squelette), erreur + Réessayer, vide, puis rendu des éléments. */
export function StationDataState<T>({
  items,
  isLoading = false,
  isError = false,
  onRetry,
  emptyText,
  errorText = "Données indisponibles pour le moment.",
  skeletonRows = 3,
  children,
}: StationDataStateProps<T>) {
  if (isLoading && !items) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Chargement">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-field bg-surface-2" />
        ))}
      </div>
    );
  }
  if (isError && !items) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-field bg-surface-1 p-3 text-sm">
        <p className="text-ink-800">{errorText}</p>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
            Réessayer
          </Button>
        ) : null}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return <div className="rounded-field bg-surface-1 p-3 text-sm text-ink-700">{emptyText}</div>;
  }
  return <>{children(items)}</>;
}
