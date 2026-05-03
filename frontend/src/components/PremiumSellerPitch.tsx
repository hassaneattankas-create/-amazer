import Link from "next/link";
import { Sparkles } from "lucide-react";

type PremiumSellerPitchProps = {
  variant?: "compact" | "featured";
  className?: string;
  /** Sur l'espace vendeur, masquer le lien vers /seller (deja sur la page). */
  showEspaceVendeurLink?: boolean;
};

export function PremiumSellerPitch({
  variant = "compact",
  className = "",
  showEspaceVendeurLink = true,
}: PremiumSellerPitchProps) {
  if (variant === "compact") {
    return (
      <aside
        className={`rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white p-4 ${className}`}
      >
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
          <Sparkles className="h-4 w-4 text-[#FF4D00]" />
          Vendeur : pourquoi viser Premium ?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Avec <span className="font-semibold text-slate-900">Premium</span>, tu debloques un mini-site complet
          (galerie, services, reservations, acomptes), une visibilite renforcee sur AMAZER et{" "}
          <span className="font-semibold">des publications illimitees</span> — ideal pour hotels, agences et marques
          qui veulent tout centraliser. Les formules classiques restent parfaites pour demarrer vite.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">Acompte</span> : le client peut verser une partie du montant (Nita
          ou Amana) pour confirmer une reservation ou un service Premium. Vous encaissez ainsi tout de suite une somme qui
          engage le client et ameliore votre tresorerie ; le solde se regle ensuite selon votre organisation habituelle
          hors plateforme (check-in, sejour ou livraison). Vous limitez les annulations tardives tout en gardant vos
          conditions commerciales. Les tarifs AMAZER (commission, abonnement) s&apos;appliquent comme pour vos autres
          activites sur la plateforme.
        </p>
        {showEspaceVendeurLink ? (
          <p className="mt-2 text-xs text-slate-600">
            Tu choisis ton mode apres inscription dans{" "}
            <Link
              href="/register?next=/seller&seller=1"
              className="font-medium text-[#FF4D00] hover:underline"
            >
              Espace vendeur
            </Link>
            .
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-600">
            Selectionne l&apos;option <span className="font-medium text-slate-800">Premium entreprise</span> dans le
            menu type d&apos;activite pour activer cette formule.
          </p>
        )}
      </aside>
    );
  }

  return (
    <article
      className={`premium-card overflow-hidden border border-[#FF4D00]/25 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/50 p-6 shadow-[0_12px_40px_rgba(255,77,0,0.12)] ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Sparkles className="h-5 w-5 shrink-0 text-[#FF4D00]" />
            Passe en Premium : la vitrine qui suit ton ambition
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Une formule concue pour les professionnels qui veulent plus qu&apos;une simple liste de produits.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-800">
        <li className="flex gap-2">
          <span className="font-semibold text-[#FF4D00]">•</span>
          <span>
            <strong className="text-slate-900">Catalogue et menu illimites</strong> — au-dela des plafonds des
            formules classiques.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-[#FF4D00]">•</span>
          <span>
            <strong className="text-slate-900">Mini-site riche</strong> : galerie, services, chambres, reservations
            avec acompte (encaissement immediat partiel via mobile money pour securiser la demande), contact pro.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-[#FF4D00]">•</span>
          <span>
            <strong className="text-slate-900">Meilleure mise en avant</strong> sur AMAZER (sections dediees, image de
            marque).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-[#FF4D00]">•</span>
          <span>
            <strong className="text-slate-900">Pour qui ?</strong> Hotels, agences de voyage, restaurants signature,
            grandes boutiques — partout ou l&apos;experience client compte.
          </span>
        </li>
      </ul>
      <p className="mt-4 text-xs text-slate-600">
        Les tarifs plateforme (commission, abonnement) sont rappelles ci-dessous. Tu actives Premium en choisissant le
        profil &quot;Premium entreprise&quot; dans ton espace vendeur.
      </p>
    </article>
  );
}
