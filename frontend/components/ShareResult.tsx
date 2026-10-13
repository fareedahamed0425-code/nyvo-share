import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Clock,
  Download,
  ShieldAlert,
  Share2,
  RefreshCw,
  Flame,
  Sparkles,
  Link,
} from "lucide-react";
import { GlassCard } from "./GlassCard";
import { formatTimeRemaining } from "../utils/formatters";

interface ShareResultProps {
  slug: string;
  shareUrl: string;
  expiresAt: number | null;
  fileName: string;
  fileSize: string;
  burnAfterRead: boolean;
  requiresPassword: boolean;
  onReset: () => void;
}

export const ShareResult: React.FC<ShareResultProps> = ({
  slug,
  shareUrl,
  expiresAt,
  fileName,
  fileSize,
  burnAfterRead,
  requiresPassword,
  onReset,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(expiresAt));

  // Trigger confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"],
      });
    } catch {
      // ignore
    }
  }, []);

  // Countdown timer update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(formatTimeRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    shareUrl
  )}&color=0f172a&bgcolor=f8fafc`;

  return (
    <GlassCard glowColor="indigo" className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto w-full">
      {/* Header Badge */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)]">
          <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
        </div>
        <h3 className="text-2xl font-extrabold text-white">Temporary Link Active</h3>
        <p className="text-xs text-white/50">
          Your file <span className="text-indigo-400 font-semibold">{fileName}</span> ({fileSize}) is uploaded and ready to share.
        </p>
      </div>

      {/* Main Copy Bar */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Shareable Link (Customized)
        </label>
        <div className="flex items-center space-x-2 bg-white/5 border border-indigo-500/30 rounded-xl p-2 pl-3.5">
          <Link className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="bg-transparent text-xs font-mono text-indigo-200 w-full focus:outline-none truncate"
          />
          <button
            onClick={handleCopy}
            id="copy-share-url-btn"
            className="px-4 py-2 rounded-lg bg-white text-black hover:bg-indigo-50 font-bold text-xs flex items-center space-x-1.5 transition-all shrink-0 shadow-md cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Badges & Live Countdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Countdown */}
        <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Time Remaining</p>
            <p className="text-sm font-mono font-bold text-indigo-200">{timeLeft.text}</p>
          </div>
        </div>

        {/* Security / Burn Status */}
        <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
            {burnAfterRead ? <Flame className="w-4 h-4 text-rose-400" /> : <ShieldAlert className="w-4 h-4" />}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Security Rule</p>
            <p className="text-xs font-semibold text-slate-200">
              {burnAfterRead
                ? "Self-Destructs on 1st download"
                : requiresPassword
                ? "Password Protected"
                : "Auto-Deletes on Expiry"}
            </p>
          </div>
        </div>
      </div>

      {/* QR Code Expansion */}
      {showQr && (
        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-950/70 border border-white/15 space-y-3">
          <p className="text-xs text-slate-300 font-medium">Scan QR Code with phone camera</p>
          <img src={qrImageUrl} alt="QR Code" className="w-44 h-44 rounded-xl border border-white/20 p-2 bg-white" />
          <p className="text-[11px] text-slate-400">Custom Slug: <span className="font-mono text-emerald-300">{slug}</span></p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowQr(!showQr)}
            id="toggle-qr-code-btn"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center space-x-1.5 transition-colors"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>{showQr ? "Hide QR" : "Show QR"}</span>
          </button>

          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center space-x-1.5 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-indigo-400" />
            <span>Test Link</span>
          </a>
        </div>

        <button
          onClick={onReset}
          id="upload-another-file-btn"
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-slate-100 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Upload Another File</span>
        </button>
      </div>
    </GlassCard>
  );
};
