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

  // Firebase Firestore Database (Kept strictly on server side)
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "",
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : "",
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
