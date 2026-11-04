"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Clock3, CreditCard, Flag, LayoutGrid, Store, Truck, Users } from "lucide-react";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { getFuelDashboard, getFuelPlan, listMyOutlets, listRegionManagers } from "@/services/local-services-service";

import { CityManagersSection } from "./CityManagersSection";
import { cityOptions } from "./CitySelect";
import { OwnerActivity, OwnerDeliveries, OwnerReports, ownerReportsQuery } from "./OwnerFeeds";
import { OwnerOverview, OwnerSummaryStrip } from "./OwnerOverview";
import { StationsByCity } from "./StationsByCity";
import { SubscriptionSection } from "./SubscriptionSection";

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

export type OwnerStationSpaceProps = {
  /** Blocs génériques du vendeur (parrainage, statistiques, avis, aide), rangés dans la dernière section repliée. */
  vitrine: ReactNode;
};

/**
 * Espace du propriétaire d'une marque de stations : un bandeau de 4 chiffres, puis des sections
 * repliables (une seule ouverte à la fois, comme le menu). Il voit tout ce que font responsables et gérants.
 */
export function OwnerStationSpace({ vitrine }: OwnerStationSpaceProps) {
  const outlets = useQuery({ queryKey: ["fuel-outlets"], queryFn: listMyOutlets });
  const dashboard = useQuery({ queryKey: ["fuel-dashboard"], queryFn: getFuelDashboard, refetchOnWindowFocus: true });
  const reports = useQuery(ownerReportsQuery);
  const managers = useQuery({ queryKey: ["fuel-region-managers"], queryFn: listRegionManagers });
  const plan = useQuery({ queryKey: ["fuel-plan"], queryFn: getFuelPlan });

  const openReports = reports.data?.filter((r) => !r.resolved_at).length;
  const cities = cityOptions(
    (outlets.data ?? []).map((o) => o.city),
    (managers.data ?? []).map((m) => m.city),
  );
  const toConfirm = dashboard.data?.to_confirm ?? 0;
  const managedCities = new Set((managers.data ?? []).map((m) => m.city.toLocaleLowerCase("fr"))).size;

  return (
    <div className="space-y-3">
      <OwnerSummaryStrip
        dashboard={dashboard.data}
        openReports={openReports}
        dashboardError={dashboard.isError}
        reportsError={reports.isError}
        onRetry={() => {
          if (dashboard.isError) void dashboard.refetch();
          if (reports.isError) void reports.refetch();
        }}
      />
      <Accordion single defaultOpen="overview">
        <AccordionItem
          id="overview"
          headingLevel={2}
          icon={<LayoutGrid className="h-5 w-5" />}
          title="Vue d'ensemble"
          meta={toConfirm ? `${toConfirm} à renseigner` : undefined}
          tone="warning"
        >
          <OwnerOverview
            dashboard={dashboard.data}
            isLoading={dashboard.isPending}
            isError={dashboard.isError}
            onRetry={() => void dashboard.refetch()}
          />
        </AccordionItem>
        <AccordionItem
          id="city-managers"
          headingLevel={2}
          icon={<Users className="h-5 w-5" />}
          title="Responsables par ville"
          meta={managers.data ? (managedCities ? plural(managedCities, "ville") : "Aucun") : undefined}
          tone={managers.data && !managedCities ? "warning" : "default"}
        >
          <CityManagersSection cities={cities} />
        </AccordionItem>
        <AccordionItem
          id="stations"
          headingLevel={2}
          icon={<Building2 className="h-5 w-5" />}
          title="Stations par ville"
          meta={outlets.data ? plural(outlets.data.length, "station") : undefined}
        >
          <StationsByCity
            outlets={outlets.data}
            isLoading={outlets.isPending}
            isError={outlets.isError}
            onRetry={() => void outlets.refetch()}
            cityChoices={cities}
          />
        </AccordionItem>
        <AccordionItem id="activity" headingLevel={2} icon={<Clock3 className="h-5 w-5" />} title="Activité">
          <OwnerActivity />
        </AccordionItem>
        <AccordionItem
          id="reports"
          headingLevel={2}
          icon={<Flag className="h-5 w-5" />}
          title="Retours clients"
          meta={openReports ? `${openReports} à traiter` : undefined}
          tone="warning"
        >
          <OwnerReports />
        </AccordionItem>
        <AccordionItem
          id="deliveries"
          headingLevel={2}
          icon={<Truck className="h-5 w-5" />}
          title="Livraisons"
          meta={dashboard.data ? `${dashboard.data.deliveries_30d} en 30 j` : undefined}
        >
          <OwnerDeliveries />
        </AccordionItem>
        <AccordionItem
          id="subscription"
          headingLevel={2}
          icon={<CreditCard className="h-5 w-5" />}
          title="Abonnement et export"
          meta={plan.data ? `Palier ${plan.data.name}` : undefined}
        >
          <SubscriptionSection />
        </AccordionItem>
        <AccordionItem id="vitrine" headingLevel={2} icon={<Store className="h-5 w-5" />} title="Vitrine, avis et parrainage">
          <div className="space-y-4">{vitrine}</div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
