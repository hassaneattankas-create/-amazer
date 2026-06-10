"use client";

import { useEffect, useRef, useState } from "react";

import { AssistantMessage, sendAssistantMessage } from "@/services/assistant-service";

const WELCOME =
  "Bonjour 👋 Je suis l'assistant AMAZER. Pose-moi une question : commander, paiement (Nita/Amana), livraison, devenir vendeur, réservations ou promotions.";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, isSending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    const next: AssistantMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setIsSending(true);
    try {
      const res = await sendAssistantMessage(next);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Désolé, l'assistant est momentanément indisponible. Réessaie plus tard ou contacte le support AMAZER.",
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
          className="fixed bottom-5 right-5 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#FF4D00] text-2xl text-white shadow-[0_10px_30px_rgba(255,77,0,0.45)] transition hover:scale-105"
        >
          <span aria-hidden>💬</span>
        </button>
      ) : (
        <div className="fixed bottom-5 right-5 z-[60] flex h-[min(70vh,520px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
          <div className="flex items-center justify-between bg-[#FF4D00] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span aria-hidden>💬</span>
              <span className="text-sm font-semibold">Assistant AMAZER</span>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setOpen(false)}
              className="text-lg leading-none"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              {WELCOME}
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#FF4D00] px-3 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                }
              >
                {m.content}
              </div>
            ))}
            {isSending ? (
              <div className="max-w-[60%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-400 shadow-sm">
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
              className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-[#FF4D00]/50"
            />
            <button
              type="button"
              aria-label="Envoyer"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#FF4D00] text-lg text-white transition hover:bg-[#e74700] disabled:opacity-50"
            >
              <span aria-hidden>➤</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
