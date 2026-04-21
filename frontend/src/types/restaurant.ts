export type RestaurantMenuOption = {
  name: string;
  price: number;
};

export type RestaurantMenuItem = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  currency: string;
  tags: string[];
  options: RestaurantMenuOption[];
  estimated_prep_minutes: number;
  is_available: boolean;
};

export type RestaurantOrderRequest = {
  vendor_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  payment_mode: "nita" | "amana";
  items: Array<{
    menu_item_id: string;
    quantity: number;
    selected_options: RestaurantMenuOption[];
    customer_note?: string;
  }>;
};

export type RestaurantOrder = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  distance_km: number;
  delivery_fee: number;
  delivery_minutes: number;
  payment_mode: "nita" | "amana";
  payment_reference: string | null;
  payment_status: "pending" | "paid";
  status: "payment_pending" | "commande" | "preparation" | "livraison" | "recu";
  total_amount: number;
  items_subtotal?: number;
  platform_commission?: number;
  platform_service_fee?: number;
  currency: string;
  created_at: string;
  items: Array<{
    id: string;
    menu_item_id: string;
    dish_name: string;
    quantity: number;
    selected_options: RestaurantMenuOption[];
    customer_note: string | null;
    unit_price: number;
    subtotal: number;
  }>;
};

export type RestaurantStorefront = {
  id: string;
  name: string;
  slug: string;
  business_name: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  is_verified: boolean;
  menu_item_count: number;
  plat_du_jour_count: number;
  cover_image_url: string | null;
};

export type RestaurantReservationRequest = {
  vendor_id: string;
  customer_name: string;
  customer_phone: string;
  reservation_at: string;
  guest_count: number;
  note?: string;
};

export type RestaurantReservation = {
  id: string;
  vendor_id: string;
  customer_name: string;
  customer_phone: string;
  reservation_at: string;
  guest_count: number;
  note: string | null;
  status: "pending" | "confirmed" | "declined";
  created_at: string;
};
