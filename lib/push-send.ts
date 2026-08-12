/**
 * Pengiriman Web Push (server-side) — dipakai setelah job background selesai
 * (mis. catatan selesai dibuat) agar muncul notifikasi sistem di HP walau
 * browser tertutup / aplikasi di latar belakang.
 *
 * Butuh env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * Kalau belum di-set, fungsi ini no-op (notifikasi web dilewati).
 */
import webpush from "web-push";
import {
  getPushSubscriptions,
  removePushSubscription,
  type PushSubscriptionRecord,
} from "@/lib/push-store";

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

function vapidConfig(): {
  subject: string;
  publicKey: string;
  privateKey: string;
} | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    subject:
      process.env.VAPID_SUBJECT ?? "mailto:admin@eureka-ai.web.id",
    publicKey,
    privateKey,
  };
}

/**
 * Kirim push notification ke semua perangkat terdaftar milik user.
 * Endpoint yang sudah mati (404/410) otomatis dibersihkan.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const config = vapidConfig();
  const subs = getPushSubscriptions(userId);
  if (!config || subs.length === 0) return;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/dashboard",
    tag: payload.tag ?? `eureka-${userId}`,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub as unknown as webpush.PushSubscription,
          body
        );
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          removePushSubscription(userId, (sub as PushSubscriptionRecord).endpoint);
        }
      }
    })
  );
}
