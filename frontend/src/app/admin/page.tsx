import Link from "next/link";

export default function AdminHomePage() {
  const items = [
    {
      href: "/admin/tarifs",
      title: "Tarifs & Commission",
      description: "Configurer commission, frais plateforme, livraison et contacts publics.",
    },
    {
      href: "/admin/finance",
      title: "Finance",
      description: "Suivre les flux, virements simules et historique financiere.",
    },
    {
      href: "/admin/catalog",
      title: "Catalogues",
      description: "Gerer categories et rubriques dynamiques du site.",
    },
    {
      href: "/admin/sections",
      title: "Sections Dynamiques",
      description: "Organiser les blocs home, sponsorises, meilleures ventes, etc.",
    },
    {
      href: "/admin/receipt-scan",
      title: "Validation Recu",
      description: "Verifier les QR recus et bloquer les doubles usages.",
    },
  ];

  return (
    <section className="space-y-5">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Panneau Proprietaire AMAZER</h1>
        <p className="mt-2 text-sm text-slate-600">
          Espace prive de configuration. Les clients et vendeurs ne voient pas ces fonctionnalites.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="premium-card border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
