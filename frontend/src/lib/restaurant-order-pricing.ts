export type RestaurantOrderSummary = {
  itemsSubtotal: number;
  deliveryFee: number;
  platformCommission: number;
  platformServiceFee: number;
  totalAmount: number;
};

export function computeRestaurantOrderSummary(
  itemsSubtotal: number,
  deliveryFee: number,
  commissionRate: number,
  serviceFee: number
): RestaurantOrderSummary {
  const normalizedSubtotal = Math.max(0, itemsSubtotal);
  const normalizedDeliveryFee = Math.max(0, deliveryFee);
  const normalizedCommissionRate = Math.max(0, commissionRate);
  const normalizedServiceFee = normalizedSubtotal > 0 ? Math.max(0, serviceFee) : 0;
  const platformCommission = normalizedSubtotal * normalizedCommissionRate;
  const totalAmount = normalizedSubtotal + normalizedDeliveryFee + platformCommission + normalizedServiceFee;

  return {
    itemsSubtotal: normalizedSubtotal,
    deliveryFee: normalizedDeliveryFee,
    platformCommission,
    platformServiceFee: normalizedServiceFee,
    totalAmount,
  };
}
