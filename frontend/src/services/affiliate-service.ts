import { api } from "@/lib/api";

export type AffiliateMe = {
  code: string;
  commission_percent: number;
  clicks: number;
  earnings: { earned: number; pending: number; orders_delivered: number; orders_pending: number };
};

export async function getMyAffiliate() {
  return (await api.get<AffiliateMe>("/api/v1/affiliates/me")).data;
}

export async function recordAffiliateClick(code: string) {
  await api.post("/api/v1/affiliates/click", { code });
}
