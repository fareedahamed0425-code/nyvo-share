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
} from "lucide-react";
import { UploadOptions } from "../types";
import { apiFetchJson } from "../utils/api";

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
        reason: "Min 3 chars",
      });
      return;
    }

    setSlugStatus({ checking: true, available: null });

    const timer = setTimeout(async () => {
      try {
        const { ok, data } = await apiFetchJson<{ available: boolean; reason?: string }>(
          `/api/check-slug/${encodeURIComponent(cleaned)}`
        );
        if (ok && typeof data.available === "boolean") {
          setSlugStatus({
            checking: false,
            available: data.available,
            reason: data.reason,
          });
          if (data.available) {
            onChange({ ...options, customSlug: cleaned });
          }
        } else {
          setSlugStatus({ checking: false, available: null });
        }
      } catch {
        setSlugStatus({ checking: false, available: null });
      }
    }, 350);

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
    <div className="space-y-4 w-full">
      {/* 1. CUSTOM LINK SLUG */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-white/70">
          <span className="flex items-center space-x-2">
            <Link className="w-3.5 h-3.5 text-indigo-400" />
            <span>Customize Link Path</span>
          </span>
          <span className="text-[11px] text-white/40">Optional human-readable slug</span>
        </div>

        <div className="flex items-center h-10 sm:h-11 rounded-xl bg-white/5 border border-white/10 focus-within:border-indigo-400/80 transition-all overflow-hidden shadow-inner">
          <span className="h-full flex items-center pl-3.5 pr-2 text-xs font-mono text-white/40 select-none border-r border-white/10 shrink-0">
            .../f/
          </span>
          <input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            disabled={disabled}
            placeholder="e.g. quarterly-review-deck"
            id="custom-slug-input"
            className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm font-mono text-white placeholder-white/20 focus:outline-none"
          />
          {slugInput.trim() && (
            <div className="pr-3 flex items-center shrink-0">
              {slugStatus.checking ? (
                <span className="text-xs text-white/40 animate-pulse">Checking...</span>
              ) : slugStatus.available === true ? (
                <span className="flex items-center text-xs text-emerald-400 font-semibold space-x-1.5">
                  <Check className="w-4 h-4" />
                  <span>Available</span>
                </span>
              ) : slugStatus.available === false ? (
                <span className="flex items-center text-xs text-rose-400 font-semibold space-x-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>{slugStatus.reason || "Taken"}</span>
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* 2. EXPIRATION TIMER (Generous, full-width segmented grid) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-white/70">
          <span className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Retention Period</span>
          </span>
          <span className="text-[11px] text-indigo-300/80 font-mono">24 Hours Default • Strict 3-Day Ceiling</span>
        </div>

        <div className="grid grid-cols-5 gap-2 w-full">
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
                className={`h-9 sm:h-10 px-2 rounded-xl text-xs font-bold border flex items-center justify-center text-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-400/90 text-white shadow-md shadow-indigo-500/30 scale-[1.01]"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. DOWNLOAD LIMIT & BURN AFTER READING (Spacious 2-column cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
        {/* Max Downloads */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 shadow-sm">
          <div className="space-y-0.5">
            <label className="flex items-center space-x-2 text-xs font-semibold text-white/80">
              <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Download Limit</span>
            </label>
            <p className="text-[10px] text-white/40">Caps total file pulls</p>
          </div>
          <select
            value={options.burnAfterRead ? 1 : options.maxDownloads || 0}
            onChange={(e) => handleMaxDownloadsChange(Number(e.target.value))}
            disabled={disabled || options.burnAfterRead}
            id="max-downloads-select"
            className="h-8 rounded-lg bg-white/10 border border-white/10 px-2.5 text-xs font-medium text-white focus:outline-none focus:border-indigo-400 transition-colors"
          >
            <option value={0} className="bg-[#0e0e14]">Unlimited</option>
            <option value={1} className="bg-[#0e0e14]">1 (Self-Destruct)</option>
            <option value={5} className="bg-[#0e0e14]">Max 5</option>
            <option value={10} className="bg-[#0e0e14]">Max 10</option>
            <option value={50} className="bg-[#0e0e14]">Max 50</option>
          </select>
        </div>

        {/* Burn after reading switch */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-rose-950/25 border border-rose-500/25 shadow-sm">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
              <span className="text-xs font-semibold text-rose-200">Burn on Read</span>
            </div>
            <p className="text-[10px] text-rose-300/60">Wipes instantly on 1st download</p>
          </div>
          <button
            type="button"
            onClick={() => handleBurnToggle(!options.burnAfterRead)}
            disabled={disabled}
            id="burn-after-read-toggle"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              options.burnAfterRead ? "bg-rose-500" : "bg-white/15"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                options.burnAfterRead ? "translate-x-4.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 4. PASSWORD PROTECTION (Spacious card with smooth input) */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-white/80">SHA-256 Passcode Protection</span>
            </div>
            <p className="text-[10px] text-white/40">Requires recipient to enter passcode before unlocking</p>
          </div>
          <button
            type="button"
            onClick={() => handlePasswordToggle(!enablePassword)}
            disabled={disabled}
            id="enable-password-toggle"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              enablePassword ? "bg-amber-500" : "bg-white/15"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                enablePassword ? "translate-x-4.5" : "translate-x-1"
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
              placeholder="Enter secure passcode for recipient..."
              id="password-protection-input"
              className="w-full h-9.5 rounded-xl bg-white/5 border border-amber-500/40 px-3.5 pr-10 text-xs sm:text-sm text-white placeholder-white/25 focus:border-amber-400 focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-white/40 hover:text-white cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
