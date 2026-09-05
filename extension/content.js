/**
 * Content script ekstraksi Tab-to-Note — Eureka.AI Browser Extension.
 *
 * HANYA berjalan atas aksi eksplisit: disuntik via chrome.scripting
 * saat pengguna menekan "Catat" di side panel (tidak ada observer,
 * tidak ada tracking pasif, tidak ada content_scripts statis).
 *
 * Protokol: terima pesan { type: "EUREKA_EXTRACT" } → balas
 * { ok: true, title, url, text } atau { ok: false, error }.
 */
(function () {
  if (window.__eurekaExtractorReady) return;
  window.__eurekaExtractorReady = true;

  function cleanText(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll(
      "script, style, noscript, nav, header, footer, aside, form, button, input, select, textarea, iframe, canvas, svg"
    ).forEach((el) => el.remove());
    const text = (clone.innerText || "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text;
  }

  function extractMainText() {
    const candidates = [
      document.querySelector("article"),
      document.querySelector("main"),
      document.querySelector('[role="main"]'),
      document.querySelector(".post-content, .article-content, .entry-content"),
    ].filter(Boolean);

    let best = null;
    let bestLen = 0;
    if (candidates.length > 0) {
      for (const el of candidates) {
        const t = cleanText(el);
        if (t.length > bestLen) {
          bestLen = t.length;
          best = t;
        }
      }
      if (best && best.length >= 200) return best;
    }

    // Fallback: blok dengan kepadatan paragraf terbesar.
    const blocks = Array.from(document.querySelectorAll("div, section"));
    for (const el of blocks) {
      if (el.querySelector("div, section")) continue; // hanya daun
      const t = cleanText(el);
      if (t.length > bestLen && t.length < 200000) {
        bestLen = t.length;
        best = t;
      }
    }
    if (best && best.length >= 200) return best;

    const body = cleanText(document.body);
    return body.length >= 200 ? body : "";
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "EUREKA_EXTRACT") return false;
    try {
      const ctype = String(document.contentType || "");
      if (ctype === "application/pdf") {
        sendResponse({
          ok: false,
          code: "PDF_NO_TEXT",
          error: "Halaman ini PDF tanpa teks terbaca. Salin manual teksnya, atau buka versi artikelnya.",
        });
        return true;
      }
      const text = extractMainText().slice(0, 12000);
      if (!text) {
        sendResponse({
          ok: false,
          code: "NO_CONTENT",
          error: "Halaman ini tidak punya konten teks yang bisa dijadikan catatan.",
        });
        return true;
      }
      sendResponse({
        ok: true,
        title: (document.title || "").slice(0, 160),
        url: location.href,
        text,
      });
    } catch (e) {
      sendResponse({
        ok: false,
        code: "EXTRACT_FAILED",
        error: e instanceof Error ? e.message : "Gagal membaca halaman.",
      });
    }
    return true;
  });
})();
