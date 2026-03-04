"use client";

import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminEmail } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/store/cartStore";

const navItems = [
  { href: "/", label: "Accueil" },
  { href: "/boutiques", label: "Boutiques" },
  { href: "/promotions", label: "Promotions" },
  { href: "/avis", label: "Avis" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profil" },
  { href: "/cart", label: "Panier" },
  { href: "/restaurant", label: "Restaurant" },
  { href: "/vendre", label: "Devenir Vendeur" },
];

export function FloatingNavbar() {
  const items = useCartStore((state) => state.items);
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const { data: user } = useCurrentUser();
  const showAdminLink = isAdminEmail(user?.email);

  return (
    <header className="fixed left-1/2 top-3 z-50 w-[min(1160px,calc(100%-1rem))] -translate-x-1/2 rounded-3xl border border-white/20 bg-white/70 shadow-[0_20px_50px_rgba(255,77,0,0.15)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2">
          <span className="luxury-title text-lg font-semibold tracking-tight">AMAZER</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-700 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[#FF4D00]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {showAdminLink ? (
            <Link
              href="/admin"
              className="hidden items-center gap-2 rounded-md border border-[#FF4D00]/35 bg-[#FF4D00]/10 px-3 py-2 text-sm text-[#FF4D00] hover:bg-[#FF4D00]/15 sm:inline-flex"
            >
              Espace Admin
            </Link>
          ) : null}
          <Link
            href="/register"
            className="hidden items-center gap-2 rounded-md border border-white/20 bg-white/70 px-3 py-2 text-sm text-slate-700 backdrop-blur-xl hover:bg-white sm:inline-flex"
          >
            Inscription
          </Link>
          <Link
            href="/login"
            className="hidden items-center gap-2 rounded-md border border-white/20 bg-white/70 px-3 py-2 text-sm text-slate-700 backdrop-blur-xl hover:bg-white sm:inline-flex"
          >
            <User className="h-4 w-4" />
            Connexion
          </Link>
          <Link href="/cart" className="primary-glow-btn shine-btn relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Panier</span>
              {cartCount > 0 ? (
                <Badge className="absolute -right-2 -top-2 bg-white text-[#FF4D00] hover:bg-white">
                  {cartCount}
                </Badge>
              ) : null}
          </Link>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2 md:hidden">
        <Link
          href="/register"
          className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
        >
          Inscription
        </Link>
        {navItems.map((item) => (
          <Link
            key={`mobile-${item.href}`}
            href={item.href}
            className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
          >
            {item.label}
          </Link>
        ))}
        {showAdminLink ? (
          <Link
            href="/admin"
            className="whitespace-nowrap rounded-xl border border-[#FF4D00]/35 bg-[#FF4D00]/10 px-3 py-1.5 text-xs text-[#FF4D00] hover:bg-[#FF4D00]/15"
          >
            Espace Admin
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
