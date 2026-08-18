/**
 * Uji unit transkrip video untuk panel subtitle sinkron (change
 * video-expand-subtitles) — tanpa jaringan.
 * Jalankan: node --test scripts/test-video-subtitles.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  activeSegmentIndex,
  sanitizeSegments,
  TranscriptCache,
  VIDEO_TRANSCRIPT_TTL_MS,
  MAX_TRANSCRIPT_SEGMENTS,
} from "../lib/videoTranscript.ts";

const segs = [
  { text: "pembukaan", offsetMs: 0, durationMs: 5000 },
  { text: "inti", offsetMs: 5000, durationMs: 4000 },
  { text: "penutup", offsetMs: 9000, durationMs: 3000 },
];

test("activeSegmentIndex: awal video → segmen pertama", () => {
  assert.equal(activeSegmentIndex(segs, 0), 0);
  assert.equal(activeSegmentIndex(segs, 2500), 0);
});

test("activeSegmentIndex: tengah segmen → indeks segmen itu", () => {
  assert.equal(activeSegmentIndex(segs, 5000), 1);
  assert.equal(activeSegmentIndex(segs, 8999), 1);
  assert.equal(activeSegmentIndex(segs, 9000), 2);
});

test("activeSegmentIndex: di batas akhir segmen → segmen berikutnya", () => {
  // t = offset+durasi persis = mulai segmen berikutnya.
  assert.equal(activeSegmentIndex(segs, 5000), 1);
  assert.equal(activeSegmentIndex(segs, 9000), 2);
});

test("activeSegmentIndex: gap antar segmen → -1", () => {
  const gapSegs = [
    { text: "a", offsetMs: 0, durationMs: 1000 },
    { text: "b", offsetMs: 3000, durationMs: 1000 },
  ];
  // 1000..3000 tidak tercakup segmen mana pun.
  assert.equal(activeSegmentIndex(gapSegs, 1500), -1);
});

test("activeSegmentIndex: durationMs 0 → fallback jarak ke segmen berikutnya", () => {
  const noDur = [
    { text: "a", offsetMs: 0, durationMs: 0 },
    { text: "b", offsetMs: 2000, durationMs: 1000 },
  ];
  // Segmen "a" aktif dari 0 sampai offset "b".
  assert.equal(activeSegmentIndex(noDur, 0), 0);
  assert.equal(activeSegmentIndex(noDur, 1999), 0);
  assert.equal(activeSegmentIndex(noDur, 2000), 1);
});

test("activeSegmentIndex: segmen terakhir durationMs 0 → aktif sampai tak terbatas", () => {
  const lastNoDur = [
    { text: "a", offsetMs: 0, durationMs: 1000 },
    { text: "b", offsetMs: 1000, durationMs: 0 },
  ];
  assert.equal(activeSegmentIndex(lastNoDur, 1000), 1);
  assert.equal(activeSegmentIndex(lastNoDur, 999999), 1);
});

test("activeSegmentIndex: sebelum video / di luar jangkauan → -1", () => {
  assert.equal(activeSegmentIndex(segs, -1), -1);
  assert.equal(activeSegmentIndex(segs, 12000), -1);
});

test("activeSegmentIndex: array kosong → -1", () => {
  assert.equal(activeSegmentIndex([], 0), -1);
});

test("sanitizeSegments: segmen kosong/whitespace dibuang", () => {
  const raw = [
    { text: "halo", offsetMs: 0, durationMs: 1000 },
    { text: "   ", offsetMs: 1000, durationMs: 1000 },
    { text: "", offsetMs: 2000, durationMs: 1000 },
    { text: "dunia", offsetMs: 3000, durationMs: 1000 },
  ];
  const out = sanitizeSegments(raw);
  assert.deepEqual(
    out.map((s) => s.text),
    ["halo", "dunia"]
  );
});

test("sanitizeSegments: durationMs default 0 bila tidak tersedia", () => {
  const out = sanitizeSegments([{ text: "x", offsetMs: 10 }]);
  assert.equal(out[0].durationMs, 0);
  assert.equal(out[0].offsetMs, 10);
});

test("sanitizeSegments: cap maks segmen", () => {
  const raw = Array.from({ length: MAX_TRANSCRIPT_SEGMENTS + 500 }, (_, i) => ({
    text: `s${i}`,
    offsetMs: i * 1000,
    durationMs: 1000,
  }));
  const out = sanitizeSegments(raw);
  assert.equal(out.length, MAX_TRANSCRIPT_SEGMENTS);
});

test("constants: TTL 1 jam & maks 2000 segmen", () => {
  assert.equal(VIDEO_TRANSCRIPT_TTL_MS, 60 * 60 * 1000);
  assert.equal(MAX_TRANSCRIPT_SEGMENTS, 2000);
});

test("TranscriptCache: hit dalam TTL mengembalikan data sama", () => {
  let now = 1_000_000;
  const cache = new TranscriptCache(1000, () => now);
  const data = { title: "V", segments: [{ text: "a", offsetMs: 0, durationMs: 0 }] };
  cache.set("videoA", data);
  now += 500;
  assert.deepEqual(cache.get("videoA"), data);
});

test("TranscriptCache: expired → null (ambil ulang)", () => {
  let now = 1_000_000;
  const cache = new TranscriptCache(1000, () => now);
  cache.set("videoA", { title: "V", segments: [] });
  now += 1001;
  assert.equal(cache.get("videoA"), null);
});

test("TranscriptCache: miss untuk videoId yang belum ada", () => {
  const cache = new TranscriptCache();
  assert.equal(cache.get("tidak-ada"), null);
});
