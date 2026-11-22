import type { Metadata } from "next";

import { TransportSearch } from "@/components/transport/TransportSearch";

export const metadata: Metadata = {
  title: "Billets de bus au Niger : comparer les compagnies et réserver | AMAZER",
  description:
    "Niamey, Maradi, Zinder, Agadez, Diffa… Comparez les prix, les heures de départ et les places restantes de toutes les compagnies, puis réservez votre billet à QR code.",
  alternates: { canonical: "/transport" },
};

export default function TransportPage() {
  return <TransportSearch />;
}
