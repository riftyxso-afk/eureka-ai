/**
 * Verifikasi kosakata grade kanonik (lib/gradeVocab.ts).
 * Jalankan: node scripts/check-grade-vocab.mjs
 * Mem-parse tabel pemetaan langsung dari sumber TS agar tidak duplikat.
 */
import { readFileSync } from "node:fs";

const vocabSrc = readFileSync(
  new URL("../lib/gradeVocab.ts", import.meta.url),
  "utf8"
);

// Ekstrak LEGACY_LABEL_MAP
const mapBlock = vocabSrc.match(/LEGACY_LABEL_MAP[^{]*\{([\s\S]*?)\}/)[1];
const legacyMap = {};
for (const m of mapBlock.matchAll(/"?([\w\s]+)"?:\s*"(\w+)"/g)) {
  legacyMap[m[1].trim()] = m[2];
}

// Ekstrak opsi gradeOptionsFor dari onboardingContent.ts
const contentSrc = readFileSync(
  new URL("../lib/onboardingContent.ts", import.meta.url),
  "utf8"
);
const validValues = new Set();
for (const m of contentSrc.matchAll(/value:\s*"(kelas_\d+|semester_\d+|pemula|menengah|lanjut)"/g)) {
  validValues.add(m[1]);
}

function normalize(raw) {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (validValues.has(v)) return v;
  return legacyMap[v.toLowerCase()] ?? null;
}

let fail = 0;
function expect(input, want) {
  const got = normalize(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  normalize(${JSON.stringify(input)}) = ${JSON.stringify(got)}${ok ? "" : ` (harusnya ${JSON.stringify(want)})`}`);
}

// Enum baru lolos apa adanya
expect("kelas_10", "kelas_10");
expect("semester_3", "semester_3");
expect("pemula", "pemula");
// Label lama profil versi lama → enum kanonik
expect("10 SMA", "kelas_10");
expect("11 SMA", "kelas_11");
expect("12 SMA", "kelas_12");
expect("Mahasiswa", "semester_1");
// Kasus tepi
expect("", null);
expect(null, null);
expect("nilai aneh", null);

console.log(fail === 0 ? "\nSemua mapping grade benar." : `\n${fail} cek GAGAL.`);
process.exit(fail === 0 ? 0 : 1);
