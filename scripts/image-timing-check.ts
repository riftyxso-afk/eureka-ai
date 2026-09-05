/** Ukur waktu tiap tahap generate gambar (prompt AI + model + unduh). */
import { aiChat } from "../lib/ai";
import { generateImageViaOpenAgentic } from "../lib/image-gen";

async function main() {
  let t0 = Date.now();
  const illustrationPrompt = await aiChat({
    system: "Kamu adalah ilustrator edukasi. Tulis SATU prompt gambar ilustrasi (maks 2 kalimat, bahasa Indonesia).",
    user: "Permintaan user: buat gambar siklus air",
    maxTokens: 160,
    temperature: 0.5,
    speedMode: "fast",
  });
  console.log(`1. susun prompt AI: ${((Date.now() - t0) / 1000).toFixed(1)}s → ${JSON.stringify(illustrationPrompt.slice(0, 80))}`);

  t0 = Date.now();
  const dataUrl = await generateImageViaOpenAgentic(illustrationPrompt.trim().slice(0, 300));
  console.log(`2. generate + unduh model: ${((Date.now() - t0) / 1000).toFixed(1)}s → ${dataUrl ? `ok ±${Math.round(dataUrl.length * 0.75 / 1024)}KB` : "NULL"}`);
}
void main();
