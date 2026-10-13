import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Clock,
  ShieldAlert,
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

  useEffect(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.5 },
        colors: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"],
      });
    } catch {
      // ignore
    }
  }, []);

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

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    shareUrl
  )}&color=0f172a&bgcolor=f8fafc`;

  return (
    <GlassCard glowColor="indigo" className="p-4 sm:p-6 space-y-4 max-w-xl mx-auto w-full">
      {/* Header Badge */}
      <div className="flex flex-col items-center text-center space-y-1">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
        </div>
        <h3 className="text-lg sm:text-xl font-extrabold text-white">Temporary Link Active</h3>
        <p className="text-[11px] text-white/50 truncate max-w-sm">
          File <span className="text-indigo-400 font-semibold">{fileName}</span> ({fileSize}) is uploaded & ready.
        </p>
      </div>

      {/* Main Copy Bar */}
      <div className="space-y-1">
        <div className="flex items-center space-x-1.5 bg-white/5 border border-indigo-500/30 rounded-lg p-1.5 pl-2.5">
          <Link className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="bg-transparent text-[11px] font-mono text-indigo-200 w-full focus:outline-none truncate"
          />
          <button
            onClick={handleCopy}
            id="copy-share-url-btn"
            className="px-3 py-1.5 rounded-md bg-white text-black hover:bg-indigo-50 font-bold text-[11px] flex items-center space-x-1 transition-all shrink-0 shadow-sm cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Badges & Live Countdown */}
      <div className="grid grid-cols-2 gap-2">
        {/* Countdown */}
        <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/5 border border-white/10">
          <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-300">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-400">Expires In</p>
            <p className="text-xs font-mono font-bold text-indigo-200">{timeLeft.text}</p>
          </div>
        </div>

        {/* Security / Burn Status */}
        <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/5 border border-white/10">
          <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-300">
            {burnAfterRead ? <Flame className="w-3.5 h-3.5 text-rose-400" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-400">Security Rule</p>
            <p className="text-[11px] font-semibold text-slate-200 truncate">
              {burnAfterRead ? "Burn on 1st DL" : requiresPassword ? "Passcode Protected" : "Auto-Deletes"}
            </p>
          </div>
        </div>
      </div>

      {/* QR Code Expansion */}
      {showQr && (
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-950/70 border border-white/15 space-y-2">
          <img src={qrImageUrl} alt="QR Code" className="w-28 h-28 rounded-lg border border-white/20 p-1 bg-white" />
          <p className="text-[10px] text-slate-400">Slug: <span className="font-mono text-emerald-300">{slug}</span></p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setShowQr(!showQr)}
            id="toggle-qr-code-btn"
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 flex items-center space-x-1 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showQr ? "Hide QR" : "QR Code"}</span>
          </button>

          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 flex items-center space-x-1 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            <span>Test Link</span>
          </a>
        </div>

        <button
          onClick={onReset}
          id="upload-another-file-btn"
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-slate-100 text-[11px] font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Upload Another</span>
        </button>
      </div>
    </GlassCard>
  );
};
