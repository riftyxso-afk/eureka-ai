/**
 * Auth routes: OTP request & verify
 */
import { Hono } from "hono";
import { mountNextRoutes } from "../utils/honoAdapter";

const app = new Hono();

// Lazy import to avoid circular deps
async function loadHandlers() {
  const otp = await import("../../../app/api/auth/otp/route");
  return { otp };
}

// Preload handlers at startup
let handlers: Awaited<ReturnType<typeof loadHandlers>> | null = null;

async function ensureHandlers() {
  if (!handlers) handlers = await loadHandlers();
  return handlers;
}

// We mount routes lazily after first request for faster startup
let mounted = false;

export function getAuthRoutes(): Hono {
  // Mount on first access
  if (!mounted) {
    mounted = true;
    // Mount is async but we fire-and-forget; routes will work after first load
    ensureHandlers().then((h) => {
      mountNextRoutes(app as any, "/api/auth/otp", h.otp);
    });
  }
  return app;
}
