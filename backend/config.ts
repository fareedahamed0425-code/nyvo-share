import path from "path";
import dotenv from "dotenv";

// Securely load environment variables for backend ONLY
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  appUrl: process.env.APP_URL || "",

  // Supabase Cloud Storage (Kept strictly on server side)
  supabase: {
    url:
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://jofcylritxybpwievaqe.supabase.co",
    key:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "sb_publishable_HFSnuv_oiEmiO4Sodkt-Pw_3LJtgRj3",
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "nyvo-share-files",
  },

  // File Retention Policy
  retention: {
    defaultExpirationMinutes: 24 * 60, // 24 Hours default
    maxExpirationMinutes: 3 * 24 * 60, // 3 Days maximum
    maxRetentionMs: 3 * 24 * 60 * 60 * 1000,
  },

  // Upload constraints
  uploads: {
    dir: path.join(process.cwd(), "uploads"),
    maxFileSize: 1500 * 1024 * 1024, // 1.5 GB limit
  },
};
