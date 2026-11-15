import { PremiumClient } from "@/components/listing/PremiumClient";
import { prefetchStorefronts } from "@/lib/server-prefetch";

/** La liste arrive avec la page (régénérée au plus chaque minute) : photos visibles plus vite. */
export default async function Page() {
  return <PremiumClient initial={await prefetchStorefronts({ storefrontTier: "premium" })} />;
}
