<div align="center">

# ⚡ NYVO SHARE

### Premium Ephemeral File Sharing with Cloud Persistence & Zero-Trust Privacy

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Storage-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <b>Share files up to 1.5 GB instantly with customizable short links, end-to-end SHA-256 password protection, burn-after-download capabilities, and automatic cloud destruction.</b>
</p>

</div>

---

## 🌟 Highlights

* **☁️ Cloud Object Storage**: High-speed, resilient file streaming powered by **Supabase Storage**.
* **⏳ Auto-Expiring Retention**: Files automatically self-destruct after **24 hours by default** (enforced strict **3-day maximum**).
* **🔥 Burn-After-Reading**: One-time download mode that permanently deletes the file from cloud and database immediately upon reception.
* **🛡️ Zero Secrets in Frontend**: Strict separation of concerns — **all API keys, bucket tokens, and database credentials remain 100% on the backend**.
* **🔗 Custom Slug URLs**: Choose readable link identifiers (e.g., `/f/quarterly-deck`) with real-time availability checks.
* **🔐 Password Encryption**: Optional SHA-256 protected access for sensitive documents.
* **👁️ In-Browser Previews**: Stream images, audio, video, and PDFs directly in the browser before downloading.
* **🐳 Dockerized**: Production-ready multi-stage Docker build running as a secure, unprivileged container.

---

## 🏛️ Architecture & Separation of Concerns

The codebase is split into two independent domains:

```
nyvo-share/
├── backend/                       # 🛡️ BACKEND (Isolated Node/Express Server)
│   ├── config.ts                  # Securely parses environment variables & secrets
│   ├── storage.ts                 # Supabase Storage client (upload, stream, delete)
│   ├── db.ts                      # Firestore metadata synchronization & memory cache
│   └── index.ts                   # Express server, background cleaner (15s), & API routes
│
├── frontend/                      # 🎨 FRONTEND (Pure React 19 Client - Zero Secrets)
│   ├── components/                # Glassmorphic UI elements (Uploader, Options, Result)
│   ├── types.ts                   # Strongly-typed TypeScript interfaces
│   ├── utils/                     # Time and byte formatters
│   ├── App.tsx                    # Main reactive shell
│   ├── main.tsx                   # Client bootstrap
│   └── index.css                  # Modern Tailwind CSS styling tokens
│
├── Dockerfile                     # Multi-stage production container specification
├── docker-compose.yml             # Orchestration for containerized deployments
├── index.html                     # Frontend entrypoint
└── package.json                   # Build scripts & dependencies
```

---

## 🚀 Quick Start

### 1. Prerequisites
* **Node.js**: v20 or v22+
* **npm**: v10+

### 2. Architecture & Service Decoupling

Nyvo-Share is architected as two decoupled, independently deployable services:

| Service | Technology | Hosting | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend API** | Node.js 22, Express, Multer, Supabase | **Render** (Docker Web Service) | Handles secure file streaming, metadata persistence, retention policies, and CORS. Zero secrets leaked. |
| **Frontend UI** | React 19, Vite, Tailwind CSS | **Vercel / Netlify / Render** | Responsive, glassmorphic UI. Communicates with backend via `VITE_API_URL` or auto-detection. |

### 3. Installation & Local Development

```bash
# Clone repository
git clone https://github.com/fareedahamed0425-code/nyvo-share.git
cd nyvo-share

# Install dependencies
npm install

# Run unified full-stack dev server
npm run dev

# Or run frontend and backend independently:
npm run dev:backend   # Express API server on http://localhost:3000
npm run dev:frontend  # Vite React dev server on http://localhost:5173 (proxies /api to backend)
```

### 4. Configuration (`.env.local` / Environment Variables)

#### Backend Service Environment Variables (Render / Server):
```env
PORT=10000
APP_URL="https://your-frontend-app.vercel.app"  # Caller origin for share link generation

# Supabase Storage (Server-only credentials)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-supabase-key"
SUPABASE_STORAGE_BUCKET="nyvo-share-files"

# Firebase (Optional - defaults to persistent JSON disk store)
FIREBASE_PROJECT_ID="nyvo-share"
FIREBASE_FIRESTORE_DATABASE_ID="ai-studio-nyvoshare-..."
```

#### Frontend Service Environment Variables (Vercel / Netlify):
```env
# Point to your deployed Render backend:
VITE_API_URL="https://nyvo-share.onrender.com"
```
*(Note: If deployed on Vercel, the included `vercel.json` automatically proxies `/api/*` to the Render backend even without environment variables!)*

---

## 🐳 Docker Deployment

Nyvo Share features an optimized multi-stage `Dockerfile` built on `node:22-alpine` with an unprivileged runtime user and `dumb-init` signal handling.

### Option A: Using Docker Compose (Recommended)

```bash
# Start in background
docker compose up -d --build

# View container logs
docker compose logs -f

# Stop container
docker compose down
```

### Option B: Using Standard Docker CLI

```bash
# Build production image
docker build -t nyvo-share:latest .

# Run container with environment file
docker run -d \
  --name nyvo-share \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  nyvo-share:latest
```

---

## ⚙️ Environment Variables

All variables are loaded exclusively by the backend in `backend/config.ts`:

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `3000` | Port on which the HTTP server listens |
| `APP_URL` | No | Auto-detected | Canonical public URL used for generated `/f/<slug>` links |
| `SUPABASE_URL` | Yes | — | Supabase project API URL |
| `SUPABASE_KEY` | Yes | — | Supabase API key (publishable or service role) |
| `SUPABASE_STORAGE_BUCKET` | Yes | `nyvo-share-files` | Target bucket for file objects |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Optional secret key for full backend admin permissions |
| `FIREBASE_PROJECT_ID` | No | `nyvo-share` | Google Cloud / Firebase project ID for Firestore metadata |
| `FIREBASE_FIRESTORE_DATABASE_ID` | No | `default` | Named Firestore database ID |
| `FIREBASE_CLIENT_EMAIL` | No | — | Service account email (for custom production hosting) |
| `FIREBASE_PRIVATE_KEY` | No | — | Service account private key |

---

## 📡 API Reference

All requests pass through the backend API layer:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET`, `HEAD` | `/health` | Health status probe for Render, uptime monitors & load balancers |
| `GET`, `HEAD` | `/api/health` | API health route with uptime & cloud storage status |
| `HEAD` | `/` | Root HEAD probe (returns 200 OK headers instantly) |
| `GET` | `/api/check-slug/:slug` | Check if a custom link slug is available |
| `POST` | `/api/upload` | Multipart upload with options (`expirationMinutes`, `password`, `burnAfterRead`) |
| `GET` | `/api/file-info/:slug` | Retrieve public metadata (size, expiration, password requirement) |
| `POST` | `/api/verify-password/:slug` | Verify access password before unlocking file actions |
| `POST` | `/api/download/:slug` | Stream file attachment (increments count, triggers burn deletion) |
| `POST` | `/api/preview/:slug` | Stream inline preview for images, audio, video, or PDFs |
| `DELETE` | `/api/file/:slug` | Owner-authenticated instant deletion using `deleteToken` |
| `POST` | `/api/active-status` | Batch fetch status for the sender's active uploads list |

---

## ⏱️ Ephemeral Retention & Cleanup Engine

1. **Upload Time Calculation**:
   * Default expiration is **24 hours** (1440 minutes).
   * Strict upper ceiling is capped at **3 days** (4320 minutes).
2. **Background Cleaner**:
   * A continuous cron worker runs every **15 seconds** in `backend/index.ts`.
   * Automatically queries both memory and Firestore for records where `expiresAt <= now` or `now - createdAt >= 3 days`.
   * When expired, it physically removes the file binary from **Supabase Cloud Storage**, wipes the **Firestore document**, and purges the memory index.

---

## 🛡️ Security Model

* **No Frontend Leakage**: The client bundle contains zero API keys or credentials.
* **Password Hashing**: Passwords are never stored in plaintext; they are hashed with `SHA-256` before writing to metadata.
* **Owner Delete Tokens**: Each upload receives an unpredictable cryptographic 32-byte hex deletion token stored only in the uploader's browser `localStorage`.
* **Container Isolation**: Docker container runs under the non-root `node` system user.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.
