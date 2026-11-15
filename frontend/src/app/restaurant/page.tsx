import { RestaurantClient } from "@/components/listing/RestaurantClient";
import { prefetchStorefronts } from "@/lib/server-prefetch";

/** La liste arrive avec la page (régénérée au plus chaque minute) : photos visibles plus vite. */
export default async function Page() {
  return <RestaurantClient initial={await prefetchStorefronts({ activityType: "restaurant" })} />;
}
