"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminEmail } from "@/lib/admin";
import { clearAppMode, persistAppMode } from "@/lib/session-mode";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/store/cartStore";
import { getSellerProfile } from "@/services/seller-service";
import { logout } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

const clientNavItems = [
  { href: "/", label: "Accueil" },
  { href: "/boutiques", label: "Boutiques" },
  { href: "/promotions", label: "Promotions" },
  { href: "/avis", label: "Avis" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profil" },
  { href: "/cart", label: "Panier" },
  { href: "/restaurant", label: "Restaurant" },
];

const sellerNavItems = [
  { href: "/seller", label: "Mon Espace" },
  { href: "/seller/dashboard", label: "Gestion Stock" },
];

const SESSION_DRAFT_KEYS = [
  "amazer_seller_profile_draft",
  "amazer_seller_product_draft",
  "amazer_seller_restaurant_draft",
  "amazer_seller_dashboard_dish_draft",
  "amazer_home_state_draft",
];

export function FloatingNavbar() {
  const items = useCartStore((state) => state.items);
  const resetCartSession = useCartStore((state) => state.resetSession);
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const { data: user } = useCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const appMode = useAuthStore((state) => state.appMode);
  const setAppMode = useAuthStore((state) => state.setAppMode);
  const resetSessionView = useAuthStore((state) => state.resetSessionView);
  const { data: sellerProfile, isFetched: sellerProfileFetched } = useQuery({
    queryKey: ["navbar-seller-profile", user?.id],
    queryFn: getSellerProfile,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const showAdminLink = isAdminEmail(user?.email);
  const showSellerLink = Boolean(sellerProfile?.id);
  const isAuthenticated = Boolean(user?.id);
  const activeNavItems =
    isAuthenticated && appMode === "seller" ? sellerNavItems : clientNavItems;

  useEffect(() => {
    if (!isAuthenticated) {
      if (appMode !== "client") {
        setAppMode("client");
      }
      return;
    }
    if (!sellerProfileFetched) {
      return;
    }
    if (showSellerLink && appMode !== "seller") {
      setAppMode("seller");
      return;
    }
    if (!showSellerLink && appMode !== "client") {
      setAppMode("client");
    }
  }, [appMode, isAuthenticated, sellerProfileFetched, setAppMode, showSellerLink]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearAppMode();
      return;
    }
    persistAppMode(appMode);
  }, [appMode, isAuthenticated]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      clearAppMode();
      resetSessionView();
      resetCartSession();
      if (typeof window !== "undefined") {
        SESSION_DRAFT_KEYS.forEach((key) => window.localStorage.removeItem(key));
      }
      window.location.assign("/login");
    }
  }

  return (
    <header className="fixed left-1/2 top-3 z-50 w-[min(1160px,calc(100%-1rem))] -translate-x-1/2 rounded-3xl border border-white/20 bg-white/70 shadow-[0_20px_50px_rgba(255,77,0,0.15)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2">
          <span className="luxury-title text-lg font-semibold tracking-tight">AMAZER</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-700 md:flex">
          {activeNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[#FF4D00]">
              {item.label}
            </Link>
          ))}
          {showSellerLink && appMode !== "seller" ? (
            <Link href="/seller" className="transition hover:text-[#FF4D00]">
              Espace Vendeur
            </Link>
          ) : null}
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
          {!isAuthenticated ? (
            <>
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
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="hidden items-center gap-2 rounded-md border border-white/20 bg-white/70 px-3 py-2 text-sm text-slate-700 backdrop-blur-xl hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 sm:inline-flex"
            >
              {isLoggingOut ? "Deconnexion..." : "Deconnexion"}
            </button>
          )}
          {appMode !== "seller" ? (
            <Link href="/cart" className="primary-glow-btn shine-btn relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Panier</span>
                {cartCount > 0 ? (
                  <Badge className="absolute -right-2 -top-2 bg-white text-[#FF4D00] hover:bg-white">
                    {cartCount}
                  </Badge>
                ) : null}
            </Link>
          ) : null}
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2 md:hidden">
        {!isAuthenticated ? (
          <Link
            href="/register"
            className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
          >
            Inscription
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoggingOut ? "Deconnexion..." : "Deconnexion"}
          </button>
        )}
        {activeNavItems.map((item) => (
          <Link
            key={`mobile-${item.href}`}
            href={item.href}
            className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
          >
            {item.label}
          </Link>
        ))}
        {showSellerLink && appMode !== "seller" ? (
          <Link
            href="/seller"
            className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
          >
            Espace Vendeur
          </Link>
        ) : null}
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
