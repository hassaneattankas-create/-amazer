import { api } from "@/lib/api";

type CartItemResponse = {
  id: string;
  product_id: string;
  quantity: number;
};

export type CartResponse = {
  id: string;
  user_id: string;
  items: CartItemResponse[];
};

export async function fetchCart(): Promise<CartResponse> {
  const response = await api.get<CartResponse>("/api/v1/cart");
  return response.data;
}

export async function addCartItem(productId: string, quantity: number): Promise<CartResponse> {
  const response = await api.post<CartResponse>("/api/v1/cart/items", {
    product_id: productId,
    quantity,
  });
  return response.data;
}

export async function updateCartItem(itemId: string, quantity: number): Promise<CartResponse> {
  const response = await api.patch<CartResponse>(`/api/v1/cart/items/${itemId}`, { quantity });
  return response.data;
}

export async function clearServerCart(): Promise<CartResponse> {
  const response = await api.delete<CartResponse>("/api/v1/cart");
  return response.data;
}
