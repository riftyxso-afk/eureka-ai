/**
 * Side panel Eureka.AI Browser Extension (vanilla JS, tanpa build step).
 *
 * Alur: login (OTP via /api/auth/otp + Supabase verify) → chat SSE
 * (/api/assistant/chat) → Catat (ekstrak tab via background → ringkas
 * → simpan via /api/notes/process → poll job). Sesi + pesan disimpan
 * di chrome.storage.local agar panel persisten saat pindah tab.
 */
(function () {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };

  var els = {};
  ["view-login", "view-chat", "view-draft", "loginEmail", "btnSendCode", "otpBlock",
    "loginCode", "btnVerifyCode", "loginError", "messages", "emptyState",
    "chatInput", "btnAsk", "btnNote", "pendingBanner", "pendingText",
    "streakBadge", "streakCount", "draftSource", "draftTitle", "draftTag",
    "draftBody", "draftLoading", "btnDraftCancel", "btnDraftSave", "draftStatus",
    "toast", "typingIndicator", "notificationBadge",
  ].forEach(function (id) {
    var key = id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
    els[key] = $(id);
  });

  /* ── Config & storage ─────────────────────────── */
  function apiBaseSync() {
    return "https://eureka-ai.web.id";
  }

  async function apiBase() {
    try {
      var r = await chrome.storage.local.get("eurekaApiBase");
      if (typeof r.eurekaApiBase === "string" && r.eurekaApiBase) return r.eurekaApiBase.replace(/\/+$/, "");
    } catch (e) { /* abaikan */ }
    var fromConfig = typeof EUREKA_CONFIG !== "undefined" && EUREKA_CONFIG.API_BASE;
    return String(fromConfig || apiBaseSync()).replace(/\/+$/, "");
  }

  function supaCfg() {
    var c = typeof EUREKA_CONFIG !== "undefined" ? EUREKA_CONFIG : {};
    return { url: String(c.SUPABASE_URL || ""), anonKey: String(c.SUPABASE_ANON_KEY || "") };
  }

  async function getAuth() {
    try {
      var r = await chrome.storage.local.get("eurekaAuth");
      if (r.eurekaAuth && r.eurekaAuth.token && r.eurekaAuth.userId) return r.eurekaAuth;
    } catch (e) { /* abaikan */ }
    return null;
  }

  async function setAuth(auth) {
    await chrome.storage.local.set({ eurekaAuth: auth });
  }

  async function clearAuth() {
    await chrome.storage.local.remove(["eurekaAuth", "eurekaSessionId"]);
  }

  /* ── API ──────────────────────────────────────── */
  async function api(path, opts) {
    opts = opts || {};
    var base = await apiBase();
    var headers = {};
    if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (opts.token) headers["Authorization"] = "Bearer " + opts.token;
    headers["x-requested-with"] = "eureka-extension";
    var res = await fetch(base + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
    });
    var json = null;
    try {
      json = await res.clone().json();
    } catch (e) { /* bukan JSON (mis. SSE) */ }
    return { res: res, json: json };
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { els.toast.hidden = true; }, 4000);
  }

  function showNotificationBadge(type) {
    els.notificationBadge.className = "notification-badge " + type;
    els.notificationBadge.hidden = false;
    clearTimeout(showNotificationBadge._t);
    showNotificationBadge._t = setTimeout(function () {
      els.notificationBadge.hidden = true;
    }, 3000);
  }

  function showTypingIndicator() {
    els.typingIndicator.classList.remove("hidden");
  }

  function hideTypingIndicator() {
    els.typingIndicator.classList.add("hidden");
  }

  function showView(name) {
    els.viewLogin.hidden = name !== "login";
    els.viewChat.hidden = name !== "chat";
    els.viewDraft.hidden = name !== "draft";
  }

  function setLoginError(msg) {
    if (!msg) {
      els.loginError.hidden = true;
      els.loginError.textContent = "";
    } else {
      els.loginError.hidden = false;
      els.loginError.textContent = msg;
    }
  }

  /* ── Streak ───────────────────────────────────── */
  var lastStreak = null;
  async function refreshStreak() {
    var auth = await getAuth();
    if (!auth) {
      els.streakBadge.hidden = true;
      return;
    }
    try {
      var r = await api("/api/progress?userId=" + encodeURIComponent(auth.userId), { token: auth.token });
      if (r.res.status === 401) return void needLogin("Sesi habis, masuk lagi ya.");
      if (!r.res.ok) return;
      var stats = (r.json && (r.json.stats || r.json)) || {};
      var streak = Number(stats.streak !== undefined ? stats.streak : stats.currentStreak !== undefined ? stats.currentStreak : stats.streakDays !== undefined ? stats.streakDays : 0);
      if (!Number.isFinite(streak) || streak < 0) streak = 0;
      els.streakBadge.hidden = false;
      els.streakCount.textContent = streak + " hari";
      if (lastStreak !== null && streak !== lastStreak) {
        els.streakBadge.classList.remove("pop");
        void els.streakBadge.offsetWidth;
        els.streakBadge.classList.add("pop");
      }
      lastStreak = streak;
    } catch (e) { /* offline — biarkan badge lama */ }
    try {
      chrome.runtime.sendMessage({ type: "EUREKA_REFRESH_BADGE" });
    } catch (e) { /* abaikan */ }
  }

  function needLogin(msg) {
    clearAuth().catch(function () {});
    showView("login");
    if (msg) showToast(msg);
  }

  /* ── Login (OTP) ──────────────────────────────── */
  els.btnSendCode.addEventListener("click", async function () {
    var email = els.loginEmail.value.trim().toLowerCase();
    if (!/.+@.+\..+/.test(email)) {
      setLoginError("Tulis email yang valid dulu ya.");
      return;
    }
    setLoginError(null);
    els.btnSendCode.disabled = true;
    try {
      var r = await api("/api/auth/otp", {
        method: "POST",
        body: { action: "request", email: email, name: "", captchaToken: "" },
      });
      if (!r.res.ok || !r.json || r.json.ok !== true) {
        setLoginError((r.json && r.json.error) || "Gagal mengirim kode. Coba lagi.");
        return;
      }
      els.otpBlock.hidden = false;
      els.loginCode.focus();
      showToast("Kode dikirim ke email kamu.");
    } catch (e) {
      setLoginError("Tidak dapat terhubung ke server. Coba lagi.");
    } finally {
      els.btnSendCode.disabled = false;
    }
  });

  els.btnVerifyCode.addEventListener("click", async function () {
    var email = els.loginEmail.value.trim().toLowerCase();
    var code = els.loginCode.value.trim();
    if (code.length < 4) {
      setLoginError("Tulis kode dari email ya.");
      return;
    }
    setLoginError(null);
    els.btnVerifyCode.disabled = true;
    try {
      var r = await api("/api/auth/otp", {
        method: "POST",
        body: { action: "verify", email: email, code: code, name: "", captchaToken: "", ref: "" },
      });
      if (!r.res.ok || !r.json || r.json.ok !== true || !r.json.tokenHash) {
        setLoginError((r.json && r.json.error) || "Kode salah. Coba lagi.");
        return;
      }
      var cfg = supaCfg();
      if (!cfg.url || !cfg.anonKey || cfg.anonKey.indexOf("ISI-DARI") === 0) {
        setLoginError("Supabase belum dikonfigurasi di extension/config.js.");
        return;
      }
      var vres = await fetch(cfg.url.replace(/\/+$/, "") + "/auth/v1/verify", {
        method: "POST",
        headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "magiclink", token_hash: r.json.tokenHash }),
      });
      var session = await vres.json().catch(function () { return null; });
      if (!vres.ok || !session || !session.access_token || !session.user) {
        setLoginError("Verifikasi gagal. Minta kode baru lalu coba lagi.");
        return;
      }
      await setAuth({
        token: session.access_token,
        refreshToken: session.refresh_token || null,
        userId: session.user.id,
        email: email,
        expiresAt: Date.now() + (Number(session.expires_in) || 3600) * 1000,
      });
      els.loginCode.value = "";
      els.otpBlock.hidden = true;
      await bootChat();
      showToast("Masuk! Selamat belajar.");
    } catch (e) {
      setLoginError("Tidak dapat terhubung ke server. Coba lagi.");
    } finally {
      els.btnVerifyCode.disabled = false;
    }
  });

  /* ── Chat ─────────────────────────────────────── */
  var messages = [];
  var sending = false;
  var mode = "ask"; // "ask" | "note"

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderMessages() {
    els.messages.innerHTML = "";
    els.emptyState.style.display = messages.length === 0 ? "" : "none";
    messages.forEach(function (m) {
      var div = document.createElement("div");
      div.className = "bubble " + (m.role === "user" ? "user" : "ai");
      m.content.split(/\n\n+/).forEach(function (para) {
        var p = document.createElement("p");
        p.textContent = para;
        div.appendChild(p);
      });
      els.messages.appendChild(div);
    });
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  async function persistMessages() {
    try {
      await chrome.storage.local.set({ eurekaMessages: messages.slice(-50) });
    } catch (e) { /* abaikan */ }
  }

  async function ensureSession(auth) {
    var stored = await chrome.storage.local.get("eurekaSessionId");
    if (stored.eurekaSessionId) return stored.eurekaSessionId;
    var r = await api("/api/assistant/sessions", {
      method: "POST",
      token: auth.token,
      body: { userId: auth.userId },
    });
    if (r.res.status === 401) {
      needLogin("Sesi habis, masuk lagi ya.");
      throw new Error("unauthorized");
    }
    if (!r.res.ok || !r.json || !r.json.session || !r.json.session.id) {
      throw new Error("Gagal membuat sesi chat.");
    }
    await chrome.storage.local.set({ eurekaSessionId: r.json.session.id });
    return r.json.session.id;
  }

  function setMode(next) {
    mode = next;
    var ask = next === "ask";
    els.btnAsk.classList.toggle("mode-active", ask);
    els.btnNote.classList.toggle("mode-active", !ask);
  }

  els.btnAsk.addEventListener("click", function () {
    setMode("ask");
    els.chatInput.focus();
  });

  els.btnNote.addEventListener("click", function () {
    setMode("note");
    void startTabNote();
  });

  async function sendChat(question) {
    var auth = await getAuth();
    if (!auth) return void needLogin("Masuk dulu yuk.");
    if (sending || !question.trim()) return;
    sending = true;
    showTypingIndicator();
    var sessionId;
    try {
      sessionId = await ensureSession(auth);
    } catch (e) {
      sending = false;
      hideTypingIndicator();
      if (String((e && e.message) || "") !== "unauthorized") showToast("Gagal membuat sesi chat. Coba lagi.");
      return;
    }

    messages.push({ role: "user", content: question });
    var aiMsg = { role: "assistant", content: "" };
    messages.push(aiMsg);
    renderMessages();
    await persistMessages();

    async function doSend(sid) {
      var base = await apiBase();
      var res = await fetch(base + "/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + auth.token },
        body: JSON.stringify({ sessionId: sid, userId: auth.userId, question: question }),
      });
      if (!res.ok || !res.body) {
        var errJson = await res.json().catch(function () { return null; });
        throw new Error((errJson && errJson.error) || ("Server error " + res.status));
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      var sawDone = false;
      for (;;) {
        var step = await reader.read();
        if (step.done) break;
        buf += decoder.decode(step.value, { stream: true });
        var lines = buf.split("\n");
        buf = lines.pop() || "";
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.indexOf("data:") !== 0) continue;
          var payload = line.slice(5).trim();
          if (!payload) continue;
          var ev = null;
          try { ev = JSON.parse(payload); } catch (e) { continue; }
          if (!ev || typeof ev.type !== "string") continue;
          if (ev.type === "token" && typeof ev.text === "string") {
            aiMsg.content += ev.text;
            renderMessages();
          } else if (ev.type === "error") {
            throw new Error(ev.message || "AI gagal menjawab.");
          } else if (ev.type === "done") {
            sawDone = true;
          }
        }
      }
      if (!sawDone && !aiMsg.content.trim()) throw new Error("AI tidak menjawab. Coba lagi.");
    }

    try {
      await doSend(sessionId);
    } catch (e) {
      var msg = e instanceof Error ? e.message : "AI gagal menjawab.";
      if (/Sesi tidak ditemukan/i.test(msg)) {
        try {
          await chrome.storage.local.remove("eurekaSessionId");
          var sid2 = await ensureSession(auth);
          aiMsg.content = "";
          await doSend(sid2);
        } catch (e2) {
          aiMsg.content = "Ups, " + (e2 instanceof Error ? e2.message : msg);
        }
      } else if (/401|masuk ulang|tidak valid/i.test(msg)) {
        messages.pop();
        renderMessages();
        sending = false;
        return void needLogin("Sesi habis, masuk lagi ya.");
      } else {
        aiMsg.content = "Ups, " + msg;
      }
    }
    renderMessages();
    await persistMessages();
    hideTypingIndicator();
    sending = false;
    void refreshStreak();
  }

  function sendFromComposer() {
    var q = els.chatInput.value.trim();
    if (!q || sending) return;
    els.chatInput.value = "";
    void sendChat(q);
  }

  els.chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendFromComposer();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.viewDraft.hidden) {
      e.preventDefault();
      showView("chat");
    }
  });

  /* ── Pending ask (Highlight-to-Tanya) ─────────── */
  async function consumePendingAsk() {
    var pending = null;
    try {
      var r = await chrome.runtime.sendMessage({ type: "EUREKA_GET_PENDING_ASK" });
      pending = (r && r.pending) || null;
    } catch (e) {
      try {
        var s = await chrome.storage.local.get("eurekaPendingAsk");
        pending = s.eurekaPendingAsk || null;
      } catch (e2) { /* abaikan */ }
    }
    if (!pending || !pending.text) return;
    try {
      await chrome.runtime.sendMessage({ type: "EUREKA_CLEAR_PENDING_ASK" });
    } catch (e) { /* abaikan */ }
    try {
      await chrome.storage.local.remove("eurekaPendingAsk");
    } catch (e) { /* abaikan */ }
    setMode("ask");
    els.pendingBanner.hidden = false;
    els.pendingText.textContent = "“" + String(pending.text).slice(0, 140) + (String(pending.text).length > 140 ? "…" : "") + "”";
    showView("chat");
    var opener =
      "Bantu aku memahami teks di bawah ini dengan SATU pertanyaan pemandu. Jangan beri jawaban langsung.\n\nTeks:\n\"\"\"" +
      String(pending.text).slice(0, 3000) +
      "\"\"\"" +
      (pending.url ? "\nSumber: " + pending.url : "");
    void sendChat(opener);
  }

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes.eurekaPendingAsk && changes.eurekaPendingAsk.newValue) {
        void consumePendingAsk();
      }
    });
  } catch (e) { /* abaikan */ }

  /* ── Tab-to-Note ──────────────────────────────── */
  var DOMAIN_TAGS = {
    "ruangguru.com": "Matematika",
    "roboguru.ruangguru.com": "Matematika",
    "quipper.com": "Belajar",
    "zenius.net": "Belajar",
    "brainly.co.id": "Belajar",
    "youtube.com": "Video",
    "youtu.be": "Video",
    "wikipedia.org": "Umum",
  };

  function autoTag(url) {
    try {
      var host = new URL(url).hostname.replace(/^www\./, "");
      for (var key in DOMAIN_TAGS) {
        if (host === key || host.endsWith("." + key)) return DOMAIN_TAGS[key];
      }
    } catch (e) { /* abaikan */ }
    return "Umum";
  }

  async function startTabNote() {
    showView("chat");
    showToast("Membaca tab aktif...");
    var resp = null;
    try {
      resp = await chrome.runtime.sendMessage({ type: "EUREKA_EXTRACT_TAB" });
    } catch (e) {
      resp = { ok: false, error: "Tidak dapat membaca tab. Coba lagi." };
    }
    if (!resp || !resp.ok) {
      showToast((resp && resp.error) || "Halaman ini tidak bisa dijadikan catatan.");
      return;
    }
    els.draftSource.textContent = resp.title ? resp.title + " — " + resp.url : resp.url;
    els.draftTitle.value = (resp.title || "Catatan baru").slice(0, 160);
    els.draftTag.value = autoTag(resp.url || "");
    els.draftBody.value = resp.text || "";
    els.draftStatus.textContent = "";
    els.draftBody.dataset.url = resp.url || "";
    showView("draft");
    void summarizeDraft();
  }

  async function summarizeDraft() {
    var auth = await getAuth();
    if (!auth) return void needLogin("Masuk dulu yuk.");
    var title = els.draftTitle.value.trim() || "Catatan baru";
    var body = els.draftBody.value.trim();
    if (body.length < 50) {
      els.draftStatus.textContent = "Teks terlalu pendek untuk diringkas. Tambahkan isi dulu.";
      return;
    }
    els.draftLoading.hidden = false;
    els.btnDraftSave.disabled = true;
    try {
      var sessionId = await ensureSession(auth);
      var base = await apiBase();
      var res = await fetch(base + "/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + auth.token },
        body: JSON.stringify({
          sessionId: sessionId,
          userId: auth.userId,
          question:
            "Ringkas teks halaman ini jadi maksimal 5 poin penting, lalu tambahkan 2 pertanyaan reflektif Socratic di akhir. Judul: " +
            title + "\n\nTeks:\n\"\"\"" + body.slice(0, 8000) + "\"\"\"",
        }),
      });
      if (!res.ok || !res.body) throw new Error("Server error " + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      var out = "";
      for (;;) {
        var step = await reader.read();
        if (step.done) break;
        buf += decoder.decode(step.value, { stream: true });
        var lines = buf.split("\n");
        buf = lines.pop() || "";
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.indexOf("data:") !== 0) continue;
          var payload = line.slice(5).trim();
          if (!payload) continue;
          var ev = null;
          try { ev = JSON.parse(payload); } catch (e) { continue; }
          if (ev && ev.type === "token" && typeof ev.text === "string") {
            out += ev.text;
            els.draftBody.value = out;
          } else if (ev && ev.type === "error") {
            throw new Error(ev.message || "Gagal meringkas.");
          }
        }
      }
      if (!out.trim()) throw new Error("Ringkasan kosong. Coba lagi.");
      els.draftStatus.textContent = "Ringkasan siap — edit dulu kalau perlu, lalu Simpan.";
    } catch (e) {
      els.draftStatus.textContent = "Ups, " + (e instanceof Error ? e.message : "gagal meringkas.") + " Isi asli tetap bisa disimpan.";
    } finally {
      els.draftLoading.hidden = true;
      els.btnDraftSave.disabled = false;
    }
  }

  els.btnDraftCancel.addEventListener("click", function () {
    setMode("ask");
    showView("chat");
  });

  els.btnDraftSave.addEventListener("click", async function () {
    var auth = await getAuth();
    if (!auth) return void needLogin("Masuk dulu yuk.");
    var url = els.draftBody.dataset.url || "";
    if (!url) {
      els.draftStatus.textContent = "URL sumber tidak ada. Ulangi dari tombol Catat.";
      return;
    }
    els.btnDraftSave.disabled = true;
    els.draftStatus.textContent = "Menyimpan...";
    try {
      var base = await apiBase();
      var form = new FormData();
      form.append("userId", auth.userId);
      form.append("sources", JSON.stringify([{ type: "web", url: url }]));
      var res = await fetch(base + "/api/notes/process", {
        method: "POST",
        headers: { Authorization: "Bearer " + auth.token },
        body: form,
      });
      var json = await res.json().catch(function () { return null; });
      if (!res.ok || !json || !json.jobId) {
        throw new Error((json && json.error) || ("Server error " + res.status));
      }
      var jobId = json.jobId;
      var done = null;
      for (var i = 0; i < 40; i++) {
        await new Promise(function (r) { setTimeout(r, 3000); });
        var poll = await fetch(base + "/api/notes/jobs/" + encodeURIComponent(jobId) + "?userId=" + encodeURIComponent(auth.userId), {
          headers: { Authorization: "Bearer " + auth.token },
        });
        var pjson = await poll.json().catch(function () { return null; });
        var job = pjson && pjson.job;
        if (!job) continue;
        els.draftStatus.textContent = "Memproses: " + Math.round(job.percent || 0) + "% — " + (job.message || "");
        if (job.status === "done") { done = job; break; }
        if (job.status === "error") throw new Error(job.error || "Gagal membuat catatan.");
      }
      if (!done) throw new Error("Masih diproses. Cek dashboard sebentar lagi ya.");
      var dashBase = base.replace(/\/+$/, "");
      els.draftStatus.textContent = "Tersimpan! Lihat di dashboard: " + dashBase + "/dashboard" + (done.noteId ? " (catatan: " + done.noteTitle + ")" : "");
      showToast("Catatan tersimpan!");
      try {
        chrome.runtime.sendMessage({ type: "EUREKA_REFRESH_BADGE" });
      } catch (e) { /* abaikan */ }
      void refreshStreak();
    } catch (e) {
      els.draftStatus.textContent = "Ups, " + (e instanceof Error ? e.message : "gagal menyimpan.");
    } finally {
      els.btnDraftSave.disabled = false;
    }
  });

  /* ── Boot ─────────────────────────────────────── */
  async function bootChat() {
    try {
      var r = await chrome.storage.local.get("eurekaMessages");
      messages = Array.isArray(r.eurekaMessages) ? r.eurekaMessages : [];
    } catch (e) {
      messages = [];
    }
    renderMessages();
    showView("chat");
    setMode("ask");
    await refreshStreak();
    await consumePendingAsk();
  }

  /* ── Session Sync (Auto Login from Website) ───────── */
  async function tryAutoLogin() {
    try {
      var cfg = supaCfg();
      if (!cfg.url || !cfg.anonKey) return false;

      var websiteUrl = "https://eureka-ai.web.id";
      var popupUrl = websiteUrl + "/extension-sync.html";
      var syncResult = await new Promise(function (resolve) {
        chrome.windows.create(
          {
            url: popupUrl,
            type: "popup",
            width: 500,
            height: 600,
            focused: true,
          },
          function (win) {
            var listener = function (message, sender) {
              if (message.type === "EUREKA_SESSION_TOKEN" && message.token) {
                chrome.windows.remove(win.id, function () {});
                chrome.runtime.onMessage.removeListener(listener);
                resolve(message);
              }
              if (message.type === "EUREKA_SESSION_EXPIRED") {
                chrome.windows.remove(win.id, function () {});
                chrome.runtime.onMessage.removeListener(listener);
                resolve(null);
              }
            };
            chrome.runtime.onMessage.addListener(listener);
            setTimeout(function () {
              chrome.runtime.onMessage.removeListener(listener);
              resolve(null);
            }, 120000);
          }
        );
      });

      if (!syncResult || !syncResult.token) return false;

      var exchangeRes = await api("/api/auth/session-exchange", {
        method: "POST",
        body: { sessionToken: syncResult.token },
      });

      if (!exchangeRes.res.ok || !exchangeRes.json || !exchangeRes.json.ok) return false;

      await setAuth({
        token: exchangeRes.json.token,
        refreshToken: null,
        userId: exchangeRes.json.userId,
        email: exchangeRes.json.email || "",
        expiresAt: new Date(exchangeRes.json.expiresAt).getTime(),
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  async function boot() {
    var auth = await getAuth();
    if (!auth) {
      var autoLoginSuccess = await tryAutoLogin();
      if (autoLoginSuccess) {
        await bootChat();
        showToast("Berhasil masuk via website!");
        return;
      }
      showView("login");
      return;
    }
    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      var refreshed = await tryAutoLogin();
      if (refreshed) {
        await bootChat();
        return;
      }
      return void needLogin("Sesi habis, masuk lagi ya.");
    }
    try {
      var base = await apiBase();
      var res = await fetch(base + "/api/progress?userId=" + encodeURIComponent(auth.userId), {
        headers: { Authorization: "Bearer " + auth.token },
      });
      if (res.status === 401) return void needLogin("Sesi habis, masuk lagi ya.");
    } catch (e) { /* offline — lanjut dengan sesi lokal */ }
    await bootChat();
  }

  void boot();
})();
