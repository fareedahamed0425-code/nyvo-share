export interface FileMetadata {
  id: string;
  slug: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
  expiresAt: number | null; // null if download-count based only
  maxDownloads: number | null; // null if unlimited until time
  downloadCount: number;
  requiresPassword: boolean;
  isBurnAfterRead: boolean;
  deleteToken?: string;
  storageType?: "supabase" | "local";
  storagePath?: string;
}

export interface UploadOptions {
  customSlug?: string;
  expirationMinutes: number; // e.g. 5, 15, 60, 1440 (24h), 10080 (7d), -1 for burn after read/downloads only
  maxDownloads?: number; // 0 for unlimited, 1, 5, 10
  password?: string;
  burnAfterRead?: boolean;
}

export interface UploadResponse {
  success: boolean;
  slug: string;
  shareUrl: string;
  expiresAt: number | null;
  deleteToken: string;
  message?: string;
}

export interface FileInfoResponse {
  success: boolean;
  metadata?: Omit<FileMetadata, 'deleteToken'>;
  error?: string;
  isExpired?: boolean;
}
