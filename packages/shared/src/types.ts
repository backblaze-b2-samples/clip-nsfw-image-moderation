export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Moderation batches ---

export type BatchStatus = "pending" | "completed";
export type Verdict = "approved" | "quarantine";

export interface BatchImage {
  filename: string;
  key: string;
  source: string | null;
  ingested_at: string | null;
  score: number | null;
  verdict: Verdict | null;
}

export interface BatchSummary {
  id: string;
  name: string;
  threshold: number;
  status: BatchStatus;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  image_count: number;
  approved_count: number;
  quarantined_count: number;
}

export interface BatchDetail extends BatchSummary {
  images: BatchImage[];
}

export interface BatchCreateResult {
  id: string;
  name: string;
  threshold: number;
  image_count: number;
}

export interface BatchRunResult {
  id: string;
  scored: number;
  approved: number;
  quarantined: number;
  threshold: number;
  results_key: string;
  summary_key: string;
}

export interface ModerationStats {
  total_batches: number;
  pending_batches: number;
  images_scored: number;
  approved: number;
  quarantined: number;
}
