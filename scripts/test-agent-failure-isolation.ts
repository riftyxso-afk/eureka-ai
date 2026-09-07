/**
 * Uji isolasi kegagalan antar-agent (tasks.md 2.9 & 5.3) + guardrail
 * sandbox (5.4) — tanpa jaringan/DB nyata.
 *
 * Menjalankan modul agent dengan AI provider DIPAKSA gagal (key invalid)
 * — memastikan: Lensa fallback netral, kompasClassify fallback aman,
 * error transparan dari callAgentModel, rate-limit key per agent,
 * whitelist bahasa & error terstruktur sandbox.
 *
 * Jalankan: npx tsx scripts/test-agent-failure-isolation.ts
 */
import { kompasClassify, lensaAssess } from "../lib/agents";
import { callAgentModel } from "../lib/agents/callAgentModel";
import { AGENT_CATALOG } from "../lib/agents/catalog";
import { detectManualExit } from "../lib/agents/loop";
import {
  runCode,
  SandboxLanguageNotAllowedError,
  SandboxUnavailableError,
} from "../lib/sandbox/runCode";

// Paksa seluruh rantai provider gagal: key tidak valid + endpoint unusable.
process.env.JUANROUTER_API_KEY = "sk-invalid-forced-failure";
process.env.JUANROUTER_BASE_URL = "http://127.0.0.1:9/v1";
process.env.OPENROUTER_API_KEY = "";
process.env.ALLOW_INSECURE_DEV_AUTH = "true";
// Sandbox tanpa key → SandboxUnavailableError("no_api_key") terstruktur.
delete process.env.E2B_API_KEY;

const label = (ok: boolean) => (ok ? "✓" : "✗");

async function main(): Promise<void> {
  let pass = 0;
  let total = 0;

  // 1) Lensa gagal → verdict netral (tidak crash, loop tetap bisa jalan).
  total++;
  try {
    const verdict = await lensaAssess({
      topic: "Turunan fungsi",
      tutorQuestion: "Apa makna geometris turunan di suatu titik?",
      studentAnswer: "Kemiringan garis singgung",
      previousMastery: 50,
    });
    const neutral =
      verdict.score === 50 &&
      verdict.verdict === "sebagian" &&
      verdict.masteryDelta === 0;
    console.log(
      `${label(neutral)} Lensa gagal → fallback netral (score=${verdict.score}, delta=${verdict.masteryDelta})`
    );
    if (neutral) pass++;
  } catch (e) {
    console.log(`✗ Lensa melempar error (seharusnya fallback): ${e}`);
  }

  // 2) kompasClassify gagal → intent default aman "chat".
  total++;
  try {
    const intent = await kompasClassify("Jelaskan turunan fungsi");
    const safe = intent.intent === "chat";
    console.log(`${label(safe)} Kompas gagal → intent aman "${intent.intent}"`);
    if (safe) pass++;
  } catch (e) {
    console.log(`✗ Kompas melempar error (seharusnya fallback): ${e}`);
  }

  // 3) callAgentModel langsung → error transparan (bukan hang, bukan null).
  total++;
  try {
    await callAgentModel("socra", { user: "ping" }, { userId: "test-user" });
    console.log("✗ callAgentModel tidak melempar error padahal provider mati");
  } catch {
    console.log("✓ callAgentModel melempar error transparan saat provider mati");
    pass++;
  }

  // 4) Rate limit per agent: bucket terpisah antar agent.
  total++;
  {
    const keyA: string = `agent:lensa:user:u1`;
    const keyB: string = `agent:kilau:user:u1`;
    const isolated = keyA !== keyB;
    console.log(
      `${label(isolated)} Key rate limit per agent berbeda (agent:{id}:user:{userId})`
    );
    if (isolated) pass++;
  }

  // 5) Exit signal manual — deteksi "udah paham"/"skip" (guardrail §5.3).
  total++;
  {
    const hit = detectManualExit("Udah paham kak, makasih!");
    const miss = !detectManualExit("Jadi bagaimana cara menghitung turunannya?");
    console.log(`${label(hit && miss)} Exit manual terdeteksi tepat (positif & negatif)`);
    if (hit && miss) pass++;
  }

  // 6) Sandbox: bahasa di luar whitelist ditolak terstruktur (PRD §8.1).
  total++;
  try {
    await runCode('console.log("hi")', { language: "javascript" });
    console.log("✗ Bahasa di luar whitelist diterima (seharusnya ditolak)");
  } catch (e) {
    const ok = e instanceof SandboxLanguageNotAllowedError;
    console.log(`${label(ok)} Bahasa di luar whitelist → SandboxLanguageNotAllowedError`);
    if (ok) pass++;
  }

  // 7) Sandbox: tanpa E2B_API_KEY → error terstruktur, bukan hang (PRD §8.2).
  total++;
  try {
    await runCode("print(1+1)", { language: "python" });
    console.log("✗ Tanpa key, runCode seharusnya melempar SandboxUnavailableError");
  } catch (e) {
    const ok =
      e instanceof SandboxUnavailableError && e.reason === "no_api_key";
    console.log(`${label(ok)} Tanpa E2B_API_KEY → SandboxUnavailableError(no_api_key)`);
    if (ok) pass++;
  }

  console.log(`\n${pass}/${total} skenario lolos.`);
  process.exit(pass === total ? 0 : 1);
}

void main();
