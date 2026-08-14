/**
 * Uji unit pembangun konteks belajar chat (tanpa jaringan).
 * Jalankan: node --test scripts/test-study-context.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNoteContext,
  buildSessionContext,
  buildStudyContext,
  collectMentionIds,
  detectStudyCommand,
  STUDY_CONTEXT_LIMIT,
} from "../lib/assistant/studyContext.ts";

test("detectStudyCommand: command exact-match case-insensitive", () => {
  assert.equal(detectStudyCommand("/kuis"), "quiz");
  assert.equal(detectStudyCommand("  /KUIS  "), "quiz");
  assert.equal(detectStudyCommand("/card"), "cards");
  assert.equal(detectStudyCommand("/Card"), "cards");
});

test("detectStudyCommand: bukan command bila bukan exact-match", () => {
  assert.equal(detectStudyCommand("/kuis 5"), null);
  assert.equal(detectStudyCommand("buat kuis"), null);
  assert.equal(detectStudyCommand("/card sekarang"), null);
  assert.equal(detectStudyCommand(""), null);
  assert.equal(detectStudyCommand("/kuisx"), null);
});

test("buildSessionContext: sesi kosong → string kosong", () => {
  assert.equal(buildSessionContext([]), "");
});

test("buildSessionContext: pesan kosong dilewati, role berlabel", () => {
  const out = buildSessionContext([
    { role: "user", content: "apa itu turunan?" },
    { role: "assistant", content: "" },
    { role: "assistant", content: "turunan adalah laju perubahan." },
  ]);
  assert.ok(out.includes("Anda:\napa itu turunan?"));
  assert.ok(out.includes("Eureka:\nturunan adalah laju perubahan."));
  assert.ok(!out.includes("Anda:\n\n"));
});

test("buildSessionContext: memotong dari awal", () => {
  const msgs = [
    { role: "user", content: "a".repeat(100) },
    { role: "assistant", content: "b".repeat(100) },
  ];
  const out = buildSessionContext(msgs, 120);
  assert.ok(out.length <= 120);
  assert.ok(out.startsWith("Anda:"));
});

test("buildNoteContext: catatan tanpa bab → title-only", () => {
  assert.equal(buildNoteContext([{ title: "Catatan X", chapters: [] }]), "Catatan X");
});

test("buildNoteContext: dengan bab → head/tail + judul", () => {
  const chapters = Array.from({ length: 6 }, (_, i) => ({
    title: `Bab ${i + 1}`,
    content: `Isi bab ${i + 1}`,
  }));
  const out = buildNoteContext([{ title: "Matematika", chapters }]);
  assert.ok(out.startsWith("Matematika"));
  assert.ok(out.includes("Bab 1\nIsi bab 1"));
  assert.ok(out.includes("Bab 6\nIsi bab 6"));
  assert.ok(!out.includes("Bab 4\nIsi bab 4"));
});

test("buildStudyContext: gabungan sesi + catatan dalam batas", () => {
  const msgs = [
    { role: "user", content: "jelaskan integral" },
    { role: "assistant", content: "integral adalah anti-turunan." },
  ];
  const notes = [{ title: "Kalkulus", chapters: [{ title: "Bab 1", content: "limit" }] }];
  const out = buildStudyContext(msgs, notes);
  assert.ok(out.length <= STUDY_CONTEXT_LIMIT);
  assert.ok(out.includes("PERCAKAPAN SESI"));
  assert.ok(out.includes("MATERI CATATAN"));
  assert.ok(out.includes("integral adalah anti-turunan"));
  assert.ok(out.includes("Kalkulus"));
});

test("buildStudyContext: tanpa sesi & catatan → kosong", () => {
  assert.equal(buildStudyContext([], []), "");
});

test("collectMentionIds: dedupe, trim, skip kosong", () => {
  const ids = collectMentionIds([
    { mentions: ["note-a", " note-a ", ""] },
    { mentions: ["note-b"] },
    { mentions: [] },
    { mentions: ["note-b"] },
  ]);
  assert.deepEqual(ids, ["note-a", "note-b"]);
});