import React, { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Clock,
  Download,
  Lock,
  Sparkles,
  RefreshCw,
  Layers,
} from "lucide-react";
import { GlassCard } from "./GlassCard";
import {
  getStoredUploads,
  removeStoredUpload,
  LocalUploadRecord,
  formatFileSize,
  formatTimeRemaining,
} from "../utils/formatters";

interface ActiveUploadsListProps {
  onSelectSlug: (slug: string) => void;
}

export const ActiveUploadsList: React.FC<ActiveUploadsListProps> = ({ onSelectSlug }) => {
  const [uploads, setUploads] = useState<LocalUploadRecord[]>([]);
  const [activeStatuses, setActiveStatuses] = useState<
    Record<
      string,
      {
        active: boolean;
        downloadCount?: number;
        maxDownloads?: number | null;
        requiresPassword?: boolean;
        expiresAt?: number | null;
      }
    >
  >({});
  const [loading, setLoading] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const fetchStatuses = async () => {
    const list = getStoredUploads();
    setUploads(list);

    if (list.length === 0) return;

    try {
      setLoading(true);
      const res = await fetch("/api/active-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: list.map((item) => item.slug) }),
      });
      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.statuses)) {
        const map: Record<string, any> = {};
        data.statuses.forEach((st: any) => {
          map[st.slug] = st;
        });
        setActiveStatuses(map);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();

    const interval = setInterval(() => {
      fetchStatuses();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleCopy = (slug: string) => {
    const origin = window.location.origin;
    const shareUrl = `${origin}/f/${slug}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleDeleteEarly = async (slug: string, deleteToken: string) => {
    try {
      const res = await fetch(`/api/file/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: { "x-delete-token": deleteToken },
      });
      if (res.ok) {
        removeStoredUpload(slug);
        setUploads((prev) => prev.filter((item) => item.slug !== slug));
      }
    } catch {
      // ignore
    }
  };

  if (uploads.length === 0) {
    return (
      <GlassCard glowColor="none" className="p-8 text-center space-y-3 max-w-xl mx-auto">
        <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Layers className="w-6 h-6 text-slate-400" />
        </div>
        <h4 className="text-base font-semibold text-slate-200">No Active Temporary Uploads</h4>
        <p className="text-xs text-slate-400">
          Files you upload during this session will appear here with live countdowns and download counters.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-extrabold text-white">Your Active Links</h3>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono font-semibold">
            {uploads.length}
          </span>
        </div>
        <button
          onClick={fetchStatuses}
          disabled={loading}
          id="refresh-active-uploads-btn"
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Refresh active link statuses"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-3">
        {uploads.map((item) => {
          const status = activeStatuses[item.slug];
          const isLive = status ? status.active : true;
          const timeInfo = formatTimeRemaining(item.expiresAt);

          return (
            <GlassCard key={item.slug} glowColor={isLive ? "indigo" : "none"} className="p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white truncate" title={item.originalName}>
                      {item.originalName}
                    </span>
                    <span className="text-xs text-white/40 shrink-0">({formatFileSize(item.size)})</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Custom slug badge */}
                    <span className="font-mono text-indigo-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded text-xs">
                      /f/{item.slug}
                    </span>

                    {/* Expiration badge */}
                    <span
                      className={`flex items-center space-x-1 font-mono text-[11px] px-2 py-0.5 rounded ${
                        timeInfo.isExpired || !isLive
                          ? "bg-rose-950/40 text-rose-300 border border-rose-500/30"
                          : "bg-indigo-950/40 text-indigo-300 border border-indigo-500/30"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{isLive ? timeInfo.text : "Deleted"}</span>
                    </span>

                    {/* Download counter */}
                    {status && status.downloadCount !== undefined && (
                      <span className="flex items-center space-x-1 font-mono text-[11px] bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                        <Download className="w-3 h-3" />
                        <span>
                          {status.downloadCount}
                          {status.maxDownloads ? ` / ${status.maxDownloads}` : " dls"}
                        </span>
                      </span>
                    )}

                    {status?.requiresPassword && (
                      <span className="p-1 rounded bg-amber-500/20 text-amber-300" title="Password protected">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleCopy(item.slug)}
                    id={`copy-active-link-${item.slug}-btn`}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors border border-white/10 cursor-pointer"
                    title="Copy Share Link"
                  >
                    {copiedSlug === item.slug ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => onSelectSlug(item.slug)}
                    id={`view-active-link-${item.slug}-btn`}
                    className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 transition-colors border border-indigo-500/30 cursor-pointer"
                    title="Open Download Page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteEarly(item.slug, item.deleteToken)}
                    id={`delete-active-link-${item.slug}-btn`}
                    className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-300 transition-colors border border-white/10 cursor-pointer"
                    title="Self-Destruct File Now"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
};
