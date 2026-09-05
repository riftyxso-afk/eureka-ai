/**
 * Background service worker (Manifest V3) — Eureka.AI Browser Extension.
 *
 * - Daftarkan context menu "Tanya Eureka" (hanya saat ada teks terseleksi).
 * - Klik toolbar → buka side panel.
 * - Terima pesan dari side panel: ambil pending-ask, refresh badge streak.
 * - Badge streak diambil dari GET /api/progress (bukan tracking pasif).
 */

try {
  importScripts("config.js");
} catch {
  // config.js opsional — getApiBase punya default
}

const MENU_ID = "eureka-ask";
const ACCENT = "#FF6F59";

async function getApiBase() {
  try {
    const { eurekaApiBase } = await chrome.storage.local.get("eurekaApiBase");
    if (typeof eurekaApiBase === "string" && eurekaApiBase) return eurekaApiBase;
  } catch {
    // abaikan — pakai default config
  }
  return (typeof EUREKA_CONFIG !== "undefined" && EUREKA_CONFIG.API_BASE) || "https://eureka-ai.web.id";
}

async function getAuth() {
  try {
    const { eurekaAuth } = await chrome.storage.local.get("eurekaAuth");
    if (eurekaAuth && eurekaAuth.token && eurekaAuth.userId) return eurekaAuth;
  } catch {
    // abaikan
  }
  return null;
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.contextMenus.removeAll();
  } catch {
    // menu belum ada — lanjut
  }
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Tanya Eureka",
    contexts: ["selection"],
  });
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // API belum tersedia — panel tetap bisa dibuka manual
  }
  await refreshStreakBadge();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshStreakBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = String(info.selectionText ?? "").trim();
  if (!text) return;
  const pageUrl = tab?.url ?? "";
  const pageTitle = tab?.title ?? "";
  await chrome.storage.local.set({
    eurekaPendingAsk: {
      text: text.slice(0, 4000),
      url: pageUrl,
      title: pageTitle,
      at: Date.now(),
    },
  });
  try {
    await chrome.sidePanel.open({ windowId: tab?.windowId });
  } catch {
    // panel tidak bisa dibuka otomatis — user bisa klik icon toolbar
  }
});

/** Ambil streak dari backend lalu tampilkan sebagai badge toolbar. */
async function refreshStreakBadge() {
  try {
    const auth = await getAuth();
    if (!auth) {
      await chrome.action.setBadgeText({ text: "" });
      return;
    }
    const base = await getApiBase();
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/progress?userId=${encodeURIComponent(auth.userId)}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        // Sesi kedaluwarsa — netralkan badge, panel akan minta login ulang.
        await chrome.storage.local.remove("eurekaAuth");
        await chrome.action.setBadgeText({ text: "" });
      }
      return;
    }
    const json = await res.json().catch(() => null);
    const stats = json?.stats ?? json ?? {};
    const streak = Number(stats.streak ?? stats.currentStreak ?? stats.streakDays ?? 0);
    if (Number.isFinite(streak) && streak > 0) {
      await chrome.action.setBadgeText({ text: String(streak) });
      await chrome.action.setBadgeBackgroundColor({ color: ACCENT });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
  } catch {
    // offline / backend down — biarkan badge apa adanya
  }
}

/**
 * Ekstraksi tab aktif — HANYA atas pesan eksplisit dari side panel
 * (pengguna menekan "Catat"). Tidak ada content script statis,
 * tidak ada observer, tidak ada tracking pasif.
 */
async function extractActiveTab(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab || !tab.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      sendResponse({
        ok: false,
        code: "BAD_TAB",
        error: "Buka halaman web biasa dulu (bukan halaman internal browser).",
      });
      return;
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch {
      sendResponse({
        ok: false,
        code: "INJECT_FAILED",
        error: "Halaman ini tidak bisa dibaca (mungkin PDF atau halaman khusus). Salin manual teksnya.",
      });
      return;
    }
    let resp = null;
    try {
      resp = await chrome.tabs.sendMessage(tab.id, { type: "EUREKA_EXTRACT" });
    } catch {
      resp = null;
    }
    if (!resp || !resp.ok) {
      sendResponse({
        ok: false,
        code: (resp && resp.code) || "NO_CONTENT",
        error:
          (resp && resp.error) ||
          "Halaman ini tidak punya konten teks yang bisa dijadikan catatan.",
      });
      return;
    }
    sendResponse({
      ok: true,
      title: resp.title || tab.title || "",
      url: resp.url || tab.url,
      text: resp.text || "",
    });
  } catch (e) {
    sendResponse({
      ok: false,
      code: "EXTRACT_FAILED",
      error: e instanceof Error ? e.message : "Gagal membaca halaman.",
    });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false;
  if (msg.type === "EUREKA_GET_PENDING_ASK") {
    chrome.storage.local
      .get("eurekaPendingAsk")
      .then((r) => sendResponse({ pending: r.eurekaPendingAsk ?? null }))
      .catch(() => sendResponse({ pending: null }));
    return true;
  }
  if (msg.type === "EUREKA_CLEAR_PENDING_ASK") {
    chrome.storage.local
      .remove("eurekaPendingAsk")
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "EUREKA_EXTRACT_TAB") {
    extractActiveTab(sendResponse);
    return true;
  }
  if (msg.type === "EUREKA_REFRESH_BADGE") {
    refreshStreakBadge()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});
