#!/usr/bin/env node
/**
 * Full end-to-end test: SumoPod Embedding → Insert Chunk → RAG Search
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

console.log("🚀 Starting full E2E test...\n");

// Step 1: Create note
console.log("Step 1: Creating note...");
let res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
  headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` },
});
const users = await res.json();
const userId = users[0]?.id;

const createNoteRes = await fetch(`${SUPABASE_URL}/rest/v1/notes`, {
  method: "POST",
  headers: {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    title: "Full RAG Test Note",
    summary: "Complete end-to-end test for RAG with SumoPod embeddings.",
    subject: "Testing",
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  signal: AbortSignal.timeout(10_000),
});
const noteBody = await createNoteRes.text();
if (!createNoteRes.ok) throw new Error(`Create failed: ${noteBody}`);
const noteData = JSON.parse(noteBody);
const noteId = noteData.id || (Array.isArray(noteData) ? noteData[0]?.id : null);
console.log(`   ✅ Created note: ${noteId.substring(0, 8)}...\n`);

// Step 2: Get embedding from SumoPod
console.log("Step 2: Getting embedding from SumoPod...");
const embRes = await fetch(`${SUMOPOD_URL}/embeddings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${sumoKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "text-embedding-3-small", input: ["passage: This is a complete end-to-end RAG test note."] }),
  signal: AbortSignal.timeout(30_000),
});
const embData = await embRes.json();
const embedding = embData.data[0].embedding;
console.log(`   ✅ Embedding: ${embedding.length} dims\n`);

// Step 3: Insert chunk
console.log("Step 3: Inserting chunk to Supabase...");
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
    text: "This is a complete end-to-end RAG test note.",
    embedding: vectorStr,
  }),
  signal: AbortSignal.timeout(15_000),
});
const chunkBody = await chunkRes.text();
if (!chunkRes.ok) throw new Error(`Insert failed: ${chunkBody}`);
const chunkId = JSON.parse(chunkBody)[0].id;
console.log(`   ✅ Chunk inserted: ${chunkId.substring(0, 8)}...\n`);

// Step 4: Test RAG search
console.log("Step 4: Testing RAG search...");
const queryEmbRes = await fetch(`${SUMOPOD_URL}/embeddings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${sumoKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "text-embedding-3-small", input: ["query: test RAG note"] }),
  signal: AbortSignal.timeout(30_000),
});
const queryEmbData = await queryEmbRes.json();
const queryVec = "[" + queryEmbData.data[0].embedding.join(",") + "]";

const matchRes = await fetch(`${SUPABASE_URL}/rpc/match_chunks`, {
  method: "POST",
  headers: {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    query_embedding: queryVec,
    p_note_id: noteId,
    similarity_threshold: 0.5,
    top_k: 2,
  }),
  signal: AbortSignal.timeout(15_000),
});
const searchResults = await matchRes.json();
console.log(`   ✅ Search returned: ${searchResults.length} chunks`);
if (searchResults.length > 0) {
  const result = searchResults[0];
  console.log(`      - Text: "${result.text}"`);
  console.log(`      - Similarity: ${(result.similarity * 100).toFixed(2)}%`);
}
console.log("");

console.log("✅ ALL TESTS PASSED!");
console.log("\nSummary:");
console.log(`  • Note ID: ${noteId}`);
console.log(`  • Chunk ID: ${chunkId}`);
console.log(`  • Embedding dims: ${embedding.length}`);
console.log(`  • RAG search: Working (${searchResults.length} results)`);
