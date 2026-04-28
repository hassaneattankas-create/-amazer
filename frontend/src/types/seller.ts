import type { RestaurantMenuItem } from "@/types/restaurant";

export type SellerActivityType = "shop" | "restaurant" | "hotel" | "enterprise";
export type StorefrontTier = "basic" | "premium";

export type SellerServiceOffering = {
  title: string;
  description: string | null;
  display_mode: "consult_only" | "book_only" | "shop";
};

export type HotelRoomType = {
  id?: string | null;
  name: string;
  description: string | null;
  night_price: number;
  capacity: number;
  amenities: string[];
  photo_urls: string[];
  deposit_amount: number | null;
};

export type SellerProfile = {
  id: string;
  user_id: string;
  vendor_id: string;
  business_name: string;
  phone: string | null;
  city: string;
  address: string | null;
  activity_type: SellerActivityType;
  storefront_tier: StorefrontTier;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  opening_hours: string | null;
  whatsapp_contact: string | null;
  contact_email: string | null;
  gallery_images: string[];
  service_offerings: SellerServiceOffering[];
  room_types: HotelRoomType[];
  deposit_payment_method: "nita" | "amana" | null;
  deposit_amount: number | null;
  commission_rate_override: number | null;
  service_fee_override: number | null;
  seller_subscription_fee_override: number | null;
  onboarding_fee_paid_at: string | null;
  subscription_paid_until: string | null;
  subscription_last_payment_reference: string | null;
  effective_commission_rate: number;
  effective_service_fee: number;
  effective_seller_subscription_fee: number;
  accepts_table_reservations: boolean;
  accepts_hotel_bookings: boolean;
  is_verified: boolean;
  created_at: string;
};

export type SellerSubscriptionStatus = {
  has_seller_profile: boolean;
  onboarding_fee_paid: boolean;
  onboarding_fee_paid_at: string | null;
  subscription_paid_until: string | null;
  subscription_active: boolean;
  monthly_fee: number;
  onboarding_fee: number;
  amount_due_now: number;
  currency: "XOF";
  has_pending_payment_request: boolean;
};

export type SellerSubscriptionPaymentRequest = {
  id: string;
  seller_profile_id: string;
  seller_user_id: string;
  payment_mode: "nita" | "amana";
  transaction_reference: string;
  months: number;
  amount_claimed: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type SellerProfilePayload = {
  business_name: string;
  phone?: string;
  city: string;
  address?: string;
  activity_type?: SellerActivityType;
  storefront_tier?: StorefrontTier;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  opening_hours?: string;
  whatsapp_contact?: string;
  contact_email?: string;
  gallery_images?: string[];
  service_offerings?: SellerServiceOffering[];
  room_types?: HotelRoomType[];
  deposit_payment_method?: "nita" | "amana";
  deposit_amount?: number;
  accepts_table_reservations?: boolean;
  accepts_hotel_bookings?: boolean;
};

export type SellerProductPayload = {
  name: string;
  brand: string;
  description?: string;
  main_image_url?: string;
  category_id?: string;
  amount: number;
  currency: string;
  stock_quantity: number;
};

export type SellerInventoryItem = {
  price_id: string;
  product_id: string;
  product_name: string;
  brand: string;
  amount: number;
  currency: string;
  stock_quantity: number;
  is_active: boolean;
  is_boosted: boolean;
  promo_price: number | null;
  promo_until: string | null;
  boost_until: string | null;
};

export type SellerShopOrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type SellerShopOrder = {
  id: string;
  customer_name: string;
  status: "payment_pending" | "commande" | "preparation" | "livraison" | "recu" | "CLAIMED";
  payment_mode: "nita" | "amana";
  payment_status: "pending" | "paid";
  delivery_type: "standard" | "express_niamey";
  tracking_code: string | null;
  total_amount: number;
  currency: string;
  created_at: string;
  items: SellerShopOrderItem[];
};

export type SellerShopOrderStatus = "commande" | "preparation" | "livraison" | "recu";

export type SellerStorefrontProduct = {
  price_id: string;
  product_id: string;
  name: string;
  brand: string;
  description?: string | null;
  amount: number;
  currency: string;
  is_boosted: boolean;
  main_image_url: string | null;
};

export type SellerStorefront = {
  vendor_id: string;
  vendor_slug: string;
  business_name: string;
  activity_type: SellerActivityType;
  storefront_tier: StorefrontTier;
  city: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  opening_hours: string | null;
  whatsapp_contact: string | null;
  contact_email: string | null;
  gallery_images: string[];
  service_offerings: SellerServiceOffering[];
  room_types: HotelRoomType[];
  deposit_payment_method: "nita" | "amana" | null;
  deposit_amount: number | null;
  effective_commission_rate: number;
  effective_service_fee: number;
  accepts_table_reservations: boolean;
  accepts_hotel_bookings: boolean;
  is_verified: boolean;
  products: SellerStorefrontProduct[];
  restaurant_menu: RestaurantMenuItem[];
};

export type HotelBookingRequest = {
  vendor_id: string;
  room_type_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  deposit_payment_method: "nita" | "amana";
  transaction_reference?: string;
  special_request?: string;
};

export type HotelBooking = {
  id: string;
  vendor_id: string;
  room_type_id: string;
  room_snapshot: Record<string, unknown>;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  deposit_payment_method: "nita" | "amana";
  deposit_amount: number;
  transaction_reference: string | null;
  special_request: string | null;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
};
