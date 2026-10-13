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
    <div className="space-y-3 w-full">
      {/* 1. CUSTOM LINK SLUG */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-white/60">
          <span className="flex items-center space-x-1.5">
            <Link className="w-3 h-3 text-indigo-400" />
            <span>Custom Link Slug</span>
          </span>
          <span className="text-[10px] text-white/30">Optional path</span>
        </div>

        <div className="flex items-center h-8.5 rounded-lg bg-white/5 border border-white/10 focus-within:border-indigo-400/80 transition-colors overflow-hidden">
          <span className="h-full flex items-center pl-2.5 pr-1.5 text-[11px] font-mono text-white/40 select-none border-r border-white/10 shrink-0">
            .../f/
          </span>
          <input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            disabled={disabled}
            placeholder="e.g. project-pitch-deck"
            id="custom-slug-input"
            className="w-full bg-transparent px-2.5 py-1 text-[11px] font-mono text-white placeholder-white/20 focus:outline-none"
          />
          {slugInput.trim() && (
            <div className="pr-2.5 flex items-center shrink-0">
              {slugStatus.checking ? (
                <span className="text-[10px] text-white/40 animate-pulse">Checking...</span>
              ) : slugStatus.available === true ? (
                <span className="flex items-center text-[10px] text-emerald-400 font-medium space-x-1">
                  <Check className="w-3 h-3" />
                  <span>Available</span>
                </span>
              ) : slugStatus.available === false ? (
                <span className="flex items-center text-[10px] text-rose-400 font-medium space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{slugStatus.reason || "Taken"}</span>
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* 2. EXPIRATION TIMER (Compact 5-button segment) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-white/60">
          <span className="flex items-center space-x-1.5">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>Link Expiration</span>
          </span>
          <span className="text-[10px] text-indigo-300 font-mono">24h default (max 3 days)</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: "10m", full: "10 Mins", minutes: 10 },
            { label: "1h", full: "1 Hour", minutes: 60 },
            { label: "6h", full: "6 Hours", minutes: 360 },
            { label: "24h (Def)", full: "24 Hours (Default)", minutes: 1440 },
            { label: "3d (Max)", full: "3 Days (Max)", minutes: 4320 },
          ].map((item) => {
            const isSelected = options.expirationMinutes === item.minutes;
            return (
              <button
                key={item.minutes}
                type="button"
                onClick={() => handleExpirationChange(item.minutes)}
                disabled={disabled}
                id={`expiration-${item.minutes}-btn`}
                title={item.full}
                className={`h-7 px-1 rounded-lg text-[10.5px] font-semibold border flex items-center justify-center text-center transition-all ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-400/80 text-white shadow-sm shadow-indigo-500/30"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. DOWNLOAD LIMIT & BURN AFTER READING (Compact 2-col) */}
      <div className="grid grid-cols-2 gap-2 items-stretch">
        {/* Max Downloads */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
          <label className="flex items-center space-x-1.5 text-[11px] font-medium text-white/70">
            <Download className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Downloads</span>
          </label>
          <select
            value={options.burnAfterRead ? 1 : options.maxDownloads || 0}
            onChange={(e) => handleMaxDownloadsChange(Number(e.target.value))}
            disabled={disabled || options.burnAfterRead}
            id="max-downloads-select"
            className="h-6.5 rounded-md bg-white/10 border border-white/10 px-1.5 text-[10.5px] text-white focus:outline-none"
          >
            <option value={0} className="bg-[#0e0e14]">Unlimited</option>
            <option value={1} className="bg-[#0e0e14]">1 (Burn)</option>
            <option value={5} className="bg-[#0e0e14]">Max 5</option>
            <option value={10} className="bg-[#0e0e14]">Max 10</option>
            <option value={50} className="bg-[#0e0e14]">Max 50</option>
          </select>
        </div>

        {/* Burn after reading switch */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-rose-950/25 border border-rose-500/25">
          <div className="flex items-center space-x-1.5">
            <Flame className="w-3 h-3 text-rose-400 shrink-0 animate-pulse" />
            <span className="text-[11px] font-medium text-rose-200">Burn on Read</span>
          </div>
          <button
            type="button"
            onClick={() => handleBurnToggle(!options.burnAfterRead)}
            disabled={disabled}
            id="burn-after-read-toggle"
            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors cursor-pointer ${
              options.burnAfterRead ? "bg-rose-500" : "bg-white/15"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                options.burnAfterRead ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 4. PASSWORD PROTECTION (Inline micro-row) */}
      <div className="p-2 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[11px] font-medium text-white/70">Password Protection</span>
          </div>
          <button
            type="button"
            onClick={() => handlePasswordToggle(!enablePassword)}
            disabled={disabled}
            id="enable-password-toggle"
            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors cursor-pointer ${
              enablePassword ? "bg-amber-500" : "bg-white/15"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                enablePassword ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {enablePassword && (
          <div className="relative pt-0.5">
            <input
              type={showPassword ? "text" : "password"}
              value={options.password || ""}
              onChange={(e) => handlePasswordChange(e.target.value)}
              disabled={disabled}
              placeholder="Set download password..."
              id="password-protection-input"
              className="w-full h-7 rounded-md bg-white/5 border border-amber-500/30 px-2.5 pr-8 text-[11px] text-white placeholder-white/20 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.2 text-white/40 hover:text-white cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
