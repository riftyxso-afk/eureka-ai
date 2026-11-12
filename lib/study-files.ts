import { randomUUID } from "node:crypto";
import { db } from "./supabase/admin";

import { studyFileSchema, type StudyFile } from "./study-file-types";
export type { StudyFile } from "./study-file-types";
const bucket = "study-computer-files";
let ready: Promise<void> | undefined;
async function ensureBucket() {
  ready ??= (async () => {
    const client = db().storage;
    const existing = await client.getBucket(bucket);
    if (existing.data?.public) throw new Error("Penyimpanan hasil harus privat.");
    if (existing.data) return;
    const result = await client.createBucket(bucket, { public: false, fileSizeLimit: 8 * 1024 * 1024 });
    if (result.error) {
      const check = await client.getBucket(bucket);
      if (!check.data || check.data.public) throw new Error("Penyimpanan file belum tersedia.");
    }
  })().catch(cause => { ready = undefined; throw cause; });
  return ready;
}

export async function saveStudyFile(userId: string, sessionId: string, name: string, mime: string, bytes: Buffer): Promise<StudyFile> {
  const file = studyFileSchema.parse({ id: randomUUID(), name, mime, size: bytes.length });
  await ensureBucket();
  const result = await db().storage.from(bucket).upload(`${userId}/${sessionId}/${file.id}`, bytes, { contentType: mime, upsert: false });
  if (result.error) throw new Error("File belum berhasil dikirim ke percakapan.");
  return file;
}

export async function readStudyFile(userId: string, sessionId: string, fileId: string) {
  const result = await db().storage.from(bucket).download(`${userId}/${sessionId}/${fileId}`);
  if (result.error || !result.data) throw new Error("File tidak ditemukan.");
  return result.data;
}
