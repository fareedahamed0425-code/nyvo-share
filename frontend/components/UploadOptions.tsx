import React, { useState, useEffect } from "react";
import {
  Clock,
  Link,
  Lock,
  Download,
  Flame,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { UploadOptions } from "../types";

interface UploadOptionsProps {
  options: UploadOptions;
  onChange: (options: UploadOptions) => void;
  disabled?: boolean;
}

export const UploadOptionsPanel: React.FC<UploadOptionsProps> = ({
  options,
  onChange,
  disabled = false,
}) => {
  const [slugInput, setSlugInput] = useState(options.customSlug || "");
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    reason?: string;
  }>({ checking: false, available: null });

  const [showPassword, setShowPassword] = useState(false);
  const [enablePassword, setEnablePassword] = useState(!!options.password);

  // Debounced custom slug checking
  useEffect(() => {
    if (!slugInput.trim()) {
      setSlugStatus({ checking: false, available: null });
      onChange({ ...options, customSlug: "" });
      return;
    }

    const cleaned = slugInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-");

    if (cleaned.length < 3) {
      setSlugStatus({
        checking: false,
        available: false,
        reason: "Must be at least 3 characters",
      });
      return;
    }

    setSlugStatus({ checking: true, available: null });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-slug/${encodeURIComponent(cleaned)}`);
        const data = await res.json();
        setSlugStatus({
          checking: false,
          available: data.available,
          reason: data.reason,
        });
        if (data.available) {
          onChange({ ...options, customSlug: cleaned });
        }
      } catch {
        setSlugStatus({ checking: false, available: null });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slugInput]);

  const handleExpirationChange = (mins: number) => {
    onChange({ ...options, expirationMinutes: mins });
  };

  const handleMaxDownloadsChange = (dl: number) => {
    onChange({ ...options, maxDownloads: dl });
  };

  const handlePasswordToggle = (enabled: boolean) => {
    setEnablePassword(enabled);
    if (!enabled) {
      onChange({ ...options, password: "" });
    }
  };

  const handlePasswordChange = (pwd: string) => {
    onChange({ ...options, password: pwd });
  };

  const handleBurnToggle = (burn: boolean) => {
    onChange({
      ...options,
      burnAfterRead: burn,
      maxDownloads: burn ? 1 : options.maxDownloads === 1 ? 0 : options.maxDownloads,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. CUSTOM LINK SLUG */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/60">
          <span className="flex items-center space-x-2">
            <Link className="w-3.5 h-3.5 text-indigo-400" />
            <span>Customize Link Slug</span>
          </span>
          <span className="text-[10px] text-white/40">Optional custom path</span>
        </label>

        <div className="relative">
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 focus-within:border-indigo-400/80 transition-colors overflow-hidden">
            <span className="pl-3.5 pr-1.5 py-2.5 text-xs font-mono text-white/40 select-none border-r border-white/10 shrink-0">
              .../f/
            </span>
            <input
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              disabled={disabled}
              placeholder="e.g. sleek-deck-2026"
              id="custom-slug-input"
              className="w-full bg-transparent px-3 py-2.5 text-xs font-mono text-white placeholder-white/20 focus:outline-none"
            />
            {slugInput.trim() && (
              <div className="pr-3 flex items-center shrink-0">
                {slugStatus.checking ? (
                  <span className="text-xs text-white/40 animate-pulse">Checking...</span>
                ) : slugStatus.available === true ? (
                  <span className="flex items-center text-xs text-emerald-400 font-medium space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Available</span>
                  </span>
                ) : slugStatus.available === false ? (
                  <span className="flex items-center text-xs text-rose-400 font-medium space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{slugStatus.reason || "Taken"}</span>
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. EXPIRATION TIMER */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/60">
          <span className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Link Expiration</span>
          </span>
          <span className="text-[10px] text-indigo-300 font-mono">Auto-deletes (24h default, max 3 days)</span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "10 Mins", minutes: 10 },
            { label: "1 Hour", minutes: 60 },
            { label: "6 Hours", minutes: 360 },
            { label: "24 Hours (Default)", minutes: 1440 },
            { label: "3 Days (Max)", minutes: 4320 },
          ].map((item) => {
            const isSelected = options.expirationMinutes === item.minutes;
            return (
              <button
                key={item.minutes}
                type="button"
                onClick={() => handleExpirationChange(item.minutes)}
                disabled={disabled}
                id={`expiration-${item.minutes}-btn`}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                  isSelected
                    ? "bg-indigo-600/80 border-indigo-400/50 text-white shadow-md shadow-indigo-500/20"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. DOWNLOAD LIMIT & BURN AFTER READING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Download limit */}
        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-white/60">
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Max Downloads</span>
          </label>
          <select
            value={options.burnAfterRead ? 1 : options.maxDownloads || 0}
            onChange={(e) => handleMaxDownloadsChange(Number(e.target.value))}
            disabled={disabled || options.burnAfterRead}
            id="max-downloads-select"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-xs text-white focus:border-indigo-400 focus:outline-none transition-colors"
          >
            <option value={0} className="bg-[#0e0e14] text-white">Unlimited (within duration)</option>
            <option value={1} className="bg-[#0e0e14] text-white">1 Download (Self-Destruct)</option>
            <option value={5} className="bg-[#0e0e14] text-white">Max 5 Downloads</option>
            <option value={10} className="bg-[#0e0e14] text-white">Max 10 Downloads</option>
            <option value={50} className="bg-[#0e0e14] text-white">Max 50 Downloads</option>
          </select>
        </div>

        {/* Burn after reading switch */}
        <div className="flex flex-col justify-between p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="text-xs font-semibold text-rose-200">Burn After Reading</span>
            </div>
            <button
              type="button"
              onClick={() => handleBurnToggle(!options.burnAfterRead)}
              disabled={disabled}
              id="burn-after-read-toggle"
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                options.burnAfterRead ? "bg-rose-500" : "bg-white/15"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  options.burnAfterRead ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-rose-300/70 mt-1">
            File wipes off server instantly after 1st download.
          </p>
        </div>
      </div>

      {/* 4. PASSWORD PROTECTION */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-white/80">Password Protection</span>
          </div>
          <button
            type="button"
            onClick={() => handlePasswordToggle(!enablePassword)}
            disabled={disabled}
            id="enable-password-toggle"
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              enablePassword ? "bg-amber-500" : "bg-white/15"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                enablePassword ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {enablePassword && (
          <div className="relative pt-1">
            <input
              type={showPassword ? "text" : "password"}
              value={options.password || ""}
              onChange={(e) => handlePasswordChange(e.target.value)}
              disabled={disabled}
              placeholder="Set download passcode..."
              id="password-protection-input"
              className="w-full rounded-xl bg-white/5 border border-amber-500/30 px-3.5 py-2 pr-10 text-xs text-white placeholder-white/20 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-white/40 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
