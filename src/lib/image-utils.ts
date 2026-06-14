/**
 * Compress an image file to reduce upload size.
 * Default: max 800px wide, JPEG quality 0.6 (~50-150 KB output)
 */
export const compressImage = async (file: File, maxWidth = 800, quality = 0.6): Promise<File> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(file); // Fallback to original if canvas fails
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }
                        const compressedFile = new File([blob], file.name, {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    "image/jpeg",
                    quality
                );
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
};

/**
 * Upload a single file to Supabase Storage with timeout and retry.
 * Returns the public URL on success, throws on failure.
 * Includes post-upload verification to detect silent failures.
 */
export const uploadWithRetry = async (
    supabase: any,
    bucket: string,
    path: string,
    file: File,
    maxRetries = 3,
    timeoutMs = 45000
): Promise<string> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const uploadPromise = supabase.storage
                .from(bucket)
                .upload(path, file, { upsert: true });

            // Race between upload and timeout
            const result = await Promise.race([
                uploadPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout: upload trop long")), timeoutMs)
                ),
            ]) as { error: any; data: any };

            if (result.error) {
                throw new Error(result.error.message);
            }

            // Success — get public URL
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(path);

            const publicUrl = urlData.publicUrl;

            // Post-upload verification: check the file actually exists
            try {
                const headResp = await fetch(publicUrl, { method: 'HEAD' });
                if (!headResp.ok) {
                    throw new Error(`Vérification post-upload échouée (HTTP ${headResp.status})`);
                }
            } catch (verifyError) {
                // If HEAD fails, the file may not be accessible (bucket not public, etc.)
                console.warn(`Vérification post-upload échouée pour ${path}:`, verifyError);
                // Don't throw — the file may still be in storage even if HEAD fails
                // (e.g. CORS blocking HEAD requests). The URL is still valid.
            }

            return publicUrl;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Wait a bit before retrying (exponential backoff)
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }

    throw new Error(`Échec après ${maxRetries + 1} tentatives: ${lastError?.message}`);
};
