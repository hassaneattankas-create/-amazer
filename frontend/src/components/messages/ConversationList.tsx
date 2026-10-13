import Link from "next/link";

import type { ConversationSummary } from "@/types/conversation";

type ConversationListProps = {
  conversations: ConversationSummary[];
  activeId: string | null;
  isLoading: boolean;
  isError: boolean;
};

function formatWhen(value: string): string {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function ConversationList({ conversations, activeId, isLoading, isError }: ConversationListProps) {
  if (isLoading) {
    return (
      <ul className="space-y-2" aria-busy="true" aria-label="Chargement des conversations">
        {[0, 1, 2].map((index) => (
          <li key={index} className="h-16 animate-pulse rounded-field bg-surface-1" />
        ))}
      </ul>
    );
  }
  if (isError) {
    return <p className="text-sm text-danger">Impossible de charger vos conversations. Rechargez la page.</p>;
  }
  if (!conversations.length) {
    return (
      <p className="text-sm text-ink-600">
        Aucune conversation pour l&apos;instant. Pour écrire à une boutique, ouvrez sa page et cliquez « Écrire à la
        boutique ».
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeId;
        return (
          <li key={conversation.id}>
            <Link
              href={`/messages?c=${conversation.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`flex min-h-11 items-start justify-between gap-3 px-3 py-3 ${
                isActive ? "bg-surface-1" : "hover:bg-surface-1"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink-900">
                  {conversation.counterpart_name}
                  {conversation.role === "seller" ? (
                    <span className="ml-2 text-xs font-normal text-ink-600">client de votre boutique</span>
                  ) : null}
                </span>
                <span className="block truncate text-sm text-ink-600">{conversation.last_message ?? ""}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-ink-600">{formatWhen(conversation.last_message_at)}</span>
                {conversation.unread_count > 0 ? (
                  <span className="rounded-pill bg-brand-600 px-2 text-xs font-semibold text-white">
                    {conversation.unread_count}
                    <span className="sr-only"> message(s) non lu(s)</span>
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
