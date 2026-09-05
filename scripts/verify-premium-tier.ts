// Verifikasi rantai model per status premium (premium-model-tier).
import { readFileSync } from "fs";

async function main() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const { getProviderChain } = await import("@/lib/ai");
  const { runWithPremium } = await import("@/lib/aiContext");

  const models = (chain: { model: string }[]) => chain.map((p) => p.model).join(", ");

  // Tanpa konteks (default) = free.
  console.log("FREE  deep :", models(getProviderChain("deep", false, true, undefined, false)));
  console.log("FREE  normal:", models(getProviderChain("normal", false, true, undefined, false)));
  console.log("PRO   deep :", models(getProviderChain("deep", false, true, undefined, true)));
  console.log("PRO   normal:", models(getProviderChain("normal", false, true, undefined, true)));

  // Via konteks ALS (jalur job catatan).
  runWithPremium(true, () => {
    console.log("ALS PRO deep:", models(getProviderChain("deep")));
  });
  runWithPremium(false, () => {
    console.log("ALS FREE deep:", models(getProviderChain("deep")));
  });

  // Free + preferred model premium → harus DIBLOKIR (tidak masuk rantai).
  const blocked = getProviderChain("fast", false, true, "gpt-5.6-terra", false);
  console.log("FREE preferred terra →", models(blocked.slice(0, 2)), "(harus mulai glm-5.3-flash)");
  const allowed = getProviderChain("fast", false, true, "gpt-5.6-terra", true);
  console.log("PRO  preferred terra →", models(allowed.slice(0, 2)), "(harus mulai gpt-5.6-terra)");

  const freeDeep = getProviderChain("deep", false, true, undefined, false).map((p) => p.model);
  const proDeep = getProviderChain("deep", false, true, undefined, true).map((p) => p.model);
  const premiumIds = ["gpt-5.6-luna", "grok-4.5-high", "gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "claude-opus-5", "qwen3.8-max", "grok-4.6-xhigh"];
  const ok =
    !freeDeep.some((m) => premiumIds.includes(m)) &&
    proDeep[0] === "gpt-6-astra" &&
    blocked[0].model === "glm-5.3-flash" &&
    allowed[0].model === "gpt-5.6-terra";
  console.log(ok ? "PROBE PREMIUM TIER LOLOS" : "PROBE GAGAL");
}
void main();
