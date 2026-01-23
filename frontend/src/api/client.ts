import axios from "axios";
import type { Upload, UploadListItem, StatusResponse } from "../types";

const API_BASE_URL = "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const uploadFile = async (file: File): Promise<UploadListItem> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const getUploads = async (
  skip = 0,
  limit = 50,
  status?: string
): Promise<UploadListItem[]> => {
  const params: { skip: number; limit: number; status?: string } = { skip, limit };
  if (status) params.status = status;

  const response = await api.get("/uploads", { params });
  return response.data;
};

export const getUpload = async (uploadId: string): Promise<Upload> => {
  const response = await api.get(`/uploads/${uploadId}`);
  return response.data;
};

export const getUploadStatus = async (
  uploadId: string
): Promise<StatusResponse> => {
  const response = await api.get(`/uploads/${uploadId}/status`);
  return response.data;
};

export const getUploadResult = async (uploadId: string): Promise<unknown> => {
  const response = await api.get(`/uploads/${uploadId}/result`);
  return response.data;
};

export const downloadMarkdown = (uploadId: string): string => {
  return `${API_BASE_URL}/uploads/${uploadId}/export/markdown`;
};

export const downloadJSON = (uploadId: string): string => {
  return `${API_BASE_URL}/uploads/${uploadId}/export/json`;
};

export const getFileUrl = (uploadId: string): string => {
  return `${API_BASE_URL}/uploads/${uploadId}/file`;
};

export const retryUpload = async (uploadId: string): Promise<Upload> => {
  const response = await api.post(`/uploads/${uploadId}/retry`);
  return response.data.upload;
};
