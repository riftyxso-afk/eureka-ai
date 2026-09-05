// @ts-nocheck
/**
 * Migrasi satu kali: gambar catatan dengan path legacy `/images/notes/...`
 * (tersimpan di disk server) → unggah ke Supabase Storage bucket
 * `note-images` → tulis ulang URL di notes.chapters (JSONB) dan
 * note_images.url. Jalankan dari root repo:
 *   backend/node_modules/.bin/tsx scripts/migrate-note-images-to-storage.ts [--dry]
 */
import { readFileSync } from "fs";
import path from "path";
import { promises as fs } from "fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) {
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
const DRY = process.argv.includes("--dry");

const LEGACY_RE = /\/images\/notes\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+/g;

async function main() {
  const { db } = await import("@/lib/supabase/admin");
  const { uploadNoteImage } = await import("@/lib/noteImageStorage");
  const client = db();

  // 1) notes.chapters JSONB
  const { data: notes, error } = await client.from("notes").select("id,title,chapters");
  if (error) throw error;
  let notesUpdated = 0, imagesMigrated = 0, imagesMissing = 0;

  for (const note of notes ?? []) {
    const blob = JSON.stringify(note.chapters ?? "");
    const paths = [...new Set(blob.match(LEGACY_RE) ?? [])];
    if (paths.length === 0) continue;
    let chapters = note.chapters;
    let changed = false;
    for (const p of paths) {
      // Cari file di kandidat disk (root public/ atau backend/public/).
      const rel = p.replace(/^\/+/, "");
      const candidates = [
        path.join(process.cwd(), "public", rel),
        path.join(process.cwd(), "backend", "public", rel),
      ];
      let buffer = null, file = null;
      for (const c of candidates) {
        try { buffer = await fs.readFile(c); file = c; break; } catch {}
      }
      if (!buffer) {
        imagesMissing++;
        console.log(`  [MISSING] ${note.id} ${p} (file tidak ditemukan di disk)`);
        continue;
      }
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
      const filename = path.basename(file);
      if (DRY) {
        console.log(`  [DRY] ${note.id}: ${p} (${buffer.length} B) → akan diunggah`);
        continue;
      }
      const url = await uploadNoteImage(note.id, filename, buffer, contentType);
      if (!url) { imagesMissing++; console.log(`  [GAGAL UNGGAH] ${p}`); continue; }
      const blobStr = JSON.stringify(chapters);
      chapters = JSON.parse(blobStr.split(p).join(url));
      changed = true;
      imagesMigrated++;
      console.log(`  [OK] ${note.id}: ${p} → ${url}`);
    }
    if (changed && !DRY) {
      const { error: upErr } = await client.from("notes").update({ chapters }).eq("id", note.id);
      if (upErr) console.error(`  [DB ERROR] ${note.id}:`, upErr.message);
      else notesUpdated++;
    }
  }

  // 2) tabel note_images
  const { data: rows, error: rErr } = await client.from("note_images").select("id,note_id,url");
  if (rErr) console.error("note_images query error:", rErr.message);
  for (const row of rows ?? []) {
    if (!LEGACY_RE.test(String(row.url ?? ""))) continue;
    const p = String(row.url);
    const rel = p.replace(/^\/+/, "");
    const candidates = [
      path.join(process.cwd(), "public", rel),
      path.join(process.cwd(), "backend", "public", rel),
    ];
    let buffer = null, file = null;
    for (const c of candidates) { try { buffer = await fs.readFile(c); file = c; break; } catch {} }
    if (!buffer) { console.log(`  [MISSING note_images] ${row.id} ${p}`); continue; }
    if (DRY) { console.log(`  [DRY note_images] ${row.id}: ${p}`); continue; }
    const ext = path.extname(file).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
    const url = await uploadNoteImage(row.note_id, path.basename(file), buffer, contentType);
    if (!url) { console.log(`  [GAGAL UNGGAH note_images] ${p}`); continue; }
    const { error: u2 } = await client.from("note_images").update({ url }).eq("id", row.id);
    if (u2) console.error(`  [DB ERROR note_images ${row.id}]:`, u2.message);
    else { imagesMigrated++; console.log(`  [OK note_images] ${row.id}: ${p} → ${url}`); }
  }

  console.log(`\n=== SELESAI${DRY ? " (DRY RUN)" : ""} ===`);
  console.log(`catatan diperbarui: ${notesUpdated} | gambar dimigrasi: ${imagesMigrated} | hilang/gagal: ${imagesMissing}`);
}
void main().catch((e) => { console.error(e); process.exit(1); });
