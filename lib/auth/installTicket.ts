import { createHmac, timingSafeEqual } from "node:crypto";

export const INSTALL_COOKIE = "eureka_install_account";
export const INSTALL_TTL = 600;
type Ticket = { hash: string; userId: string; expires: number };

function signature(payload: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Account transfer is unavailable");
  return createHmac("sha256", key).update("eureka-install-v1:" + payload).digest("base64url");
}

export function createInstallTicket(hash: string, userId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ hash, userId, expires: now + INSTALL_TTL * 1000 })).toString("base64url");
  return payload + "." + signature(payload);
}

export function readInstallTicket(value: string, now = Date.now()): Ticket | null {
  try {
    if (value.length > 2000) return null;
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const actual = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(signature(parts[0]), "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const ticket = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as Ticket;
    if (typeof ticket.hash !== "string" || !ticket.hash || typeof ticket.userId !== "string" || !ticket.userId ||
      !Number.isFinite(ticket.expires) || ticket.expires <= now || ticket.expires > now + INSTALL_TTL * 1000) return null;
    return ticket;
  } catch { return null; }
}
