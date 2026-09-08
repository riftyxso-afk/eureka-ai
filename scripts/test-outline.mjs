/**
 * Test gpt-5.6-luna response format.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const env = {};
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const env = loadEnv();

async function test(model) {
  const baseUrl = env.JUANROUTER_BASE_URL;
  const apiKey = env.JUANROUTER_API_KEY;
  
  console.log(`\n=== Testing: ${model} ===`);
  
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Jawab HANYA JSON array valid, tanpa teks lain." },
        { role: "user", content: 'Buat outline bab. Output: [{"title":"Judul","topics":["topik"]}]' },
      ],
    }),
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Raw length:", text.length);
  console.log("First 500 chars:\n", text.slice(0, 500));
  
  // Parse SSE
  if (text.includes("data:")) {
    let content = "";
    let thinking = "";
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const j = JSON.parse(line.slice(6));
        const delta = j.choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
        if (delta?.reasoning_content) thinking += delta.reasoning_content;
      } catch {}
    }
    console.log("\nThinking length:", thinking.length);
    console.log("Content length:", content.length);
    console.log("Content:", content.slice(0, 300));
  }
}

// Test gpt-5.6-luna dan gemini-3.7-flash-low
await test("gpt-5.6-luna");
await test("gemini-3.7-flash-low");
