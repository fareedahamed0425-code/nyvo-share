import React, { useRef, useState } from "react";
import {
  UploadCloud,
  File,
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
        return <FileImage className="w-6 h-6 text-cyan-400" />;
      case "video":
        return <FileVideo className="w-6 h-6 text-purple-400" />;
      case "audio":
        return <FileAudio className="w-6 h-6 text-emerald-400" />;
      case "code":
        return <FileCode className="w-6 h-6 text-amber-400" />;
      case "archive":
        return <Archive className="w-6 h-6 text-rose-400" />;
      default:
        return <FileText className="w-6 h-6 text-indigo-400" />;
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
          className={`relative group cursor-pointer rounded-xl border-2 border-dashed p-3.5 sm:p-4 text-center transition-all duration-300 ${
            isDragging
              ? "border-indigo-400 bg-indigo-500/10 scale-[1.01] shadow-[0_0_20px_rgba(99,102,241,0.2)]"
              : "border-white/10 bg-white/[0.02] hover:border-indigo-400/50 hover:bg-white/[0.04]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="relative z-10 flex items-center justify-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform duration-300">
              <UploadCloud className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            </div>

            <div className="text-left">
              <p className="text-sm font-semibold text-white leading-tight">
                Drop file here, or{" "}
                <span className="text-indigo-400 group-hover:text-indigo-300 underline underline-offset-2 transition-colors">
                  browse
                </span>
              </p>
              <p className="text-[11px] text-white/40 mt-0.5">
                Up to <span className="text-white/80 font-medium">1.5 GB</span> • Auto-expiring cloud storage
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-2.5 sm:p-3 backdrop-blur-md shadow-[0_2px_12px_rgba(99,102,241,0.15)] flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            {previewUrl ? (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-slate-950">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-white/10 flex items-center justify-center shrink-0">
                {renderCategoryIcon(getFileCategory(selectedFile.type, selectedFile.name))}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-100 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </h4>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                <span>{formatFileSize(selectedFile.size)}</span>
                <span>•</span>
                <span className="uppercase font-mono text-[9px] bg-white/10 px-1 py-0.2 rounded text-indigo-200">
                  {selectedFile.name.split(".").pop() || "FILE"}
                </span>
              </p>
            </div>
          </div>

          {!disabled && (
            <button
              onClick={handleRemove}
              id="remove-file-button"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors border border-white/10 shrink-0"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
