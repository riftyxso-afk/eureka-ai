/**
 * Test koneksi API model untuk pembuatan catatan.
 * 
 * Cara pakai:
 *   node scripts/test-note-api.mjs
 * 
 * Akan test semua provider yang terkonfigurasi di .env.local
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manual
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    const env = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch (e) {
    console.error("Gagal baca .env.local:", e.message);
    process.exit(1);
  }
}

const env = loadEnv();

const providers = [
  {
    name: "Juan Router (Primary - Teks)",
    baseUrl: env.JUANROUTER_BASE_URL || "https://router.juan.web.id/v1",
    apiKey: env.JUANROUTER_API_KEY || "",
    model: env.JUANROUTER_MODEL || "gemini-3.7-flash-low",
  },
  {
    name: "OpenRouter (Fallback Darurat)",
    baseUrl: env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY || "",
    model: env.OPENROUTER_MODEL || "nvidia/nemotron-3.5-lightning:free",
  },
  {
    name: "OpenAgentic (Free Model)",
    baseUrl: env.OPENAGENTIC_BASE_URL || "https://openagentic.id/api/v1",
    apiKey: env.OPENAGENTIC_API_KEY || "",
    model: env.OPENAGENTIC_MODEL || "deepseek-v4-flash-free",
  },
  {
    name: "AIMurah",
    baseUrl: env.AI_BASE_URL || "https://aimurah.my.id/api/v1",
    apiKey: env.AI_API_KEY || "",
    model: env.AI_MODEL || "deepseek-v4-flash-free",
  },
];

// Prompt sederhana untuk test catatan
const TEST_PROMPT = `Kamu adalah Eureka.AI — Asisten Pembelajaran Cerdas.

Buat catatan singkat (maksimal 3 paragraf) tentang: "Pengertian Artificial Intelligence"

Gunakan format markdown:
## 📚 Tutorial: Pengertian AI
(kalimat penjelas)

## 📝 Catatan Pribadi:
(rangkuman singkat)`;

async function testProvider(provider) {
  if (!provider.apiKey) {
    return { ...provider, status: "NO_KEY", message: "API key tidak ada" };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: "Kamu adalah AI tutor yang membantu pelajar Indonesia." },
          { role: "user", content: TEST_PROMPT },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        ...provider,
        status: "ERROR",
        message: `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
        latency: `${elapsed}ms`,
      };
    }

    const text = await response.text();
    
    // Handle streaming SSE response (data: {...})
    if (text.startsWith("data: ")) {
      const lines = text.split("\n").filter(l => l.startsWith("data: ") && l !== "data: [DONE]");
      let content = "";
      let model = provider.model;
      let usage = {};
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) content += delta;
          if (json.model) model = json.model;
          if (json.usage) usage = json.usage;
        } catch {}
      }
      
      return {
        ...provider,
        status: "OK",
        message: content.slice(0, 150) + (content.length > 150 ? "..." : "(streaming)"),
        latency: `${elapsed}ms`,
        tokens: {
          prompt: usage.prompt_tokens || "?",
          completion: usage.completion_tokens || "?",
          total: usage.total_tokens || "?",
        },
        model,
      };
    }
    
    // Handle normal JSON response
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || "(tidak ada konten)";
    const tokens = data.usage || {};

    return {
      ...provider,
      status: "OK",
      message: content.slice(0, 150) + (content.length > 150 ? "..." : ""),
      latency: `${elapsed}ms`,
      tokens: {
        prompt: tokens.prompt_tokens || "?",
        completion: tokens.completion_tokens || "?",
        total: tokens.total_tokens || "?",
      },
      model: data.model || provider.model,
    };
  } catch (e) {
    const elapsed = Date.now() - startTime;
    return {
      ...provider,
      status: "ERROR",
      message: e.message,
      latency: `${elapsed}ms`,
    };
  }
}

// Main
console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║   Eureka.AI — Test Koneksi API untuk Catatan           ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

console.log(`Active provider: ${env.AI_PROVIDER || "openagentic"}\n`);
console.log("Testing semua provider...\n");

const results = await Promise.all(providers.map(testProvider));

for (const r of results) {
  const icon = r.status === "OK" ? "✅" : "❌";
  console.log(`${icon} ${r.name}`);
  console.log(`   Status : ${r.status}`);
  console.log(`   Model  : ${r.model}`);
  console.log(`   Latency: ${r.latency || "-"}`);

  if (r.status === "OK") {
    console.log(`   Tokens : ${r.tokens?.prompt || "?"} prompt / ${r.tokens?.completion || "?"} completion / ${r.tokens?.total || "?"} total`);
    console.log(`   Response: ${r.message}`);
  } else if (r.message) {
    console.log(`   Error  : ${r.message}`);
  }
  console.log("");
}

// Ringkasan
const okCount = results.filter(r => r.status === "OK").length;
const failCount = results.filter(r => r.status === "ERROR").length;

console.log("═══════════════════════════════════════════════════════════");
console.log(`Ringkasan: ${okCount} OK | ${failCount} ERROR`);

if (okCount > 0) {
  console.log("\n✅ Minimal 1 provider aktif — pembuatan catatan berfungsi.");
} else {
  console.log("\n❌ Tidak ada provider yang bisa diakses. Periksa API key di .env.local");
}
