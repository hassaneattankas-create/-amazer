import type { PromotionItem, VendorStorefront } from "@/types/catalog";
import type { HomeContent, HomeContentSection } from "@/types/content";
import type { ProductSearchItem, ProductSearchResult } from "@/types/product";
import type { RestaurantStorefront } from "@/types/restaurant";

const ALLOWED_SHOP_NAMES = new Set(["amazer", "fragrance"]);
const ALLOWED_RESTAURANT_NAMES = new Set(["le sahel rooftop"]);
const ALLOWED_HOME_PRODUCT_BRANDS = new Set(["amazer market", "fragrance"]);

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function storefrontName(store: Pick<VendorStorefront, "business_name" | "name">): string {
  return normalize(store.business_name || store.name);
}

export function isAllowedPublicShopStore(store: Pick<VendorStorefront, "business_name" | "name">): boolean {
  return ALLOWED_SHOP_NAMES.has(storefrontName(store));
}

export function isAllowedPublicRestaurantStore(
  store: Pick<VendorStorefront, "business_name" | "name"> | Pick<RestaurantStorefront, "business_name" | "name">
): boolean {
  return ALLOWED_RESTAURANT_NAMES.has(normalize(store.business_name || store.name));
}

export function filterPublicStorefronts(items: VendorStorefront[]): VendorStorefront[] {
  return items.filter((item) => {
    const activityType = normalize(item.activity_type);
    if (activityType === "shop") {
      return isAllowedPublicShopStore(item);
    }
    if (activityType === "restaurant") {
      return isAllowedPublicRestaurantStore(item);
    }
    return false;
  });
}

export function isAllowedPublicProduct(item: Pick<ProductSearchItem, "best_offer">): boolean {
  return ALLOWED_SHOP_NAMES.has(normalize(item.best_offer.vendor.name));
}

export function filterPublicProductSearchResult(result: ProductSearchResult): ProductSearchResult {
  const items = result.items.filter(isAllowedPublicProduct);
  return {
    items,
    meta: {
      ...result.meta,
      returned: items.length,
    },
  };
}

export function filterPublicPromotions(items: PromotionItem[]): PromotionItem[] {
  return items.filter((item) => ALLOWED_SHOP_NAMES.has(normalize(item.vendor.name)));
}

function filterHomeSection(section: HomeContentSection): HomeContentSection | null {
  const products = section.products.filter((item) => ALLOWED_HOME_PRODUCT_BRANDS.has(normalize(item.brand)));
  const restaurants = section.restaurants.filter((item) =>
    ALLOWED_RESTAURANT_NAMES.has(normalize(item.name))
  );

  if (!products.length && !restaurants.length) {
    return null;
  }

  return {
    ...section,
    products,
    restaurants,
  };
}

export function filterPublicHomeContent(content: HomeContent): HomeContent {
  return {
    ...content,
    sections: content.sections
      .map(filterHomeSection)
      .filter((section): section is HomeContentSection => section !== null),
  };
}

export function filterPublicRestaurantStorefronts(items: RestaurantStorefront[]): RestaurantStorefront[] {
  return items.filter((item) => isAllowedPublicRestaurantStore(item));
}
