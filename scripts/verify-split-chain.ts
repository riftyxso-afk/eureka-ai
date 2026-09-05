// Verifikasi rantai provider setelah juan-router-provider-split.
// Mode: "chain" (inspeksi rantai + live smoke) | "no-juan" (simulasi kunci Juan kosong).
import { readFileSync } from "fs";

const mode = process.argv[2] ?? "chain";

async function main() {
  // Muat .env.local sebelum import lib/ai (konstanta dibaca saat modul dimuat).
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  if (mode === "no-juan") {
    process.env.JUANROUTER_API_KEY = "";
    process.env.AI_FORCE_MODELS = "contoh-model-forced"; // pastikan OpenAgentic tetap tidak masuk
  } else if (mode === "force") {
    process.env.AI_FORCE_MODELS = "contoh-model-forced";
  }

  const ai = await import("@/lib/ai");
  const { getProviderChain, hasAiKey } = ai;

  const summarize = (chain: { name: string; model: string }[]) =>
    chain.map((p) => `${p.name}/${p.model}`).join(" | ");

  console.log(`\n=== MODE: ${mode} ===`);
  console.log("hasAiKey:", hasAiKey());

  for (const speed of ["fast", "normal", "deep"] as const) {
    for (const forChat of [true, false]) {
      const chain = getProviderChain(speed, forChat, true);
      const names = [...new Set(chain.map((p) => p.name))].join(",");
      const hasOpenAgentic = chain.some((p) => p.name === "OpenAgentic");
      console.log(
        `chain[${speed}, forChat=${forChat}] providers=[${names}] openagentic=${hasOpenAgentic ? "ADA!!" : "tidak"} → ${summarize(chain)}`
      );
    }
  }

  if (mode === "chain") {
    console.log("\n--- Live smoke: chat (forChat=true, fast) ---");
    try {
      const out = await ai.aiChat({
        system: "Jawab maksimal 5 kata.",
        user: "Apa ibu kota Indonesia?",
        speedMode: "fast",
        forChat: true,
        maxTokens: 60,
      });
      console.log("JAWABAN:", out.slice(0, 120));
    } catch (e) {
      console.log("GAGAL:", (e as Error).message);
    }

    console.log("\n--- Live smoke: non-chat JSON (forChat=false, normal) ---");
    try {
      const obj = await ai.aiChatJson(
        {
          system: 'Kembalikan JSON: {"ok": true, "nilai": <angka 1-10>}',
          user: "buat sekarang",
          json: true,
          speedMode: "normal",
          forChat: false,
          maxTokens: 60,
        },
        (raw) => JSON.parse(raw) as { ok: boolean }
      );
      console.log("HASIL JSON:", JSON.stringify(obj));
    } catch (e) {
      console.log("GAGAL:", (e as Error).message);
    }
  }
}
void main();
