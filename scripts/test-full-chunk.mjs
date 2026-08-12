#!/usr/bin/env node
/**
 * E2E test: Buat note + SumoPod embedding (1536 dim) -> insert Supabase chunks.
 */
const SUPABASE_URL = "https://ruajiywsdixhsketfurf.supabase.co";
const SVC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWppeXdzZGl4aHNrZXRmdXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzOTc5NSwiZXhwIjoyMTAyMDE1Nzk1fQ.4AQoPb7XcIBtjXRApp5HFHOzUdHm0YtQB_jIN8V8G4k";
const SUMOPOD_URL = "https://ai.sumopod.com/v1";

import { readFileSync } from "node:fs";

const sumoKey = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("SUMOPOD_API_KEY="))
  ?.replace("SUMOPOD_API_KEY=", "")
  .trim();

if (!sumoKey) {
  console.error("❌ SUMOPOD_API_KEY not set");
  process.exit(1);
}

// 1. Get user ID dari users table
let res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
  headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` },
  signal: AbortSignal.timeout(10_000),
});
const users = await res.json();
const userId = users[0]?.id;
console.log(`✅ User ID: ${userId?.substring(0,8)}...`);

// 2. Create note
const createNote = await fetch(`${SUPABASE_URL}/rest/v1/notes`, {
  method: "POST",
  headers: {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    title: "Test Note - SumoPod Chunk Insert",
    summary: "Automated test for RAG chunk insertion with SumoPod embeddings.",
    subject: "Test",
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  signal: AbortSignal.timeout(10_000),
});
  const body = await createNote.text();
  if (!createNote.ok) throw new Error(`Create note failed: ${createNote.status}, ${body}`);
  const noteData = JSON.parse(body);
  const noteId = noteData.id || (Array.isArray(noteData) ? noteData[0]?.id : null);
  console.log(`✅ Created note: ${noteId?.substring(0,8)}...`);

// 3. Get embedding dari SumoPod (1536 dim)
const text = "Ini adalah tes chunk untuk testing pipeline RAG.";
const embRes = await fetch(`${SUMOPOD_URL}/embeddings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${sumoKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "text-embedding-3-small", input: [`passage: ${text}`] }),
  signal: AbortSignal.timeout(30_000),
});
const embData = await embRes.json();
const embedding = embData.data[0].embedding;
console.log(`✅ Embedding: ${embedding.length} dims`);

// 4. Insert chunk
const vectorStr = `[${embedding.join(",")}]`;
const chunkRes = await fetch(`${SUPABASE_URL}/rest/v1/chunks`, {
  method: "POST",
  headers: {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    note_id: noteId,
    chapter_id: 0,
    text,
    embedding: vectorStr,
  }),
  signal: AbortSignal.timeout(15_000),
});
const chunkText = await chunkRes.text();
if (chunkRes.ok) {
  const chunkId = JSON.parse(chunkText)[0]?.id;
  console.log(`✅ CHUNK INSERTED SUCCESS!`);
  console.log(`   Note ID: ${noteId}`);
  console.log(`   Chunk ID: ${chunkId?.substring(0,8)}...`);
  console.log(`   Text: "${text}"`);
  console.log(`   Dims: ${embedding.length}`);
  process.exit(0);
} else {
  console.error(`❌ INSERT FAILED: ${chunkRes.status} ${chunkText}`);
  process.exit(1);
}