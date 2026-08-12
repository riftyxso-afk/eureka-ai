#!/usr/bin/env node
/**
 * E2E test: Buat catatan via /api/notes/process → generate bab-bab AI.
 * Menggunakan sumber web URL (butuh Firecrawl API key).
 */
const BASE = "http://localhost:3000";

import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8").split("\n");
const userId = env
  .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY="))
  ?.split("=")[1]
  ?.trim();

const sourceUrl = "https://id.wikipedia.org/wiki/Teknologi";

console.log("=== Test Buat Catatan + Generate Bab ===\n");

// 1. POST ke /api/notes/process
console.log("1️⃣  Mengirim request ke /api/notes/process...");
const form = new FormData();
form.append("sourceType", "web");
form.append("url", sourceUrl);
form.append("userId", "401d7c26-220b-455b-a47f-2a5e584dec87");
form.append("studyMode", "standar");
form.append("gayaPenulisan", "Ramah & Santai");
form.append("bahasa", "Bahasa Indonesia");
form.append("chapterCount", "4");

const res = await fetch(`${BASE}/api/notes/process`, {
  method: "POST",
  body: form,
  signal: AbortSignal.timeout(30_000),
});
const body = await res.json();
console.log(`Status: ${res.status}`);
if (!res.ok) {
  console.error("❌ Gagal:", JSON.stringify(body));
  process.exit(1);
}
const jobId = body.jobId;
console.log(`✅ Job terdaftar: ${jobId} (${body.status})\n`);

// 2. Poll status job sampai done/error
console.log("2️⃣  Memantau progres job...\n");
let attempts = 0;
while (attempts < 180) {
  await new Promise((r) => setTimeout(r, 2000));
  const statusRes = await fetch(`${BASE}/api/notes/jobs/${jobId}`);
  const data = await statusRes.json();
  const job = data.job;
  const pct = job.percent ?? 0;
  process.stdout.write(`\r   [${"█".repeat(Math.floor(pct / 10))}${"░".repeat(10 - Math.floor(pct / 10))}] ${pct}% — ${job.message ?? ""}   `);

  if (job.status === "done") {
    console.log(`\n\n✅ Job selesai! Note ID: ${job.noteId}`);
    console.log(`   Judul: ${job.noteTitle}`);
    process.exit(0);
  }
  if (job.status === "error" || job.status === "failed") {
    console.log(`\n\n❌ Job gagal: ${job.error}`);
    process.exit(1);
  }
  attempts++;
}
console.log("\n⚠️ Timeout menunggu job selesai.");
