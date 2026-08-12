#!/usr/bin/env node
/**
 * Test RAG search via REST (fallback jika RPC tidak aktif).
 */
const SUPABASE_URL = "https://ruajiywsdixhsketfurf.supabase.co";
const SVC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWppeXdzZGl4aHNrZXRmdXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzOTc5NSwiZXhwIjoyMTAyMDE1Nzk1fQ.4AQoPb7XcIBtjXRApp5HFHOzUdHm0YtQB_jIN8V8G4k";

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

// Get first note
const notesRes = await fetch(`${SUPABASE_URL}/rest/v1/notes?select=id,title&limit=1`, {
  headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` },
});
const notes = await notesRes.json();
if (!notes[0]) throw new Error("No notes found");
const noteId = notes[0].id;
console.log(`Note ID: ${noteId}\n`);

// Get embedding for query
const embRes = await fetch("https://ai.sumopod.com/v1/embeddings", {
  method: "POST",
  headers: { Authorization: `Bearer ${sumoKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "text-embedding-3-small", input: ["query: test"] }),
  signal: AbortSignal.timeout(30_000),
});
const embData = await embRes.json();
const queryVec = "[" + embData.data[0].embedding.join(",") + "]";

// Use pgvector with KNN operator via REST filters
const chunksRes = await fetch(`${SUPABASE_URL}/rest/v1/chunks?select=*,similarity:1-(embedding <=> '${queryVec}'::vector)&order=similarity.desc&limit=5&nbv=1&note_id=eq.${noteId}`, {
  headers: {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    Prefer: "count=exact,planner-predict=true",
  },
  signal: AbortSignal.timeout(15_000),
});
const chunks = await chunksRes.json();

console.log(`Found ${chunks.length || 0} chunks`);
if (Array.isArray(chunks) && chunks.length > 0) {
  chunks.slice(0, 3).forEach((chunk, i) => {
    const score = chunk.similarity || "(no score)";
    console.log(`\n${i + 1}. ${chunk.text?.substring(0, 60)}...`);
    console.log(`   Score: ${score}, Chunk ID: ${chunk.id.substring(0, 8)}...`);
  });
} else {
  console.log("⚠️ No results or invalid response format");
  console.log("Response:", JSON.stringify(chunks, null, 2));
}
