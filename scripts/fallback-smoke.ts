// Smoke fallback darurat: kunci Juan dikosongkan → teks harus dilayani OpenRouter.
import { readFileSync } from "fs";
async function main() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  process.env.JUANROUTER_API_KEY = "";
  const { aiChat } = await import("@/lib/ai");
  const t0 = Date.now();
  try {
    const out = await aiChat({ system: "Jawab maksimal 5 kata.", user: "Apa ibu kota Indonesia?", speedMode: "fast", maxTokens: 60 });
    console.log("JAWABAN:", out.slice(0, 100), `(${Date.now() - t0}ms)`);
  } catch (e) {
    console.log("GAGAL:", (e as Error).message);
  }
}
void main();
