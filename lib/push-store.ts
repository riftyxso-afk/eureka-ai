/**
 * Store Push Subscription — in-memory per proses (sama pola jobQueue).
 *
 * Backend berjalan di SATU instance VPS (pm2 cluster 1), jadi Map cukup.
 * Subscription hilang saat server restart — user cukup buka aplikasi sekali
 * lagi dan browser otomatis daftar ulang via lib/push.ts.
 */

export interface PushSubscriptionRecord {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const MAX_PER_USER = 10;

const store = new Map<string, PushSubscriptionRecord[]>();

/** Simpan/update subscription untuk satu user (hapus endpoint duplikat). */
export function savePushSubscription(
  userId: string,
  sub: PushSubscriptionRecord
): void {
  const list = (store.get(userId) ?? []).filter(
    (s) => s.endpoint !== sub.endpoint
  );
  list.push(sub);
  store.set(userId, list.slice(-MAX_PER_USER));
}

export function getPushSubscriptions(userId: string): PushSubscriptionRecord[] {
  return store.get(userId) ?? [];
}

/** Hapus endpoint yang sudah tidak valid (404/410 dari push service). */
export function removePushSubscription(
  userId: string,
  endpoint: string
): void {
  const list = (store.get(userId) ?? []).filter(
    (s) => s.endpoint !== endpoint
  );
  if (list.length > 0) store.set(userId, list);
  else store.delete(userId);
}
