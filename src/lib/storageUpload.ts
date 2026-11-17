/**
 * storageUpload.ts — client-side WebP compression + Supabase Storage upload for announcements.
 *
 * Resizes images to at most 800px on the longest edge, exports as WebP (0.8 quality),
 * and uploads to the `'announcements'` Supabase Storage bucket with immutable cache headers.
 * Falls back to the compressed WebP DataURL if the Storage upload fails (never the raw file).
 */

import { supabase } from "@lib/supabase";

const MAX_DIMENSION = 800;
const WEBP_QUALITY = 0.8;
const ANNOUNCEMENTS_BUCKET = "announcements";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
    img.src = src;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/webp",
      WEBP_QUALITY,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo convertir el WebP a DataURL"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses `file` to an 800px-bounded WebP image (quality 0.8) and uploads it
 * to Supabase Storage (`announcements` bucket, `cacheControl: '31536000'`).
 * Returns the public URL on success, or the compressed WebP DataURL as fallback.
 */
export async function uploadOptimizedAnnouncementImage(file: File): Promise<string> {
  const sourceDataUrl = await readFileAsDataUrl(file);
  if (typeof document === "undefined") return sourceDataUrl;

  const img = await loadImageElement(sourceDataUrl);
  const longest = Math.max(img.width, img.height, 1);
  const scale = Math.min(1, MAX_DIMENSION / longest);
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const webpBlob = await canvasToWebpBlob(canvas);
  const compressedDataUrl = webpBlob
    ? await blobToDataUrl(webpBlob)
    : canvas.toDataURL("image/webp", WEBP_QUALITY);

  if (!webpBlob) {
    return compressedDataUrl;
  }

  try {
    const uniqueId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `avisos/${uniqueId}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(ANNOUNCEMENTS_BUCKET)
      .upload(filePath, webpBlob, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      return compressedDataUrl;
    }

    const { data } = supabase.storage.from(ANNOUNCEMENTS_BUCKET).getPublicUrl(filePath);
    return data?.publicUrl || compressedDataUrl;
  } catch {
    return compressedDataUrl;
  }
}
