"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Fuel } from "lucide-react";

import { ManagedStationsSection } from "@/components/stations/space/ManagedStationsSection";
import { RegionCitiesSection } from "@/components/stations/space/RegionCitiesSection";
import { SpaceEmpty, SpaceLoadError, SpaceLoggedOut, SpaceSkeleton } from "@/components/stations/space/SpaceStates";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listManagedOutlets } from "@/services/local-services-service";
import { listRegionCities, stationKeys } from "@/services/station-space-service";

/**
 * Espace station (route gardée pour les notifications et liens existants) :
 * « Mes villes » pour le responsable de ville, « Mes stations » pour le gérant.
 */
export default function StationSpacePage() {
  // isLoading (et non isPending) : pour un visiteur non connecté la requête est désactivée, jamais « en cours ».
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const userId = user?.id ?? "";
  const loggedIn = Boolean(userId);
  // Chargées en parallèle ; l'id du compte dans la clé évite d'afficher les stations d'un autre compte sur le même appareil.
  const cities = useQuery({
    queryKey: [...stationKeys.regionCities, userId],
    queryFn: listRegionCities,
    enabled: loggedIn,
    refetchOnWindowFocus: true,
  });
  const outlets = useQuery({
    queryKey: [...stationKeys.managedOutlets, userId],
    queryFn: listManagedOutlets,
    enabled: loggedIn,
    refetchOnWindowFocus: true,
  });

  // Les stations atteintes via une ville sont déjà sous « Mes villes » : ici, seulement celles confiées en direct.
  const managed = useMemo(() => {
    const viaCity = new Set((cities.data ?? []).flatMap((city) => city.stations.map((station) => station.id)));
    return (outlets.data ?? []).filter((outlet) => outlet.role === "manager" && !viaCity.has(outlet.id));
  }, [cities.data, outlets.data]);

  const cityList = cities.data ?? [];
  const citiesError = cities.isError ? (
    <SpaceLoadError text="Vos villes n'ont pas pu être chargées." onRetry={() => void cities.refetch()} />
  ) : null;
  const outletsError = outlets.isError ? (
    <SpaceLoadError text="Vos stations n'ont pas pu être chargées." onRetry={() => void outlets.refetch()} />
  ) : null;

  let body: ReactNode;
  if (userLoading) body = <SpaceSkeleton />;
  else if (!loggedIn) body = <SpaceLoggedOut />;
  else if (cities.isPending || outlets.isPending) body = <SpaceSkeleton />;
  else if (cities.isError && outlets.isError) {
    body = (
      <SpaceLoadError
        text="Espace station indisponible pour le moment. Vérifiez votre connexion."
        onRetry={() => {
          void cities.refetch();
          void outlets.refetch();
        }}
      />
    );
  } else if (cityList.length === 0 && managed.length === 0) {
    // Une des deux listes a échoué : on ne conclut pas « rien de confié ».
    body = citiesError ?? outletsError ?? <SpaceEmpty email={user?.email} />;
  } else {
    body = (
      <>
        {cityList.length > 0 ? <RegionCitiesSection cities={cityList} /> : citiesError}
        {managed.length > 0 ? <ManagedStationsSection outlets={managed} /> : outletsError}
      </>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-gutter pb-14 pt-4">
      <header>
        <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-display text-ink-900">
          <Fuel className="h-7 w-7 text-brand-600" aria-hidden="true" />
          Espace station
        </h1>
        <p className="mt-1 text-sm text-ink-600">Ce que vous changez ici, les clients le voient tout de suite.</p>
      </header>
      {body}
    </section>
  );
}
