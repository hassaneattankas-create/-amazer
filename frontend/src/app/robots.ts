import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

/** Pages publiques ouvertes aux moteurs de recherche ; espaces privés exclus. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seller", "/dashboard", "/cart", "/order", "/profile", "/messages", "/notifications", "/livreur", "/gerant-station", "/api/", "/restaurant/order"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
