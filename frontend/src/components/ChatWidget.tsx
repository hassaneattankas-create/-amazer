"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";

import Link from "next/link";

import { formatXOF } from "@/lib/currency";
import { getProductRoute } from "@/lib/mobile-routes";
import { AssistantMessage, AssistantProduct, sendAssistantMessage } from "@/services/assistant-service";

const WELCOME = "Bonjour ! Je suis l'assistant AMAZER. Je vous aide à trouver un produit, commander, payer, suivre une livraison ou ouvrir votre boutique.";
const SUGGESTIONS = ["Comment commander ?", "Comment payer ?", "Ouvrir ma boutique", "Pharmacie de garde"];
// L'assistant se présente une fois par visite, quelques secondes après l'arrivée.
const TEASER_KEY = "amazer_aide_proposee";
const TEASER_DELAY_MS = 4000;
const TEASER_DURATION_MS = 15000;

type ChatEntry = AssistantMessage & { products?: AssistantProduct[] };

/** **mot** en gras, retours à la ligne gardés (étapes numérotées). */
function FormattedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sur la fiche produit mobile, une barre d'achat occupe le bas de l'ecran : on remonte le bouton.
  const pathname = usePathname();
  const liftedOnMobile = pathname?.startsWith("/product") ?? false;
  // L'administration n'a pas d'assistant public.
  const hidden = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, isSending]);

  useEffect(() => {
    if (hidden) return;
    try {
      if (sessionStorage.getItem(TEASER_KEY)) return;
    } catch {
      // stockage indisponible : on propose l'aide quand même, une seule fois sur cette page
    }
    let hideTimer = 0;
    const showTimer = window.setTimeout(() => {
      setTeaser(true);
      try {
        sessionStorage.setItem(TEASER_KEY, "1");
      } catch {
        // sans stockage, la proposition reviendra à la prochaine visite : sans conséquence
      }
      hideTimer = window.setTimeout(() => setTeaser(false), TEASER_DURATION_MS);
    }, TEASER_DELAY_MS);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [hidden]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || isSending) return;
    const next: ChatEntry[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setIsSending(true);
    try {
      const res = await sendAssistantMessage(next);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, products: res.products ?? [] }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "L'assistant ne répond pas pour le moment. Réessayez, ou écrivez-nous sur WhatsApp.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function openChat() {
    setTeaser(false);
    setOpen(true);
  }

  if (hidden) return null;

  return (
    <>
      {!open ? (
        <>
          {teaser ? (
            <div
              role="dialog"
              aria-label="Proposition d'aide de l'assistant AMAZER"
              className={`fixed right-4 z-dropdown w-72 animate-in fade-in slide-in-from-bottom-2 rounded-card border border-border bg-card p-3 shadow-floating duration-base md:bottom-20 md:right-5 ${
                liftedOnMobile ? "bottom-40" : "bottom-20"
              }`}
            >
              <div className="flex items-start gap-2">
                <Image src="/mascotte/mascotte-assistant.webp" alt="" width={92} height={100} className="-ml-2 -mt-14 h-24 w-auto shrink-0" />
                <p className="flex-1 text-sm text-ink-800">
                  <span className="font-semibold text-ink-900">Bonjour !</span> Besoin d&apos;aide pour commander, payer ou
                  vendre ? Je vous guide.
                </p>
                <button
                  type="button"
                  aria-label="Fermer la proposition d'aide"
                  onClick={() => setTeaser(false)}
                  className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-ink-600 hover:bg-surface-1"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={openChat}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-field bg-brand-600 px-4 text-sm font-semibold text-white transition-colors duration-fast hover:bg-brand-700"
              >
                Oui, aidez-moi
              </button>
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Ouvrir l'assistant AMAZER"
            onClick={openChat}
            className={`fixed right-4 z-dropdown inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-pill border-2 border-brand-500 bg-white shadow-floating transition-transform duration-fast hover:scale-105 md:bottom-5 md:right-5 ${
              liftedOnMobile ? "bottom-24" : "bottom-4"
            }`}
          >
            <Image src="/mascotte/mascotte-tete.webp" alt="" width={44} height={44} className="h-11 w-11" />
          </button>
        </>
      ) : (
        <div className="fixed bottom-5 right-5 z-toast flex h-[min(70vh,520px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-overlay">
          <div className="flex items-center justify-between bg-ink-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-pill bg-white">
                <Image src="/mascotte/mascotte-tete.webp" alt="" width={32} height={32} className="h-8 w-8" />
              </span>
              <span className="text-sm font-semibold">Assistant AMAZER</span>
            </div>
            <button
              type="button"
              aria-label="Fermer l'assistant"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-pill hover:bg-white/10"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
            <span className="text-xs text-ink-600">Besoin d&apos;une personne ?</span>
            <WhatsAppButton variant="link" label="WhatsApp" message="Bonjour AMAZER, j'ai besoin d'aide." />
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            <div className="max-w-xs rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              {WELCOME}
            </div>
            {!messages.length ? (
              <div className="flex flex-wrap gap-2" aria-label="Questions fréquentes">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-11 rounded-pill border border-border bg-white px-3 text-xs font-medium text-ink-800 hover:border-brand-500 hover:text-brand-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-xs whitespace-pre-line rounded-2xl rounded-tr-sm bg-ink-900 px-3 py-2 text-sm text-white"
                    : "max-w-xs whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                }
              >
                <FormattedText text={m.content} />
                {m.products?.length ? (
                  <ul className="mt-2 space-y-1.5 whitespace-normal">
                    {m.products.map((product) => (
                      <li key={product.id}>
                        <Link
                          href={getProductRoute(product.id)}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between gap-2 rounded-field border border-border bg-card px-2 py-1.5 hover:border-ink-400"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-ink-900">{product.name}</span>
                            <span className="block truncate text-2xs text-ink-600">{product.shop}</span>
                          </span>
                          <span className="shrink-0 text-xs font-bold text-ink-900">{formatXOF(product.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            {isSending ? (
              <div className="max-w-48 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-400 shadow-sm">
                …
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 bg-white p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(input);
              }}
              aria-label="Votre question"
              placeholder="Écrivez votre question…"
              className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
            />
            <button
              type="button"
              aria-label="Envoyer"
              onClick={() => send(input)}
              disabled={isSending || !input.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-lg text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              <span aria-hidden>➤</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
