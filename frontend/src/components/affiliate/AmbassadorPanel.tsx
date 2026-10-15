"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { AffiliateMe, applyAmbassador, getAffiliateLeaderboard } from "@/services/affiliate-service";

/** Ambassadeur : paliers et classement du mois. Affilie : candidature. */
export function AmbassadorPanel({ me }: { me: AffiliateMe }) {
  return me.ambassador ? <AmbassadorStatus me={me} info={me.ambassador} /> : <AmbassadorApply me={me} />;
}

function AmbassadorStatus({ me, info }: { me: AffiliateMe; info: NonNullable<AffiliateMe["ambassador"]> }) {
  const { data: board } = useQuery({ queryKey: ["affiliate-leaderboard"], queryFn: getAffiliateLeaderboard });
  const progress = info.next_tier_shops ? Math.min(100, Math.round((info.paying_shops / info.next_tier_shops) * 100)) : 100;
  return (
    <div className="space-y-3 rounded-card border border-brand-500 bg-card p-4">
      <p className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <Trophy className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Vous êtes ambassadeur AMAZER
      </p>
      <ul className="grid gap-2 text-sm sm:grid-cols-3">
        <li className="rounded-field bg-surface-1 px-3 py-2">
          <span className="block text-ink-600">1er mois d&apos;une boutique</span>
          <span className="text-lg font-bold text-ink-900">{info.first_month_percent} %</span>
        </li>
        <li className="rounded-field bg-surface-1 px-3 py-2">
          <span className="block text-ink-600">Mois suivants ({me.seller_share_months} mois)</span>
          <span className="text-lg font-bold text-ink-900">{info.current_percent} %</span>
        </li>
        <li className="rounded-field bg-surface-1 px-3 py-2">
          <span className="block text-ink-600">Boutiques payantes amenées</span>
          <span className="text-lg font-bold text-ink-900">{info.paying_shops}</span>
        </li>
      </ul>
      {info.next_tier_shops ? (
        <div>
          <p className="text-sm text-ink-800">
            Encore <strong>{info.next_tier_shops - info.paying_shops}</strong> boutique(s) payante(s) pour passer à{" "}
            <strong>{info.next_tier_percent} %</strong>.
          </p>
          <div className="mt-1 h-2 rounded-pill bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 rounded-pill bg-brand-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-ink-900">Palier maximum atteint. Bravo !</p>
      )}

      <div className="border-t border-border pt-3">
        <p className="text-sm font-semibold text-ink-900">
          Classement du mois{board && board.top_bonus > 0 ? ` · prime de ${formatXOF(board.top_bonus)} pour le n°1` : ""}
        </p>
        {board?.rows.length ? (
          <ol className="mt-2 space-y-1 text-sm">
            {board.rows.map((row) => (
              <li
                key={row.rank}
                className={`flex justify-between rounded-field px-3 py-1.5 ${row.is_me ? "bg-brand-50 font-semibold text-ink-900" : "text-ink-800"}`}
              >
                <span>
                  {row.rank}. {row.name}
                  {row.is_me ? " (vous)" : ""}
                </span>
                <span>
                  {row.new_shops} boutique{row.new_shops > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-sm text-ink-600">Personne encore ce mois-ci : la première place est à prendre.</p>
        )}
      </div>
    </div>
  );
}

function AmbassadorApply({ me }: { me: AffiliateMe }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const mutation = useMutation({
    mutationFn: applyAmbassador,
    onSuccess: () => {
      setFeedback({ ok: true, text: "Candidature envoyée. AMAZER vous répond rapidement." });
      void queryClient.invalidateQueries({ queryKey: ["affiliate-me"] });
    },
    onError: (error) => setFeedback({ ok: false, text: getApiErrorMessage(error, "Envoi impossible. Réessayez.") }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    mutation.mutate(message.trim());
  };

  return (
    <div className="space-y-2 rounded-card border border-border bg-card p-4">
      <p className="flex items-center gap-2 font-semibold text-ink-900">
        <Trophy className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Devenir ambassadeur
      </p>
      <p className="text-sm text-ink-700">
        Pour celles et ceux qui amènent des boutiques : prime sur le 1er mois de chaque boutique, taux qui augmentent par palier,
        classement et prime du meilleur du mois.
      </p>
      {me.ambassador_applied ? (
        <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">Candidature reçue : AMAZER l&apos;étudie.</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="ambassador-message" className="block text-sm font-medium text-ink-800">
            Où et comment allez-vous trouver des boutiques ?
          </label>
          <textarea
            id="ambassador-message"
            required
            minLength={10}
            maxLength={600}
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ex. Je connais les commerçants du marché Katako, je suis étudiant à l'université…"
            className="w-full rounded-field border border-border bg-card px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={mutation.isPending || message.trim().length < 10}>
            {mutation.isPending ? "Envoi…" : "Envoyer ma candidature"}
          </Button>
        </form>
      )}
      {feedback ? (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-danger"}`} role="status">
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
