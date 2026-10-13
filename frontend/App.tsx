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
      {/* Sleek Ambient Glow Orbs */}
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

      {/* Main Expansive Viewport */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-2 sm:py-3 relative z-10 flex flex-col justify-center overflow-hidden">
        {/* If user accessed a file download view */}
        {currentViewSlug ? (
          <div className="w-full max-w-2xl mx-auto">
            <DownloadView slug={currentViewSlug} onGoHome={navigateToHome} />
          </div>
        ) : activeTab === "active" ? (
          /* User's Active Temp Links Tab */
          <div className="w-full max-w-3xl mx-auto">
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
          /* Primary Expansive 2-Column Split View Utilizing Full Screen Space */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center w-full">
            {/* Left Column: Hero Branding, Spacious Feature Tiles & Status */}
            <div className="lg:col-span-5 flex flex-col justify-center space-y-5">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-medium backdrop-blur-xl w-fit shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Zero-Knowledge Ephemeral Storage</span>
              </div>

              <div className="space-y-2.5">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1]">
                  Share assets that <span className="text-indigo-400">disappear</span>.
                </h1>
                <p className="text-xs sm:text-sm text-white/60 leading-relaxed max-w-lg">
                  Upload your files, configure automated self-destruct rules, and watch links vanish after use. Complete cloud anonymity with permanent privacy.
                </p>
              </div>

              {/* 4 Feature Highlights - Expansive Glass Tiles with Rich Breathing Room */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="glass-panel p-3.5 rounded-2xl flex items-center space-x-3.5 hover:border-indigo-500/30 transition-all shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-inner">
                    <Link className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white/90 truncate">Custom Slugs</p>
                    <p className="text-[11px] text-white/40 truncate">Personalized link paths</p>
                  </div>
                </div>

                <div className="glass-panel p-3.5 rounded-2xl flex items-center space-x-3.5 hover:border-indigo-500/30 transition-all shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-inner">
                    <Clock className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white/90 truncate">Auto-Delete</p>
                    <p className="text-[11px] text-white/40 truncate">24h default (3d max)</p>
                  </div>
                </div>

                <div className="glass-panel p-3.5 rounded-2xl flex items-center space-x-3.5 hover:border-rose-500/30 transition-all shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-inner">
                    <Flame className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white/90 truncate">Burn on Read</p>
                    <p className="text-[11px] text-white/40 truncate">Wipes on 1st download</p>
                  </div>
                </div>

                <div className="glass-panel p-3.5 rounded-2xl flex items-center space-x-3.5 hover:border-amber-500/30 transition-all shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-inner">
                    <Lock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white/90 truncate">Password Lock</p>
                    <p className="text-[11px] text-white/40 truncate">SHA-256 protected</p>
                  </div>
                </div>
              </div>

              {/* System Cloud Storage Status Indicator */}
              <div className="flex items-center space-x-2.5 text-xs text-white/50 pt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
                <span className="font-medium">Supabase Cloud Storage Active • 1.5 GB Max Limit</span>
              </div>
            </div>

            {/* Right Column: Full-Space Interactive Upload Workbench */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <GlassCard glowColor="indigo" className="p-6 sm:p-7 lg:p-8 rounded-3xl space-y-4 sm:space-y-5 w-full shadow-2xl border-white/10">
                {/* Spacious Drag-and-Drop Area */}
                <FileUploader
                  selectedFile={selectedFile}
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    setUploadError(null);
                  }}
                  disabled={isUploading}
                />

                {/* Generous Security & Link Options */}
                <UploadOptionsPanel
                  options={options}
                  onChange={setOptions}
                  disabled={isUploading}
                />

                {/* Upload Error Banner */}
                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="truncate">{uploadError}</span>
                  </div>
                )}

                {/* Big, Confident Generate Link Button */}
                <button
                  onClick={handleStartUpload}
                  disabled={!selectedFile || isUploading}
                  id="generate-temp-link-btn"
                  className={`w-full h-11 sm:h-12 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center space-x-2.5 transition-all shadow-lg ${
                    !selectedFile || isUploading
                      ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/10"
                      : "bg-white text-black hover:bg-indigo-50 shadow-white/15 hover:scale-[1.008] cursor-pointer"
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Zap className="w-4 h-4 text-indigo-600 animate-bounce" />
                      <span>Uploading & Generating Link...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Generate Secure Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </GlassCard>
            </div>
          </div>
        )}
      </main>

      {/* Slim, Elegant Footer */}
      <footer className="w-full border-t border-white/5 py-2.5 text-xs text-white/30 relative z-10 shrink-0 bg-[#030305]/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 text-white/50">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero-Knowledge Ephemeral Cloud Sharing</span>
            </span>
            <span className="text-white/20">•</span>
            <span className="text-white/40">Automatic Discard Engine</span>
          </div>
          <span className="text-white/30 font-mono text-[11px]">24h Default • Strict 3-Day Retention Ceiling</span>
        </div>
      </footer>
    </div>
  );
}
