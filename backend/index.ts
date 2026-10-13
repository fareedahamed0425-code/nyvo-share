import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { config } from "./config";
import {
  StoredFile,
  fileRegistry,
  db,
  syncSaveFile,
  getOrFetchStoredFile,
  deleteStoredFile,
  persistRegistryToDisk,
} from "./db";
import { uploadToStorage, downloadFromStorage } from "./storage";

// Prevent unhandled promise rejections or metadata warnings from terminating the Node server
process.on("unhandledRejection", (reason: any) => {
  console.warn("[Process] Handled unhandledRejection:", reason?.message || reason);
});

process.on("uncaughtException", (error: Error) => {
  console.error("[Process] Handled uncaughtException:", error?.message || error);
});

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
  try {
    const now = Date.now();
    for (const [slug, stored] of Array.from(fileRegistry.entries())) {
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
        // Silently ignore if index not built or network issue
      }
    }
  } catch (err: any) {
    console.warn("[Auto-Clean] Cleaner error:", err?.message || err);
  }
}, 15000);

async function startServer() {
  const app = express();

  // Robust Cross-Origin Resource Sharing (CORS) for decoupled frontend services
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-delete-token, Accept, Range, Origin");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json());

  // Comprehensive Health Check Handlers (GET & HEAD)
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Service-Name", "nyvo-share-api");
    return res.status(200).json({
      status: "healthy",
      service: "Nyvo-Share Secure Backend API",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: Date.now(),
      storage: {
        provider: "supabase",
        bucket: config.supabase.bucket,
        status: "connected",
      },
      retention: {
        defaultMinutes: config.retention.defaultExpirationMinutes,
        maxMinutes: config.retention.maxExpirationMinutes,
      },
    });
  };

  const headHealthHandler = (_req: express.Request, res: express.Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Service-Name", "nyvo-share-api");
    res.setHeader("Content-Type", "application/json");
    return res.status(200).end();
  };

  // Dedicated Health Check Routes for Render, load balancers, and uptime monitors
  app.get("/health", healthHandler);
  app.head("/health", headHealthHandler);

  app.get("/api/health", healthHandler);
  app.head("/api/health", headHealthHandler);

  // HEAD route for root endpoint
  app.head("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Service-Name", "nyvo-share-api");
    return res.status(200).end();
  });

  // Root API status endpoint
  app.get("/api", (_req, res) => {
    return res.json({
      service: "Nyvo-Share Secure Backend API",
      status: "online",
      version: "1.0.0",
      storage: "Supabase Cloud Storage",
      retentionPolicy: "24h default / 72h max ceiling",
    });
  });

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

      // Construct robust production link (prioritizing caller frontend origin if present)
      const callerOrigin = (req.headers.origin as string) || (req.headers.referer ? new URL(req.headers.referer).origin : "");
      const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      const host = req.headers.host || `localhost:${config.port}`;
      const hostUrl = callerOrigin || (config.appUrl ? config.appUrl.replace(/\/+$/, "") : `${proto}://${host}`);
      const shareUrl = `${hostUrl.replace(/\/+$/, "")}/f/${finalSlug}`;

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
    persistRegistryToDisk();
    if (db) {
      db.collection("files").doc(slug).update({ downloadCount: stored.downloadCount }).catch(() => {});
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

  // HTML template for root / endpoint when visited in a web browser
  const API_STATUS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nyvo-Share | Backend API Service</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      background: #050508;
      color: #fafafa;
      font-family: 'Inter', -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background: rgba(18, 18, 26, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 36px;
      max-width: 560px;
      width: 100%;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.08);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.12);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.25);
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin-bottom: 20px;
    }
    .pulse {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }
    h1 { font-size: 26px; margin: 0 0 8px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    p { color: #94a3b8; font-size: 14px; margin: 0 0 28px; line-height: 1.6; }
    .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .endpoints { display: flex; flex-direction: column; gap: 8px; }
    .endpoint {
      background: rgba(10, 10, 16, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 10px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #c7d2fe;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .method { font-weight: 700; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
    .m-get { color: #34d399; background: rgba(52, 211, 153, 0.1); }
    .m-post { color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
    .m-del { color: #f87171; background: rgba(248, 113, 113, 0.1); }
    .meta-box {
      margin-top: 24px;
      padding: 14px 18px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
    }
    .meta-box strong { color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="pulse"></span> Backend API Service Active</div>
    <h1>⚡ Nyvo-Share API</h1>
    <p>Decoupled backend service. All cloud credentials and storage buckets are securely quarantined on this server.</p>
    
    <div class="section-title">Available REST Endpoints</div>
    <div class="endpoints">
      <div class="endpoint"><span>/health</span> <span class="method m-get">GET</span></div>
      <div class="endpoint"><span>/api</span> <span class="method m-get">GET</span></div>
      <div class="endpoint"><span>/api/check-slug/:slug</span> <span class="method m-get">GET</span></div>
      <div class="endpoint"><span>/api/upload</span> <span class="method m-post">POST</span></div>
      <div class="endpoint"><span>/api/file-info/:slug</span> <span class="method m-get">GET</span></div>
      <div class="endpoint"><span>/api/download/:slug</span> <span class="method m-post">POST</span></div>
      <div class="endpoint"><span>/api/preview/:slug</span> <span class="method m-post">POST</span></div>
      <div class="endpoint"><span>/api/file/:slug</span> <span class="method m-del">DELETE</span></div>
    </div>

    <div class="meta-box">
      <div>Storage: <strong>Supabase Cloud</strong></div>
      <div>Retention: <strong>24h Default / 3d Max</strong></div>
    </div>
  </div>
</body>
</html>`;

  // Root route: Show sleek Backend API status dashboard for browsers, JSON for API clients
  app.get("/", (req, res) => {
    if (req.accepts("html")) {
      return res.send(API_STATUS_HTML);
    }
    return res.json({
      service: "Nyvo-Share Secure Backend API",
      status: "online",
      version: "1.0.0",
      storage: "Supabase Cloud Storage",
      retentionPolicy: "24h default / 72h max ceiling",
    });
  });

  // Catch-all JSON 404 for any unregistered paths
  app.use((_req, res) => {
    return res.status(404).json({
      success: false,
      error: "Endpoint not found on Nyvo-Share backend API.",
    });
  });

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[Server] Nyvo-Share backend active on http://0.0.0.0:${config.port}`);
  });
}

startServer();
