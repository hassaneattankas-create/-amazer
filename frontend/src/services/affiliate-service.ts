import { api } from "@/lib/api";

export type AffiliateEarningStatus = "pending" | "review" | "available" | "requested" | "paid" | "cancelled";
export type PayoutMethod = "nita" | "amana" | "airtel" | "moov";

export type AffiliateMe = {
  code: string;
  tier: "affiliate" | "ambassador";
  status: string;
  seller_share_percent: number;
  seller_share_months: number;
  customer_bonus: number;
  hold_days: number;
  min_payout: number;
  clicks: number;
  referred_sellers: number;
  referred_customers: number;
  earnings: {
    earned: number;
    /** Bonus clients reserves sur des commandes pas encore livrees. */
    pending: number;
    in_progress: number;
    on_hold: number;
    review: number;
    available: number;
    requested: number;
    paid: number;
    from_sellers: number;
    from_customers: number;
    from_bonus: number;
    orders_delivered: number;
    orders_pending: number;
  };
  ambassador: {
    first_month_percent: number;
    current_percent: number;
    paying_shops: number;
    next_tier_shops: number | null;
    next_tier_percent: number | null;
    monthly_top_bonus: number;
  } | null;
  ambassador_applied: boolean;
  payout_method: PayoutMethod | null;
  payout_phone: string | null;
  recent_earnings: Array<{
    id: string;
    label: string;
    amount: number;
    status: AffiliateEarningStatus;
    note: string | null;
    created_at: string;
    available_at: string | null;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    method: PayoutMethod;
    phone: string;
    status: "requested" | "paid" | "rejected";
    transaction_reference: string | null;
    admin_note: string | null;
    created_at: string;
    processed_at: string | null;
  }>;
};

export type AffiliateLeaderboard = {
  month: string;
  top_bonus: number;
  rows: Array<{ rank: number; name: string; new_shops: number; is_me: boolean }>;
};

export async function getMyAffiliate() {
  return (await api.get<AffiliateMe>("/api/v1/affiliates/me")).data;
}

export async function getAffiliateLeaderboard() {
  return (await api.get<AffiliateLeaderboard>("/api/v1/affiliates/leaderboard")).data;
}

export async function requestAffiliatePayout(data: { method: PayoutMethod; phone: string }) {
  return (await api.post<AffiliateMe["payouts"][number]>("/api/v1/affiliates/payouts", data)).data;
}

export async function applyAmbassador(message: string) {
  await api.post("/api/v1/affiliates/apply", { message });
}

export async function recordAffiliateClick(code: string) {
  await api.post("/api/v1/affiliates/click", { code });
}
