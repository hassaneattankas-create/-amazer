import { Offer } from "@/types/product";

export type CartItem = {
  productId: string;
  name: string;
  quantity: number;
  offersSnapshot: Offer[];
};

export type OptimizedPlanItem = {
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  currency: string;
};

export type OptimizeCartResult = {
  splitTotal: number;
  bestSingleVendorTotal: number | null;
  savings: number;
  commissionFee: number;
  serviceFee: number;
  shippingFee: number;
  subtotal: number;
  optimizedPlan: OptimizedPlanItem[];
  isSplitBetter: boolean;
  status: "ok" | "unavailable_item";
  errorMessage?: string;
};

export type SavingsHistoryRecord = {
  id: string;
  createdAt: string;
  savings: number;
};
