/**
 * Service Worker Eureka.AI — Web Push notifications.
 *
 * Tugasnya satu: menampilkan notifikasi sistem di HP saat backend mengirim
 * push (mis. "Catatan selesai dibuat!") walau tab browser tertutup atau
 * aplikasi sedang di latar belakang. Klik notifikasi → buka catatan.
 *
 * Catatan: tanpa fetch handler agar tidak mengganggu cache aset Next.js.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const { title, body, url, tag } = data;
  const options = {
    body: body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: tag || "eureka-push",
    renotify: true,
    data: { url: url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title || "Eureka.AI", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
