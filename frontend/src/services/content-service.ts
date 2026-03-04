import { api } from "@/lib/api";
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
  const response = await api.get<DynamicSection[]>("/api/v1/admin/content/sections");
  return response.data;
}

export async function createAdminSection(payload: {
  title: string;
  slug: string;
  section_type: "products" | "restaurants" | "mixed";
  is_active: boolean;
  sort_order: number;
}): Promise<DynamicSection> {
  const response = await api.post<DynamicSection>("/api/v1/admin/content/sections", payload);
  return response.data;
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
  const response = await api.put<DynamicSection>(`/api/v1/admin/content/sections/${sectionId}`, payload);
  return response.data;
}

export async function replaceAdminSectionItems(
  sectionId: string,
  payload: SectionItemInput[]
): Promise<DynamicSection> {
  const response = await api.put<DynamicSection>(
    `/api/v1/admin/content/sections/${sectionId}/items`,
    payload
  );
  return response.data;
}

export async function getAdminAdClickStats(): Promise<AdClickStats> {
  const response = await api.get<AdClickStats>("/api/v1/admin/content/ad-click-stats");
  return response.data;
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const response = await api.get<AdminCategory[]>("/api/v1/admin/content/categories");
  return response.data;
}

export async function createAdminCategory(payload: {
  name: string;
  slug: string;
  parent_id?: string | null;
  is_active: boolean;
}): Promise<AdminCategory> {
  const response = await api.post<AdminCategory>("/api/v1/admin/content/categories", payload);
  return response.data;
}

export async function updateAdminCategory(
  categoryId: string,
  payload: { name: string; slug: string; parent_id?: string | null; is_active: boolean }
): Promise<AdminCategory> {
  const response = await api.put<AdminCategory>(`/api/v1/admin/content/categories/${categoryId}`, payload);
  return response.data;
}
