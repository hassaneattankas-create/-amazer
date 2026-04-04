import { isMobileAppBuild } from "@/lib/mobile-app";

function buildQueryRoute(pathname: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = value?.trim();
    if (normalized) {
      searchParams.set(key, normalized);
    }
  }
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getCategoryRoute(slug: string): string {
  return isMobileAppBuild()
    ? buildQueryRoute("/category", { slug })
    : `/category/${encodeURIComponent(slug)}`;
}

export function getProductRoute(productId: string): string {
  return isMobileAppBuild()
    ? buildQueryRoute("/product", { id: productId })
    : `/product/${encodeURIComponent(productId)}`;
}

export function getShopRoute(vendorId: string): string {
  return isMobileAppBuild()
    ? buildQueryRoute("/shop", { vendorId })
    : `/shop/${encodeURIComponent(vendorId)}`;
}

export function getOrderPayRoute(orderId: string): string {
  return isMobileAppBuild()
    ? buildQueryRoute("/order/pay", { id: orderId })
    : `/order/pay/${encodeURIComponent(orderId)}`;
}

export function getOrderSuccessRoute(orderId: string): string {
  return isMobileAppBuild()
    ? buildQueryRoute("/order/success", { id: orderId })
    : `/order/success/${encodeURIComponent(orderId)}`;
}

export function getOrderReceiptRoute(orderId: string, token?: string | null): string {
  return isMobileAppBuild()
    ? buildQueryRoute("/order/receipt", { id: orderId, token })
    : buildQueryRoute(`/order/receipt/${encodeURIComponent(orderId)}`, { token });
}
