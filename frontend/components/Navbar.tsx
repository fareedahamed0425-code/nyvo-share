import React from "react";
import { Upload, Layers, Flame } from "lucide-react";

interface NavbarProps {
  activeTab: "upload" | "active";
  setActiveTab: (tab: "upload" | "active") => void;
  activeUploadsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeUploadsCount,
}) => {
  return (
    <header className="w-full max-w-7xl mx-auto px-6 lg:px-10 pt-3.5 pb-2 relative z-50 shrink-0">
      <div className="flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => setActiveTab("upload")}
          className="flex items-center space-x-3 cursor-pointer group"
          id="brand-logo-button"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.25)] group-hover:scale-105 transition-transform duration-300">
            <Flame className="w-4.5 h-4.5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="text-xl font-extrabold tracking-tight text-white">
              NYVO <span className="text-indigo-400">SHARE</span>
            </span>
            <div className="hidden sm:block px-2.5 py-0.5 rounded-full bg-white/5 text-[11px] text-white/70 border border-white/10 font-semibold tracking-wide">
              Ephemeral Storage
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center space-x-2 bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md shadow-sm">
          <button
            onClick={() => setActiveTab("upload")}
            id="tab-upload-btn"
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "upload"
                ? "bg-indigo-600 text-white border border-indigo-400/50 shadow-md shadow-indigo-500/25"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          <button
            onClick={() => setActiveTab("active")}
            id="tab-active-links-btn"
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "active"
                ? "bg-indigo-600 text-white border border-indigo-400/50 shadow-md shadow-indigo-500/25"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Active Links</span>
            {activeUploadsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-400 text-slate-950 text-[10px] font-black">
                {activeUploadsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
