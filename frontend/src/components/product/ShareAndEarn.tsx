"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { withAffiliateRef } from "@/lib/affiliate";
import { publicSiteOrigin } from "@/lib/backend-origin";
import { getMyAffiliate } from "@/services/affiliate-service";

/**
 * « Partager et gagner » : pour un membre connecte, le lien partage porte son code d'affiliation.
 * Partage natif du telephone si disponible, sinon copie du lien.
 */
export function ShareAndEarn({ title }: { title: string }) {
  const { data: user } = useCurrentUser();
  const [status, setStatus] = useState("");

  const share = async () => {
    // Dans l'application, window.location est une adresse interne : on partage l'adresse publique.
    let link = `${publicSiteOrigin()}${window.location.pathname}${window.location.search}`;
    if (user?.id) {
      try {
        const me = await getMyAffiliate();
        link = withAffiliateRef(link, me.code);
      } catch {
        // lien simple si le code est indisponible
      }
    }
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} sur AMAZER`, url: link });
        setStatus("");
      } else {
        await navigator.clipboard.writeText(link);
        setStatus("Lien copié.");
      }
    } catch {
      setStatus("");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 items-center gap-2 rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {user?.id ? "Partager et gagner" : "Partager"}
      </button>
      {status ? (
        <span className="text-xs text-success" role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}
