import { api } from "@/lib/api";
import type {
  FuelChange,
  FuelDashboard,
  FuelPlan,
  FuelManager,
  FuelKey,
  FuelNetwork,
  FuelOutlet,
  FuelStatus,
  FuelOutletInput,
  FuelOutletUpdate,
  LocalServiceList,
  ManagedOutlet,
  RegionManager,
  ServiceStatus,
  ServiceStatusUpdate,
  StationReport,
  StationReportKind,
} from "@/types/local-services";

export async function listPharmacies(params: { city?: string; onDuty?: boolean }): Promise<LocalServiceList> {
  const response = await api.get<LocalServiceList>("/api/v1/services/pharmacies", {
    params: { ...(params.city ? { city: params.city } : {}), ...(params.onDuty ? { on_duty: true } : {}) },
  });
  return response.data;
}

export async function listStations(params: { city?: string; fuel?: FuelKey; available?: boolean }): Promise<LocalServiceList> {
  const response = await api.get<LocalServiceList>("/api/v1/services/stations", {
    params: {
      ...(params.city ? { city: params.city } : {}),
      ...(params.fuel ? { fuel: params.fuel } : {}),
      ...(params.available ? { available: true } : {}),
    },
  });
  return response.data;
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  const response = await api.get<ServiceStatus>("/api/v1/seller/service-status");
  return response.data;
}

export async function updateServiceStatus(payload: ServiceStatusUpdate): Promise<ServiceStatus> {
  const response = await api.put<ServiceStatus>("/api/v1/seller/service-status", payload);
  return response.data;
}

export async function listMyOutlets(): Promise<FuelOutlet[]> {
  return (await api.get<FuelOutlet[]>("/api/v1/seller/fuel-outlets")).data;
}

export async function createOutlet(payload: FuelOutletInput): Promise<FuelOutlet> {
  return (await api.post<FuelOutlet>("/api/v1/seller/fuel-outlets", payload)).data;
}

export async function updateOutlet(id: string, payload: FuelOutletUpdate): Promise<FuelOutlet> {
  return (await api.put<FuelOutlet>(`/api/v1/seller/fuel-outlets/${id}`, payload)).data;
}

export async function deleteOutlet(id: string): Promise<void> {
  await api.delete(`/api/v1/seller/fuel-outlets/${id}`);
}

export async function getFuelNetwork(): Promise<FuelNetwork> {
  return (await api.get<FuelNetwork>("/api/v1/seller/fuel-network")).data;
}

export async function bulkUpdateOutlets(payload: { fuel?: FuelStatus; confirm?: boolean; city?: string }): Promise<FuelOutlet[]> {
  return (await api.put<FuelOutlet[]>("/api/v1/seller/fuel-outlets/bulk", payload)).data;
}

export async function listFuelManagers(): Promise<FuelManager[]> {
  return (await api.get<FuelManager[]>("/api/v1/seller/fuel-managers")).data;
}

export async function addFuelManager(payload: { outlet_id: string; email: string }): Promise<FuelManager[]> {
  return (await api.post<FuelManager[]>("/api/v1/seller/fuel-managers", payload)).data;
}

export async function removeFuelManager(id: string): Promise<void> {
  await api.delete(`/api/v1/seller/fuel-managers/${id}`);
}

/** Stations confiées au compte connecté (gérant). */
export async function listManagedOutlets(): Promise<ManagedOutlet[]> {
  return (await api.get<ManagedOutlet[]>("/api/v1/station-manager/outlets")).data;
}

export async function updateManagedOutlet(id: string, payload: { fuel?: FuelStatus; confirm?: boolean }): Promise<ManagedOutlet> {
  return (await api.put<ManagedOutlet>(`/api/v1/station-manager/outlets/${id}`, payload)).data;
}

export async function getFuelPlan(): Promise<FuelPlan> {
  return (await api.get<FuelPlan>("/api/v1/seller/fuel-plan")).data;
}

export async function getFuelDashboard(): Promise<FuelDashboard> {
  return (await api.get<FuelDashboard>("/api/v1/seller/fuel-dashboard")).data;
}

export async function listRegionManagers(): Promise<RegionManager[]> {
  return (await api.get<RegionManager[]>("/api/v1/seller/fuel-region-managers")).data;
}

export async function addRegionManager(payload: { city: string; email: string }): Promise<RegionManager[]> {
  return (await api.post<RegionManager[]>("/api/v1/seller/fuel-region-managers", payload)).data;
}

export async function removeRegionManager(id: string): Promise<void> {
  await api.delete(`/api/v1/seller/fuel-region-managers/${id}`);
}

/** Export Excel (CSV « ; ») : historique des disponibilités ou statistiques par jour, sur 12 mois. */
export async function downloadFuelExport(kind: "history" | "stats"): Promise<Blob> {
  return (await api.get<Blob>("/api/v1/seller/fuel-export", { params: { kind }, responseType: "blob" })).data;
}

export async function listMyFuelHistory(): Promise<FuelChange[]> {
  return (await api.get<FuelChange[]>("/api/v1/seller/fuel-history")).data;
}

export async function listMyStationReports(): Promise<StationReport[]> {
  return (await api.get<StationReport[]>("/api/v1/seller/station-reports")).data;
}

export async function reportStation(payload: { vendor_id: string; outlet_id: string | null; kind: StationReportKind; comment: string | null }): Promise<void> {
  await api.post("/api/v1/services/report", payload);
}

/** Statistiques de la station (appel, itinéraire, commande de gaz). Ne bloque jamais l'action du client. */
export function recordOutletEvent(outletId: string, kind: "call" | "route" | "gas"): void {
  void api.post(`/api/v1/services/outlets/${outletId}/event`, { kind }).catch(() => undefined);
}
