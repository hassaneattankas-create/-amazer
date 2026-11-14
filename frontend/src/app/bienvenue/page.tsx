"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, PartyPopper, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getPublicWelcome } from "@/services/finance-service";

/** Page ouverte par la notification de bienvenue : le message de l'équipe et la communauté WhatsApp d'AMAZER. */
export default function WelcomePage() {
  const { data: user } = useCurrentUser();
  const { data, isPending, isError } = useQuery({ queryKey: ["public-welcome"], queryFn: getPublicWelcome, staleTime: 300_000 });
  const first = (user?.full_name ?? "").trim().split(" ")[0];
  const message = (data?.message ?? "").replaceAll("{prenom}", first).replace("Bonjour , ", "Bonjour, ").replace("Bonjour ,", "Bonjour,");

  return (
    <section className="mx-auto w-full max-w-xl space-y-5 px-gutter pb-14 pt-6">
      <header className="rounded-card bg-ink-900 px-5 py-6 text-white">
        <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-display">
          <PartyPopper className="h-7 w-7 text-brand-400" aria-hidden="true" />
          {data?.title ?? "Bienvenue sur AMAZER"}
        </h1>
      </header>

      {isPending ? (
        <div className="h-32 animate-pulse rounded-card border border-border bg-surface-1" aria-busy="true" />
      ) : isError ? (
        <p className="text-sm text-ink-700">Votre compte est prêt. Bienvenue sur AMAZER !</p>
      ) : (
        <p className="whitespace-pre-line text-base leading-relaxed text-ink-800">{message}</p>
      )}

      {data?.whatsapp_group_url || data?.whatsapp_channel_url ? (
        <div className="space-y-3 rounded-card border border-border bg-card p-5">
          <p className="font-semibold text-ink-900">Rejoignez la communauté AMAZER</p>
          {data.whatsapp_group_url ? (
            <Button asChild size="lg" className="w-full">
              <a href={data.whatsapp_group_url} target="_blank" rel="noopener noreferrer">
                <Users className="h-5 w-5" aria-hidden="true" />
                Rejoindre le groupe WhatsApp
              </a>
            </Button>
          ) : null}
          {data.whatsapp_channel_url ? (
            <Button asChild size="lg" variant="outline" className="w-full">
              <a href={data.whatsapp_channel_url} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Suivre la chaîne WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <Button asChild size="lg" variant="outline" className="w-full">
        <Link href="/">Découvrir AMAZER</Link>
      </Button>
    </section>
  );
}
