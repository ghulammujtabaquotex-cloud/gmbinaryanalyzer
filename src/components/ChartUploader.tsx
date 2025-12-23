import { useCallback, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartUploaderProps {
  onImageSelect: (file: File | null) => void;
  selectedImage: File | null;
  disabled?: boolean;
}

// Compress image to stay under ~1 MB file size (base64 adds ~33%)
const MAX_DIMENSION = 1400;
const TARGET_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if larger than max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality levels until size is acceptable
      const tryQuality = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Compression failed"));
              return;
            }
            if (blob.size <= TARGET_SIZE_BYTES || quality <= 0.3) {
              const compressed = new File([blob], file.name, { type: "image/jpeg" });
              resolve(compressed);
            } else {
              tryQuality(quality - 0.1);
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryQuality(0.85);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = URL.createObjectURL(file);
  });
}

export function ChartUploader({ onImageSelect, selectedImage, disabled = false }: ChartUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      onImageSelect(compressed);
      const url = URL.createObjectURL(compressed);
      setPreviewUrl(url);
    } catch {
      // Fallback to original if compression fails
      onImageSelect(file);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setIsCompressing(false);
    }
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearImage = useCallback(() => {
    onImageSelect(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [onImageSelect, previewUrl]);

  return (
    <div className="w-full">
      {!selectedImage ? (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex flex-col items-center justify-center w-full h-64 rounded-xl cursor-pointer transition-all duration-300",
            "glass-card gradient-border",
            isDragOver 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "hover:bg-card/90 hover:border-primary/50"
          )}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
            <div className={cn(
              "p-4 rounded-full mb-4 transition-all duration-300",
              isDragOver ? "bg-primary/20" : "bg-secondary"
            )}>
              <Upload className={cn(
                "w-8 h-8 transition-colors duration-300",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <p className="mb-2 text-sm font-medium text-foreground">
              <span className="text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG or WebP (auto-compressed for fast analysis)
            </p>
            {isCompressing && (
              <p className="text-xs text-primary mt-1 animate-pulse">Compressing image…</p>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleInputChange}
            disabled={isCompressing}
          />
        </label>
      ) : (
        <div className="relative w-full rounded-xl overflow-hidden glass-card gradient-border animate-fade-in">
          <div className="relative aspect-video">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Chart preview"
                className="w-full h-full object-contain bg-background/50"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{selectedImage.name}</span>
            </div>
            <button
              onClick={clearImage}
              disabled={disabled}
              className={cn(
                "p-2 rounded-lg transition-colors",
                disabled 
                  ? "bg-muted text-muted-foreground cursor-not-allowed" 
                  : "bg-destructive/20 hover:bg-destructive/30 text-destructive"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
