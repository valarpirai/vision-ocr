export const UploadStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

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

// RAG / Search types

export interface ConversationListItem {
  id: string;
  title: string | null;
  updated_at: string;
  message_count: number;
}

export interface MessageSource {
  upload_id: string;
  filename: string;
  page_number: number;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: MessageSource[];
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  created_at: string;
  messages: Message[];
}

export interface AskRequest {
  question: string;
  upload_ids?: string[];
}

export interface AskResponse {
  answer: string;
  sources: MessageSource[];
  message_id: number;
}
