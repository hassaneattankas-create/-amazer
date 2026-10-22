"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, ChevronDown, CreditCard, Flag, FolderTree, Layers, Lock, QrCode, RotateCcw, Send, Share2, SlidersHorizontal, Users, Wallet, type LucideIcon } from "lucide-react";

import { AdminPinGate } from "@/components/admin/AdminPinGate";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { useAdminMe } from "@/hooks/use-admin-me";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNow } from "@/hooks/use-now";
import { isAdminEmail } from "@/lib/admin";
import { ADMIN_PIN_EVENT, requestAdminPin } from "@/lib/admin-pin";
import { hasAdminFinanceVerified } from "@/lib/api";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Un menu court, rangé par usage : ce qui se traite chaque jour, l'argent à verser, puis les réglages.
const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Au quotidien",
    items: [
      { href: "/admin", label: "À traiter", icon: BarChart3 },
      { href: "/admin/finance", label: "Commandes et paiements", icon: CreditCard },
      { href: "/admin/receipt-scan", label: "Confirmer une livraison", icon: QrCode },
      { href: "/admin/moderation", label: "Modération", icon: Flag },
    ],
  },
  {
    title: "Argent à verser",
    items: [
      { href: "/admin/affilies", label: "Affiliés", icon: Share2 },
      { href: "/admin/revendeurs", label: "Revendeurs", icon: Wallet },
      { href: "/admin/remboursements", label: "Remboursements", icon: RotateCcw },
    ],
  },
  {
    title: "Gestion",
    items: [
      { href: "/admin/tarifs", label: "Vendeurs et tarifs", icon: SlidersHorizontal },
      { href: "/admin/users", label: "Utilisateurs", icon: Users },
      { href: "/admin/messages", label: "Messages", icon: Send },
      { href: "/admin/catalog", label: "Catégories", icon: FolderTree },
      { href: "/admin/sections", label: "Sections de l'accueil", icon: Layers },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // isLoading : sans connexion la requête est désactivée ; on redirige vers la connexion au lieu d'attendre.
  const { data: user, isLoading: isPending, isError } = useCurrentUser();
  const { data: adminMe, isPending: isAdminPending, isError: isAdminError } = useAdminMe(Boolean(user?.id));
  const isAdmin = Boolean(adminMe?.is_admin) || isAdminEmail(user?.email);
  // PIN : une seule saisie pour tout l'espace admin ; revérifié chaque minute (expiration au bout de 30 min).
  const [pinOk, setPinOk] = useState(() => hasAdminFinanceVerified());
  const now = useNow(30_000);
  const pinValid = pinOk && now > 0 && hasAdminFinanceVerified();

  useEffect(() => {
    const relock = () => setPinOk(false);
    window.addEventListener(ADMIN_PIN_EVENT, relock);
    return () => window.removeEventListener(ADMIN_PIN_EVENT, relock);
  }, []);

  useEffect(() => {
    if (isPending || (user && isAdminPending)) {
      return;
    }
    if (isError || !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, isAdminError, isAdminPending, isError, isPending, pathname, router, user]);

  if (isPending || (user && isAdminPending)) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-4 px-gutter pb-14">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </section>
    );
  }

  if (!user || !isAdmin) {
    return (
      <section className="mx-auto w-full max-w-4xl px-gutter pb-14">
        <article className="rounded-card border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold text-ink-900">Espace admin privé</h1>
          <p className="mt-2 text-sm text-ink-600">
            Accès admin requis. Le compte <span className="font-semibold">{user?.email ?? "non identifié"}</span> n&apos;a pas les droits admin.
          </p>
        </article>
      </section>
    );
  }

  const currentLabel = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.href === pathname)?.label ?? "Admin";
  const asideBody = (
    <>
        <p className="text-2xs font-semibold uppercase tracking-label text-ink-500">Admin</p>
        <p className="mt-1 truncate text-sm font-semibold text-ink-900">{user.email}</p>
        <nav className="mt-3 space-y-4" aria-label="Menu admin">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-1 text-2xs font-semibold uppercase tracking-label text-ink-500">{group.title}</p>
              <div className="mt-1 space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-10 items-center gap-2 rounded-field px-3 text-sm transition-colors duration-fast ${
                        active ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-700 hover:bg-surface-1"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        {pinValid ? (
          <button
            type="button"
            onClick={requestAdminPin}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-field border border-border text-sm font-medium text-ink-700 hover:bg-surface-1"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Verrouiller
          </button>
        ) : null}
    </>
  );

  return (
    <section className="mx-auto w-full max-w-7xl gap-5 px-gutter pb-14 sm:grid sm:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-card border border-border bg-card p-4 sm:sticky sm:top-24">
        {/* Téléphone : menu replié pour voir tout de suite le contenu ; ordinateur : menu ouvert. */}
        <details key={pathname} className="sm:hidden">
          <summary className="flex min-h-10 cursor-pointer items-center justify-between text-sm font-semibold text-ink-900">
            Menu admin · {currentLabel}
            <ChevronDown className="h-4 w-4 text-ink-500" aria-hidden="true" />
          </summary>
          <div className="mt-2">{asideBody}</div>
        </details>
        <div className="hidden sm:block">{asideBody}</div>
      </aside>
      <div className="mt-5 min-w-0 sm:mt-0">{pinValid ? children : <AdminPinGate onVerified={() => setPinOk(true)} />}</div>
    </section>
  );
}
