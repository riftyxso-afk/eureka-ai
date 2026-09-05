// Probe waktu tiap tahap pipeline gambar (sama persis dengan route /api/assistant/image).
import { readFileSync } from "fs";

async function main() {
  // Muat env dulu SEBELUM import lib/ai (lib membaca env saat modul dimuat).
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const { aiChat, hasAiKey } = await import("@/lib/ai");
  const { generateImageViaOpenAgentic } = await import("@/lib/image-gen");

  const system =
    "Kamu adalah ilustrator edukasi. Dari permintaan user + topik konteks percakapan, tulis SATU prompt gambar ilustrasi (maks 2 kalimat, bahasa Indonesia) yang menggambarkan topik secara akurat. JANGAN ganti topik. Jangan sebut 'permintaan' — langsung deskripsi gambarnya saja.";
  const user =
    "Permintaan user: buat gambar siklus air\n\nTopik konteks percakapan (gunakan ini bila permintaan tidak menyebut topik spesifik): jelaskan siklus air Siklus air: evaporasi, kondensasi, presipitasi, koleksi.";

  console.log("hasAiKey:", hasAiKey());

  const t0 = Date.now();
  let prompt = "";
  try {
    prompt = (
      await aiChat({ system, user, maxTokens: 160, temperature: 0.5, speedMode: "fast" })
    ).trim();
    console.log("[1] aiChat(fast) prompt:", Date.now() - t0, "ms ->", JSON.stringify(prompt.slice(0, 80)));
  } catch (e) {
    console.log("[1] aiChat(fast) GAGAL setelah", Date.now() - t0, "ms:", (e as Error).message);
  }

  const t1 = Date.now();
  const dataUrl = await generateImageViaOpenAgentic(prompt || "diagram siklus air");
  console.log("[2] generateImageViaOpenAgentic:", Date.now() - t1, "ms ->", dataUrl ? Math.round((dataUrl.length * 0.75) / 1024) + " KB" : "NULL");
  console.log("TOTAL:", Date.now() - t0, "ms");
}
void main();
