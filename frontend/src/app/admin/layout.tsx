"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BarChart3, CreditCard, FolderTree, QrCode, SlidersHorizontal, Users } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminEmail } from "@/lib/admin";

const adminNavItems = [
  { href: "/admin", label: "Vue Generale", icon: BarChart3 },
  { href: "/admin/tarifs", label: "Tarifs", icon: SlidersHorizontal },
  { href: "/admin/finance", label: "Finance", icon: CreditCard },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/catalog", label: "Catalogues", icon: FolderTree },
  { href: "/admin/receipt-scan", label: "Scan Recu", icon: QrCode },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, isPending, isError } = useCurrentUser();
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (isPending) {
      return;
    }
    if (isError || !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, isError, isPending, pathname, router, user]);

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </section>
    );
  }

  if (!user || !isAdmin) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 pb-14 sm:px-6">
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h1 className="luxury-title text-2xl font-semibold">Espace Admin Prive</h1>
          <p className="mt-2 text-sm text-slate-600">Verification d&apos;acces en cours...</p>
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl gap-5 px-4 pb-14 sm:grid sm:grid-cols-[260px_minmax(0,1fr)] sm:px-6">
      <aside className="premium-card h-fit border border-slate-200 bg-white p-4 sm:sticky sm:top-24">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Admin prive</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{user.email}</p>
        <nav className="mt-4 space-y-2">
          {adminNavItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                  active
                    ? "border-[#FF4D00]/45 bg-[#FF4D00]/10 text-[#FF4D00]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#FF4D00]/30"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="mt-5 sm:mt-0">{children}</div>
    </section>
  );
}
