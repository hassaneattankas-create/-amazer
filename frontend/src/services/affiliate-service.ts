import { api } from "@/lib/api";

export type AffiliateMe = {
  code: string;
  seller_share_percent: number;
  seller_share_months: number;
  customer_bonus: number;
  clicks: number;
  referred_sellers: number;
  referred_customers: number;
  earnings: {
    earned: number;
    pending: number;
    from_sellers: number;
    from_customers: number;
    orders_delivered: number;
    orders_pending: number;
  };
};

export async function getMyAffiliate() {
  return (await api.get<AffiliateMe>("/api/v1/affiliates/me")).data;
}

export async function recordAffiliateClick(code: string) {
  await api.post("/api/v1/affiliates/click", { code });
}
