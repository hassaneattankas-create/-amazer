"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Menu, ShoppingCart, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { Badge } from "@/components/ui/badge";
import { useAdminMe } from "@/hooks/use-admin-me";
import { useClientMounted } from "@/hooks/use-client-mounted";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminEmail } from "@/lib/admin";
import { clearAppMode, persistAppMode } from "@/lib/session-mode";
import { logout } from "@/services/auth-service";
import {
  AMAZER_NOTIFICATION_EVENT,
  listMyNotifications,
  notifyLocalOrderEvent,
  requestAndRegisterNotifications,
} from "@/services/notification-service";
import { getSellerProfile, getSellerSubscriptionStatus } from "@/services/seller-service";
import { getPreRegisterSellerStatus } from "@/services/auth-service";
import {
  clearPendingSellerPreReg,
  getPendingSellerPreReg,
  PENDING_SELLER_EVENT,
  setPendingSellerPreReg,
  type PendingSellerPreReg,
} from "@/lib/pending-seller";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cartStore";
import { useNotificationStore } from "@/store/notification-store";

/** Menu simple : trois usages (acheter, réserver, services), puis gagner de l'argent. */
const clientNavSections: Array<{ title: string | null; items: Array<{ href: string; label: string }> }> = [
  { title: null, items: [{ href: "/", label: "Accueil" }] },
  {
    title: "Acheter",
    items: [
      { href: "/boutiques", label: "Boutiques" },
      { href: "/restaurant", label: "Restaurants" },
      { href: "/promotions", label: "Promotions" },
    ],
  },
  { title: "Réserver", items: [{ href: "/hotels", label: "Hôtels et transport" }] },
  {
    title: "Services",
    items: [
      { href: "/pharmacies", label: "Pharmacies de garde" },
      { href: "/stations", label: "Stations-essence" },
    ],
  },
  {
    title: "Gagner avec AMAZER",
    items: [
      { href: "/affiliation", label: "Affiliation" },
      { href: "/revendre", label: "Revendre sans stock" },
      { href: "/formations", label: "Formations gratuites" },
      { href: "/avis", label: "Avis" },
    ],
  },
];
const clientHrefs = new Set(clientNavSections.flatMap((section) => section.items.map((item) => item.href)));

const sellerNavItems = [
  { href: "/seller/dashboard", label: "Ma Boutique" },
];

const SESSION_DRAFT_KEYS = [
  "amazer_seller_profile_draft",
  "amazer_seller_product_draft",
  "amazer_seller_restaurant_draft",
  "amazer_seller_dashboard_dish_draft",
  "amazer_home_state_draft",
];

export function FloatingNavbar() {
  const t = useT();
  const isClient = useClientMounted();
  const queryClient = useQueryClient();
  const items = useCartStore((state) => state.items);
  const resetCartSession = useCartStore((state) => state.resetSession);
  const cartCount = isClient ? items.reduce((total, item) => total + item.quantity, 0) : 0;
  const { data: user } = useCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingPreReg, setPendingPreReg] = useState<PendingSellerPreReg | null>(null);
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
  const { data: sellerSubscriptionStatus } = useQuery({
    queryKey: ["seller-subscription-status"],
    queryFn: getSellerSubscriptionStatus,
    enabled: Boolean(sellerProfile?.id),
    staleTime: 30_000,
  });
  const syncNotifications = useNotificationStore((state) => state.syncNotifications);
  const seenRemoteNotificationsRef = useRef<Set<string>>(new Set());
  const remoteNotificationsInitializedRef = useRef(false);
  const { data: remoteNotifications = [], isFetched: remoteNotificationsFetched } = useQuery({
    queryKey: ["remote-notifications", user?.id],
    queryFn: () => listMyNotifications(60),
    enabled: Boolean(user?.id),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // Pre-inscription vendeur en attente sur cet appareil: on interroge son statut
  // meme sans connexion pour prevenir l'utilisateur que son compte est pret.
  const { data: preRegStatus } = useQuery({
    queryKey: ["pending-seller-prereg", pendingPreReg?.id],
    queryFn: () => getPreRegisterSellerStatus(pendingPreReg!.id),
    enabled: Boolean(isClient && pendingPreReg?.id && !pendingPreReg?.notified),
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: false,
  });

  const showAdminLink = Boolean(adminMe?.is_admin) || isAdminEmail(user?.email);
  const showSellerLink = Boolean(sellerProfile?.id);
  const sellerNavigationItems = sellerSubscriptionStatus?.subscription_active
    ? sellerNavItems
    : [{ href: "/seller", label: "Activer vendeur" }];
  const isAuthenticated = Boolean(user?.id);
  const accountNavItems = [
    ...(isAuthenticated ? [{ href: "/dashboard", label: "Tableau de bord" }, { href: "/messages", label: "Messages" }] : []),
    ...(showSellerLink ? sellerNavigationItems : []),
    ...(user?.role === "courier" || showAdminLink ? [{ href: "/livreur", label: "Espace livreur" }] : []),
    ...(showAdminLink ? [{ href: "/admin", label: "Espace Admin" }] : []),
  ].filter((item, index, array) => !clientHrefs.has(item.href) && array.findIndex((entry) => entry.href === item.href) === index);

  useEffect(() => {
    if (!isClient) {
      return;
    }
    if (!user?.id) {
      return;
    }
    void requestAndRegisterNotifications();
  }, [isClient, user?.id]);

  // Une fois connecte, la pre-inscription locale n'a plus d'utilite (le compte
  // existe et les notifications serveur prennent le relais).
  useEffect(() => {
    if (!isClient || !user?.id) {
      return;
    }
    if (getPendingSellerPreReg()) {
      clearPendingSellerPreReg();
      setPendingPreReg(null);
    }
  }, [isClient, user?.id]);

  // Charge la pre-inscription locale et reagit a ses mises a jour (soumission/clear).
  useEffect(() => {
    if (!isClient) {
      return;
    }
    const sync = () => setPendingPreReg(getPendingSellerPreReg());
    sync();
    window.addEventListener(PENDING_SELLER_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(PENDING_SELLER_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, [isClient]);

  // Quand l'admin valide (ou refuse) la pre-inscription: notifier dans l'app,
  // meme avant connexion, puis arreter d'interroger.
  useEffect(() => {
    if (!isClient || !pendingPreReg?.id || pendingPreReg.notified || !preRegStatus) {
      return;
    }
    if (preRegStatus.status === "approved") {
      void notifyLocalOrderEvent({
        title: "Votre compte est pret !",
        body:
          `Felicitations ! Votre compte vendeur` +
          (pendingPreReg.businessName ? ` "${pendingPreReg.businessName}"` : "") +
          ` est active. Connectez-vous pour commencer a utiliser AMAZER.`,
        tag: `prereg-approved-${pendingPreReg.id}`,
        href: `/login?next=${encodeURIComponent("/seller/dashboard")}`,
      });
      // Marque comme notifie (garde l'entree pour eviter une 2e notif) puis nettoie.
      setPendingSellerPreReg({ ...pendingPreReg, notified: true });
      setPendingPreReg((prev) => (prev ? { ...prev, notified: true } : prev));
    } else if (preRegStatus.status === "rejected") {
      void notifyLocalOrderEvent({
        title: "Demande vendeur refusee",
        body: "Votre demande n'a pas ete validee. Contactez le support AMAZER.",
        tag: `prereg-rejected-${pendingPreReg.id}`,
      });
      clearPendingSellerPreReg();
      setPendingPreReg(null);
    }
  }, [isClient, pendingPreReg, preRegStatus]);

  useEffect(() => {
    if (!isClient || !user?.id) {
      return;
    }

    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<{ tag?: string }>).detail;
      void queryClient.invalidateQueries({ queryKey: ["remote-notifications", user.id] });
      if (
        (detail?.tag || "").startsWith("seller-payment-decision-") ||
        (detail?.tag || "").startsWith("seller_sub_")
      ) {
        void queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
        void queryClient.invalidateQueries({ queryKey: ["navbar-seller-profile"] });
        void queryClient.invalidateQueries({ queryKey: ["seller-subscription-status"] });
        void queryClient.invalidateQueries({ queryKey: ["seller-subscription-payment-requests"] });
      }
    };

    window.addEventListener(AMAZER_NOTIFICATION_EVENT, handleNotification as EventListener);
    return () => {
      window.removeEventListener(AMAZER_NOTIFICATION_EVENT, handleNotification as EventListener);
    };
  }, [isClient, queryClient, user?.id]);

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
    if (!isAuthenticated || !remoteNotificationsFetched) {
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
      if (
        (item.tag || "").startsWith("seller-payment-decision-") ||
        (item.tag || "").startsWith("seller_sub_")
      ) {
        void queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
        void queryClient.invalidateQueries({ queryKey: ["navbar-seller-profile"] });
        void queryClient.invalidateQueries({ queryKey: ["seller-subscription-status"] });
        void queryClient.invalidateQueries({ queryKey: ["seller-subscription-payment-requests"] });
      }
    }
  }, [
    isAuthenticated,
    queryClient,
    remoteNotifications,
    remoteNotificationsFetched,
    syncNotifications,
    user?.id,
  ]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let removeListener: (() => Promise<void>) | undefined;

    const registerListener = async () => {
      const listener = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive || !user?.id) {
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ["remote-notifications", user.id] });
        void queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
        void queryClient.invalidateQueries({ queryKey: ["navbar-seller-profile"] });
        void queryClient.invalidateQueries({ queryKey: ["seller-subscription-status"] });
        void queryClient.invalidateQueries({ queryKey: ["seller-subscription-payment-requests"] });
      });
      removeListener = () => listener.remove();
    };

    void registerListener();

    return () => {
      if (removeListener) {
        void removeListener();
      }
    };
  }, [queryClient, user?.id]);

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

  const menuLinkClass =
    "flex min-h-11 items-center rounded-field px-3 text-sm font-medium text-ink-800 hover:bg-surface-1 hover:text-brand-700";

  return (
    <header
      ref={menuRef}
      className="sticky top-0 z-sticky w-full border-b border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-gutter sm:h-16 sm:gap-3">
        <Link href="/" className="mr-auto inline-flex shrink-0 items-center gap-2 md:mr-2" aria-label="AMAZER, accueil">
          <Image src="/logo-amazer-mark-128.png" alt="" width={36} height={36} priority className="h-9 w-9" />
          <span className="text-xl font-extrabold tracking-display text-ink-900">AMAZER</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="main-menu"
            aria-label="Menu"
            className="inline-flex min-h-11 items-center gap-1 rounded-field px-3 text-sm font-medium text-ink-800 hover:bg-surface-1"
          >
            <Menu className="h-5 w-5 md:hidden" aria-hidden="true" />
            <span className="hidden md:inline">{t("Menu")}</span>
            <ChevronDown
              className={`hidden h-4 w-4 transition-transform duration-fast md:block ${isMenuOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {isMenuOpen ? (
            <div
              id="main-menu"
              className="fixed inset-x-4 top-16 z-dropdown overflow-hidden rounded-card border border-border bg-card shadow-floating md:absolute md:inset-x-auto md:left-0 md:top-full md:mt-2 md:w-72"
            >
              <nav aria-label={t("Menu principal")} className="max-h-96 overflow-y-auto p-2">
                {clientNavSections.map((section) => (
                  <div key={section.title ?? "main"} className={section.title ? "mt-2" : undefined}>
                    {section.title ? (
                      <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-label text-ink-500">{t(section.title)}</p>
                    ) : null}
                    {section.items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)} className={menuLinkClass}>
                        {t(item.label)}
                      </Link>
                    ))}
                  </div>
                ))}
                {accountNavItems.length ? <div className="my-2 border-t border-border" /> : null}
                {accountNavItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)} className={menuLinkClass}>
                    {t(item.label)}
                  </Link>
                ))}
                <div className="md:hidden">
                  <div className="my-2 border-t border-border" />
                  {!isAuthenticated ? (
                    <>
                      <Link href="/login" onClick={() => setIsMenuOpen(false)} className={menuLinkClass}>
                        {t("Se connecter")}
                      </Link>
                      <Link href="/register" onClick={() => setIsMenuOpen(false)} className={menuLinkClass}>
                        {t("Créer un compte")}
                      </Link>
                    </>
                  ) : null}
                  {showSellerLink ? null : (
                    <Link href="/vendre" onClick={() => setIsMenuOpen(false)} className={menuLinkClass}>
                      {t("Devenir vendeur")}
                    </Link>
                  )}
                  {showAdminLink ? (
                    <Link href="/admin" onClick={() => setIsMenuOpen(false)} className={menuLinkClass}>
                      {t("Espace Admin")}
                    </Link>
                  ) : null}
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className={`${menuLinkClass} w-full text-left disabled:opacity-60`}
                    >
                      {isLoggingOut ? t("Déconnexion…") : t("Se déconnecter")}
                    </button>
                  ) : null}
                </div>
              </nav>
            </div>
          ) : null}
        </div>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {showSellerLink ? null : (
            <Link href="/vendre" className="inline-flex min-h-11 items-center rounded-field px-3 text-sm text-ink-700 hover:bg-surface-1">
              {t("Devenir vendeur")}
            </Link>
          )}
          {showAdminLink ? (
            <Link href="/admin" className="inline-flex min-h-11 items-center rounded-field px-3 text-sm font-medium text-brand-700 hover:bg-surface-1">
              {t("Espace Admin")}
            </Link>
          ) : null}
          {!isAuthenticated ? (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center gap-2 rounded-field px-3 text-sm font-medium text-ink-800 hover:bg-surface-1"
            >
              <User className="h-5 w-5" aria-hidden="true" />
              {t("Se connecter")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex min-h-11 items-center rounded-field px-3 text-sm text-ink-700 hover:bg-surface-1 disabled:opacity-60"
            >
              {isLoggingOut ? t("Déconnexion…") : t("Se déconnecter")}
            </button>
          )}
        </div>

        {!isAuthenticated ? (
          <Link
            href="/login"
            aria-label="Se connecter"
            className="inline-flex h-11 w-11 items-center justify-center rounded-field text-ink-800 hover:bg-surface-1 md:hidden"
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
        <LocaleSwitcher />
        <Link
          href="/notifications"
          aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} non lues` : "Notifications"}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-field text-ink-800 hover:bg-surface-1"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadNotifications > 0 ? (
            <Badge className="absolute right-1 top-1 h-5 min-w-5 justify-center rounded-pill bg-brand-600 px-1 text-2xs text-white hover:bg-brand-600">
              {unreadNotifications}
            </Badge>
          ) : null}
        </Link>
        <Link
          href="/cart"
          aria-label={cartCount > 0 ? `Panier, ${cartCount} article(s)` : "Panier"}
          className="relative inline-flex h-11 items-center justify-center gap-2 rounded-field bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">{t("Panier")}</span>
          {cartCount > 0 ? (
            <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 justify-center rounded-pill bg-ink-900 px-1 text-2xs text-white hover:bg-ink-900">
              {cartCount}
            </Badge>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
