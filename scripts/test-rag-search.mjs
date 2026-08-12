#!/usr/bin/env node
/**
 * Test RPC match_chunks via HTTP (cara aplikasi memanggilnya).
 */
const SUPABASE_URL = "https://ruajiywsdixhsketfurf.supabase.co";
const SUMOPOD_URL = "https://ai.sumopod.com/v1";

import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8").split("\n");
const sumoKey = env.find((l) => l.startsWith("SUMOPOD_API_KEY="))?.replace("SUMOPOD_API_KEY=", "").trim();
const svcKey = env.find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="))?.replace("SUPABASE_SERVICE_ROLE_KEY=", "").trim();

if (!sumoKey || !svcKey) process.exit(1);

const notesRes = await fetch(`${SUPABASE_URL}/rest/v1/notes?select=id&limit=1`, {
  headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
});
const notes = await notesRes.json();
const noteId = notes[0]?.id;
if (!noteId) throw new Error("No notes found");

console.log(`Note: ${noteId.substring(0, 8)}...\n`);

const embRes = await fetch(`${SUMOPOD_URL}/embeddings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${sumoKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "text-embedding-3-small", input: ["query: tes chunk RAG"] }),
  signal: AbortSignal.timeout(30_000),
});
const embData = await embRes.json();
const queryVec = "[" + embData.data[0].embedding.join(",") + "]";

const rpcRes = await fetch(`${SUPABASE_URL}/rpc/match_chunks`, {
  method: "POST",
  headers: {
    apikey: svcKey,
    Authorization: `Bearer ${svcKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query_embedding: queryVec,
    p_note_id: null,
    similarity_threshold: 0.5,
    top_k: 3,
  }),
  signal: AbortSignal.timeout(15_000),
});

const text = await rpcRes.text();
console.log(`HTTP ${rpcRes.status}\n`);

if (rpcRes.ok) {
  const results = JSON.parse(text);
  if (!Array.isArray(results)) {
    console.log("Response:", text.substring(0, 300));
    process.exit(1);
  }
  console.log(`✅ RPC match_chunks OK — ${results.length} results:\n`);
  results.forEach((r, i) => {
    console.log(`${i + 1}. similarity=${(r.similarity * 100).toFixed(1)}%  "${r.text}"`);
  });
} else {
  console.error("❌ RPC failed:", text.substring(0, 300));
  process.exit(1);
}
