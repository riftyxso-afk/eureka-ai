"use client";
import type { ChatAttachment } from "./types";

/** Normalize phone photos into a bounded JPEG understood by vision providers. */
export async function prepareChatImage(file: File): Promise<ChatAttachment> {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Pilih gambar berukuran maksimal 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Gambar tidak dapat dibaca. Gunakan JPG, PNG, atau WebP."));
      element.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Gambar belum dapat diproses.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    if (dataUrl.length > 1_400_000) dataUrl = canvas.toDataURL("image/jpeg", 0.55);
    if (dataUrl.length > 1_800_000) throw new Error("Gambar masih terlalu besar. Coba gambar dengan resolusi lebih kecil.");
    return { filename: file.name.replace(/\.[^.]+$/, "") + ".jpg", mimeType: "image/jpeg", dataUrl };
  } finally { URL.revokeObjectURL(url); }
}
