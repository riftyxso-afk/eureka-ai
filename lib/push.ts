/**
 * Setup Web Push di sisi browser: daftarkan service worker, minta izin,
 * buat subscription dengan VAPID public key, lalu kirim ke backend
 * (POST /api/notifications/push-subscribe) agar job selesai bisa memunculkan
 * notifikasi sistem di HP.
 *
 * Semua kegagalan diabaikan diam-diam (push adalah fitur opsional):
 * - iOS Safari non-PWA tidak mendukung PushManager → subscribe ditolak.
 * - VAPID key belum di-set → subscription tidak dibuat.
 */
import { apiFetch } from "@/lib/apiClient";

const SW_PATH = "/sw.js";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
/** Key localStorage per endpoint — cegah POST subscription berulang. */
const REGISTERED_KEY = "eureka_push_registered";

/** Konversi base64url (VAPID key) → Uint8Array untuk applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64Url);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Pastikan perangkat user terdaftar untuk Web Push.
 * Panggil dari efek setelah login & saat izin notifikasi sudah granted.
 */
export async function ensurePushSetup(userId: string): Promise<void> {
  if (!userId || typeof window === "undefined") return;
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    if (!VAPID_PUBLIC_KEY) return;

    const reg = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));
    if (!sub) return;

    // Sudah terdaftar di backend (per endpoint) — jangan kirim ulang.
    const registered: string[] = JSON.parse(
      window.localStorage.getItem(REGISTERED_KEY) ?? "[]"
    );
    if (!registered.includes(sub.endpoint)) {
      await apiFetch("/api/notifications/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subscription: sub.toJSON(),
        }),
      });
      registered.push(sub.endpoint);
      window.localStorage.setItem(
        REGISTERED_KEY,
        JSON.stringify(registered.slice(-20))
      );
    }
  } catch {
    // Tidak didukung / ditolak — biarkan, push tetap opsional.
  }
}
