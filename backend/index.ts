import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { config } from "./config";
import {
  StoredFile,
  fileRegistry,
  db,
  syncSaveFile,
  getOrFetchStoredFile,
  deleteStoredFile,
} from "./db";
import { uploadToStorage, downloadFromStorage } from "./storage";

// Ensure local temporary directory exists
if (!fs.existsSync(config.uploads.dir)) {
  fs.mkdirSync(config.uploads.dir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploads.dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(6).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxFileSize },
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

// Background auto-cleaner (Runs every 15 seconds)
setInterval(async () => {
  const now = Date.now();
  for (const [slug, stored] of fileRegistry.entries()) {
    const isTimeExpired = stored.expiresAt !== null && stored.expiresAt <= now;
    // Hard retention ceiling: delete anything older than 3 days
    const isHardMaxExpired = now - stored.createdAt >= config.retention.maxRetentionMs;
    const isDownloadLimitReached =
      stored.maxDownloads !== null && stored.downloadCount >= stored.maxDownloads;

    if (isTimeExpired || isHardMaxExpired || isDownloadLimitReached) {
      console.log(`[Auto-Clean] Purging file: ${slug} (expired=${isTimeExpired}, max3d=${isHardMaxExpired}, dlLimit=${isDownloadLimitReached})`);
      await deleteStoredFile(slug);
    }
  }

  // Periodic Firestore sweep for any expired files not currently cached in memory
  if (db) {
    try {
      const expiredSnapshot = await db.collection("files")
        .where("expiresAt", "<=", now)
        .limit(20)
        .get();

      for (const doc of expiredSnapshot.docs) {
        console.log(`[Auto-Clean] Firestore sweeping expired file: ${doc.id}`);
        await deleteStoredFile(doc.id);
      }
    } catch {
      // Ignore if index not built
    }
  }
}, 15000);

async function startServer() {
  const app = express();
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
      // Retention: Default 24 Hours, Maximum 3 Days
      let expMinutes = parseInt(expirationMinutes, 10);
      if (isNaN(expMinutes) || expMinutes <= 0) {
        expMinutes = config.retention.defaultExpirationMinutes; // 24 Hours default
      }
      if (expMinutes > config.retention.maxExpirationMinutes) {
        expMinutes = config.retention.maxExpirationMinutes; // 3 Days maximum
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

      // Upload file to Supabase Cloud Storage
      const storagePath = `${finalSlug}/${req.file.originalname}`;
      let storageType: "supabase" | "local" = "local";

      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const uploadResult = await uploadToStorage(
          storagePath,
          fileBuffer,
          req.file.mimetype || "application/octet-stream"
        );

        if (uploadResult.success) {
          storageType = "supabase";
          console.log(`[Upload] File saved in Supabase Storage: ${storagePath}`);
          // Remove local disk temp file
          try {
            fs.unlinkSync(req.file.path);
          } catch {}
        } else {
          console.warn(`[Upload] Supabase Storage note (falling back to local cache):`, uploadResult.error);
        }
      } catch (err: any) {
        console.warn(`[Upload] Supabase Storage exception (falling back to local cache):`, err?.message || err);
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

      // Construct robust production link
      const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      const host = req.headers.host || `localhost:${config.port}`;
      const hostUrl = config.appUrl ? config.appUrl.replace(/\/+$/, "") : `${proto}://${host}`;
      const shareUrl = `${hostUrl}/f/${finalSlug}`;

      return res.json({
        success: true,
        slug: finalSlug,
        shareUrl,
        expiresAt: storedFile.expiresAt,
        deleteToken,
      });
    } catch (err) {
      console.error("[Upload] Server upload error:", err);
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

    if (now - stored.createdAt >= config.retention.maxRetentionMs) {
      deleteStoredFile(slug);
      return res.status(410).json({ success: false, isExpired: true, error: "File exceeded 3-day max retention." });
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

    if (now - stored.createdAt >= config.retention.maxRetentionMs) {
      deleteStoredFile(slug);
      return res.status(410).json({ success: false, error: "This file exceeded the 3-day max retention period and was deleted." });
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

    // Set download response headers
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(stored.originalName)}"`);
    res.setHeader("Content-Type", stored.mimeType);
    res.setHeader("Content-Length", stored.size);

    const handlePostDownload = () => {
      if (
        stored.isBurnAfterRead ||
        (stored.maxDownloads !== null && stored.downloadCount >= stored.maxDownloads)
      ) {
        console.log(`[Download] Burn after read triggered for slug: ${slug}`);
        setTimeout(() => deleteStoredFile(slug), 1000);
      }
    };

    // 1. Fetch from Supabase Cloud Storage if available
    if (stored.storageType === "supabase" && stored.storagePath) {
      const { data, error } = await downloadFromStorage(stored.storagePath);
      if (!error && data) {
        res.send(data);
        handlePostDownload();
        return;
      }
      console.error("[Download] Supabase download error:", error);
    }

    // 2. Fallback to local disk file stream
    if (fs.existsSync(stored.filePath)) {
      const fileStream = fs.createReadStream(stored.filePath);
      fileStream.pipe(res);
      fileStream.on("end", handlePostDownload);
      fileStream.on("error", (err) => {
        console.error("[Download] Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: "File streaming error." });
        }
      });
      return;
    }

    fileRegistry.delete(slug);
    return res.status(404).json({ success: false, error: "File stream unavailable." });
  });

  // API Route: Preview file stream (inline display for images/videos/audio/pdfs)
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

    // 1. Fetch from Supabase Cloud Storage
    if (stored.storageType === "supabase" && stored.storagePath) {
      const { data, error } = await downloadFromStorage(stored.storagePath);
      if (!error && data) {
        res.send(data);
        return;
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

  // API Route: Fetch active status for a set of slugs
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

  // Integrate Vite for Development or Static Serving for Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: process.cwd(),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[Server] Nyvo-Share backend active on http://0.0.0.0:${config.port}`);
  });
}

startServer();
