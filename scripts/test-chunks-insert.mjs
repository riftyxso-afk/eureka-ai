#!/usr/bin/env node
/**
 * E2E test: SumoPod embedding (1536 dim) -> insert Supabase chunks.
 */
const SUMOPOD_URL = "https://ai.sumopod.com/v1";
const SUPABASE_URL = "https://ruajiywsdixhsketfurf.supabase.co";
const SVC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWppeXdzZGl4aHNrZXRmdXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzOTc5NSwiZXhwIjoyMTAyMDE1Nzk1fQ.4AQoPb7XcIBtjXRApp5HFHOzUdHm0YtQB_jIN8V8G4k";

import { readFileSync } from "node:fs";

const sumoKey = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("SUMOPOD_API_KEY="))
  ?.replace("SUMOPOD_API_KEY=", "")
  .trim();

if (!sumoKey) {
  console.error("❌ SUMOPOD_API_KEY not set in .env.local");
  process.exit(1);
}

// 1. Get embedding from SumoPod
const text = "test chunk dari script test-chunks-insert.mjs";
const embRes = await fetch(`${SUMOPOD_URL}/embeddings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${sumoKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "text-embedding-3-small", input: [`passage: ${text}`] }),
  signal: AbortSignal.timeout(30_000),
});
if (!embRes.ok) {
  console.error("❌ SumoPod embedding failed:", embRes.status, await embRes.text());
  process.exit(1);
}
const embData = await embRes.json();
const embedding = embData.data[0].embedding;
console.log(`✅ Embedding OK: ${embedding.length} dims`);

// 2. Insert into Supabase chunks
const vectorStr = `[${embedding.join(",")}]`;
const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/chunks`, {
  method: "POST",
  headers: {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    note_id: "401d7c26-220b-455b-a47f-2a5e584dec87",
    chapter_id: 0,
    text,
    embedding: vectorStr,
  }),
  signal: AbortSignal.timeout(15_000),
});
const insertText = await insertRes.text();
if (insertRes.ok) {
  console.log("✅ INSERT SUCCESS:", insertText.substring(0, 200));
} else {
  console.error("❌ INSERT FAILED:", insertRes.status, insertText);
}
