import React, { useState, useEffect } from "react";
import {
  Download,
  Lock,
  Clock,
  FileCheck,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Eye,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  Archive,
  ArrowLeft,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "./GlassCard";
import { FileMetadata } from "../types";
import {
  formatFileSize,
  formatTimeRemaining,
  getFileCategory,
} from "../utils/formatters";
import { apiFetch, apiFetchJson } from "../utils/api";

interface DownloadViewProps {
  slug: string;
  onGoHome: () => void;
}

export const DownloadView: React.FC<DownloadViewProps> = ({ slug, onGoHome }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ text: "", isExpired: false, secondsLeft: 0 });

  // 1. Fetch File Metadata
  useEffect(() => {
    let mounted = true;
    async function fetchFileInfo() {
      try {
        setLoading(true);
        setError(null);
        const { ok, data } = await apiFetchJson<{ success: boolean; error?: string; metadata?: FileMetadata }>(
          `/api/file-info/${encodeURIComponent(slug)}`
        );

        if (!mounted) return;

        if (!ok || !data.success || !data.metadata) {
          setError(data.error || (data as any).message || "This file link has expired, hit download limit, or was auto-deleted.");
          setLoading(false);
          return;
        }

        setMetadata(data.metadata);
        if (!data.metadata.requiresPassword) {
          setIsUnlocked(true);
        }
        setLoading(false);
      } catch {
        if (mounted) {
          setError("Failed to communicate with TempShare server.");
          setLoading(false);
        }
      }
    }

    fetchFileInfo();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Live Timer Update
  useEffect(() => {
    if (!metadata) return;

    setTimeLeft(formatTimeRemaining(metadata.expiresAt));

    const timer = setInterval(() => {
      const updated = formatTimeRemaining(metadata.expiresAt);
      setTimeLeft(updated);
      if (updated.isExpired) {
        setError("This file has expired and was auto-deleted.");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [metadata]);

  // Handle Password Unlock
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordError("Please enter the download password.");
      return;
    }

    try {
      setPasswordError(null);
      const { ok, data } = await apiFetchJson<{ verified: boolean; error?: string }>(
        `/api/verify-password/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      if (ok && data.verified) {
        setIsUnlocked(true);
      } else {
        setPasswordError(data.error || "Incorrect password. Please try again.");
      }
    } catch {
      setPasswordError("Password verification failed.");
    }
  };

  // Trigger Stream Download
  const handleDownload = async () => {
    if (!metadata) return;

    try {
      setIsDownloading(true);
      const res = await apiFetch(`/api/download/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || (errorData as any).message || "Download failed. File may have expired or self-destructed.");
        setIsDownloading(false);
        return;
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = metadata.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setIsDownloading(false);
      setDownloadSuccess(true);

      // If self-destruct / burn after read, alert user that file is now deleted
      if (metadata.isBurnAfterRead) {
        setTimeout(() => {
          setError("This file was set to Burn After Reading and has now been permanently destroyed from disk.");
        }, 1500);
      }
    } catch {
      setError("An error occurred during file download.");
      setIsDownloading(false);
    }
  };

  // Preview loader for images
  const handleLoadPreview = async () => {
    if (!metadata || previewData) {
      setShowPreview(!showPreview);
      return;
    }

    try {
      const res = await apiFetch(`/api/preview/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewData(objectUrl);
        setShowPreview(true);
      }
    } catch {
      // ignore
    }
  };

  const category = metadata ? getFileCategory(metadata.mimeType, metadata.originalName) : "document";

  const renderIcon = () => {
    switch (category) {
      case "image":
        return <FileImage className="w-10 h-10 text-cyan-400" />;
      case "video":
        return <FileVideo className="w-10 h-10 text-purple-400" />;
      case "audio":
        return <FileAudio className="w-10 h-10 text-emerald-400" />;
      case "code":
        return <FileCode className="w-10 h-10 text-amber-400" />;
      case "archive":
        return <Archive className="w-10 h-10 text-rose-400" />;
      default:
        return <FileText className="w-10 h-10 text-indigo-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center animate-spin">
          <Sparkles className="w-6 h-6 text-indigo-400" />
        </div>
        <p className="text-sm font-medium text-slate-300">Fetching temporary file link...</p>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard glowColor="rose" className="p-8 max-w-lg mx-auto text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-100">Link Expired or File Self-Destructed</h3>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">{error}</p>
        </div>
        <div className="pt-2">
          <button
            onClick={onGoHome}
            id="go-home-from-error-btn"
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-semibold flex items-center justify-center space-x-2 mx-auto transition-colors border border-white/15"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Upload New Temporary File</span>
          </button>
        </div>
      </GlassCard>
    );
  }

  if (!metadata) return null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Top Back Navigation */}
      <button
        onClick={onGoHome}
        id="back-to-home-btn"
        className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Create your own temporary link</span>
      </button>

      <GlassCard glowColor="indigo" className="p-6 sm:p-8 space-y-5 rounded-3xl shadow-2xl">
        {/* File Main Overview Header */}
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
            {renderIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate" title={metadata.originalName}>
              {metadata.originalName}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-200">{formatFileSize(metadata.size)}</span>
              <span>•</span>
              <span className="uppercase font-mono text-[9px] bg-white/10 px-1.5 py-0.2 rounded text-indigo-300">
                {metadata.originalName.split(".").pop() || "FILE"}
              </span>
            </div>
          </div>
        </div>

        {/* Burn Warning Banner */}
        {metadata.isBurnAfterRead && (
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 flex items-center space-x-2">
            <Flame className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
            <p className="text-[11px] text-rose-200 font-medium">
              Self-Destruct File: Will be permanently deleted off server immediately upon first download!
            </p>
          </div>
        )}

        {/* Live Timer and Security Meta */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-950/50 border border-white/10">
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[9px] uppercase text-slate-400 font-medium">Expires In</p>
              <p className="text-[11px] font-mono font-bold text-cyan-200">{timeLeft.text}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[9px] uppercase text-slate-400 font-medium">Downloads</p>
              <p className="text-[11px] font-mono font-bold text-slate-200">
                {metadata.downloadCount}{" "}
                {metadata.maxDownloads ? `/ ${metadata.maxDownloads}` : "(Unlimited)"}
              </p>
            </div>
          </div>
        </div>

        {/* Locked by Password Screen */}
        {!isUnlocked && (
          <form onSubmit={handleVerifyPassword} className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
            <div className="flex items-center space-x-2 text-amber-300">
              <KeyRound className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Password Required</span>
            </div>
            <p className="text-xs text-slate-300">
              The owner protected this link with a password. Enter passcode to access:
            </p>
            <div className="flex space-x-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                id="unlock-password-input"
                className="w-full bg-slate-950/80 border border-amber-500/40 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                id="unlock-file-btn"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-colors"
              >
                Unlock
              </button>
            </div>
            {passwordError && <p className="text-xs text-rose-400 mt-1">{passwordError}</p>}
          </form>
        )}

        {/* Unlocked Actions */}
        {isUnlocked && (
          <div className="space-y-4 pt-2">
            {/* Image Preview Toggle if image */}
            {category === "image" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleLoadPreview}
                  id="preview-image-btn"
                  className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 flex items-center justify-center space-x-2 transition-colors"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>{showPreview ? "Hide Image Preview" : "Preview Image"}</span>
                </button>

                {showPreview && previewData && (
                  <div className="rounded-xl overflow-hidden border border-white/20 max-h-72 bg-slate-950 flex items-center justify-center p-2">
                    <img src={previewData} alt="Preview" className="max-h-64 object-contain rounded-lg" />
                  </div>
                )}
              </div>
            )}

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              id="download-file-btn"
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-xl cursor-pointer ${
                isDownloading
                  ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/10"
                  : "bg-white text-black hover:bg-indigo-50 shadow-white/10 hover:scale-[1.01]"
              }`}
            >
              {isDownloading ? (
                <>
                  <Clock className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span>Preparing Stream Download...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download File ({formatFileSize(metadata.size)})</span>
                </>
              )}
            </button>

            {downloadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center text-xs text-emerald-300 flex items-center justify-center space-x-2">
                <FileCheck className="w-4 h-4" />
                <span>Download started! File successfully delivered.</span>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
};
