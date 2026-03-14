import { api } from "@/lib/api";

export type MediaUploadResponse = {
  filename: string;
  url: string;
  content_type: string;
  size_bytes: number;
};

export async function uploadMedia(file: File): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<MediaUploadResponse>("/api/v1/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}
