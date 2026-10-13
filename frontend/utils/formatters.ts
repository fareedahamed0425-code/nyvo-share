export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatTimeRemaining(expiresAt: number | null): {
  text: string;
  isExpired: boolean;
  secondsLeft: number;
} {
  if (!expiresAt) {
    return { text: "No time limit", isExpired: false, secondsLeft: Infinity };
  }

  const now = Date.now();
  const diff = expiresAt - now;

  if (diff <= 0) {
    return { text: "Expired", isExpired: true, secondsLeft: 0 };
  }

  const secondsTotal = Math.floor(diff / 1000);
  const days = Math.floor(secondsTotal / 86400);
  const hours = Math.floor((secondsTotal % 86400) / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = secondsTotal % 60;

  if (days > 0) {
    return { text: `${days}d ${hours}h ${minutes}m`, isExpired: false, secondsLeft: secondsTotal };
  }
  if (hours > 0) {
    return { text: `${hours}h ${minutes}m ${seconds}s`, isExpired: false, secondsLeft: secondsTotal };
  }
  if (minutes > 0) {
    return { text: `${minutes}m ${seconds}s`, isExpired: false, secondsLeft: secondsTotal };
  }
  return { text: `${seconds}s`, isExpired: false, secondsLeft: secondsTotal };
}

export function getFileCategory(mimeType: string, filename: string): "image" | "video" | "audio" | "pdf" | "code" | "archive" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf" || filename.endsWith(".pdf")) return "pdf";
  
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "java", "cpp", "c", "go", "rs"].includes(ext)) {
    return "code";
  }
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) {
    return "archive";
  }
  return "document";
}

// LocalStorage persistence for user's created uploads in this browser session
const STORAGE_KEY = "tempshare_active_slugs_v1";

export interface LocalUploadRecord {
  slug: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: number;
  expiresAt: number | null;
  deleteToken: string;
}

export function getStoredUploads(): LocalUploadRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addStoredUpload(record: LocalUploadRecord) {
  try {
    const list = getStoredUploads();
    const filtered = list.filter((item) => item.slug !== record.slug);
    filtered.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 30)));
  } catch (err) {
    console.error("Failed to store upload record in localStorage", err);
  }
}

export function removeStoredUpload(slug: string) {
  try {
    const list = getStoredUploads();
    const updated = list.filter((item) => item.slug !== slug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to remove upload record from localStorage", err);
  }
}
