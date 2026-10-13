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

// Local persistent disk storage for file registry
const registryFilePath = path.join(config.uploads.dir, "registry.json");

function ensureUploadsDir() {
  if (!fs.existsSync(config.uploads.dir)) {
    fs.mkdirSync(config.uploads.dir, { recursive: true });
  }
}

export function loadRegistryFromDisk() {
  try {
    ensureUploadsDir();
    if (fs.existsSync(registryFilePath)) {
      const data = fs.readFileSync(registryFilePath, "utf-8");
      const list: StoredFile[] = JSON.parse(data);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.slug) {
            fileRegistry.set(item.slug, item);
          }
        }
        console.log(`[Registry] Loaded ${fileRegistry.size} stored files from persistent registry.`);
      }
    }
  } catch (err) {
    console.warn("[Registry] Could not load registry.json:", err);
  }
}

export function persistRegistryToDisk() {
  try {
    ensureUploadsDir();
    const items = Array.from(fileRegistry.values());
    fs.writeFileSync(registryFilePath, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("[Registry] Failed to save registry.json:", err);
  }
}

// Immediately load existing file registry from disk on boot
loadRegistryFromDisk();

// Initialize Firebase Firestore Database (Server-side only, ONLY if valid credentials exist)
export let db: FirebaseFirestore.Firestore | null = null;

try {
  let projectId = config.firebase.projectId;
  let firestoreDbId = config.firebase.firestoreDatabaseId;
  let credentialObj = null;

  // Check if Firebase service account credentials exist
  if (config.firebase.clientEmail && config.firebase.privateKey) {
    credentialObj = cert({
      projectId: projectId || "nyvo-share",
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credentialObj = cert(parsed);
      if (!projectId && parsed.project_id) projectId = parsed.project_id;
    } catch (e) {
      console.warn("[Database] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  } else if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  ) {
    try {
      const parsed = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
      credentialObj = cert(parsed);
      if (!projectId && parsed.project_id) projectId = parsed.project_id;
    } catch (e) {
      console.warn("[Database] Could not load GOOGLE_APPLICATION_CREDENTIALS file:", e);
    }
  }

  // CRITICAL: Only initialize Firebase Admin if we have explicit credentials.
  // Never initialize with bare { projectId } on non-GCP hosts (like Render/Docker),
  // as google-auth-library will attempt to fetch GCP metadata ADC and crash the node process.
  if (credentialObj && projectId) {
    if (getAdminApps().length === 0) {
      initAdminApp({
        projectId,
        credential: credentialObj,
      });
    }

    db = firestoreDbId
      ? getAdminFirestore(getAdminApps()[0], firestoreDbId)
      : getAdminFirestore(getAdminApps()[0]);
    console.log(`[Database] Firebase Firestore initialized with Service Account (Project: ${projectId}, DB: ${firestoreDbId || "default"})`);
  } else {
    console.log(`[Database] Running with resilient local disk registry (${registryFilePath}). Firebase Admin ADC bypass active.`);
  }
} catch (err) {
  console.warn("[Database] Firebase Admin setup note:", err);
  db = null;
}

// Save file metadata to Memory, Disk & Firestore
export async function syncSaveFile(stored: StoredFile) {
  fileRegistry.set(stored.slug, stored);
  persistRegistryToDisk();

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
          persistRegistryToDisk();
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

// Delete file metadata from Memory, Disk, Firestore & Supabase Storage
export async function deleteStoredFile(slug: string) {
  const stored = fileRegistry.get(slug) || (await getOrFetchStoredFile(slug));
  if (stored) {
    fileRegistry.delete(slug);
    persistRegistryToDisk();

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
  } else {
    fileRegistry.delete(slug);
    persistRegistryToDisk();
  }

  if (db) {
    try {
      await db.collection("files").doc(slug).delete();
    } catch (err) {
      console.error("[Database] Firestore delete document error:", err);
    }
  }
}
