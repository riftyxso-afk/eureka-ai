// One seven-day period shared by existing and newly registered accounts.
export const FREE_PRO_START = "2026-11-11T01:50:00.000Z";
const start = Date.parse(FREE_PRO_START);
const end = start + 7 * 86_400_000;

export function getFreeProUntil(now = Date.now()): string | null {
  return now >= start && now < end ? new Date(end).toISOString() : null;
}
