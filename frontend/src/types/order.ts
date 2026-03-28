export type OrderItem = {
  id: string;
  product_id: string;
  vendor_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type Order = {
  id: string;
  status: "payment_pending" | "commande" | "preparation" | "livraison" | "recu" | "CLAIMED";
  payment_mode: "nita" | "amana";
  delivery_type: "standard" | "express_niamey";
  payment_reference: string | null;
  payment_status: "pending" | "paid";
  payment_confirmed_at: string | null;
  transaction_code: string | null;
  tracking_code: string | null;
  estimated_minutes: number;
  total_amount: number;
  currency: string;
  created_at: string;
  items: OrderItem[];
};

export type CheckoutPayload = {
  items: Array<{
    product_id: string;
    vendor_id: string;
    quantity: number;
    unit_price: number;
  }>;
  payment_mode: "nita" | "amana";
  delivery_type: "standard" | "express_niamey";
  transaction_code?: string;
  currency?: string;
};

export type ReceiptLink = {
  order_id: string;
  token: string;
  receipt_url: string;
  verify_url: string;
};

export type ReceiptItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type Receipt = {
  order_id: string;
  customer_name: string;
  payment_mode: "nita" | "amana";
  payment_reference: string | null;
  payment_status: "pending" | "paid";
  currency: string;
  total_amount: number;
  transaction_code_masked: string | null;
  created_at: string;
  issued_at: string;
  items: ReceiptItem[];
  integrity_hash: string;
  verify_url: string;
  payment_url: string;
  platform_wallet_phone: string | null;
};

export type ReceiptVerifyPayload = {
  token: string;
  vendor_id?: string;
  gps?: string;
};

export type ReceiptVerifyResult = {
  order_id: string;
  status: "claimed" | "blocked";
  message: string;
  scanned_at: string | null;
};

export type PaymentIntent = {
  order_id: string;
  payment_mode: "nita" | "amana";
  payment_reference: string;
  amount: number;
  currency: string;
  payment_url: string;
  qr_payload: string;
  expires_in_seconds: number;
};

export type PaymentConfirmPayload = {
  provider_reference?: string;
  code_last4?: string;
};

export type PaymentConfirmResult = {
  order_id: string;
  payment_status: "pending" | "paid";
  order_status: Order["status"];
  message: string;
};
