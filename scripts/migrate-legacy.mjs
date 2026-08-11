#!/usr/bin/env node
/**
 * Eureka.AI — Migrasi data lama (data/*.json) ke Supabase.
 *
 * Pemakaian:
 *   node scripts/migrate-legacy.mjs --userId=<auth-user-uuid> [--name=Kamu] [--email=kamu@email.com]
 *
 * - userId: id user di Supabase Auth (login dulu lewat aplikasi, lalu ambil dari dashboard Auth > Users)
 * - Skrip idempotent: data yang sudah ada di DB dilewati.
 * - Membaca kredensial dari .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 */
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

// ---------- argumen ----------
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) args[m[1]] = m[2];
}

const userId = args.userId || process.env.EUREKA_MIGRATE_USER_ID;
if (!userId) {
  console.error(
    "Gunakan: node scripts/migrate-legacy.mjs --userId=<auth-user-uuid>"
  );
  process.exit(1);
}

// ---------- kredensial dari .env.local ----------
let env = {};
try {
  const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  // .env.local tidak ada
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!url.includes(".supabase.co") || !serviceKey.startsWith("eyJ")) {
  console.error(
    "Kredensial Supabase asli belum ada di .env.local (masih placeholder?).\n" +
      "Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY lalu coba lagi."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const stats = {};
function bump(key, n = 1) {
  stats[key] = (stats[key] ?? 0) + n;
}

async function readJson(name, fallback) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, name), "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function exists(table, idColumn, id) {
  const { data } = await supabase
    .from(table)
    .select(idColumn)
    .eq(idColumn, id)
    .maybeSingle();
  return Boolean(data);
}

// ---------- 0) pastikan profil user ada ----------
const profileName = args.name || "Pengguna";
const profileEmail = args.email || `${userId}@eureka.local`;
{
  const { error } = await supabase.from("users").upsert({
    id: userId,
    email: profileEmail,
    name: profileName,
  });
  if (error) {
    console.warn(
      `[users] Tidak bisa membuat baris profil: ${error.message}\n` +
        "  (Pastikan userId adalah id dari Supabase Auth — login dulu lewat aplikasi.)"
    );
  } else {
    bump("users");
  }
}

// ---------- 1) Catatan + chunk (vector-store.json) ----------
{
  const store = await readJson("vector-store.json", null);
  if (!store || !Array.isArray(store.notes)) {
    console.log("[notes] vector-store.json kosong / tidak ada — dilewati.");
  } else {
    const chunksById = {};
    for (const c of store.chunks ?? []) chunksById[c.noteId] ??= [];
    for (const c of store.chunks ?? []) chunksById[c.noteId].push(c);

    for (const note of store.notes) {
      if (await exists("notes", "id", note.id)) {
        bump("notes_skipped");
        continue;
      }
      const chunks = chunksById[note.id] ?? [];
      const summary = note.summary || chunks[0]?.text || note.title;
      const { error } = await supabase.from("notes").insert({
        id: note.id,
        user_id: userId,
        title: note.title,
        summary: String(summary).slice(0, 5000),
        subject: note.subject || null,
        created_at: note.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) {
        bump("notes_failed");
        console.warn(`  [notes] ${note.title}: ${error.message}`);
        continue;
      }
      bump("notes");

      if (chunks.length > 0) {
        const first = chunks[0].embedding;
        const dim = Array.isArray(first) ? first.length : null;
        if (dim !== 1536) {
          console.warn(
            `  [chunks] Catatan "${note.title}": dimensi embedding ${dim} != 1536 — teks diimpor tanpa embedding.`
          );
        }
        const rows = chunks.map((c, i) => ({
          note_id: note.id,
          chapter_id: c.chapterId ?? 0,
          text: c.text,
          embedding:
            Array.isArray(c.embedding) && c.embedding.length === 1536
              ? c.embedding
              : null,
          created_at: new Date().toISOString(),
        }));
        const { error: chunkErr } = await supabase
          .from("chunks")
          .insert(rows)
          .select("id");
        if (chunkErr) {
          bump("chunks_failed");
          console.warn(`  [chunks] ${note.title}: ${chunkErr.message}`);
        } else {
          bump("chunks", rows.length);
        }
      }
    }
  }
}

// ---------- 2) Progres (XP, hari aktif, log, kartu hafalan) ----------
{
  const store = await readJson("progress.json", null);
  const p = store?.users?.[userId] ?? store?.users?.[`test-user-${userId}`];
  if (p) {
    await supabase.from("progress").upsert({
      user_id: userId,
      xp: p.xp ?? 0,
      active_days: p.activeDays ?? [],
    });
    bump("progress");

    for (const e of p.activityLog ?? []) {
      await supabase.from("activity_log").insert({
        user_id: userId,
        xp: e.xp ?? 0,
        label: e.label ?? "Aktivitas belajar",
        created_at: e.date,
      });
      bump("activity_log");
    }

    for (const c of p.cards ?? []) {
      if (await exists("flashcards", "id", c.id)) {
        bump("flashcards_skipped");
        continue;
      }
      const { error } = await supabase.from("flashcards").insert({
        id: c.id,
        user_id: userId,
        note_id: c.noteId,
        front: c.front,
        back: c.back,
        due_date: c.dueDate,
        review_count: c.reviewCount ?? 0,
      });
      if (error && error.code !== "23503") bump("flashcards_failed");
      else bump("flashcards");
    }
  } else {
    console.log("[progress] tidak ada data untuk userId ini.");
  }
}

// ---------- 3) Ujian ----------
{
  const store = await readJson("exams.json", null);
  const entries = store?.users?.[userId] ?? [];
  for (const e of entries) {
    if (await exists("exams", "id", e.id)) {
      bump("exams_skipped");
      continue;
    }
    const { error } = await supabase.from("exams").insert({
      id: e.id,
      user_id: userId,
      subject: e.subject,
      title: e.title,
      date: e.date,
      status: e.status,
      score: e.score,
      created_at: e.createdAt,
    });
    if (error) bump("exams_failed");
    else bump("exams");
  }
}

// ---------- 4) Highlight ----------
{
  const entries = await readJson("highlights.json", []);
  for (const h of entries) {
    if (await exists("highlights", "id", h.id)) {
      bump("highlights_skipped");
      continue;
    }
    const { error } = await supabase.from("highlights").insert({
      id: h.id,
      note_id: h.noteId,
      chapter_id: h.chapterId ?? 0,
      text: h.text,
      color: h.color,
      user_id: h.userId ?? "user",
      created_at: h.createdAt,
    });
    if (error && error.code !== "23503") bump("highlights_failed");
    else bump("highlights");
  }
}

// ---------- 5) Gambar catatan ----------
{
  const entries = await readJson("note-images.json", []);
  for (const img of entries) {
    if (await exists("note_images", "id", img.id)) {
      bump("images_skipped");
      continue;
    }
    const { error } = await supabase.from("note_images").insert({
      id: img.id,
      note_id: img.noteId,
      chapter_id: img.chapterId ?? null,
      url: img.url,
      caption: img.caption ?? null,
      alignment: img.alignment ?? "center",
      size: img.size ?? "medium",
      source: img.source ?? "upload",
      position: img.position ?? 0,
      created_at: img.createdAt,
    });
    if (error && error.code !== "23503") bump("images_failed");
    else bump("images");
  }
}

// ---------- 6) Notifikasi ----------
{
  const entries = await readJson("notifications.json", []);
  for (const n of entries) {
    if (await exists("notifications", "id", n.id)) {
      bump("notifications_skipped");
      continue;
    }
    const { error } = await supabase.from("notifications").insert({
      id: n.id,
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link ?? null,
      read: n.read ?? false,
      created_at: n.createdAt,
    });
    if (error) bump("notifications_failed");
    else bump("notifications");
  }
}

// ---------- 7) Kuis & flashcards per catatan (note-study.json) ----------
{
  const store = await readJson("note-study.json", null);
  if (store) {
    const noteIds = new Set([
      ...Object.keys(store.quizzes ?? {}),
      ...Object.keys(store.flashcards ?? {}),
    ]);
    for (const noteId of noteIds) {
      const { data: existing } = await supabase
        .from("study_content")
        .select("note_id")
        .eq("note_id", noteId)
        .maybeSingle();
      const { error } = await supabase.from("study_content").upsert({
        note_id: noteId,
        quizzes: store.quizzes?.[noteId] ?? existing?.quizzes ?? [],
        flashcards: store.flashcards?.[noteId] ?? existing?.flashcards ?? [],
      });
      if (error && error.code !== "23503") bump("study_failed");
      else bump("study_content");
    }
  }
}

// ---------- 8) Papan tulis ----------
{
  const store = await readJson("whiteboards.json", null);
  for (const [noteId, board] of Object.entries(store?.boards ?? {})) {
    await supabase.from("whiteboards").upsert({
      note_id: noteId,
      cleared_at: board.clearedAt ?? 0,
    });
    bump("whiteboards");
    for (const s of board.strokes ?? []) {
      if (await exists("board_strokes", "id", s.id)) {
        bump("strokes_skipped");
        continue;
      }
      const { error } = await supabase.from("board_strokes").insert({
        id: s.id,
        note_id: noteId,
        author_id: s.authorId ?? "user",
        author_name: s.authorName ?? "Pengguna",
        color: s.color ?? "#3B82F6",
        size: s.size ?? 3,
        points: s.points ?? [],
        created_at: s.createdAt,
      });
      if (error && error.code !== "23503") bump("strokes_failed");
      else bump("strokes");
    }
  }
}

// ---------- 9) Catatan pribadi per bab (chapter-notes.json) ----------
{
  const store = await readJson("chapter-notes.json", null);
  for (const [key, entry] of Object.entries(store ?? {})) {
    const [noteId, chapterId] = key.split(":");
    const { error } = await supabase.from("chapter_notes").upsert({
      note_id: noteId,
      chapter_id: Number(chapterId),
      content: entry.content ?? "",
    });
    if (error && error.code !== "23503") bump("chapter_notes_failed");
    else bump("chapter_notes");
  }
}

// ---------- 10) Teman (hanya bila kedua user terdaftar di auth) ----------
{
  const store = await readJson("friends.json", null);
  const users = store?.users ?? {};
  for (const [id, u] of Object.entries(users)) {
    if (id === userId) continue;
    const { error } = await supabase.from("users").upsert({
      id,
      email: `${id}@eureka.local`,
      name: u.name ?? "Pengguna",
      created_at: u.createdAt,
    });
    if (error) {
      console.warn(
        `[friends] profil "${u?.name}" (${id}) tidak diimpor (bukan user auth): ${error.message}`
      );
    }
  }
  for (const f of store?.friendships ?? []) {
    if (![f.fromId, f.toId].includes(userId)) continue;
    const { data: a } = await supabase
      .from("users")
      .select("id")
      .eq("id", f.fromId)
      .maybeSingle();
    const { data: b } = await supabase
      .from("users")
      .select("id")
      .eq("id", f.toId)
      .maybeSingle();
    if (!a || !b) continue;
    const { error } = await supabase.from("friendships").insert({
      from_id: f.fromId,
      to_id: f.toId,
      status: f.status,
      created_at: f.createdAt,
    });
    if (error) bump("friendships_failed");
    else bump("friendships");
  }
}

// ---------- ringkasan ----------
console.log("\n=== Ringkasan migrasi ===");
for (const [k, v] of Object.entries(stats).sort((x, y) =>
  x[0].localeCompare(y[0])
)) {
  console.log(`  ${k.padEnd(24)} ${v}`);
}
console.log("Selesai. Buka aplikasi dan cek data kamu.");
