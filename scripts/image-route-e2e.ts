/** E2E route gambar chat: token owner → POST /api/assistant/image → dataUrl. */
import { readFileSync, writeFileSync } from "fs";

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
const OWNER_ID = "30e6cd46-5d2d-4248-ba9d-58e2e13a97e5";

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
  const token = vj.access_token;
  if (!token) { console.error("GAGAL token"); process.exit(1); }
  console.log("token ok");

  const r = await fetch(API + "/api/assistant/image", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      prompt: "buat gambar siklus air",
      userId: OWNER_ID,
      history: [
        { role: "user", content: "jelaskan siklus air" },
        { role: "assistant", content: "Siklus air: evaporasi, kondensasi, presipitasi, koleksi." },
      ],
    }),
  });
  const j = await r.json().catch(() => null);
  console.log("HTTP", r.status);
  if (r.status === 200 && j?.ok && typeof j.dataUrl === "string") {
    console.log("dataUrl:", j.dataUrl.slice(0, 40) + "...");
    console.log("prefix benar:", j.dataUrl.startsWith("data:image/"));
    console.log("ukuran ±", Math.round(j.dataUrl.length * 0.75 / 1024), "KB");
    console.log("promptUsed:", JSON.stringify(j.promptUsed));
    // Simpan hasil utk dilihat user.
    const b64 = j.dataUrl.replace(/^data:image\/png;base64,/, "");
    const out = process.env.TEMP + "\\eureka-image-e2e.png";
    writeFileSync(out, Buffer.from(b64, "base64"));
    console.log("tersimpan:", out);
    console.log(j.dataUrl.startsWith("data:image/") ? "E2E GAMBAR LOLOS" : "GAGAL: bukan data URL");
  } else {
    console.log("respons:", JSON.stringify(j).slice(0, 300));
    console.log("← bukan hasil gambar (mungkin gating premium / error provider)");
  }
}
void main();
