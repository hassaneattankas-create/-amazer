import { api } from "@/lib/api";

export type AdminMe = {
  is_admin: boolean;
  email: string;
};

export async function getAdminMe(): Promise<AdminMe> {
  const response = await api.get<AdminMe>("/api/v1/admin/me");
  return response.data;
}

