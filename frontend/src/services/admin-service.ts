import { adminProxyRequest } from "@/lib/admin-proxy-client";

export type AdminMe = {
  is_admin: boolean;
  email: string;
};

export async function getAdminMe(): Promise<AdminMe> {
  return adminProxyRequest<AdminMe>({
    url: "/admin/me",
    method: "GET",
  });
}
