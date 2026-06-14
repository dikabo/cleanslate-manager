import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { compressImage, uploadWithRetry } from "@/lib/image-utils";

interface PhotoUploadProps {
  orderId?: string;
  type: "before" | "after";
  existingPhotos?: Array<{ id: string; url: string }>;
  onPhotosChange?: (photos: Array<{ url: string; file?: File }>) => void;
  /** For use before order is created - stores files locally */
  localMode?: boolean;
  /** Link uploaded photo to a specific article */
  articleId?: string;
}

export function PhotoUpload({
  orderId,
  type,
  existingPhotos = [],
  onPhotosChange,
  localMode = false,
  articleId,
}: PhotoUploadProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  // In localMode, we ONLY use existingPhotos (controlled component)
  // In normal mode, we can use localPhotos for un-uploaded pending files.
  const [localPhotos, setLocalPhotos] = useState<Array<{ url: string; file: File }>>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const allPhotos = localMode ? existingPhotos : [...existingPhotos, ...localPhotos];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Compress immediately upon selection (whether local/uploaded mode)
    const compressedPromises = files.map(file => {
      // Basic check: only try to compress image types
      if (file.type.startsWith('image/')) {
        return compressImage(file, 1000, 0.72);
      }
      return Promise.resolve(file);
    });

    const toUpload = await Promise.all(compressedPromises);

    if (localMode) {
      const newLocalPhotos = toUpload.map((file) => ({
        url: URL.createObjectURL(file),
        file,
        id: crypto.randomUUID(), // Add temporary ID for local items
      }));
      // Pass the combined list directly to the parent
      const updated = [...existingPhotos, ...newLocalPhotos] as any[];
      onPhotosChange?.(updated);
      return;
    }

    if (!orderId) return;

    setUploading(true);
    try {
      let successCount = 0;
      let failedCount = 0;
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const ext = file.name.split(".").pop() || "jpg";
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const path = `${orderId}/${type}/${uniqueId}.${ext}`;

        toast.info(`Photo ${i + 1}/${toUpload.length} en cours...`, { id: "photo-upload-progress" });

        try {
          const publicUrl = await uploadWithRetry(supabase, "order-photos", path, file, 2, 30000);

          const photoData: { order_id: string; url: string; type: string; article_id?: string } = {
            order_id: orderId,
            url: publicUrl,
            type,
          };
          if (articleId) {
            photoData.article_id = articleId;
          }
          const { error: dbError } = await supabase.from("photos").insert(photoData);

          if (dbError) throw new Error(`Database (${dbError.message})`);
          successCount++;
        } catch (err) {
          failedCount++;
          const fileName = toUpload[i]?.name || `Photo ${i + 1}`;
          console.warn(`Photo "${fileName}" échouée:`, err);
        }
      }

      toast.dismiss("photo-upload-progress");
      if (successCount > 0) {
        toast.success(`${successCount}/${toUpload.length} photo(s) ajoutée(s)`);
        // Invalidate queries to refresh the photos in the UI
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-orders"] });
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} photo(s) non envoyée(s). Vérifiez votre connexion et réessayez.`,
          { duration: 6000 }
        );
      }
      if (successCount === 0 && failedCount > 0) {
        toast.error("Aucune photo n'a pu être envoyée. Vérifiez votre connexion.", { duration: 8000 });
      }
      onPhotosChange?.([]);
    } catch (error: unknown) {
      toast.error(`Erreur upload: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const removeLocalPhoto = (index: number) => {
    if (localMode) {
      // In local mode, 'index' refers to the item in existingPhotos
      const updated = existingPhotos.filter((_, i) => i !== index);
      onPhotosChange?.(updated);
    } else {
      // In normal mode, 'index' is the local unuploaded offset
      const updated = localPhotos.filter((_, i) => i !== index);
      setLocalPhotos(updated);
      onPhotosChange?.(updated);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {allPhotos.map((photo, idx) => (
          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border">
            <img
              src={photo.url}
              alt={`Photo ${type} ${idx + 1}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            {(localMode || idx >= existingPhotos.length) && (
              <button
                onClick={() => removeLocalPhoto(localMode ? idx : idx - existingPhotos.length)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
            "hover:border-primary hover:bg-primary/5 text-muted-foreground"
          )}
          aria-label="Prendre une photo"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Camera className="h-5 w-5" />
              <span className="text-xs">Photo</span>
            </>
          )}
        </button>

        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
            "hover:border-primary hover:bg-primary/5 text-muted-foreground"
          )}
          aria-label="Importer depuis la galerie"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-xs">Galerie</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {allPhotos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {allPhotos.length} photo(s)
        </p>
      )}
    </div>
  );
}
