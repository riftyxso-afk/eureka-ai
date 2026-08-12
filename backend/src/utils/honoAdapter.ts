/**
 * Adapter untuk mengkonversi Next.js-style route handlers ke Hono handlers.
 * Memungkinkan reuse kode app/api/ tanpa rewrite.
 */
import type { Context } from "hono";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: any, ctx: any) => Promise<unknown> | unknown;

interface HandlerModule {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  PATCH?: RouteHandler;
  DELETE?: RouteHandler;
}

/** Convert Next.js [param] syntax ke Hono :param syntax */
function toHonoPath(nextPath: string): string {
  return nextPath
    .replace(/\[\.\.\.[^\]]+\]/g, "*")
    .replace(/\[([^\]]+)\]/g, ":$1");
}

/** Convert Hono Request ke NextRequest */
function toNextRequest(c: Context): NextRequest {
  const raw = c.req.raw;
  return new NextRequest(raw.url, {
    method: raw.method,
    headers: raw.headers,
    body: raw.body ?? undefined,
  });
}

/** Convert NextResponse ke Hono-compatible Response */
async function toResponse(result: unknown): Promise<Response> {
  // Check by constructor name to handle multiple NextResponse instances
  // (instanceof fails when Next.js routes are loaded via dynamic import)
  const name = result?.constructor?.name;
  const isResponseLike = name === "NextResponse" ||
    (result instanceof Response) ||
    (name === "Response" && "body" in (result as object) && "status" in (result as object));
  
  if (isResponseLike) {
    const resp = result as Response;
    // PENTING: teruskan body apa adanya (streaming pass-through), JANGAN
    // `await resp.text()` — itu mem-buffer seluruh stream sehingga SSE
    // (EventSource progress) tidak pernah terkirim realtime dan request
    // menggantung sampai stream ditutup (bisa 9 menit).
    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  }
  // Plain object — wrap in JSON response
  return NextResponse.json(result as object, { status: 200 });
}

/**
 * Mount Next.js-style route module ke Hono app.
 * Path otomatis dikonversi dari Next.js [param] ke Hono :param.
 */
export function mountNextRoutes(
  app: { on: (method: string, path: string, handler: (c: Context) => Promise<Response>) => void },
  routePath: string,
  module: HandlerModule
): void {
  const honoPath = toHonoPath(routePath);
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

  for (const method of methods) {
    const handler = module[method];
    if (!handler) continue;

    app.on(method, honoPath, async (c: Context) => {
      try {
        const req = toNextRequest(c);
        const params = Promise.resolve({ ...c.req.param() });
        const result = await handler(req, { params });
        return await toResponse(result);
      } catch (e) {
        console.error(`[adapter] ${method} ${routePath} gagal:`, e);
        const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    });
  }
}
