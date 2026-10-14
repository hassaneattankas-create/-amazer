import Link from "next/link";
import { CreditCard, Flag, FolderTree, Layers, QrCode, Send, SlidersHorizontal, Users, Wallet, type LucideIcon } from "lucide-react";

type AdminLink = { href: string; title: string; description: string; icon: LucideIcon };

// Regroupe par usage quotidien : d'abord ce qui demande une action, puis les reglages.
const GROUPS: { title: string; items: AdminLink[] }[] = [
  {
    title: "À traiter",
    items: [
      { href: "/admin/finance", title: "Paiements et commandes", description: "Valider les paiements, suivre et annuler les commandes.", icon: CreditCard },
      { href: "/admin/moderation", title: "Modération", description: "Signalements des clients et produits masqués.", icon: Flag },
      { href: "/admin/revendeurs", title: "Revendeurs", description: "Gains à verser aux revendeurs sans stock.", icon: Wallet },
      { href: "/admin/receipt-scan", title: "Confirmer une livraison", description: "Scanner le QR code du reçu client.", icon: QrCode },
    ],
  },
  {
    title: "Gestion",
    items: [
      { href: "/admin/messages", title: "Messages", description: "Envoyer une annonce sur le site et par e-mail.", icon: Send },
      { href: "/admin/users", title: "Utilisateurs", description: "Rôles (admin, livreur), retrait et suppression de comptes.", icon: Users },
      { href: "/admin/tarifs", title: "Tarifs et vendeurs", description: "Commission, frais, livraison par quartier, abonnements.", icon: SlidersHorizontal },
      { href: "/admin/catalog", title: "Catégories", description: "Catégories du catalogue.", icon: FolderTree },
      { href: "/admin/sections", title: "Sections de l'accueil", description: "Blocs mis en avant sur le site.", icon: Layers },
    ],
  },
];

export default function AdminHomePage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Administration AMAZER</h1>
        <p className="mt-1 text-sm text-ink-600">Visible uniquement par l&apos;équipe AMAZER.</p>
      </header>
      {GROUPS.map((group) => (
        <div key={group.title}>
          <h2 className="text-sm font-semibold uppercase tracking-label text-ink-600">{group.title}</h2>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex gap-3 rounded-card border border-border bg-card p-4 transition-colors duration-fast hover:border-ink-400"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold text-ink-900">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-600">{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
