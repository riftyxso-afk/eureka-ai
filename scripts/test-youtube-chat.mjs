/**
 * Uji unit fitur video chat & catatan dari chat (tanpa jaringan).
 * Jalankan: node --test scripts/test-youtube-chat.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractYoutubeVideoId,
  findYoutubeLink,
  findLatestYoutubeInUserMessages,
} from "../lib/assistant/videoUrl.ts";
import {
  buildChatTranscript,
  CHAT_TRANSCRIPT_DEFAULTS,
} from "../lib/assistant/chatTranscript.ts";

test("extractYoutubeVideoId: format youtube.com/watch", () => {
  assert.equal(
    extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
});

test("extractYoutubeVideoId: format youtu.be", () => {
  assert.equal(
    extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
});

test("extractYoutubeVideoId: format shorts", () => {
  assert.equal(
    extractYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
});

test("extractYoutubeVideoId: format embed", () => {
  assert.equal(
    extractYoutubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
});

test("extractYoutubeVideoId: non-YouTube → null", () => {
  assert.equal(extractYoutubeVideoId("https://example.com/video"), null);
  assert.equal(extractYoutubeVideoId("https://www.youtube.com/watch"), null);
  assert.equal(extractYoutubeVideoId(""), null);
});

test("findYoutubeLink: link di tengah kalimat", () => {
  const out = findYoutubeLink(
    "jelasin video ini https://youtu.be/dQw4w9WgXcQ tentang turunan dong"
  );
  assert.deepEqual(out, {
    url: "https://youtu.be/dQw4w9WgXcQ",
    videoId: "dQw4w9WgXcQ",
  });
});

test("findYoutubeLink: tanda baca di ujung URL dibersihkan", () => {
  const out = findYoutubeLink("tonton https://youtu.be/dQw4w9WgXcQ.");
  assert.equal(out?.url, "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(out?.videoId, "dQw4w9WgXcQ");
});

test("findYoutubeLink: beberapa URL → link YouTube pertama yang menang", () => {
  const out = findYoutubeLink(
    "https://example.com/pertama https://www.youtube.com/watch?v=AAAAAAAAAAA lalu https://youtu.be/BBBBBBBBBBB"
  );
  assert.equal(out?.videoId, "AAAAAAAAAAA");
});

test("findYoutubeLink: tanpa link YouTube → null", () => {
  assert.equal(findYoutubeLink("apa itu fotosintesis?"), null);
  assert.equal(findYoutubeLink("https://example.com/artikel"), null);
  assert.equal(findYoutubeLink(""), null);
});

test("findLatestYoutubeInUserMessages: pesan user terbaru yang menang", () => {
  const msgs = [
    { role: "user", content: "lihat video https://youtu.be/AAAAAAAAAAA ya" },
    { role: "assistant", content: "oke, itu tentang integral." },
    { role: "user", content: "video kedua https://youtu.be/BBBBBBBBBBB" },
  ];
  assert.equal(
    findLatestYoutubeInUserMessages(msgs),
    "https://youtu.be/BBBBBBBBBBB"
  );
});

test("findLatestYoutubeInUserMessages: pesan asisten dilewati", () => {
  const msgs = [
    { role: "assistant", content: "video: https://youtu.be/AAAAAAAAAAA" },
    { role: "user", content: "lanjut bahas turunan" },
  ];
  assert.equal(findLatestYoutubeInUserMessages(msgs), null);
});

test("findLatestYoutubeInUserMessages: kosong → null", () => {
  assert.equal(findLatestYoutubeInUserMessages([]), null);
});

test("buildChatTranscript: role diberi label, pesan kosong dilewati", () => {
  const out = buildChatTranscript([
    { role: "user", content: "apa itu turunan?" },
    { role: "assistant", content: "" },
    { role: "assistant", content: "turunan adalah laju perubahan." },
  ]);
  assert.ok(out.includes("Siswa: apa itu turunan?"));
  assert.ok(out.includes("Eureka: turunan adalah laju perubahan."));
  assert.ok(!out.includes("Siswa: \n"));
});

test("buildChatTranscript: hanya pesan terakhir maxMessages yang dipakai", () => {
  const msgs = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `pesan ke-${i}`,
  }));
  const out = buildChatTranscript(msgs, { maxMessages: 12 });
  assert.ok(out.includes("pesan ke-19"));
  assert.ok(!out.includes("pesan ke-0"));
  assert.equal(out.split("\n").length, 12); // 12 baris, satu per pesan
});

test("buildChatTranscript: batas maxChars membuang pesan TERTUA (tetap simpan terbaru)", () => {
  const msgs = Array.from({ length: 5 }, (_, i) => ({
    role: "user",
    content: `x`.repeat(100) + `-${i}`,
  }));
  const out = buildChatTranscript(msgs, { maxChars: 220 });
  assert.ok(out.length <= 220);
  // Pesan terbaru (indeks 4) harus ikut; pesan tertua (indeks 0) dibuang.
  assert.ok(out.endsWith(`x`.repeat(100) + `-4`));
  assert.ok(!out.includes(`x`.repeat(100) + `-0`));
});

test("buildChatTranscript: default & kosong", () => {
  assert.equal(buildChatTranscript([]), "");
  assert.equal(
    CHAT_TRANSCRIPT_DEFAULTS.maxMessages,
    12
  );
  assert.equal(CHAT_TRANSCRIPT_DEFAULTS.maxChars, 20000);
});
