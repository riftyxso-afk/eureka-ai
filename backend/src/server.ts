/**
 * Eureka.AI — Backend API (Hono + @hono/node-server).
 *
 * Server ini memount semua route dari app/api (logika tetap satu sumber
 * di repo root) via adapter, tanpa menulis ulang handler.
 *
 * Cara pakai:
 *   1. Install: cd backend && npm install
 *   2. Env:     salin .env.local root (otomatis dibaca) atau set env sendiri
 *   3. Jalankan: npm run dev   (port default 3001, atau set PORT)
 *
 * Deploy: layanan Node biasa (Railway/Render/Fly/VPS). Lalu arahkan
 * NEXT_PUBLIC_API_URL frontend ke URL backend ini.
 */
import { existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";

import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";

import { mountAllRoutes } from "./routes";

// ---- env: baca .env.local di repo root (tetap bisa di-override env asli) ----
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
for (const envPath of [
  path.join(rootDir, ".env.local"),
  path.join(rootDir, ".env"),
]) {
  if (existsSync(envPath)) loadEnv({ path: envPath, override: false });
}

const app = new Hono();

// ─── CORS ──────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === "production";
const rawCors = process.env.CORS_ORIGIN ?? "";
const corsOrigins = rawCors
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const explicitlyAllowAll = corsOrigins.includes("*");

// Produksi TIDAK BOLEH "*" (dan TIDAK BOLEH kosong → default deny).
// Ini mencegah origin asing membaca respons ber-credential.
if (isProd && (explicitlyAllowAll || corsOrigins.length === 0)) {
  console.warn(
    "[backend] PERINGATAN KEAMANAN: CORS_ORIGIN harus berisi daftar origin di produksi. " +
      (explicitlyAllowAll
        ? "'*' ditolak — origin lintas domain diblokir."
        : "kosong — origin lintas domain diblokir.")
  );
}
const corsAllowAll = !isProd && explicitlyAllowAll;

/**
 * Resolver origin CORS:
 * - non-browser (tanpa Origin, mis. curl/server-to-server) → izinkan
 * - localhost (dev) → selalu izinkan
 * - CORS_ORIGIN "*" → hanya untuk non-produksi, izinkan SEMUA origin
 * - CORS_ORIGIN berisi daftar → hanya origin yang terdaftar (wajib di produksi)
 */
const resolveCorsOrigin: (origin: string) => string | null = (origin) => {
  if (!origin) return "*";
  if (corsAllowAll) return origin;
  if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  // Chrome/Edge extensions: izinkan semua chrome-extension:// origins
  if (/^chrome-extension:\/\//.test(origin)) return origin;
  return corsOrigins.includes(origin.replace(/\/+$/, "")) ? origin : null;
};

app.use(
  "*",
  cors({
    origin: resolveCorsOrigin,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-session-id",
      "x-requested-with",
      "x-locale",
    ],
    exposeHeaders: ["content-type"],
    credentials: true,
  })
);
console.log(
  `[backend] CORS: ${
    corsAllowAll
      ? "semua origin diizinkan (CORS_ORIGIN kosong atau *)"
      : `whitelist: ${corsOrigins.join(", ")} (+localhost untuk dev)`
  }`
);

// ─── Health check ──────────────────────────────────────────
app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "eureka-ai-backend",
    time: new Date().toISOString(),
    version: "2.0.0",
  })
);

// ─── Mount all API routes ─────────────────────────────────
const port = Number(process.env.PORT ?? 3001);

mountAllRoutes(app)
  .then((n) => {
    console.log(`[backend] ${n} route API dimount (selain /api/health).`);
    serve({ fetch: app.fetch, port }, (info) => {
      console.log(`[backend] Eureka.AI API berjalan di http://localhost:${info.port}`);
    });
  })
  .catch((e) => {
    console.error("[backend] Gagal memulai server:", e);
    process.exit(1);
  });
