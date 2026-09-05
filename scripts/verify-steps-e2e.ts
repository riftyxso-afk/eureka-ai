// @ts-nocheck
/**
 * E2E verifikasi note-loading-live-steps — backend :3001 (atau argumen).
 * 1) Token via service-role (pola note-e2e-test.ts).
 * 2) POST /api/notes/process (mode cepat) → 202 jobId.
 * 3) DUA koneksi SSE paralel: koneksi-1 sejak awal; koneksi-2 join
 *    setelah 5 detik (simulasi reconnect — menerima replay penuh).
 *    Keduanya dibiarkan mengalir sampai stream tutup sendiri (percent 100);
 *    TIDAK ada yang cancel() di tengah (cancel menutup sesi utk semua).
 * 4) Bandingkan state kedua klien: harus konvergen ke 5 langkah berurutan,
 *    unik, semua done → replay idempoten terbukti.
 */
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API = process.argv[2] || "http://localhost:3001";

const sessionId = "steps-" + Date.now();

function makeClient(label) {
  const seen = new Map();
  const order = [];
  let lastPercent = 0;
  let done = false;
  const apply = (p) => {
    if (p.step?.id && p.step.label) {
      const first = !seen.has(p.step.id);
      seen.set(p.step.id, p.step);
      if (first) {
        order.push(p.step.id);
        console.log(`  [${label}] langkah baru: ${p.step.id} — ${p.step.label} (${p.step.status})`);
      }
    }
    if (typeof p.percent === "number") lastPercent = Math.max(lastPercent, p.percent);
    if (p.percent >= 100) done = true;
  };
  return { seen, order, apply, get percent() { return lastPercent; }, get done() { return done; } };
}

async function streamRun(label, client) {
  const res = await fetch(`${API}/api/notes/process-progress/${sessionId}`, {
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok || !res.body) { console.error(`GAGAL buka SSE (${label}):`, res.status); return; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done: rdDone } = await reader.read();
      if (rdDone) break;
      buf += decoder.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop() ?? "";
      for (const c of chunks) {
        for (const line of c.split(/\r?\n/)) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "{}") continue;
          try { client.apply(JSON.parse(payload)); } catch {}
        }
      }
    }
  } catch (e) {
    console.error(`SSE ${label} error:`, e.message);
  }
}

async function main() {
  const gl = await fetch(SUPA + "/auth/v1/admin/generate_link", {
    method: "POST",
    headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: "radzfoundation@gmail.com" }),
  }).then((r) => r.json());
  const vj = await fetch(SUPA + "/auth/v1/verify", {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: gl.hashed_token }),
  }).then((r) => r.json());
  if (!vj.access_token) { console.error("GAGAL token"); process.exit(1); }
  const token = vj.access_token;
  console.log("token ok; sessionId =", sessionId);

  const materi =
    "Fotosintesis adalah proses tumbuhan membuat makanan sendiri. " +
    "Tumbuhan menyerap karbon dioksida lewat daun dan air lewat akar. " +
    "Dengan bantuan sinar matahari dan klorofil, keduanya diubah menjadi glukosa dan oksigen. " +
    "Oksigen dilepaskan ke udara untuk pernapasan makhluk hidup. " +
    "Fotosintesis terjadi di kloroplas dan sangat penting bagi kehidupan di bumi. " +
    "Faktor yang memengaruhi: cahaya, karbon dioksida, air, dan suhu. ";
  const form = new FormData();
  form.append("sources", JSON.stringify([{ type: "soal", soalText: materi.repeat(4), fileName: "fotosintesis.txt" }]));
  form.append("userId", "30e6cd46-5d2d-4248-ba9d-58e2e13a97e5");
  form.append("sessionId", sessionId);
  form.append("generationMode", "cepat");
  form.append("chapterCount", "2");
  form.append("noteType", "rangkuman");
  form.append("bahasa", "Bahasa Indonesia");
  form.append("studyMode", "standar");
  form.append("gayaPenulisan", "Ramah & Santai");

  const pr = await fetch(`${API}/api/notes/process`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-session-id": sessionId },
    body: form,
  });
  const pj = await pr.json().catch(() => null);
  console.log("POST /api/notes/process:", pr.status, JSON.stringify(pj).slice(0, 140));
  if (pr.status !== 202 || !pj?.jobId) { console.error("GAGAL mulai job"); process.exit(1); }

  const c1 = makeClient("koneksi-1");
  const p1 = streamRun("koneksi-1", c1);
  await new Promise((r) => setTimeout(r, 5000));
  const c2 = makeClient("koneksi-2-replay");
  const p2 = streamRun("koneksi-2-replay", c2);

  // Pengaman: maks 8 menit.
  await Promise.race([
    Promise.all([p1, p2]),
    new Promise((r) => setTimeout(r, 8 * 60 * 1000)),
  ]);

  console.log("\n=== RINGKASAN ===");
  console.log("klien-1:", c1.order.join(" → "), "| done:", c1.done, "| pct:", c1.percent);
  console.log("klien-2:", c2.order.join(" → "), "| done:", c2.done, "| pct:", c2.percent);

  const expected = ["extract", "chapters", "enrichment", "rag", "study_tools"];
  const same = JSON.stringify(c1.order) === JSON.stringify(c2.order);
  const allSeen = expected.every((p) => c1.order.includes(p));
  const orderOk = expected.every((p) => c1.order.indexOf(p) === expected.indexOf(p));
  const unique = c1.order.length === new Set(c1.order).size;
  const allDone = [...c1.seen.values()].every((s) => s.status === "done");
  const ok = allSeen && orderOk && unique && c1.done && c2.done && same && allDone;
  console.log(ok
    ? "E2E STEPS LOLOS (5 fase berurutan, semua done, dua klien konvergen — replay idempoten)"
    : `HASIL: allSeen=${allSeen} orderOk=${orderOk} unique=${unique} done1=${c1.done} done2=${c2.done} same=${same} allDone=${allDone}`);
  process.exit(ok ? 0 : 1);
}
void main();
