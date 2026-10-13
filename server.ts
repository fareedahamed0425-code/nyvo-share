import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

// Retention Policy: Default 24 Hours (1440m), Maximum 3 Days (4320m)
const DEFAULT_EXPIRATION_MINUTES = 24 * 60; // 24 Hours
const MAX_EXPIRATION_MINUTES = 3 * 24 * 60; // 3 Days
const MAX_RETENTION_MS = MAX_EXPIRATION_MINUTES * 60 * 1000;

// Supabase Storage Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jofcylritxybpwievaqe.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_HFSnuv_oiEmiO4Sodkt-Pw_3LJtgRj3";
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "nyvo-share-files";

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log(`Supabase Storage initialized with URL: ${SUPABASE_URL}, Bucket: ${SUPABASE_STORAGE_BUCKET}`);

    // Verify / attempt to prepare bucket
    supabase.storage.getBucket(SUPABASE_STORAGE_BUCKET).then(async ({ error }) => {
      if (error && supabase) {
        const createRes = await supabase.storage.createBucket(SUPABASE_STORAGE_BUCKET, { public: true });
        if (!createRes.error) {
          console.log(`Created Supabase storage bucket: ${SUPABASE_STORAGE_BUCKET}`);
        } else {
          console.log(`Note: If bucket '${SUPABASE_STORAGE_BUCKET}' does not exist, create it in your Supabase Dashboard under Storage.`);
        }
      } else {
        console.log(`Supabase Storage bucket '${SUPABASE_STORAGE_BUCKET}' ready.`);
      }
    }).catch(() => {});
  } catch (err) {
    console.warn("Supabase init error:", err);
  }
}

interface StoredFile {
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

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory registry for ultra-fast lookups
const fileRegistry = new Map<string, StoredFile>();

// Initialize Firebase Firestore Database (Server-side)
let db: FirebaseFirestore.Firestore | null = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (getAdminApps().length === 0) {
      initAdminApp({
        projectId: config.projectId,
      });
    }
    db = config.firestoreDatabaseId
      ? getAdminFirestore(getAdminApps()[0], config.firestoreDatabaseId)
      : getAdminFirestore(getAdminApps()[0]);
    console.log("Firebase Firestore initialized with Database ID:", config.firestoreDatabaseId || "default");
  }
} catch (err) {
  console.warn("Firebase Admin setup warning:", err);
}

// Helper: Save file metadata to Memory & Firestore
async function syncSaveFile(stored: StoredFile) {
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
      console.error("Firestore set document error:", err);
    }
  }
}

// Helper: Retrieve file metadata from Memory or Firestore
async function getOrFetchStoredFile(slug: string): Promise<StoredFile | null> {
  if (fileRegistry.has(slug)) {
    return fileRegistry.get(slug)!;
  }
  if (db) {
    try {
      const doc = await db.collection("files").doc(slug).get();
      if (doc.exists) {
        const stored = doc.data() as StoredFile;
        // Check if stored in Supabase or exists on disk
        const fileExists =
          stored &&
          (stored.storageType === "supabase" || (stored.filePath && fs.existsSync(stored.filePath)));

        if (fileExists) {
          fileRegistry.set(slug, stored);
          return stored;
        } else if (stored) {
          // File missing from storage, purge document
          await db.collection("files").doc(slug).delete();
        }
      }
    } catch (err) {
      console.error("Firestore get document error:", err);
    }
  }
  return null;
}

// Helper: Delete file metadata from Memory & Firestore & Supabase Storage
async function deleteStoredFile(slug: string) {
  const stored = fileRegistry.get(slug) || (await getOrFetchStoredFile(slug));
  if (stored) {
    fileRegistry.delete(slug);

    // Remove from Supabase Storage if present
    if (stored.storagePath && supabase) {
      try {
        await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([stored.storagePath]);
        console.log(`Deleted file from Supabase Storage: ${stored.storagePath}`);
      } catch (err) {
        console.error(`Failed to remove file from Supabase: ${stored.storagePath}`, err);
      }
    }

    // Remove from local disk if present
    if (stored.filePath && fs.existsSync(stored.filePath)) {
      try {
        fs.unlinkSync(stored.filePath);
      } catch (err) {
        console.error(`Failed to delete physical file: ${stored.filePath}`, err);
      }
    }
  }
  if (db) {
    try {
      await db.collection("files").doc(slug).delete();
    } catch (err) {
      console.error("Firestore delete document error:", err);
    }
  }
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(6).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1500 * 1024 * 1024 }, // 1.5 GB limit
});

// Helper: Slug generator
const ADJECTIVES = ["swift", "cosmic", "lunar", "velvet", "crystal", "amber", "silent", "golden", "shadow", "frost", "electric", "neon"];
const NOUNS = ["pulse", "nebula", "wave", "spark", "beacon", "drift", "prism", "orbit", "echo", "vertex", "horizon", "cipher"];

function generateRandomSlug(): string {
  let slug = "";
  let attempts = 0;
  do {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(100 + Math.random() * 900);
    slug = `${adj}-${noun}-${num}`;
    attempts++;
  } while (fileRegistry.has(slug) && attempts < 50);

  if (fileRegistry.has(slug)) {
    slug = crypto.randomBytes(4).toString("hex");
  }
  return slug;
}

function sanitizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function hashPassword(pwd: string): string {
  return crypto.createHash("sha256").update(pwd).digest("hex");
}

// Background cleaner running every 15 seconds
setInterval(async () => {
  const now = Date.now();
  for (const [slug, stored] of fileRegistry.entries()) {
    const isTimeExpired = stored.expiresAt !== null && stored.expiresAt <= now;
    // Hard ceiling: delete if older than 3 days regardless of settings
    const isHardMaxExpired = now - stored.createdAt >= MAX_RETENTION_MS;
    const isDownloadLimitReached =
      stored.maxDownloads !== null && stored.downloadCount >= stored.maxDownloads;

    if (isTimeExpired || isHardMaxExpired || isDownloadLimitReached) {
      console.log(`Auto-deleting expired file slug: ${slug} (time=${isTimeExpired}, max3d=${isHardMaxExpired}, dlLimit=${isDownloadLimitReached})`);
      await deleteStoredFile(slug);
    }
  }

  // Periodic Firestore sweep for any expired documents
  if (db) {
    try {
      const expiredSnapshot = await db.collection("files")
        .where("expiresAt", "<=", now)
        .limit(20)
        .get();

      for (const doc of expiredSnapshot.docs) {
        console.log(`Firestore cleaner auto-deleting slug: ${doc.id}`);
        await deleteStoredFile(doc.id);
      }
    } catch {
      // Ignore if index not built
    }
  }
}, 15000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Check custom slug availability
  app.get("/api/check-slug/:slug", async (req, res) => {
    const clean = sanitizeSlug(req.params.slug);
    if (!clean || clean.length < 3) {
      return res.json({ available: false, reason: "Slug must be at least 3 characters long." });
    }
    const stored = await getOrFetchStoredFile(clean);
    return res.json({ available: !stored, slug: clean });
  });

  // API Route: Upload file with custom options
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded." });
      }

      const { customSlug, expirationMinutes, maxDownloads, password, burnAfterRead } = req.body;

      let finalSlug = "";
      if (customSlug && typeof customSlug === "string" && customSlug.trim() !== "") {
        const cleanedSlug = sanitizeSlug(customSlug);
        if (cleanedSlug.length < 3) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: "Custom link slug must be at least 3 characters long.",
          });
        }
        const existing = await getOrFetchStoredFile(cleanedSlug);
        if (existing) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: "This custom link slug is already taken. Please choose another one.",
          });
        }
        finalSlug = cleanedSlug;
      } else {
        finalSlug = generateRandomSlug();
      }

      const now = Date.now();
      // Retention: Default 24 Hours (1440m), Max 3 Days (4320m)
      let expMinutes = parseInt(expirationMinutes, 10);
      if (isNaN(expMinutes) || expMinutes <= 0) {
        expMinutes = DEFAULT_EXPIRATION_MINUTES; // 24 Hours default
      }
      if (expMinutes > MAX_EXPIRATION_MINUTES) {
        expMinutes = MAX_EXPIRATION_MINUTES; // Hard cap at 3 Days
      }

      const expiresAt = now + expMinutes * 60 * 1000;

      let maxDl = parseInt(maxDownloads, 10);
      if (isNaN(maxDl) || maxDl <= 0) {
        maxDl = null;
      }

      const isBurn = burnAfterRead === "true" || burnAfterRead === true;
      if (isBurn) {
        maxDl = 1; // Self-destruct on 1 download
      }

      const deleteToken = crypto.randomBytes(16).toString("hex");

      // Upload file into Supabase Storage
      const storagePath = `${finalSlug}/${req.file.originalname}`;
      let storageType: "supabase" | "local" = "local";

      if (supabase) {
        try {
          const fileBuffer = fs.readFileSync(req.file.path);
          const { error: sbError } = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(storagePath, fileBuffer, {
              contentType: req.file.mimetype || "application/octet-stream",
              upsert: true,
            });

          if (!sbError) {
            storageType = "supabase";
            console.log(`Uploaded to Supabase Storage [${SUPABASE_STORAGE_BUCKET}]: ${storagePath}`);
            // Unlink temporary file from local disk
            try {
              fs.unlinkSync(req.file.path);
            } catch {}
          } else {
            console.warn(`Supabase Storage note (falling back to local cache):`, sbError.message || sbError);
          }
        } catch (err: any) {
          console.warn("Supabase upload exception (falling back to local cache):", err?.message || err);
        }
      }

      const storedFile: StoredFile = {
        id: crypto.randomUUID(),
        slug: finalSlug,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || "application/octet-stream",
        size: req.file.size,
        filePath: req.file.path,
        storageType,
        storagePath: storageType === "supabase" ? storagePath : undefined,
        createdAt: now,
        expiresAt,
        maxDownloads: maxDl,
        downloadCount: 0,
        passwordHash: password ? hashPassword(password) : undefined,
        isBurnAfterRead: isBurn,
        deleteToken,
      };

      await syncSaveFile(storedFile);

      const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      const host = req.headers.host || "localhost:3000";
      const hostUrl = process.env.APP_URL
        ? process.env.APP_URL.replace(/\/+$/, "")
        : `${proto}://${host}`;
      const shareUrl = `${hostUrl}/f/${finalSlug}`;

      return res.json({
        success: true,
        slug: finalSlug,
        shareUrl,
        expiresAt: storedFile.expiresAt,
        deleteToken,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ success: false, message: "Server error during upload." });
    }
  });

  // API Route: Get File Info metadata
  app.get("/api/file-info/:slug", async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const stored = await getOrFetchStoredFile(slug);

    if (!stored) {
      return res.status(404).json({ success: false, isExpired: true, error: "File not found or expired." });
    }

    const now = Date.now();
    if (stored.expiresAt !== null && stored.expiresAt <= now) {
      deleteStoredFile(slug);
      return res.status(410).json({ success: false, isExpired: true, error: "File has expired." });
    }

    if (stored.maxDownloads !== null && stored.downloadCount >= stored.maxDownloads) {
      deleteStoredFile(slug);
      return res.status(410).json({ success: false, isExpired: true, error: "Download limit reached." });
    }

    return res.json({
      success: true,
      metadata: {
        id: stored.id,
        slug: stored.slug,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
        maxDownloads: stored.maxDownloads,
        downloadCount: stored.downloadCount,
        requiresPassword: !!stored.passwordHash,
        isBurnAfterRead: stored.isBurnAfterRead,
      },
    });
  });

  // API Route: Verify password
  app.post("/api/verify-password/:slug", async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const { password } = req.body;
    const stored = await getOrFetchStoredFile(slug);

    if (!stored) {
      return res.status(404).json({ success: false, error: "File not found or expired." });
    }

    if (!stored.passwordHash) {
      return res.json({ success: true, verified: true });
    }

    if (!password || hashPassword(password) !== stored.passwordHash) {
      return res.status(401).json({ success: false, verified: false, error: "Incorrect password." });
    }

    return res.json({ success: true, verified: true });
  });

  // API Route: Download file stream
  app.post("/api/download/:slug", async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const { password } = req.body || {};
    const stored = await getOrFetchStoredFile(slug);

    if (!stored) {
      return res.status(404).json({ success: false, error: "File not found or expired." });
    }

    const now = Date.now();
    if (stored.expiresAt !== null && stored.expiresAt <= now) {
      deleteStoredFile(slug);
      return res.status(410).json({ success: false, error: "This file has expired and was auto-deleted." });
    }

    if (now - stored.createdAt >= MAX_RETENTION_MS) {
      deleteStoredFile(slug);
      return res.status(410).json({ success: false, error: "This file has exceeded the 3-day maximum retention period and was deleted." });
    }

    if (stored.maxDownloads !== null && stored.downloadCount >= stored.maxDownloads) {
      deleteStoredFile(slug);
      return res.status(410).json({ success: false, error: "Maximum download limit reached. File auto-deleted." });
    }

    // Password verification if required
    if (stored.passwordHash) {
      if (!password || hashPassword(password) !== stored.passwordHash) {
        return res.status(401).json({ success: false, error: "Incorrect password required for download." });
      }
    }

    // Increment download count
    stored.downloadCount += 1;
    if (db) {
      db.collection("files").doc(slug).update({ downloadCount: stored.downloadCount }).catch(console.error);
    }

    // Set download headers
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(stored.originalName)}"`);
    res.setHeader("Content-Type", stored.mimeType);
    res.setHeader("Content-Length", stored.size);

    const handlePostDownload = () => {
      // If max downloads reached or burn after read, purge immediately after sending
      if (
        stored.isBurnAfterRead ||
        (stored.maxDownloads !== null && stored.downloadCount >= stored.maxDownloads)
      ) {
        console.log(`Burn after download triggered for slug: ${slug}`);
        setTimeout(() => deleteStoredFile(slug), 1000);
      }
    };

    // 1. If file is stored in Supabase Storage
    if (stored.storageType === "supabase" && stored.storagePath && supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .download(stored.storagePath);

        if (error || !data) {
          console.error("Supabase download error:", error);
          return res.status(404).json({ success: false, error: "File not found in storage bucket." });
        }

        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
        handlePostDownload();
        return;
      } catch (err) {
        console.error("Supabase download exception:", err);
        return res.status(500).json({ success: false, error: "Failed to download from cloud storage." });
      }
    }

    // 2. Fallback to local disk file stream
    if (fs.existsSync(stored.filePath)) {
      const fileStream = fs.createReadStream(stored.filePath);
      fileStream.pipe(res);

      fileStream.on("end", handlePostDownload);

      fileStream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: "File streaming error." });
        }
      });
      return;
    }

    fileRegistry.delete(slug);
    return res.status(404).json({ success: false, error: "File stream unavailable." });
  });

  // API Route: Preview file stream (inline display for images/videos/audio/pdfs if allowed)
  app.post("/api/preview/:slug", async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const { password } = req.body || {};
    const stored = await getOrFetchStoredFile(slug);

    if (!stored) {
      return res.status(404).json({ success: false, error: "File not found." });
    }

    if (stored.passwordHash) {
      if (!password || hashPassword(password) !== stored.passwordHash) {
        return res.status(401).json({ success: false, error: "Password required." });
      }
    }

    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(stored.originalName)}"`);
    res.setHeader("Content-Type", stored.mimeType);

    // 1. If stored in Supabase Storage
    if (stored.storageType === "supabase" && stored.storagePath && supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .download(stored.storagePath);

        if (error || !data) {
          return res.status(404).json({ success: false, error: "Preview unavailable in cloud storage." });
        }

        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
        return;
      } catch (err) {
        console.error("Supabase preview exception:", err);
        return res.status(500).json({ success: false, error: "Preview error." });
      }
    }

    // 2. Fallback to local disk stream
    if (fs.existsSync(stored.filePath)) {
      const fileStream = fs.createReadStream(stored.filePath);
      fileStream.pipe(res);
      return;
    }

    return res.status(404).json({ success: false, error: "File not found on disk." });
  });

  // API Route: Early manual deletion by owner using deleteToken
  app.delete("/api/file/:slug", async (req, res) => {
    const slug = sanitizeSlug(req.params.slug);
    const token = req.headers["x-delete-token"] || req.query.token;
    const stored = await getOrFetchStoredFile(slug);

    if (!stored) {
      return res.status(404).json({ success: false, message: "File already removed or not found." });
    }

    if (stored.deleteToken !== token) {
      return res.status(403).json({ success: false, message: "Invalid deletion authorization token." });
    }

    await deleteStoredFile(slug);
    return res.json({ success: true, message: "File permanently deleted ahead of schedule." });
  });

  // API Route: Fetch active status for a set of slugs (user's uploads)
  app.post("/api/active-status", async (req, res) => {
    const { slugs } = req.body;
    if (!Array.isArray(slugs)) {
      return res.status(400).json({ success: false, message: "Slugs must be an array." });
    }

    const statuses = await Promise.all(
      slugs.map(async (slug) => {
        const stored = await getOrFetchStoredFile(slug);
        if (!stored) {
          return { slug, active: false, reason: "Expired or deleted" };
        }
        return {
          slug,
          active: true,
          originalName: stored.originalName,
          size: stored.size,
          mimeType: stored.mimeType,
          createdAt: stored.createdAt,
          expiresAt: stored.expiresAt,
          downloadCount: stored.downloadCount,
          maxDownloads: stored.maxDownloads,
          requiresPassword: !!stored.passwordHash,
        };
      })
    );

    return res.json({ success: true, statuses });
  });

  // Integrate Vite or Static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TempShare Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
