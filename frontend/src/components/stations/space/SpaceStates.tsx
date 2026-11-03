import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Squelette aux dimensions d'une section d'accordéon (titre + deux cartes). */
export function SpaceSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Chargement">
      <div className="h-6 w-32 animate-pulse rounded-field bg-surface-3" />
      <div className="h-16 animate-pulse rounded-card bg-surface-3" />
      <div className="h-16 animate-pulse rounded-card bg-surface-3" />
    </div>
  );
}

export function SpaceLoggedOut() {
  return (
    <div className="rounded-card border border-border bg-card p-5 text-center">
      <p className="font-semibold text-ink-900">Connectez-vous avec le compte que le propriétaire ou le responsable de ville a ajouté.</p>
      <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild className="min-h-11">
          <Link href="/login?next=/gerant-station">Se connecter</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/register?next=/gerant-station">Créer un compte</Link>
        </Button>
      </div>
    </div>
  );
}

export function SpaceEmpty({ email }: { email?: string | null }) {
  return (
    <div className="rounded-card border border-border bg-card p-5 text-sm text-ink-700">
      <p className="font-semibold text-ink-900">Aucune station ni ville ne vous est confiée pour l&apos;instant.</p>
      <p className="mt-1">
        Donnez votre e-mail au propriétaire de la marque ou au responsable de votre ville
        {email ? (
          <>
            {" "}
            : <strong className="break-all text-ink-900">{email}</strong>
          </>
        ) : null}
        . Dès qu&apos;il vous ajoute, vos stations apparaissent ici.
      </p>
    </div>
  );
}

export function SpaceLoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-card p-4 text-sm" role="alert">
      <p className="flex-1 text-ink-800">{text}</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}
