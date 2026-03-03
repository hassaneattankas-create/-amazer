import { CartItem, OptimizeCartResult, OptimizedPlanItem } from "@/types/cart";
import { Offer } from "@/types/product";

export const DEFAULT_SHIPPING_COST = 1500;
const DEFAULT_COMMISSION_RATE = 0.05;
const DEFAULT_SERVICE_FEE = 200;

type PricingConfig = {
  commissionRate?: number;
  serviceFee?: number;
  defaultShippingFee?: number;
};

function getShippingCost(offer: Offer, fallback: number): number {
  return offer.shipping_cost ?? fallback;
}

function pickCheapestValidOffer(offers: Offer[], quantity: number): Offer | null {
  const valid = offers.filter((offer) => offer.stock_quantity >= quantity);
  if (!valid.length) {
    return null;
  }
  return valid.reduce((best, current) => (current.amount < best.amount ? current : best));
}

function formatPlanItem(item: CartItem, offer: Offer): OptimizedPlanItem {
  return {
    productId: item.productId,
    productName: item.name,
    vendorId: offer.vendor.id,
    vendorName: offer.vendor.name,
    quantity: item.quantity,
    unitPrice: offer.amount,
    subtotal: offer.amount * item.quantity,
    currency: offer.currency,
  };
}

export function optimizeCart(items: CartItem[], pricingConfig?: PricingConfig): OptimizeCartResult {
  const commissionRate = pricingConfig?.commissionRate ?? DEFAULT_COMMISSION_RATE;
  const serviceFee = pricingConfig?.serviceFee ?? DEFAULT_SERVICE_FEE;
  const defaultShippingFee = pricingConfig?.defaultShippingFee ?? DEFAULT_SHIPPING_COST;
  const splitPlan: OptimizedPlanItem[] = [];
  const splitVendors = new Map<string, number>();

  for (const item of items) {
    const cheapest = pickCheapestValidOffer(item.offersSnapshot, item.quantity);
    if (!cheapest) {
      return {
        splitTotal: 0,
        bestSingleVendorTotal: null,
        savings: 0,
        commissionFee: 0,
        serviceFee: 0,
        shippingFee: 0,
        subtotal: 0,
        optimizedPlan: [],
        isSplitBetter: false,
        status: "unavailable_item",
        errorMessage: `Le produit "${item.name}" n'est pas disponible en quantite suffisante.`,
      };
    }
    splitPlan.push(formatPlanItem(item, cheapest));
    if (!splitVendors.has(cheapest.vendor.id)) {
      splitVendors.set(cheapest.vendor.id, getShippingCost(cheapest, defaultShippingFee));
    }
  }

  const subtotal = splitPlan.reduce((sum, line) => sum + line.subtotal, 0);
  const splitShippingTotal = Array.from(splitVendors.values()).reduce(
    (sum, shipping) => sum + shipping,
    0
  );
  const commissionFee = subtotal * commissionRate;
  const serviceFeeTotal = splitPlan.length > 0 ? serviceFee : 0;
  const splitTotal = subtotal + splitShippingTotal + commissionFee + serviceFeeTotal;

  const vendorIds = Array.from(
    new Set(
      items.flatMap((item) =>
        item.offersSnapshot
          .filter((offer) => offer.stock_quantity >= item.quantity)
          .map((offer) => offer.vendor.id)
      )
    )
  );

  let bestSingleVendorTotal: number | null = null;

  for (const vendorId of vendorIds) {
    let vendorSubtotal = 0;
    let vendorShipping = defaultShippingFee;
    let allCovered = true;

    for (const item of items) {
      const offer = item.offersSnapshot.find(
        (entry) => entry.vendor.id === vendorId && entry.stock_quantity >= item.quantity
      );
      if (!offer) {
        allCovered = false;
        break;
      }
      vendorSubtotal += offer.amount * item.quantity;
      vendorShipping = getShippingCost(offer, defaultShippingFee);
    }

    if (!allCovered) {
      continue;
    }

    const vendorCommission = vendorSubtotal * commissionRate;
    const vendorServiceFee = serviceFee;
    const vendorTotal = vendorSubtotal + vendorShipping + vendorCommission + vendorServiceFee;
    if (bestSingleVendorTotal === null || vendorTotal < bestSingleVendorTotal) {
      bestSingleVendorTotal = vendorTotal;
    }
  }

  const rawSavings = bestSingleVendorTotal === null ? 0 : bestSingleVendorTotal - splitTotal;
  const savings = rawSavings > 0 ? rawSavings : 0;

  return {
    splitTotal,
    bestSingleVendorTotal,
    savings,
    commissionFee,
    serviceFee: serviceFeeTotal,
    shippingFee: splitShippingTotal,
    subtotal,
    optimizedPlan: splitPlan,
    isSplitBetter: savings > 0,
    status: "ok",
  };
}
