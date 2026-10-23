"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle } from "lucide-react";

import { WhatsAppIcon } from "@/components/contact/WhatsAppButton";
import { formatXOF } from "@/lib/currency";
import { getPublicFinanceSettings } from "@/services/finance-service";

type Script = { title: string; text: string };

/**
 * « Quoi dire aux vendeurs » : arguments vrais (tirés des réglages réels), messages prêts à envoyer
 * avec le lien de l'affilié, et réponses aux objections fréquentes.
 */
export function SellerPitchKit({ sellerLink }: { sellerLink: string | null }) {
  const [copied, setCopied] = useState("");
  const { data: pricing } = useQuery({ queryKey: ["public-finance-settings"], queryFn: getPublicFinanceSettings, staleTime: 5 * 60_000 });

  const trial = pricing?.seller_trial_days ?? 0;
  const shopFee = pricing?.seller_subscription_fee_shop;
  const link = sellerLink ?? "https://amazer.store/vendre";
  const trialText = trial > 0 ? `${trial} jours d'essai gratuit` : "une mise en ligne immédiate";
  const feeText = shopFee ? `ensuite ${formatXOF(shopFee)} par mois` : "un petit abonnement mensuel";

  const arguments_ = [
    "Votre boutique en ligne en 10 minutes, depuis votre téléphone : photos, prix, stock.",
    "Vous recevez le prix entier de vos articles : la commission et les frais AMAZER sont payés par le client.",
    "Le client paie avant que vous prépariez : AMAZER vérifie le paiement (Nita, Amana). Fini les commandes fantômes.",
    "AMAZER livre : pas besoin de livreur, la commande part de chez vous et arrive chez le client.",
    "Des clients de tout le Niger vous trouvent : recherche, promotions, boutiques à la une, messages directs.",
    `${trial > 0 ? `${trial} jours gratuits pour essayer` : "Mise en ligne immédiate"}, ${feeText}. Sans engagement.`,
  ];

  const scripts: Script[] = [
    {
      title: "Message court (WhatsApp)",
      text: `Bonjour ! Vous vendez déjà sur WhatsApp ? Mettez votre boutique sur AMAZER : le client paie avant, AMAZER livre, et vous recevez le prix entier. ${trialText}. Inscription en 10 minutes : ${link}`,
    },
    {
      title: "Message complet",
      text:
        `Bonjour, je vous présente AMAZER, la plateforme de vente du Niger.\n\n` +
        `• Votre boutique en ligne en 10 minutes, depuis votre téléphone\n` +
        `• Le client paie avant la préparation (Nita / Amana, vérifié par AMAZER)\n` +
        `• AMAZER livre vos commandes\n` +
        `• Vous recevez le prix entier : les frais sont payés par le client\n` +
        `• ${trialText}, ${feeText}\n\n` +
        `Inscrivez-vous ici : ${link}\nJe peux vous aider à mettre vos premiers produits en ligne.`,
    },
    {
      title: "Pharmacie ou station-essence",
      text: `Bonjour ! Sur AMAZER, les clients voient en direct votre garde (pharmacie) ou vos disponibilités (essence, gasoil, gaz), avec appel et itinéraire Google Maps, partout au Niger. Le gaz peut même être livré par AMAZER. Inscription : ${link}`,
    },
  ];

  const objections: Script[] = [
    { title: "« C'est trop cher »", text: `C'est ${shopFee ? formatXOF(shopFee) : "un petit montant"} par mois, moins qu'une seule vente pour la plupart des boutiques, et ${trialText} pour voir les résultats avant de payer.` },
    { title: "« Je vends déjà sur WhatsApp »", text: "Gardez WhatsApp ! AMAZER vous amène des clients que vous ne connaissez pas encore, et le paiement est vérifié avant la livraison." },
    { title: "« Je n'ai pas le temps »", text: "Dix minutes suffisent : on prend 5 photos ensemble, maintenant, et votre boutique est en ligne." },
    { title: "« Et si on ne me paie pas ? »", text: "Le client paie AMAZER avant que vous prépariez. Vous ne préparez que les commandes payées." },
    { title: "« Je ne sais pas utiliser ça »", text: "Je vous accompagne pour les premiers produits, et la page « Formations gratuites » explique tout pas à pas." },
  ];

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  };

  const buttonClass = "inline-flex min-h-10 items-center gap-1.5 rounded-field border px-3 text-sm font-semibold";

  return (
    <section aria-labelledby="pitch-title" className="space-y-4 rounded-card border border-border bg-card p-4">
      <div>
        <h2 id="pitch-title" className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <MessageCircle className="h-5 w-5 text-brand-600" aria-hidden="true" />
          Quoi dire aux vendeurs pour les convaincre
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Des arguments vrais et des messages prêts à envoyer{sellerLink ? ", avec votre lien d'affilié déjà dedans" : ""}.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">Les 6 arguments qui comptent</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-800">
          {arguments_.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink-900">Messages prêts à envoyer</p>
        {scripts.map((script) => (
          <div key={script.title} className="rounded-field bg-surface-1 p-3">
            <p className="text-sm font-semibold text-ink-900">{script.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-800">{script.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy(script.text, script.title)} className={`${buttonClass} border-border bg-card text-ink-900 hover:bg-surface-2`}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied === script.title ? "Copié !" : "Copier"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(script.text)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonClass} border-success text-success hover:bg-surface-2`}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Envoyer sur WhatsApp
              </a>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">Réponses aux objections</p>
        <dl className="mt-2 space-y-2 text-sm">
          {objections.map((item) => (
            <div key={item.title}>
              <dt className="font-medium text-ink-900">{item.title}</dt>
              <dd className="text-ink-700">{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="rounded-field bg-brand-50 p-3 text-sm text-ink-800">
        <strong>Le conseil qui marche :</strong> passez voir le commerçant, aidez-le à publier ses 5 premiers produits avec de belles
        photos, puis partagez sa boutique. Un vendeur actif paie son abonnement chaque mois, et vous touchez votre part.
      </p>
    </section>
  );
}
