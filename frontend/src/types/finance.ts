export type FinanceSettings = {
  commission_rate: number;
  service_fee: number;
  default_delivery_fee: number;
  urban_delivery_fee: number;
  peripheral_delivery_fee: number;
  seller_subscription_fee: number;
  ad_boost_price: number;
  ad_boost_duration_days: number;
  ad_boost_price_24h: number;
  ad_boost_price_7d: number;
  launch_mode_zero_commission: boolean;
  support_email: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
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

export type AdminOrderTracking = {
  id: string;
  customer_name: string;
  status: "commande" | "preparation" | "livraison" | "recu" | "CLAIMED";
  payment_mode: string;
  total_amount: number;
  tracking_code: string | null;
  created_at: string;
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
  created_at: string;
};
