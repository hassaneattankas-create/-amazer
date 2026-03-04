"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFeedback, listFeedback } from "@/services/feedback-service";

export default function AvisPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    message: "",
    rating: 5,
  });

  const { data: feedback = [] } = useQuery({
    queryKey: ["customer-feedback"],
    queryFn: () => listFeedback(120),
  });

  const mutation = useMutation({
    mutationFn: createFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-feedback"] });
      setForm({ full_name: "", email: "", message: "", rating: 5 });
      setStatus("Votre avis a ete envoye.");
    },
    onError: () => setStatus("Impossible d'envoyer votre avis."),
  });

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Espace Avis Client</h1>
        <p className="mt-2 text-sm text-slate-600">Partagez votre experience AMAZER.</p>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Laisser un avis</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nom complet"
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          />
          <Input
            placeholder="Email (optionnel)"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <textarea
            className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Votre message..."
            value={form.message}
            onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
          />
          <select
            className="h-11 rounded-md border border-slate-300 px-3 text-sm"
            value={form.rating}
            onChange={(event) => setForm((prev) => ({ ...prev, rating: Number(event.target.value) }))}
          >
            <option value={5}>5/5</option>
            <option value={4}>4/5</option>
            <option value={3}>3/5</option>
            <option value={2}>2/5</option>
            <option value={1}>1/5</option>
          </select>
        </div>
        <Button
          type="button"
          className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
          onClick={() =>
            mutation.mutate({
              full_name: form.full_name,
              email: form.email || undefined,
              message: form.message,
              rating: form.rating,
            })
          }
          disabled={!form.full_name || form.message.length < 8 || mutation.isPending}
        >
          Envoyer
        </Button>
        {status ? <p className="mt-2 text-sm text-slate-700">{status}</p> : null}
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Avis recents</h2>
        <div className="mt-3 space-y-3">
          {feedback.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.full_name}</p>
                <p className="text-xs text-amber-600">{item.rating}/5</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("fr-FR")}</p>
              <p className="mt-2 text-sm text-slate-700">{item.message}</p>
            </div>
          ))}
          {!feedback.length ? <p className="text-sm text-slate-500">Aucun avis pour le moment.</p> : null}
        </div>
      </article>
    </section>
  );
}
