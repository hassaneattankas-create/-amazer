import { api } from "@/lib/api";
import type { FuelKey, FuelNetwork, FuelOutlet, FuelStatus, FuelOutletInput, FuelOutletUpdate, LocalServiceList, ServiceStatus, ServiceStatusUpdate } from "@/types/local-services";

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

/** Statistiques de la station (appel, itinéraire, commande de gaz). Ne bloque jamais l'action du client. */
export function recordOutletEvent(outletId: string, kind: "call" | "route" | "gas"): void {
  void api.post(`/api/v1/services/outlets/${outletId}/event`, { kind }).catch(() => undefined);
}
