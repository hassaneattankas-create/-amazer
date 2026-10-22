export type FinanceSettings = {
  commission_rate: number;
  service_fee: number;
  default_delivery_fee: number;
  urban_delivery_fee: number;
  peripheral_delivery_fee: number;
  seller_subscription_fee_shop: number;
  seller_subscription_fee_restaurant: number;
  seller_subscription_fee_premium: number;
  launch_mode_zero_commission: boolean;
  max_products_basic_tier: number;
  platform_wallet_phone: string | null;
  support_email: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
  /** Numéros AMAZER de livraison depuis les pharmacies / stations (vide = bouton masqué). */
  pharmacy_delivery_phone?: string | null;
  fuel_delivery_phone?: string | null;
  /** Villes livrées depuis les pharmacies / stations, séparées par des virgules. */
  local_delivery_cities?: string;
  /** Réseau de stations : incluses, prix par station en plus (4–10, 11–30, 31+), forfait national. */
  fuel_included_outlets?: number;
  fuel_tier1_price?: number;
  fuel_tier2_price?: number;
  fuel_tier3_price?: number;
  fuel_network_flat?: number;
  /** Essai gratuit a l'inscription vendeur, en jours (0 = desactive). */
  seller_trial_days?: number;
  /** Revente sans stock : abonnement mensuel du revendeur (XOF) et part AMAZER sur la marge (%). */
  reseller_subscription_fee?: number;
  reseller_commission_percent?: number;
  /** Affiliation : part des abonnements des vendeurs amenes (%, pendant N mois) et bonus par nouveau client. */
  affiliate_seller_share_percent?: number;
  affiliate_seller_share_months?: number;
  affiliate_customer_bonus?: number;
  /** Securite des gains : delai avant paiement (jours), minimum de retrait, plafond des nouveaux comptes, inscriptions/jour. */
  affiliate_hold_days?: number;
  /** Commande en livraison non confirmee : passee « Recu » automatiquement apres ce delai (heures). */
  auto_receipt_hours?: number;
  affiliate_min_payout?: number;
  affiliate_new_account_monthly_cap?: number;
  affiliate_max_referrals_per_day?: number;
  /** Ambassadeurs : prime 1er mois (%), paliers (boutiques payantes -> %), prime du n°1 du mois. */
  ambassador_first_month_percent?: number;
  ambassador_tier2_shops?: number;
  ambassador_tier2_percent?: number;
  ambassador_tier3_shops?: number;
  ambassador_tier3_percent?: number;
  ambassador_monthly_top_bonus?: number;
  /** Reduction de lancement sur le tarif standard, en % (0 = desactivee). */
  seller_launch_discount_percent?: number;
};

export type PublicContactInfo = {
  support_email: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
};

export type FinanceSummary = {
  total_commissions_collected: number;
  active_sellers: number;
  revenue_last_30_days: Array<{
    day: string;
    amount: number;
  }>;
};

export type WalletSummary = {
  total_nita: number;
  total_amana: number;
  total_cash_on_delivery: number;
  total_all: number;
  amazer_commission_total: number;
  service_fee_total: number;
};

export type TreasuryTransaction = {
  source: string;
  order_id: string;
  payment_mode: string;
  amount: number;
  encrypted_transaction_code: string | null;
  decrypted_transaction_code: string | null;
  created_at: string;
};

export type VerifyPinPayload = {
  pin: string;
  birth_date: string;
};

export type TransferPayload = {
  bank_name: "BOA" | "SONIBANK";
  amount: number;
};

export type TransferResult = {
  id: string;
  bank_name: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

export type CountersResetResult = {
  finance_counters_reset_at: string;
  ad_click_counters_reset_at: string;
};

export type AdminOrderTracking = {
  id: string;
  customer_name: string;
  status: "commande" | "preparation" | "livraison" | "recu" | "CLAIMED" | "annulee";
  payment_mode: string;
  total_amount: number;
  tracking_code: string | null;
  created_at: string;
  payment_status?: "pending" | "paid" | string;
  /** « restaurant » : le restaurant prépare et livre ; l'admin ne valide que le paiement. */
  kind?: "shop" | "restaurant";
  place_name?: string | null;
  /** Référence Nita envoyée par le client, tant que le paiement est à valider. */
  client_reference?: string | null;
  delivery_district?: string | null;
  item_count?: number;
};

export type DistrictFeeItem = {
  district_name: string;
  delivery_fee: number;
};

export type AuditLogItem = {
  id: string;
  event_type: string;
  actor_email: string | null;
  ip_address: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type AdminSeller = {
  profile_id: string;
  user_id: string;
  vendor_id: string;
  business_name: string;
  city: string;
  phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  activity_type: string;
  storefront_tier: string;
  is_enterprise: boolean;
  offers_transport: boolean;
  service_kind?: "pharmacy" | "fuel_station" | null;
  /** E-mail du compte (actions sur le compte dans « Utilisateurs »). */
  email?: string | null;
  subscription_paid_until: string | null;
  commission_rate_override: number | null;
  service_fee_override: number | null;
  seller_subscription_fee_override: number | null;
  effective_commission_rate: number;
  effective_service_fee: number;
  effective_seller_subscription_fee: number;
  created_at: string;
};

export type AdminSellerPricingPayload = {
  commission_rate_override: number | null;
  service_fee_override: number | null;
  seller_subscription_fee_override: number | null;
};

export type AdminUserStats = {
  total_users: number;
  active_users: number;
  inactive_users: number;
  seller_accounts: number;
  client_only_accounts: number;
  admin_accounts: number;
  new_users_last_7_days: number;
  new_users_last_30_days: number;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  whatsapp_phone: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_seller: boolean;
  role?: string;
  created_at: string;
};

export type AdminPendingSeller = {
  id: string;
  full_name: string;
  identifier: string;
  business_name: string | null;
  activity_type: string;
  storefront_tier: string;
  payment_mode: string | null;
  months: number;
  transaction_reference: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  submitted_at: string;
};

export type AdminSellerSubscriptionPaymentRequest = {
  id: string;
  seller_profile_id: string;
  seller_user_id: string;
  business_name: string;
  seller_email: string;
  payment_mode: "nita" | "amana";
  transaction_reference: string;
  months: number;
  amount_claimed: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};
