import { useCallback, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartUploaderProps {
  onImageSelect: (file: File | null) => void;
  selectedImage: File | null;
}

export function ChartUploader({ onImageSelect, selectedImage }: ChartUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type.startsWith("image/")) {
      onImageSelect(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
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
              PNG, JPG or WebP (Trading chart screenshot)
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleInputChange}
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
              className="p-2 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
