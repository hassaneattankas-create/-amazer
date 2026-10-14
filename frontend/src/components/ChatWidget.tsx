"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { MessageCircle, X } from "lucide-react";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";

import Link from "next/link";

import { formatXOF } from "@/lib/currency";
import { getProductRoute } from "@/lib/mobile-routes";
import { AssistantMessage, AssistantProduct, sendAssistantMessage } from "@/services/assistant-service";

const WELCOME = "Bonjour ! Dites-moi ce que vous cherchez, ou posez une question sur une commande, un paiement ou la livraison.";

type ChatEntry = AssistantMessage & { products?: AssistantProduct[] };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sur la fiche produit mobile, une barre d'achat occupe le bas de l'ecran : on remonte le bouton.
  const pathname = usePathname();
  const liftedOnMobile = pathname?.startsWith("/product") ?? false;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, isSending]);

  async function handleSend() {
    const text = input.trim();
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

  return (
    <>
      {!open ? (
        <button
          type="button"
          aria-label="Ouvrir l'assistant AMAZER"
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-dropdown inline-flex h-12 w-12 items-center justify-center rounded-pill bg-ink-900 text-white shadow-floating transition-transform duration-fast hover:scale-105 md:bottom-5 md:right-5 ${
            liftedOnMobile ? "bottom-24" : "bottom-4"
          }`}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : (
        <div className="fixed bottom-5 right-5 z-toast flex h-[min(70vh,520px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-overlay">
          <div className="flex items-center justify-between bg-ink-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Image src="/logo-amazer-mark-128.png" alt="" width={28} height={28} className="h-7 w-7" />
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
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-xs rounded-2xl rounded-tr-sm bg-ink-900 px-3 py-2 text-sm text-white"
                    : "max-w-xs rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                }
              >
                {m.content}
                {m.products?.length ? (
                  <ul className="mt-2 space-y-1.5">
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
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Écris ta question…"
              className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
            />
            <button
              type="button"
              aria-label="Envoyer"
              onClick={handleSend}
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
