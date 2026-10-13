import React, { useRef, useState } from "react";
import {
  UploadCloud,
  X,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  Archive,
  CheckCircle2,
} from "lucide-react";
import { formatFileSize, getFileCategory } from "../utils/formatters";

interface FileUploaderProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  selectedFile,
  onFileSelect,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    onFileSelect(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case "image":
        return <FileImage className="w-8 h-8 text-cyan-400" />;
      case "video":
        return <FileVideo className="w-8 h-8 text-purple-400" />;
      case "audio":
        return <FileAudio className="w-8 h-8 text-emerald-400" />;
      case "code":
        return <FileCode className="w-8 h-8 text-amber-400" />;
      case "archive":
        return <Archive className="w-8 h-8 text-rose-400" />;
      default:
        return <FileText className="w-8 h-8 text-indigo-400" />;
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        id="file-upload-input"
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`relative group cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-7 text-center transition-all duration-300 ${
            isDragging
              ? "border-indigo-400 bg-indigo-500/15 scale-[1.01] shadow-[0_0_30px_rgba(99,102,241,0.25)]"
              : "border-white/15 bg-white/[0.02] hover:border-indigo-400/60 hover:bg-white/[0.04]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {/* Subtle glowing halo in dropzone */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)] shrink-0 group-hover:scale-110 transition-transform duration-300">
              <UploadCloud className="w-7 h-7 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            </div>

            <div className="text-center sm:text-left space-y-1">
              <p className="text-base sm:text-lg font-bold text-white tracking-tight">
                Drop your file here, or{" "}
                <span className="text-indigo-400 group-hover:text-indigo-300 underline underline-offset-4 transition-colors">
                  browse files
                </span>
              </p>
              <p className="text-xs text-white/50">
                Any file type supported • High-speed cloud transfer up to <span className="text-white/80 font-semibold">1.5 GB</span>
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1 text-[11px] text-white/40">
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Documents</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Images</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Videos</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Archives</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Code</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 sm:p-5 backdrop-blur-md shadow-[0_4px_24px_rgba(99,102,241,0.2)] flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0">
            {previewUrl ? (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-slate-950 shadow-inner">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-indigo-500/10 border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
                {renderCategoryIcon(getFileCategory(selectedFile.type, selectedFile.name))}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm sm:text-base font-bold text-slate-100 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </h4>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 flex items-center space-x-2.5 mt-1 font-medium">
                <span className="text-slate-200">{formatFileSize(selectedFile.size)}</span>
                <span className="text-white/30">•</span>
                <span className="uppercase font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded-md text-indigo-300 font-semibold">
                  {selectedFile.name.split(".").pop() || "FILE"}
                </span>
                <span className="text-white/30">•</span>
                <span className="text-emerald-400 text-xs">Ready for upload</span>
              </p>
            </div>
          </div>

          {!disabled && (
            <button
              onClick={handleRemove}
              id="remove-file-button"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors border border-white/10 shrink-0 cursor-pointer"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
