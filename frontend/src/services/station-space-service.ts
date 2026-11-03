import type { QueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ManagedOutlet } from "@/types/local-services";
import type {
  ActivityItem,
  DeliveryInput,
  DeliveryItem,
  FuelActivityFilters,
  RegionCity,
  RegionOutletCreate,
  RegionOutletUpdate,
  RegionStation,
  ReportItem,
  ReportResolveInput,
  StationInfoUpdate,
  StationManagerRef,
  StationSpaceMe,
} from "@/types/station-space";

/**
 * Clés TanStack Query de l'espace station. Les racines (premier élément) sont stables :
 * invalidateStationQueries() les invalide toutes pour garder les trois niveaux cohérents.
 */
export const stationKeys = {
  me: ["station-space-me"] as const,
  regionCities: ["station-region-cities"] as const,
  regionActivity: (vendorId: string, city: string) => ["station-region-activity", vendorId, city] as const,
  regionReports: (vendorId: string, city: string) => ["station-region-reports", vendorId, city] as const,
  managedOutlets: ["managed-outlets"] as const,
  outletDeliveries: (outletId: string) => ["outlet-deliveries", outletId] as const,
  outletReports: (outletId: string) => ["outlet-reports", outletId] as const,
  outletActivity: (outletId: string) => ["outlet-activity", outletId] as const,
  fuelActivity: (filters: FuelActivityFilters = {}) => ["fuel-activity", filters] as const,
  fuelDeliveries: (city?: string) => ["fuel-deliveries", city ?? ""] as const,
};

/** Racines invalidées après toute écriture (propriétaire, ville, gérant). Inclut les clés existantes du tableau de bord vendeur. */
const STATION_QUERY_ROOTS = [
  "station-space-me",
  "station-region-cities",
  "station-region-activity",
  "station-region-reports",
  "managed-outlets",
  "outlet-deliveries",
  "outlet-reports",
  "outlet-activity",
  "fuel-activity",
  "fuel-deliveries",
  "fuel-outlets",
  "fuel-network",
  "fuel-plan",
  "fuel-dashboard",
  "fuel-managers",
  "fuel-region-managers",
  "fuel-history",
  "station-reports",
  "service-status",
] as const;

/** À appeler dans onSuccess de chaque mutation de station : rafraîchit toutes les vues des trois niveaux. */
export function invalidateStationQueries(queryClient: QueryClient): Promise<void[]> {
  return Promise.all(STATION_QUERY_ROOTS.map((root) => queryClient.invalidateQueries({ queryKey: [root] })));
}

// ── Tous les comptes connectés ──────────────────────────────────────────────

/** Rôles du compte connecté (lien « Espace station » du menu). */
export async function getStationSpaceMe(): Promise<StationSpaceMe> {
  return (await api.get<StationSpaceMe>("/api/v1/station-space/me")).data;
}

// ── Responsable de ville ────────────────────────────────────────────────────

export async function listRegionCities(): Promise<RegionCity[]> {
  return (await api.get<RegionCity[]>("/api/v1/station-region/cities")).data;
}

export async function createRegionOutlet(payload: RegionOutletCreate): Promise<RegionStation> {
  return (await api.post<RegionStation>("/api/v1/station-region/outlets", payload)).data;
}

export async function updateRegionOutlet(outletId: string, payload: RegionOutletUpdate): Promise<RegionStation> {
  return (await api.put<RegionStation>(`/api/v1/station-region/outlets/${outletId}`, payload)).data;
}

export async function deleteRegionOutlet(outletId: string): Promise<void> {
  await api.delete(`/api/v1/station-region/outlets/${outletId}`);
}

/** Désigne un gérant ; renvoie les gérants de la station. */
export async function addRegionStationManager(payload: { outlet_id: string; email: string }): Promise<StationManagerRef[]> {
  return (await api.post<StationManagerRef[]>("/api/v1/station-region/managers", payload)).data;
}

export async function removeRegionStationManager(managerId: string): Promise<void> {
  await api.delete(`/api/v1/station-region/managers/${managerId}`);
}

export async function listRegionActivity(params: { vendor_id: string; city: string; limit?: number }): Promise<ActivityItem[]> {
  return (await api.get<ActivityItem[]>("/api/v1/station-region/activity", { params })).data;
}

export async function listRegionReports(params: { vendor_id: string; city: string }): Promise<ReportItem[]> {
  return (await api.get<ReportItem[]>("/api/v1/station-region/reports", { params })).data;
}

// ── Station (gérant ; aussi responsable de ville et propriétaire) ──────────

export async function updateManagedOutletInfo(outletId: string, payload: StationInfoUpdate): Promise<ManagedOutlet> {
  return (await api.put<ManagedOutlet>(`/api/v1/station-manager/outlets/${outletId}/info`, payload)).data;
}

export async function listOutletDeliveries(outletId: string): Promise<DeliveryItem[]> {
  return (await api.get<DeliveryItem[]>(`/api/v1/station-manager/outlets/${outletId}/deliveries`)).data;
}

export async function createOutletDelivery(outletId: string, payload: DeliveryInput): Promise<DeliveryItem> {
  return (await api.post<DeliveryItem>(`/api/v1/station-manager/outlets/${outletId}/deliveries`, payload)).data;
}

export async function listOutletReports(outletId: string): Promise<ReportItem[]> {
  return (await api.get<ReportItem[]>(`/api/v1/station-manager/outlets/${outletId}/reports`)).data;
}

/** Marque un retour client comme traité (responsable de ville, gérant). */
export async function resolveStationReport(reportId: string, payload: ReportResolveInput = {}): Promise<ReportItem> {
  return (await api.post<ReportItem>(`/api/v1/station-manager/reports/${reportId}/resolve`, payload)).data;
}

export async function listOutletActivity(outletId: string): Promise<ActivityItem[]> {
  return (await api.get<ActivityItem[]>(`/api/v1/station-manager/outlets/${outletId}/activity`)).data;
}

// ── Propriétaire de la marque (/seller) ─────────────────────────────────────

export async function listFuelActivity(filters: FuelActivityFilters = {}): Promise<ActivityItem[]> {
  return (await api.get<ActivityItem[]>("/api/v1/seller/fuel-activity", { params: filters })).data;
}

export async function listFuelDeliveries(city?: string): Promise<DeliveryItem[]> {
  return (await api.get<DeliveryItem[]>("/api/v1/seller/fuel-deliveries", { params: city ? { city } : {} })).data;
}

/** Marque un retour client comme traité (propriétaire, y compris les retours sans station). */
export async function resolveSellerStationReport(reportId: string, payload: ReportResolveInput = {}): Promise<ReportItem> {
  return (await api.post<ReportItem>(`/api/v1/seller/station-reports/${reportId}/resolve`, payload)).data;
}
