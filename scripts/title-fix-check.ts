/** Verifikasi cepat fix judul + transcript (bagian dari task 4.1). */
import { sanitizeAiTitle } from "../lib/assistant/store";
import { buildChatTranscript } from "../lib/assistant/chatTranscript";

let fail = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`ok: ${name}`);
  else { fail++; console.error(`GAGAL: ${name}`, JSON.stringify(got)); }
}

// Keluaran model thinking-preamble (kasus nyata "Heres a thinking process:").
const preamble =
  "Here's a thinking process:\n\n1. Analyze the user's request: The user said \"belajar rust\".\n2. Determine key topics.\n\nBelajar Rust dari Dasar";
check("preamble dibuang, ambil jawaban", sanitizeAiTitle(preamble) === "Belajar Rust dari Dasar", sanitizeAiTitle(preamble));

// Hanya preamble tanpa jawaban → tidak layak → "" (fallback potongan prompt).
const onlyPreamble = "Here's a thinking process:\n\n1. Analyze the user's request.\n2. Determine topics.";
check("preamble-only ditolak", sanitizeAiTitle(onlyPreamble) === "", sanitizeAiTitle(onlyPreamble));

// Judul bersih lolos utuh.
check("judul bersih lolos", sanitizeAiTitle("Fotosintesis Kelas 10") === "Fotosintesis Kelas 10");

// Format "Judul: X" dipotong prefiksnya.
check("prefiks Judul: dibuang", sanitizeAiTitle("Judul: Hukum Newton") === "Hukum Newton", sanitizeAiTitle("Judul: Hukum Newton"));

// Terlalu panjang (>60 char) → ditolak.
check("kepanjangan ditolak", sanitizeAiTitle("a".repeat(61)) === "");

// Transcript: pesan kosong (placeholder stream) tersaring.
const t = buildChatTranscript([
  { role: "user", content: "ajari fotosintesis" },
  { role: "assistant", content: "" },
  { role: "user", content: "   " },
  { role: "assistant", content: "Fotosintesis adalah..." },
]);
check("transcript tanpa placeholder kosong", !t.includes("\n\n") && t.includes("Fotosintesis adalah"), t);
check("transcript hanya pesan berisi", t.split("\n").length === 2, t);

console.log(fail ? `${fail} GAGAL` : "semua lolos");
process.exit(fail ? 1 : 0);
