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
  distance_km: number;
  payment_mode: "nita" | "amana" | "cash_on_delivery";
  items: Array<{
    menu_item_id: string;
    quantity: number;
    selected_options: RestaurantMenuOption[];
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
  delivery_minutes: number;
  payment_mode: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  items: Array<{
    id: string;
    menu_item_id: string;
    dish_name: string;
    quantity: number;
    selected_options: RestaurantMenuOption[];
    unit_price: number;
    subtotal: number;
  }>;
};
