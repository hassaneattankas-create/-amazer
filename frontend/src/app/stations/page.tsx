import type { Metadata } from "next";

import { ServiceDirectory } from "@/components/services/ServiceDirectory";

export const metadata: Metadata = {
  title: "Stations-essence : où trouver du carburant au Niger | AMAZER",
  description: "Super, gasoil et gaz disponibles maintenant dans les stations de Niamey et du Niger, mis à jour par les stations.",
  alternates: { canonical: "/stations" },
};

export default function StationsPage() {
  return <ServiceDirectory kind="fuel_station" />;
}
