/**
 * Eureka.AI — Backend API mandiri (Hono + @hono/node-server).
 *
 * Server ini MEMOUNT SEMUA route dari app/api di repo root (Next.js App
 * Router) tanpa menulis ulang logika apa pun: route ditulis sebagai
 * (req: NextRequest, { params }) => NextResponse, dan di sini diadaptasi
 * ke Hono (NextRequest/NextResponse dikonversi dari/ke Request/Response).
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
import { readdir } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";

import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import type { Context } from "hono";
import { NextRequest, NextResponse } from "next/server";
import type { RequestInit as NextRequestInit } from "next/dist/server/web/spec-extension/request";

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

const corsOrigins = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  "*",
  cors({
    origin: corsOrigins.includes("*") ? "*" : corsOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-session-id"],
    exposeHeaders: ["content-type"],
  })
);

type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RouteModule {
  GET?: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => unknown;
  POST?: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => unknown;
  PUT?: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => unknown;
  PATCH?: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => unknown;
  DELETE?: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => unknown;
}

/** Path Next.js `[param]`/`[...rest]` -> path Hono `:param`/`*`. */
function toHonoPath(nextPath: string): string {
  return nextPath
    .replace(/\[\.\.\.[^\]]+\]/g, "*")
    .replace(/\[([^\]]+)\]/g, ":$1");
}

async function toNextRequest(c: Context): Promise<NextRequest> {
  const raw = c.req.raw;
  const init: NextRequestInit = {
    method: raw.method,
    headers: raw.headers,
    body: raw.body ?? undefined,
  };
  return new NextRequest(raw.url, init);
}

function mountModule(
  app: Hono,
  routePath: string,
  module: RouteModule
): void {
  const honoPath = toHonoPath(routePath);
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as RouteMethod[]) {
    const handler = module[method];
    if (!handler) continue;
    app.on(method, honoPath, async (c: Context) => {
      try {
        const req = await toNextRequest(c);
        const result = await handler(req, {
          params: Promise.resolve({ ...c.req.param() }),
        });
        if (result instanceof NextResponse) {
          return new Response(result.body, {
            status: result.status,
            headers: result.headers,
          });
        }
        return NextResponse.json(result as object, { status: 200 });
      } catch (e) {
        console.error(`[backend] ${method} ${routePath} gagal:`, e);
        const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    });
  }
}

/** Temukan & mount semua `route.ts` di app/api (rekursif). */
async function mountAllRoutes(app: Hono): Promise<number> {
  const apiRoot = path.join(rootDir, "app", "api");
  const files = await readdir(apiRoot, { recursive: true });
  const routeFiles = files
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => path.join(apiRoot, f));
  routeFiles.sort();

  let mounted = 0;
  for (const file of routeFiles) {
    try {
      const rel = path.relative(apiRoot, file).replace(/\\/g, "/");
      const routePath = "/api/" + rel.replace(/\/route\.ts$/, "");
      const mod = (await import(pathToFileURL(file).href)) as RouteModule;
      if (!mod.GET && !mod.POST && !mod.PUT && !mod.PATCH && !mod.DELETE) continue;
      mountModule(app, routePath, mod);
      mounted++;
    } catch (e) {
      console.error(`[backend] Gagal memuat route ${file}:`, e);
    }
  }
  return mounted;
}

const healthPath = "/api/health";
app.get(healthPath, (c) =>
  c.json({ ok: true, service: "eureka-ai-backend", time: new Date().toISOString() })
);

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
