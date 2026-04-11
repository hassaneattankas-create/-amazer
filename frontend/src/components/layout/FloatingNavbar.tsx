"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, ShoppingCart, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { useAdminMe } from "@/hooks/use-admin-me";
import { useClientMounted } from "@/hooks/use-client-mounted";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminEmail } from "@/lib/admin";
import { clearAppMode, persistAppMode } from "@/lib/session-mode";
import { logout } from "@/services/auth-service";
import { listMyNotifications, notifyLocalOrderEvent } from "@/services/notification-service";
import { getSellerProfile } from "@/services/seller-service";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cartStore";
import { useNotificationStore } from "@/store/notification-store";

const clientNavItems = [
  { href: "/", label: "Accueil" },
  { href: "/boutiques", label: "Boutiques" },
  { href: "/restaurant", label: "Restaurant" },
  { href: "/hotels", label: "Premium" },
  { href: "/promotions", label: "Promotions" },
  { href: "/avis", label: "Avis" },
];

const sellerNavItems = [
  { href: "/seller/dashboard", label: "Ma Boutique" },
  { href: "/seller/delivery-scan", label: "Scan Livraison" },
];

const SESSION_DRAFT_KEYS = [
  "amazer_seller_profile_draft",
  "amazer_seller_product_draft",
  "amazer_seller_restaurant_draft",
  "amazer_seller_dashboard_dish_draft",
  "amazer_home_state_draft",
];

export function FloatingNavbar() {
  const isClient = useClientMounted();
  const items = useCartStore((state) => state.items);
  const resetCartSession = useCartStore((state) => state.resetSession);
  const cartCount = isClient ? items.reduce((total, item) => total + item.quantity, 0) : 0;
  const { data: user } = useCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const appMode = useAuthStore((state) => state.appMode);
  const setAppMode = useAuthStore((state) => state.setAppMode);
  const resetSessionView = useAuthStore((state) => state.resetSessionView);
  const { data: adminMe } = useAdminMe(Boolean(user?.id));
  const unreadNotifications = useNotificationStore((state) =>
    state.items.reduce((count, item) => count + (item.unread ? 1 : 0), 0)
  );
  const clearNotifications = useNotificationStore((state) => state.clearAll);
  const { data: sellerProfile } = useQuery({
    queryKey: ["navbar-seller-profile", user?.id],
    queryFn: getSellerProfile,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const syncNotifications = useNotificationStore((state) => state.syncNotifications);
  const seenRemoteNotificationsRef = useRef<Set<string>>(new Set());
  const remoteNotificationsInitializedRef = useRef(false);
  const { data: remoteNotifications = [] } = useQuery({
    queryKey: ["remote-notifications", user?.id],
    queryFn: () => listMyNotifications(60),
    enabled: Boolean(user?.id),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const showAdminLink = Boolean(adminMe?.is_admin) || isAdminEmail(user?.email);
  const showSellerLink = Boolean(sellerProfile?.id);
  const isAuthenticated = Boolean(user?.id);
  const groupedNavItems = [
    ...clientNavItems,
    ...(isAuthenticated ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    ...(isAuthenticated ? [{ href: "/notifications", label: "Notifications" }] : []),
    ...(showSellerLink ? sellerNavItems : []),
    ...(showAdminLink ? [{ href: "/admin", label: "Espace Admin" }] : []),
  ].filter((item, index, array) => array.findIndex((entry) => entry.href === item.href) === index);

  useEffect(() => {
    if (!isClient) {
      return;
    }
    if (!isAuthenticated) {
      if (appMode !== "client") {
        setAppMode("client");
      }
      return;
    }
    if (appMode !== "client" && !showSellerLink) {
      setAppMode("client");
    }
  }, [isClient, appMode, isAuthenticated, setAppMode, showSellerLink]);

  useEffect(() => {
    if (!isClient) {
      return;
    }
    if (!isAuthenticated) {
      clearAppMode();
      return;
    }
    persistAppMode(appMode);
  }, [isClient, appMode, isAuthenticated]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    clearNotifications();
    seenRemoteNotificationsRef.current = new Set();
    remoteNotificationsInitializedRef.current = false;
  }, [clearNotifications, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    syncNotifications(remoteNotifications);
    const known = seenRemoteNotificationsRef.current;
    if (!remoteNotificationsInitializedRef.current) {
      remoteNotifications.forEach((item) => known.add(item.id));
      remoteNotificationsInitializedRef.current = true;
      return;
    }
    const freshUnread = remoteNotifications.filter((item) => item.unread && !known.has(item.id));
    remoteNotifications.forEach((item) => known.add(item.id));
    for (const item of freshUnread) {
      void notifyLocalOrderEvent({
        title: item.title,
        body: item.body,
        tag: item.tag || `remote-${item.id}`,
        href: item.href,
      });
    }
  }, [isAuthenticated, remoteNotifications, syncNotifications]);

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
    <header
      ref={menuRef}
      className="pointer-events-auto fixed left-1/2 top-3 z-50 w-[min(1160px,calc(100%-1rem))] -translate-x-1/2 rounded-3xl border border-white/20 bg-white/70 shadow-[0_20px_50px_rgba(255,77,0,0.15)] backdrop-blur-xl"
    >
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2">
          <span className="luxury-title text-lg font-semibold tracking-tight">AMAZER</span>
        </Link>

        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
          >
            Rubriques
            <ChevronDown
              className={`h-4 w-4 transition ${isMenuOpen ? "rotate-180 text-[#FF4D00]" : ""}`}
            />
          </button>

          {isMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-64 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="max-h-80 overflow-y-auto p-3">
                {groupedNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="mb-2 flex items-center rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-[#FF4D00]/20 hover:bg-orange-50 hover:text-[#FF4D00]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
            >
              Rubriques
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${isMenuOpen ? "rotate-180 text-[#FF4D00]" : ""}`}
              />
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <div className="max-h-72 overflow-y-auto p-3">
                  {groupedNavItems.map((item) => (
                    <Link
                      key={`mobile-header-${item.href}`}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="mb-2 flex rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-[#FF4D00]/20 hover:bg-orange-50 hover:text-[#FF4D00]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {showSellerLink ? null : (
            <Link
              href="/vendre"
              className="hidden items-center gap-2 rounded-md border border-white/20 bg-white/70 px-3 py-2 text-sm text-slate-700 backdrop-blur-xl hover:bg-white sm:inline-flex"
            >
              Devenir vendeur
            </Link>
          )}
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
                Inscription client
              </Link>
              <Link
                href="/login"
                className="hidden items-center gap-2 rounded-md border border-[#FF4D00]/35 bg-[#FF4D00]/10 px-4 py-2.5 text-sm font-medium text-[#FF4D00] shadow-sm hover:bg-[#FF4D00]/15 sm:inline-flex"
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
          <Link
            href="/notifications"
            className="relative inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/70 px-3 py-2 text-sm text-slate-700 backdrop-blur-xl hover:bg-white"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
            {unreadNotifications > 0 ? (
              <Badge className="absolute -right-2 -top-2 bg-[#FF4D00] text-white hover:bg-[#FF4D00]">
                {unreadNotifications}
              </Badge>
            ) : null}
          </Link>
          <Link
            href="/cart"
            className="primary-glow-btn shine-btn relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white"
          >
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

      <nav className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 md:hidden">
        {!isAuthenticated ? (
          <>
            <Link
              href="/login"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-[#FF4D00]/35 bg-[#FF4D00]/10 px-3 py-1.5 text-xs font-medium text-[#FF4D00] hover:bg-[#FF4D00]/15"
            >
              <User className="h-3.5 w-3.5" />
              Connexion
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
            >
              Inscription client
            </Link>
          </>
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
        {showSellerLink ? null : (
          <Link
            href="/vendre"
            className="whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
          >
            Devenir vendeur
          </Link>
        )}
        {showAdminLink ? (
          <Link
            href="/admin"
            className="whitespace-nowrap rounded-xl border border-[#FF4D00]/35 bg-[#FF4D00]/10 px-3 py-1.5 text-xs text-[#FF4D00] hover:bg-[#FF4D00]/15"
          >
            Espace Admin
          </Link>
        ) : null}
        {isAuthenticated ? (
          <Link
            href="/notifications"
            className="relative whitespace-nowrap rounded-xl border border-white/20 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-xl hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
          >
            Notifications
            {unreadNotifications > 0 ? (
              <span className="ml-1 font-semibold text-[#FF4D00]">({unreadNotifications})</span>
            ) : null}
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
