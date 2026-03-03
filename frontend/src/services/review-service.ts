import { api } from "@/lib/api";
import { CreateReviewPayload, Review } from "@/types/review";

export async function listReviews(productId: string): Promise<Review[]> {
  const response = await api.get<Review[]>(`/api/v1/products/${productId}/reviews`);
  return response.data;
}

export async function createReview(productId: string, payload: CreateReviewPayload): Promise<Review> {
  const response = await api.post<Review>(`/api/v1/products/${productId}/reviews`, payload);
  return response.data;
}
