export enum UploadStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface Upload {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: UploadStatus;
  uploaded_at: string;
  processed_at?: string;
  total_chunks?: number;
  error_message?: string;
}

export interface UploadListItem {
  id: string;
  filename: string;
  status: UploadStatus;
  uploaded_at: string;
}

export interface StatusResponse {
  status: UploadStatus;
  progress?: number;
}
