import { adminProxyRequest } from "@/lib/admin-proxy-client";
import type { FuelKey, OfficialList } from "@/types/local-services";

export type OfficialListInput = {
  kind: OfficialList["kind"];
  city: string;
  title: string;
  source: string;
  brand: string | null;
  fuel: FuelKey | null;
  contact_phone: string | null;
  contact_address: string | null;
  starts_at: string;
  ends_at: string;
  lines: string;
};

export function listAdminOfficialLists(): Promise<OfficialList[]> {
  return adminProxyRequest<OfficialList[]>({ url: "/admin/official-lists", method: "GET" });
}

export function createAdminOfficialList(payload: OfficialListInput): Promise<OfficialList> {
  return adminProxyRequest<OfficialList>({ url: "/admin/official-lists", method: "POST", data: payload });
}

export function deleteAdminOfficialList(id: string): Promise<void> {
  return adminProxyRequest<void>({ url: `/admin/official-lists/${id}`, method: "DELETE" });
}

export type DutyPhotoRead = { city: string; starts_at: string | null; ends_at: string | null; lines: string; count: number };

/** Lit la photo de l'affiche des pharmacies de garde (réduite avant l'envoi). La lecture peut prendre une minute. */
export function readDutyPhoto(payload: { mime: "image/jpeg"; data: string }): Promise<DutyPhotoRead> {
  return adminProxyRequest<DutyPhotoRead>({ url: "/admin/official-lists/read-photo", method: "POST", data: payload, timeout: 150000 });
}
