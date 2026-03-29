"use client";

import { useQuery } from "@tanstack/react-query";

import { getAdminMe } from "@/services/admin-service";

export function useAdminMe(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: getAdminMe,
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
