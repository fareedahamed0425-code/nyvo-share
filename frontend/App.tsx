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
import { apiFetchJson } from "./utils/api";
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

  // Direct Slug View Route Handling: e.g. /f/:slug
  const [currentViewSlug, setCurrentViewSlug] = useState<string | null>(null);

  useEffect(() => {
    const handleRoute = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/f\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        setCurrentViewSlug(match[1]);
      } else {
        setCurrentViewSlug(null);
      }
    };

    handleRoute();
    window.addEventListener("popstate", handleRoute);
    return () => window.removeEventListener("popstate", handleRoute);
  }, []);

  const navigateToHome = () => {
    window.history.pushState({}, "", "/");
    setCurrentViewSlug(null);
    setUploadResult(null);
    setSelectedFile(null);
    setActiveTab("upload");
  };

  const navigateToSlug = (slug: string) => {
    window.history.pushState({}, "", `/f/${slug}`);
    setCurrentViewSlug(slug);
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

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

      const { ok, data } = await apiFetchJson<UploadResponse>("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!ok || !data.success) {
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
    <div className="h-screen max-h-screen bg-[#030305] text-white flex flex-col font-['Inter',sans-serif] selection:bg-indigo-500 selection:text-white relative overflow-hidden no-scrollbar">
      {/* Sleek Theme Glow Orbs */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />
      <div className="glow-orb orb-3" />

      {/* Slim Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (currentViewSlug) navigateToHome();
        }}
        activeUploadsCount={activeCount}
      />

      {/* Main Single-Screen Viewport */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-3 relative z-10 flex flex-col justify-center overflow-hidden">
        {/* If user accessed a file download view */}
        {currentViewSlug ? (
          <div className="w-full max-w-xl mx-auto">
            <DownloadView slug={currentViewSlug} onGoHome={navigateToHome} />
          </div>
        ) : activeTab === "active" ? (
          /* User's Active Temp Links Tab */
          <div className="w-full max-w-2xl mx-auto">
            <ActiveUploadsList onSelectSlug={(slug) => navigateToSlug(slug)} />
          </div>
        ) : uploadResult ? (
          /* Upload Success Share Screen */
          <div className="w-full max-w-xl mx-auto">
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
          /* Primary Single-Screen 2-Column Split View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full">
            {/* Left Column: Hero Branding & Feature Highlights */}
            <div className="lg:col-span-5 flex flex-col justify-center space-y-3.5">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-[11px] font-medium backdrop-blur-xl w-fit">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Custom Ephemeral Links</span>
              </div>

              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
                  Share assets that <span className="text-indigo-400">disappear</span>.
                </h1>
                <p className="text-xs sm:text-sm text-white/50 leading-relaxed max-w-md">
                  Upload your file, customize self-destruct rules, and watch it vanish after use. Ephemeral sharing with permanent privacy.
                </p>
              </div>

              {/* 4 Feature Highlights as a sleek 2x2 micro-tile grid */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                <div className="glass-panel p-2.5 rounded-xl flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Link className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white/90 truncate">Custom Slugs</p>
                    <p className="text-[9.5px] text-white/40 truncate">Personalized paths</p>
                  </div>
                </div>

                <div className="glass-panel p-2.5 rounded-xl flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white/90 truncate">Auto-Delete</p>
                    <p className="text-[9.5px] text-white/40 truncate">24h default (3d max)</p>
                  </div>
                </div>

                <div className="glass-panel p-2.5 rounded-xl flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white/90 truncate">Burn on Read</p>
                    <p className="text-[9.5px] text-white/40 truncate">Wipes on 1st DL</p>
                  </div>
                </div>

                <div className="glass-panel p-2.5 rounded-xl flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white/90 truncate">Password Lock</p>
                    <p className="text-[9.5px] text-white/40 truncate">Passcode protected</p>
                  </div>
                </div>
              </div>

              {/* System Status Pill */}
              <div className="flex items-center space-x-2 text-[11px] text-white/40 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                <span className="truncate">Supabase Cloud Storage • Max 1.5 GB</span>
              </div>
            </div>

            {/* Right Column: Upload Card Workbench */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <GlassCard glowColor="indigo" className="p-4 sm:p-5 space-y-3 w-full">
                {/* Compact Dropzone */}
                <FileUploader
                  selectedFile={selectedFile}
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    setUploadError(null);
                  }}
                  disabled={isUploading}
                />

                {/* Compact Options */}
                <UploadOptionsPanel
                  options={options}
                  onChange={setOptions}
                  disabled={isUploading}
                />

                {/* Error alert if any */}
                {uploadError && (
                  <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-[11px] flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="truncate">{uploadError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleStartUpload}
                  disabled={!selectedFile || isUploading}
                  id="generate-temp-link-btn"
                  className={`w-full h-9.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md ${
                    !selectedFile || isUploading
                      ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/10"
                      : "bg-white text-black hover:bg-indigo-50 shadow-white/10 hover:scale-[1.005] cursor-pointer"
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
                      <span>Uploading & Generating Link...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Generate Secure Link</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </GlassCard>
            </div>
          </div>
        )}
      </main>

      {/* Slim Non-Intrusive Footer */}
      <footer className="w-full border-t border-white/5 py-2 text-[11px] text-white/30 relative z-10 shrink-0 bg-[#030305]/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Knowledge Ephemeral Cloud Sharing</span>
          </span>
          <span className="text-white/20">24h Default • 3-Day Strict Ceiling</span>
        </div>
      </footer>
    </div>
  );
}
