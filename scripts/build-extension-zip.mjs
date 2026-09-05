/**
 * Build public/eureka-extension.zip dari folder extension/.
 *
 * - Hanya file allow-list yang masuk (tanpa dev config lokal).
 * - config.js di-generate dari env (API produksi + Supabase anon),
 *   sehingga ZIP yang diunduh user langsung jalan tanpa diedit.
 * - Jalankan ulang setiap habis mengubah extension/:
 *     npm run build:extension
 *
 * Env yang dibutuhkan:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   EXTENSION_API_BASE (opsional, default https://eureka-ai.web.id)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extDir = join(root, "extension");
const outPath = join(root, "public", "eureka-extension.zip");

const API_BASE = (process.env.EXTENSION_API_BASE || "https://api-eureka.web.id").replace(/\/+$/, "");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "GAGAL: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY kosong. " +
      "Jalankan dengan env terisi (mis. via .env.local)."
  );
  process.exit(1);
}

// Allow-list: path relatif di dalam extension/ (+ tipe baca).
const FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "sidepanel.html",
  "sidepanel.css",
  "sidepanel.js",
  "README.md",
  "PRIVACY.md",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];

const configJs = `/**
 * Konfigurasi Eureka.AI Browser Extension (dibuat otomatis oleh
 * scripts/build-extension-zip.mjs — jangan edit manual di ZIP).
 */
const EUREKA_CONFIG = {
  API_BASE: '${API_BASE}',
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}',
};
`;

const entries = {};
for (const rel of FILES) {
  const isBinary = rel.endsWith(".png");
  const data = readFileSync(join(extDir, rel), isBinary ? null : "utf8");
  entries[rel] = isBinary ? new Uint8Array(data) : new TextEncoder().encode(data);
}
entries["config.js"] = new TextEncoder().encode(configJs);

const zipped = zipSync(entries, { level: 9 });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, zipped);

console.log(`OK: public/eureka-extension.zip (${zipped.length} bytes, ${Object.keys(entries).length} files)`);
for (const name of Object.keys(entries)) console.log("  + " + name);
