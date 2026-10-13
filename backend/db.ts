import path from "path";
import fs from "fs";
import { initializeApp as initAdminApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { deleteFromStorage } from "./storage";
import { config } from "./config";

export interface StoredFile {
  id: string;
  slug: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  storageType?: "supabase" | "local";
  storagePath?: string;
  createdAt: number;
  expiresAt: number | null;
  maxDownloads: number | null;
  downloadCount: number;
  passwordHash?: string;
  isBurnAfterRead: boolean;
  deleteToken: string;
}

// In-memory registry for instant lookups
export const fileRegistry = new Map<string, StoredFile>();

// Initialize Firebase Firestore Database (Server-side only)
export let db: FirebaseFirestore.Firestore | null = null;

try {
  let projectId = config.firebase.projectId;
  let firestoreDbId = config.firebase.firestoreDatabaseId;

  // Fallback to local config file if projectId is not in environment variables
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if ((!projectId || !firestoreDbId) && fs.existsSync(configPath)) {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!projectId) projectId = fileConfig.projectId;
    if (!firestoreDbId) firestoreDbId = fileConfig.firestoreDatabaseId;
  }

  if (projectId) {
    if (getAdminApps().length === 0) {
      if (config.firebase.clientEmail && config.firebase.privateKey) {
        initAdminApp({
          projectId,
          credential: cert({
            projectId,
            clientEmail: config.firebase.clientEmail,
            privateKey: config.firebase.privateKey,
          }),
        });
      } else {
        initAdminApp({ projectId });
      }
    }

    db = firestoreDbId
      ? getAdminFirestore(getAdminApps()[0], firestoreDbId)
      : getAdminFirestore(getAdminApps()[0]);
    console.log(`[Database] Firebase Firestore initialized (Project: ${projectId}, DB: ${firestoreDbId || "default"})`);
  }
} catch (err) {
  console.warn("[Database] Firebase Admin setup note:", err);
}

// Save file metadata to Memory & Firestore
export async function syncSaveFile(stored: StoredFile) {
  fileRegistry.set(stored.slug, stored);
  if (db) {
    try {
      const docData: Record<string, any> = {
        id: stored.id,
        slug: stored.slug,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        filePath: stored.filePath,
        storageType: stored.storageType || "local",
        storagePath: stored.storagePath || null,
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt ?? null,
        maxDownloads: stored.maxDownloads ?? null,
        downloadCount: stored.downloadCount,
        isBurnAfterRead: stored.isBurnAfterRead,
        deleteToken: stored.deleteToken,
      };
      if (stored.passwordHash) {
        docData.passwordHash = stored.passwordHash;
      }
      await db.collection("files").doc(stored.slug).set(docData);
    } catch (err) {
      console.error("[Database] Firestore set document error:", err);
    }
  }
}

// Retrieve file metadata from Memory or Firestore
export async function getOrFetchStoredFile(slug: string): Promise<StoredFile | null> {
  if (fileRegistry.has(slug)) {
    return fileRegistry.get(slug)!;
  }
  if (db) {
    try {
      const doc = await db.collection("files").doc(slug).get();
      if (doc.exists) {
        const stored = doc.data() as StoredFile;
        // Verify file exists either in Supabase cloud or on local disk
        const fileExists =
          stored &&
          (stored.storageType === "supabase" || (stored.filePath && fs.existsSync(stored.filePath)));

        if (fileExists) {
          fileRegistry.set(slug, stored);
          return stored;
        } else if (stored) {
          // File missing from storage, purge stale document
          await db.collection("files").doc(slug).delete();
        }
      }
    } catch (err) {
      console.error("[Database] Firestore get document error:", err);
    }
  }
  return null;
}

// Delete file metadata from Memory & Firestore & Supabase Storage
export async function deleteStoredFile(slug: string) {
  const stored = fileRegistry.get(slug) || (await getOrFetchStoredFile(slug));
  if (stored) {
    fileRegistry.delete(slug);

    // Remove from Supabase Storage
    if (stored.storagePath) {
      deleteFromStorage(stored.storagePath).catch((err) =>
        console.error(`[Database] Failed to delete from Supabase: ${stored.storagePath}`, err)
      );
    }

    // Remove from local disk if present
    if (stored.filePath && fs.existsSync(stored.filePath)) {
      try {
        fs.unlinkSync(stored.filePath);
      } catch (err) {
        console.error(`[Database] Failed to delete physical file: ${stored.filePath}`, err);
      }
    }
  }

  if (db) {
    try {
      await db.collection("files").doc(slug).delete();
    } catch (err) {
      console.error("[Database] Firestore delete document error:", err);
    }
  }
}
