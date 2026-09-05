/**
 * Penyimpanan gambar catatan yang PERMANEN & lintas-instance.
 *
 * Masalah yang dipecahkan: enrichment catatan dulu menulis file ke
 * `public/images/notes/<noteId>/` di disk server. Di produksi (frontend
 * Vercel + backend VPS terpisah) URL `/images/notes/...` dilayani frontend
 * yang tidak punya file-nya → gambar rusak (404). Selain itu disk Vercel
 * read-only dan file hilang saat redeploy.
 *
 * Solusi: unggah ke Supabase Storage (bucket publik `note-images`) →
 * URL absolut yang sama-sama bisa diakses frontend & backend dari mana pun.
 */
import { db } from "./supabase/admin";

export const NOTE_IMAGE_BUCKET = "note-images";

let bucketReady = false;

/** Pastikan bucket publik ada (sekali per proses). */
async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const client = db();
  const { data } = await client.storage.listBuckets();
  const exists = (data ?? []).some((b) => b.name === NOTE_IMAGE_BUCKET);
  if (!exists) {
    const { error } = await client.storage.createBucket(NOTE_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    // Race antar-instance: bila sudah dibuat instance lain, abaikan.
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

/**
 * Unggah buffer gambar → kembalikan URL publik Supabase Storage.
 * path: `notes/<noteId>/<filename>` (dinormalisasi, tanpa leading slash).
 * null bila gagal (pemanggil memutuskan fallback).
 */
export async function uploadNoteImage(
  noteId: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  try {
    await ensureBucket();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `notes/${noteId}/${safeName}`;
    const client = db();
    const { error } = await client.storage.from(NOTE_IMAGE_BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.warn("[noteImageStorage] upload gagal:", error.message);
      return null;
    }
    const { data } = client.storage.from(NOTE_IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn("[noteImageStorage] error:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Hapus objek dari bucket note-images berdasarkan URL publiknya.
 * Mengembalikan true bila terhapus / sudah tidak ada; false bila gagal.
 * URL yang bukan milik bucket ini (mis. legacy path lokal) → true (no-op).
 */
export async function deleteNoteImage(publicUrl: string): Promise<boolean> {
  try {
    const client = db();
    const { data } = client.storage.from(NOTE_IMAGE_BUCKET).getPublicUrl("_probe");
    const prefix = data.publicUrl.replace(/\/_probe$/, "");
    if (!publicUrl.startsWith(prefix)) return true; // bukan objek storage ini
    const path = publicUrl.slice(prefix.length + 1);
    const { error } = await client.storage.from(NOTE_IMAGE_BUCKET).remove([path]);
    if (error) {
      console.warn("[noteImageStorage] remove gagal:", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Kembalikan URL absolut untuk path `/images/notes/<noteId>/<file>` lama
 * bila file-nya masih ada di disk server ini (root public/ atau
 * backend/public/), selain itu null. Dipakai migrasi satu kali.
 */
export async function readLegacyNoteImage(
  legacyPath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const { promises: fs } = await import("fs");
  const { default: path } = await import("path");
  const rel = legacyPath.replace(/^\/+/, ""); // images/notes/<id>/<file>
  const candidates = [
    path.join(process.cwd(), "public", rel),
    path.join(process.cwd(), "..", "public", rel),
    path.join(process.cwd(), "backend", "public", rel),
  ];
  for (const file of candidates) {
    try {
      const buffer = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType =
        ext === ".png" ? "image/png" :
        ext === ".webp" ? "image/webp" :
        ext === ".gif" ? "image/gif" : "image/jpeg";
      return { buffer, contentType };
    } catch {
      // coba kandidat berikutnya
    }
  }
  return null;
}
