// Verifikasi katalog & preferredModel (model-store-selector task 1.x).
import { readFileSync } from "fs";

async function main() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const { getProviderChain, SPEED_MODEL_LISTS, MODEL_CATALOG, MODEL_CATALOG_IDS } = await import("@/lib/ai");

  console.log("katalog:", MODEL_CATALOG.length, "model | ids:", MODEL_CATALOG_IDS.size);
  console.log("fast  :", SPEED_MODEL_LISTS.fast.join(", "));
  console.log("normal:", SPEED_MODEL_LISTS.normal.join(", "));
  console.log("deep  :", SPEED_MODEL_LISTS.deep.join(", "));

  const c1 = getProviderChain("fast", false, true, "minimax-m3");
  console.log("preferred minimax-m3 @fast →", c1.slice(0, 3).map((p) => p.name + "/" + p.model).join(", "), "... total", c1.length);

  const c2 = getProviderChain("normal", false, true, "hack-model");
  console.log("preferred asing @normal →", c2.slice(0, 2).map((p) => p.model).join(", "), "(harus gpt-5.6-luna dulu)");

  const c3 = getProviderChain("deep", false, false);
  console.log("reasoning OFF @deep →", c3.map((p) => p.model).join(", "), "(tanpa qwen3.8-max/claude-opus-5)");

  const c4 = getProviderChain("deep", false, false, "gpt-5.6-terra");
  console.log("preferred gpt-5.6-terra reasoning OFF →", c4.slice(0, 2).map((p) => p.model).join(", "));
}
void main();
