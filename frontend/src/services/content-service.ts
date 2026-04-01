import { api } from "@/lib/api";
import { adminProxyRequest } from "@/lib/admin-proxy-client";
import {
  AdClickStats,
  AdminCategory,
  DynamicSection,
  HomeContent,
  SectionItemInput,
} from "@/types/content";

export async function getHomeContent(): Promise<HomeContent> {
  const response = await api.get<HomeContent>("/api/v1/home-content");
  return response.data;
}

export async function trackAdClick(productId: string, sectionSlug?: string): Promise<void> {
  await api.post("/api/v1/ads/click", {
    product_id: productId,
    section_slug: sectionSlug,
  });
}

export async function listAdminSections(): Promise<DynamicSection[]> {
  return adminProxyRequest<DynamicSection[]>({
    url: "/admin/content/sections",
    method: "GET",
  });
}

export async function createAdminSection(payload: {
  title: string;
  slug: string;
  section_type: "products" | "restaurants" | "mixed";
  is_active: boolean;
  sort_order: number;
}): Promise<DynamicSection> {
  return adminProxyRequest<DynamicSection>({
    url: "/admin/content/sections",
    method: "POST",
    data: payload,
  });
}

export async function updateAdminSection(
  sectionId: string,
  payload: {
    title: string;
    section_type: "products" | "restaurants" | "mixed";
    is_active: boolean;
    sort_order: number;
  }
): Promise<DynamicSection> {
  return adminProxyRequest<DynamicSection>({
    url: `/admin/content/sections/${sectionId}`,
    method: "PUT",
    data: payload,
  });
}

export async function replaceAdminSectionItems(
  sectionId: string,
  payload: SectionItemInput[]
): Promise<DynamicSection> {
  return adminProxyRequest<DynamicSection>({
    url: `/admin/content/sections/${sectionId}/items`,
    method: "PUT",
    data: payload,
  });
}

export async function getAdminAdClickStats(): Promise<AdClickStats> {
  return adminProxyRequest<AdClickStats>({
    url: "/admin/content/ad-click-stats",
    method: "GET",
  });
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  return adminProxyRequest<AdminCategory[]>({
    url: "/admin/content/categories",
    method: "GET",
  });
}

export async function createAdminCategory(payload: {
  name: string;
  slug: string;
  parent_id?: string | null;
  is_active: boolean;
}): Promise<AdminCategory> {
  return adminProxyRequest<AdminCategory>({
    url: "/admin/content/categories",
    method: "POST",
    data: payload,
  });
}

export async function updateAdminCategory(
  categoryId: string,
  payload: { name: string; slug: string; parent_id?: string | null; is_active: boolean }
): Promise<AdminCategory> {
  return adminProxyRequest<AdminCategory>({
    url: `/admin/content/categories/${categoryId}`,
    method: "PUT",
    data: payload,
  });
}
