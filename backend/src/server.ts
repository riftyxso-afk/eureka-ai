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
const corsOrigins = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  "*",
  cors({
    origin: corsOrigins.includes("*") ? "*" : corsOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-session-id",
      "x-requested-with",
    ],
    exposeHeaders: ["content-type"],
    credentials: true,
  })
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
