/**
 * Smoke test API Kuis Share & Live Room (butuh backend lokal di :3001 +
 * Supabase terkonfigurasi — baca env dari backend/.env.local).
 *
 * Yang diuji: 401 tanpa auth, 404 token tak dikenal, alur publik
 * (GET share/room, join, start host, submit, skor), 409 duplikat
 * (nama dipakai, submit dobel, start dobel), validasi soal.
 *
 * Jalankan: .\backend\node_modules\.bin\tsx.cmd --test scripts/test-quiz-live.mjs
 */
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

function loadEnv(file) {
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val.includes(" ")) continue; // nilai multi-kata (mis. token OIDC) bukan milik kita
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

for (const f of ["backend/.env.local", ".env.local"]) {
  try {
    loadEnv(f);
  } catch {
    // lanjut ke file berikutnya
  }
}

const { createShare, createRoom, validateQuestions, QuizLiveError } =
  await import("../lib/quizLive.ts");

const BASE = "http://localhost:3001";
const j = (r) => r.json().catch(() => ({}));

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await j(res) };
}

const QUESTIONS = [
  { id: 1, question: "Soal 1", options: ["A1", "B1", "C1", "D1"], answer: 0, explanation: "Karena A" },
  { id: 2, question: "Soal 2", options: ["A2", "B2", "C2", "D2"], answer: 1, explanation: "Karena B" },
  { id: 3, question: "Soal 3", options: ["A3", "B3", "C3", "D3"], answer: 2, explanation: "Karena C" },
];

test("alur kuis share + live room (HTTP)", async () => {
  // 1) Auth wajib untuk buat share & room
  let r = await post("/api/quiz-shares", { noteId: "x", questions: QUESTIONS });
  assert.equal(r.status, 401, "share tanpa auth harus 401");
  r = await post("/api/quiz-rooms", { shareToken: "s_x", hostName: "H" });
  assert.equal(r.status, 401, "room tanpa auth harus 401");

  // 2) Token tak dikenal → 404 (termasuk prefix salah)
  r = await post("/api/quiz-shares/s_tidakada", null);
  assert.equal(r.status, 404);
  r = await post("/api/quiz-rooms/r_tidakada", null);
  assert.equal(r.status, 404);
  const wrongPrefix = await fetch(`${BASE}/api/quiz-shares/r_abc`);
  assert.equal(wrongPrefix.status, 404, "prefix r_ di endpoint share harus 404");

  // 3) Validasi soal
  assert.throws(() => validateQuestions([]), (e) => e instanceof QuizLiveError && e.status === 422);
  assert.throws(() => validateQuestions([{ question: "x" }]), (e) => e instanceof QuizLiveError && e.status === 422);

  // 4) Seed share + room via service-role (melewati auth)
  const share = await createShare({
    userId: "00000000-0000-0000-0000-000000000099",
    noteId: "00000000-0000-0000-0000-000000000098",
    noteTitle: "Kuis Smoke Test",
    questions: validateQuestions(QUESTIONS),
  });
  const room = await createRoom({ shareToken: share.token, hostName: "Host" });
  const roomToken = room.token;
  const hostKey = room.participantKey;

  try {
    // 5) GET share publik
    const shareRes = await fetch(`${BASE}/api/quiz-shares/${share.token}`);
    assert.equal(shareRes.status, 200);
    const shareData = await shareRes.json();
    assert.equal(shareData.title, "Kuis Smoke Test");
    assert.equal(shareData.questions.length, 3);

    // 6) GET room publik (lobby, 1 partisipan = host)
    const roomRes = await fetch(`${BASE}/api/quiz-rooms/${roomToken}`);
    assert.equal(roomRes.status, 200);
    let roomData = await roomRes.json();
    assert.equal(roomData.status, "lobby");
    assert.equal(roomData.participants.length, 1);
    assert.equal(roomData.participants[0].isHost, true);
    assert.equal(roomData.questions.length, 3);

    // 7) Join + nama duplikat → 409
    r = await post(`/api/quiz-rooms/${roomToken}/join`, { name: "Budi" });
    assert.equal(r.status, 201, "join pertama harus 201");
    const budiKey = r.data.participantKey;
    r = await post(`/api/quiz-rooms/${roomToken}/join`, { name: "Budi" });
    assert.equal(r.status, 409, "nama sama harus 409");

    // 8) Submit sebelum mulai → 409
    r = await post(`/api/quiz-rooms/${roomToken}/submit`, {
      participantKey: budiKey,
      answers: { "1": 0, "2": 1, "3": 2 },
    });
    assert.equal(r.status, 409, "submit sebelum live harus 409");

    // 9) Start dengan host_key salah → tetap 409 (sudah bukan lobby? belum)
    r = await post(`/api/quiz-rooms/${roomToken}/start`, { hostKey: "salah" });
    assert.equal(r.status, 409, "start tanpa host_key valid harus gagal (room masih lobby, tapi eq host_key gagal)");

    // 10) Start valid → 200, room jadi live
    r = await post(`/api/quiz-rooms/${roomToken}/start`, { hostKey });
    assert.equal(r.status, 200, "start dengan host_key harus 200");
    r = await post(`/api/quiz-rooms/${roomToken}/start`, { hostKey });
    assert.equal(r.status, 409, "start dobel harus 409");

    // 11) Submit valid → skor benar (2/3: q1 & q3 benar)
    r = await post(`/api/quiz-rooms/${roomToken}/submit`, {
      participantKey: budiKey,
      answers: { "1": 0, "2": 0, "3": 2 },
    });
    assert.equal(r.status, 200, "submit saat live harus 200");
    assert.deepEqual(r.data, { score: 2, total: 3 });

    // 12) Submit dobel → 409
    r = await post(`/api/quiz-rooms/${roomToken}/submit`, {
      participantKey: budiKey,
      answers: { "1": 0 },
    });
    assert.equal(r.status, 409, "submit dobel harus 409");

    // 13) Room mencerminkan skor
    roomData = await (await fetch(`${BASE}/api/quiz-rooms/${roomToken}`)).json();
    assert.equal(roomData.status, "live");
    const budi = roomData.participants.find((p) => p.name === "Budi");
    assert.ok(budi, "Budi ada di partisipan");
    assert.equal(budi.score, 2);
    assert.ok(budi.submittedAt, "submitted_at terisi");

    console.log("[ok] Semua assertion lulus ✔");
  } finally {
    // 14) Bersihkan data uji
    const { db } = await import("../lib/supabase/admin.ts");
    const { data: shareRow } = await db()
      .from("quiz_shares").select("id").eq("token", share.token).maybeSingle();
    if (shareRow) {
      await db().from("quiz_room_participants").delete().eq("room_id", room.id).select().then((r2) => r2);
      await db().from("quiz_rooms").delete().eq("id", room.id);
      await db().from("quiz_shares").delete().eq("id", shareRow.id);
    }
  }
});