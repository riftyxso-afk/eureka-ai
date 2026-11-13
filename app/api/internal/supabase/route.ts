import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Private server-to-server transport. Never mounted on the VPS itself. */
async function relay(req: Request) {
  const secret = process.env.SUPABASE_RELAY_SECRET;
  const supplied = req.headers.get("x-eureka-relay-secret") ?? "";
  if (!secret || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const path = new URL(req.url).searchParams.get("path") ?? "";
  const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const target = new URL(path, project);
  if (target.origin !== project.origin || !/^\/(auth|rest|storage)\/v1\//.test(target.pathname) || target.hash) {
    return Response.json({ error: "Invalid destination" }, { status: 400 });
  }
  const headers = new Headers();
  for (const name of ["authorization", "apikey", "content-type", "prefer", "range", "range-unit", "accept", "accept-profile", "content-profile", "x-client-info", "x-supabase-api-version", "x-upsert"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  if (body && body.byteLength > 8 * 1024 * 1024) return new Response(null, { status: 413 });
  try {
    const upstream = await fetch(target, { method: req.method, headers, body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const output = new Headers({ "Cache-Control": "private, no-store" });
    for (const name of ["content-type", "content-range", "range-unit", "preference-applied", "x-total-count"]) {
      const value = upstream.headers.get(name);
      if (value) output.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: output });
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 503 });
  }
}

export { relay as GET, relay as POST, relay as PUT, relay as PATCH, relay as DELETE, relay as HEAD };
