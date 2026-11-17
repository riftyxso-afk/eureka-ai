// One seven-day period shared by existing and newly registered accounts.
export const FREE_PRO_START = "2026-11-11T01:50:00.000Z";
const start = Date.parse(FREE_PRO_START);
const end = start + 7 * 86_400_000;

export function getFreeProUntil(now = Date.now()): string | null {
  return now >= start && now < end ? new Date(end).toISOString() : null;
}

export const WELCOME_PRO_DAYS = 28;
export const WELCOME_PRO_START = "2026-11-17T05:46:36.000Z";

export function getWelcomeProUntil(createdAt: string | null | undefined, now = Date.now()): string | null {
  const created = Date.parse(createdAt ?? "");
  if (!Number.isFinite(created) || created < Date.parse(WELCOME_PRO_START) || created > now) return null;
  const expires = created + WELCOME_PRO_DAYS * 86_400_000;
  return now < expires ? new Date(expires).toISOString() : null;
}
