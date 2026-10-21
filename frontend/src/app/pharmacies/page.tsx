import type { Metadata } from "next";

import { ServiceDirectory } from "@/components/services/ServiceDirectory";

export const metadata: Metadata = {
  title: "Pharmacies de garde au Niger | AMAZER",
  description: "Pharmacies de garde maintenant à Niamey et partout au Niger : appel, itinéraire Google Maps et livraison AMAZER à Niamey.",
  alternates: { canonical: "/pharmacies" },
};

export default function PharmaciesPage() {
  return <ServiceDirectory kind="pharmacy" />;
}
