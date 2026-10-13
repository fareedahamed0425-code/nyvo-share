import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { GlassCard } from "./components/GlassCard";
import { FileUploader } from "./components/FileUploader";
import { UploadOptionsPanel } from "./components/UploadOptions";
import { ShareResult } from "./components/ShareResult";
import { DownloadView } from "./components/DownloadView";
import { ActiveUploadsList } from "./components/ActiveUploadsList";
import { UploadOptions, UploadResponse } from "./types";
import {
  formatFileSize,
  addStoredUpload,
  getStoredUploads,
} from "./utils/formatters";
import {
  Sparkles,
  Lock,
  Clock,
  Flame,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertCircle,
  Link,
  Shield,
  FileCheck2,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"upload" | "active">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Upload options default state
  const [options, setOptions] = useState<UploadOptions>({
    customSlug: "",
    expirationMinutes: 1440, // 24 hours default (max 3 days)
    maxDownloads: 0, // unlimited
    password: "",
    burnAfterRead: false,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  // Handle direct share link parameter navigation (e.g., /f/custom-slug or ?f=custom-slug)
  const [currentViewSlug, setCurrentViewSlug] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (path.startsWith("/f/")) {
      const slugPart = path.substring(3).trim();
      if (slugPart) return slugPart;
    }
    const params = new URLSearchParams(window.location.search);
    const slugQuery = params.get("f");
    if (slugQuery) return slugQuery;
    return null;
  });

  // Sync state on browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/f/")) {
        const slugPart = path.substring(3).trim();
        setCurrentViewSlug(slugPart || null);
      } else {
        const params = new URLSearchParams(window.location.search);
        const slugQuery = params.get("f");
        setCurrentViewSlug(slugQuery || null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update URL history when navigating to a slug
  const navigateToSlug = (slug: string) => {
    window.history.pushState({}, "", `/f/${slug}`);
    setCurrentViewSlug(slug);
  };

  const navigateToHome = () => {
    window.history.pushState({}, "", "/");
    setCurrentViewSlug(null);
    setUploadResult(null);
    setSelectedFile(null);
    setUploadError(null);
  };

  // Perform File Upload
  const handleStartUpload = async () => {
    if (!selectedFile) return;

    if (selectedFile.size > 1500 * 1024 * 1024) {
      setUploadError("File size exceeds the 1.5 GB maximum allowed limit.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      if (options.customSlug?.trim()) {
        formData.append("customSlug", options.customSlug.trim());
      }
      formData.append("expirationMinutes", String(options.expirationMinutes));
      formData.append("maxDownloads", String(options.maxDownloads || 0));
      if (options.password) {
        formData.append("password", options.password);
      }
      formData.append("burnAfterRead", String(options.burnAfterRead));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setUploadError(data.message || "Failed to upload file. Please try again.");
        setIsUploading(false);
        return;
      }

      // Record in LocalStorage
      addStoredUpload({
        slug: data.slug,
        originalName: selectedFile.name,
        size: selectedFile.size,
        mimeType: selectedFile.type,
        createdAt: Date.now(),
        expiresAt: data.expiresAt,
        deleteToken: data.deleteToken,
      });

      setUploadResult(data);
      setIsUploading(false);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("A network error occurred while uploading. Please retry.");
      setIsUploading(false);
    }
  };

  const activeCount = getStoredUploads().length;

  return (
    <div className="min-h-screen bg-[#030305] text-white flex flex-col font-['Inter',sans-serif] selection:bg-indigo-500 selection:text-white relative overflow-x-hidden no-scrollbar">
      {/* Sleek Theme Glow Orbs */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />
      <div className="glow-orb orb-3" />

      {/* Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (currentViewSlug) navigateToHome();
        }}
        activeUploadsCount={activeCount}
      />

      {/* Main Body */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10 relative z-10 flex flex-col items-center">
        {/* If user accessed a file download view */}
        {currentViewSlug ? (
          <div className="w-full max-w-2xl mx-auto">
            <DownloadView slug={currentViewSlug} onGoHome={navigateToHome} />
          </div>
        ) : activeTab === "active" ? (
          /* User's Active Temp Links Tab */
          <div className="w-full max-w-2xl mx-auto">
            <ActiveUploadsList onSelectSlug={(slug) => navigateToSlug(slug)} />
          </div>
        ) : uploadResult ? (
          /* Upload Success Share Screen */
          <div className="w-full max-w-2xl mx-auto">
            <ShareResult
              slug={uploadResult.slug}
              shareUrl={uploadResult.shareUrl}
              expiresAt={uploadResult.expiresAt}
              fileName={selectedFile?.name || "File"}
              fileSize={selectedFile ? formatFileSize(selectedFile.size) : ""}
              burnAfterRead={options.burnAfterRead}
              requiresPassword={!!options.password}
              onReset={() => {
                setUploadResult(null);
                setSelectedFile(null);
                setUploadError(null);
                setOptions({
                  customSlug: "",
                  expirationMinutes: 1440,
                  maxDownloads: 0,
                  password: "",
                  burnAfterRead: false,
                });
              }}
            />
          </div>
        ) : (
          /* Primary Upload View */
          <div className="space-y-6 w-full max-w-2xl mx-auto">
            {/* Hero Title */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-medium backdrop-blur-xl">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Custom Ephemeral Links</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                Share assets that <span className="text-indigo-400">disappear</span>.
              </h1>
              <p className="text-sm md:text-base text-white/50 max-w-xl mx-auto leading-relaxed">
                Upload your file, customize your secure link, and watch it vanish after use. Temporary sharing, permanent privacy.
              </p>
            </div>

            {/* Feature Highlights Bar (Equal Height Alignment) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              <div className="glass-panel p-3.5 rounded-2xl text-center flex flex-col items-center justify-center min-h-[96px] space-y-1">
                <Link className="w-5 h-5 mx-auto text-indigo-400" />
                <p className="text-xs font-bold text-white/90">Custom Slugs</p>
                <p className="text-[10px] text-white/40">Unique link names</p>
              </div>

              <div className="glass-panel p-3.5 rounded-2xl text-center flex flex-col items-center justify-center min-h-[96px] space-y-1">
                <Clock className="w-5 h-5 mx-auto text-indigo-400" />
                <p className="text-xs font-bold text-white/90">Auto-Delete</p>
                <p className="text-[10px] text-white/40">24h default (3d max)</p>
              </div>

              <div className="glass-panel p-3.5 rounded-2xl text-center flex flex-col items-center justify-center min-h-[96px] space-y-1">
                <Flame className="w-5 h-5 mx-auto text-rose-400" />
                <p className="text-xs font-bold text-white/90">Burn on Read</p>
                <p className="text-[10px] text-white/40">Instant wipe on dl</p>
              </div>

              <div className="glass-panel p-3.5 rounded-2xl text-center flex flex-col items-center justify-center min-h-[96px] space-y-1">
                <Lock className="w-5 h-5 mx-auto text-amber-400" />
                <p className="text-xs font-bold text-white/90">Password Lock</p>
                <p className="text-[10px] text-white/40">Passcode protected</p>
              </div>
            </div>

            {/* Main Interactive Glass Upload Box */}
            <GlassCard glowColor="indigo" className="p-6 md:p-8 w-full space-y-6">
              {/* File Dropzone */}
              <FileUploader
                selectedFile={selectedFile}
                onFileSelect={(file) => {
                  setSelectedFile(file);
                  setUploadError(null);
                }}
                disabled={isUploading}
              />

              {/* Link Customizations & Security Panel */}
              <UploadOptionsPanel
                options={options}
                onChange={setOptions}
                disabled={isUploading}
              />

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Submit Upload Button */}
              <button
                onClick={handleStartUpload}
                disabled={!selectedFile || isUploading}
                id="generate-temp-link-btn"
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg ${
                  !selectedFile || isUploading
                    ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/10"
                    : "bg-white text-black hover:bg-indigo-50 shadow-white/10 hover:scale-[1.01] cursor-pointer"
                }`}
              >
                {isUploading ? (
                  <>
                    <Zap className="w-5 h-5 text-indigo-600 animate-bounce" />
                    <span>Uploading & Generating Link...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>Generate Secure Link</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </GlassCard>

            {/* System Status Indicator Box */}
            <div className="w-full glass-panel rounded-2xl px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                <span className="text-xs font-medium text-white/70">Supabase Storage & Ephemeral Cleaner Active</span>
              </div>
              <span className="text-xs font-mono text-white/40">v2.5.0</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-6 text-xs text-white/30 relative z-10 bg-[#030305]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 gap-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-white/50">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-white/70 font-medium">Supabase Cloud Storage</span>
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center space-x-1.5">
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-white/70 font-medium">1.5 GB Max File Limit</span>
            </span>
          </div>
          <div className="text-center sm:text-right space-y-0.5">
            <p className="text-xs text-white/40">
              Real-time Ephemeral Sharing • Automatic Discard Engine
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
