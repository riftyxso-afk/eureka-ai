/**
 * Uji unit poin video (change video-expand-key-points) — tanpa jaringan.
 * Jalankan: node --test scripts/test-video-points.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parsePoints,
  VideoPointsCache,
  VIDEO_POINTS_TTL_MS,
  MAX_POINTS,
} from "../lib/videoPoints.ts";

test("parsePoints: format '- ' dibersihkan", () => {
  const out = parsePoints("- poin satu\n- poin dua\n");
  assert.deepEqual(out, ["poin satu", "poin dua"]);
});

test("parsePoints: format '• ' dan '* ' dibersihkan", () => {
  assert.deepEqual(parsePoints("• a\n• b"), ["a", "b"]);
  assert.deepEqual(parsePoints("* a\n* b"), ["a", "b"]);
});

test("parsePoints: format bernomor dibersihkan", () => {
  assert.deepEqual(parsePoints("1. pertama\n2. kedua"), ["pertama", "kedua"]);
  assert.deepEqual(parsePoints("1) pertama\n2) kedua"), ["pertama", "kedua"]);
});

test("parsePoints: baris kosong & whitespace dibuang", () => {
  assert.deepEqual(parsePoints("- a\n\n   \n- b"), ["a", "b"]);
});

test("parsePoints: dedupe & cap max", () => {
  const raw = Array.from({ length: 12 }, (_, i) => `- poin ${i}`).join("\n");
  const out = parsePoints(raw, 5);
  assert.equal(out.length, 5);
  const dup = parsePoints("- sama\n- sama\n- beda");
  assert.deepEqual(dup, ["sama", "beda"]);
});

test("parsePoints: teks tanpa bullet tetap jadi poin per baris", () => {
  const out = parsePoints("baris satu\nbaris dua");
  assert.deepEqual(out, ["baris satu", "baris dua"]);
});

test("parsePoints: kosong → []", () => {
  assert.deepEqual(parsePoints(""), []);
  assert.deepEqual(parsePoints("   "), []);
  assert.deepEqual(parsePoints(null), []);
  assert.deepEqual(parsePoints(undefined), []);
});

test("constants: TTL 1 jam & maks 8 poin", () => {
  assert.equal(VIDEO_POINTS_TTL_MS, 60 * 60 * 1000);
  assert.equal(MAX_POINTS, 8);
});

test("VideoPointsCache: hit dalam TTL mengembalikan poin sama", () => {
  let now = 1_000_000;
  const cache = new VideoPointsCache(1000, () => now);
  cache.set("videoA", ["p1", "p2"]);
  now += 500;
  assert.deepEqual(cache.get("videoA"), ["p1", "p2"]);
});

test("VideoPointsCache: expired → null (generate lagi)", () => {
  let now = 1_000_000;
  const cache = new VideoPointsCache(1000, () => now);
  cache.set("videoA", ["p1"]);
  now += 1001;
  assert.equal(cache.get("videoA"), null);
  // Miss kedua tetap null (entry dihapus).
  now += 5000;
  assert.equal(cache.get("videoA"), null);
});

test("VideoPointsCache: miss untuk videoId yang belum ada", () => {
  const cache = new VideoPointsCache();
  assert.equal(cache.get("tidak-ada"), null);
});
