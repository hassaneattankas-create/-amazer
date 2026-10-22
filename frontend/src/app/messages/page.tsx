"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConversationList } from "@/components/messages/ConversationList";
import { ConversationThread } from "@/components/messages/ConversationThread";
import { getApiErrorMessage, getHttpResponseStatus } from "@/lib/api-error";
import {
  getConversation,
  listConversations,
  reportConversation,
  sendMessage,
  startConversation,
} from "@/services/conversation-service";

const LIST_KEY = ["conversations"] as const;

function MessagesContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");
  const newVendorId = searchParams.get("vendor");
  const newVendorName = searchParams.get("name") || "la boutique";
  const [error, setError] = useState("");

  const listQuery = useQuery({ queryKey: LIST_KEY, queryFn: listConversations, refetchInterval: 30_000 });
  const threadQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId as string),
    enabled: Boolean(conversationId),
    refetchInterval: 15_000,
  });

  // Une conversation existe deja avec cette boutique : on l'ouvre au lieu d'en creer une autre.
  const existing = newVendorId
    ? listQuery.data?.find((item) => item.vendor_id === newVendorId && item.role === "customer")
    : undefined;
  useEffect(() => {
    if (existing && !conversationId) {
      router.replace(`/messages?c=${existing.id}`);
    }
  }, [existing, conversationId, router]);

  useEffect(() => {
    if (threadQuery.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    }
  }, [threadQuery.isSuccess, threadQuery.dataUpdatedAt, queryClient]);

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      conversationId ? sendMessage(conversationId, body) : startConversation(newVendorId as string, body),
    onSuccess: (detail) => {
      setError("");
      queryClient.setQueryData(["conversation", detail.id], detail);
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      if (!conversationId) {
        router.replace(`/messages?c=${detail.id}`);
      }
    },
    onError: (sendError) => setError(getApiErrorMessage(sendError, "Message non envoyé. Vérifiez votre connexion.")),
  });

  const onSend = async (body: string) => {
    try {
      await sendMutation.mutateAsync(body);
      return true;
    } catch {
      return false;
    }
  };

  const onReport = async (reason: string) => {
    if (!conversationId) {
      return false;
    }
    try {
      await reportConversation(conversationId, reason);
      return true;
    } catch {
      return false;
    }
  };

  const showThread = Boolean(conversationId || (newVendorId && !existing));
  const thread = threadQuery.data;

  // Pas connecté (ex. « Écrire à la boutique ») : connexion puis retour sur cette même conversation.
  if (getHttpResponseStatus(listQuery.error) === 401) {
    const back = typeof window === "undefined" ? "/messages" : `${window.location.pathname}${window.location.search}`;
    return (
      <section className="mx-auto max-w-xl px-gutter py-10">
        <div className="rounded-card border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold text-ink-900">Connectez-vous pour écrire</h1>
          <p className="mt-1 text-sm text-ink-600">Vos messages avec les boutiques restent privés.</p>
          <Link
            href={`/login?next=${encodeURIComponent(back)}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-field bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Se connecter
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-gutter py-8">
      <h1 className="text-2xl font-semibold text-ink-900">Messages</h1>
      <p className="mt-1 text-sm text-ink-600">
        Vos échanges privés avec les boutiques et, si vous êtes vendeur, avec vos clients.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <nav
          aria-label="Conversations"
          className={`rounded-card border border-border bg-card p-2 md:col-span-1 ${showThread ? "hidden md:block" : ""}`}
        >
          <ConversationList
            conversations={listQuery.data ?? []}
            activeId={conversationId}
            isLoading={listQuery.isPending}
            isError={listQuery.isError}
          />
        </nav>

        <div className={`rounded-card border border-border bg-card p-4 md:col-span-2 ${showThread ? "" : "hidden md:block"}`}>
          {showThread ? (
            <>
              <Link href="/messages" className="mb-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-600 md:hidden">
                ← Conversations
              </Link>
              {conversationId && threadQuery.isPending ? (
                <div className="h-64 animate-pulse rounded-field bg-surface-1" aria-busy="true" />
              ) : conversationId && threadQuery.isError ? (
                <p className="text-sm text-danger">
                  Conversation introuvable ou inaccessible.{" "}
                  <Link href="/messages" className="font-medium text-brand-600 hover:underline">
                    Retour aux conversations
                  </Link>
                </p>
              ) : (
                <ConversationThread
                  title={thread ? thread.counterpart_name : `Écrire à ${newVendorName}`}
                  subtitle={
                    thread?.role === "seller"
                      ? "Client de votre boutique"
                      : "Ne partagez jamais un code reçu par SMS, e-mail ou WhatsApp."
                  }
                  messages={thread?.messages ?? []}
                  isSending={sendMutation.isPending}
                  error={error}
                  onSend={onSend}
                  onReport={conversationId ? onReport : undefined}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-ink-600">Choisissez une conversation pour l&apos;afficher.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-5xl px-gutter py-8" aria-busy="true" />}>
      <MessagesContent />
    </Suspense>
  );
}
