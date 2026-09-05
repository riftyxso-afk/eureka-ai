## Context

Ekstensi Eureka.AI saat ini adalah vanilla JS (tanpa build step) yang berjalan di Chrome Side Panel. Session login disimpan di `chrome.storage.local` dan menggunakan OTP email via Supabase. Website Eureka.AI menggunakan Supabase auth dengan session cookie. Keduanya berada di domain berbeda (`eureka-ai.web.id` untuk website, `chrome-extension://<id>` untuk ekstensi).

Backend berjalan di Hono (port 3001) dengan CORS yang sudah mengizinkan `chrome-extension://` origins.

## Goals / Non-Goals

**Goals:**
- User yang sudah login di website tidak perlu login ulang di ekstensi
- Login via website (popup) sebagai alternatif OTP manual
- UI ekstensi lebih responsif dengan loading states dan animasi
- Keyboard shortcuts untuk operasi umum
- Notifikasi visual untuk feedback aksi

**Non-Goals:**
- OAuth provider baru (Google, GitHub) — fokus di session sync existing
- Push notifications dari server
- Offline mode
- Multi-account support

## Decisions

### 1. Session Sync Strategy: Popup-based Token Exchange

**Decision**: Gunakan popup window ke website untuk ambil session token, lalu kirim ke backend untuk exchange.

**Why**: 
- Cookie Supabase tidak bisa diakses langsung dari extension (cross-origin)
- Popup tidak memerlukan perubahan cookie policy
- User experience familiar (sama seperti OAuth flow)

**Alternatives considered**:
- *Direct cookie access*: Diblokir oleh browser security model
- *Native messaging*: Terlalu kompleks untuk MVP
- *Content script injection*: Melanggar kebijakan keamanan Supabase

### 2. Backend Endpoint: `/api/auth/session-exchange`

**Decision**: Buat endpoint baru yang menerima session token Supabase dari website, memvalidasi, dan mengembalikan session token untuk extension.

**Why**:
- Backend sudah punya akses ke Supabase admin
- Token validation terjadi server-side (aman)
- Bisa rate-limit dan log untuk keamanan

### 3. UI Framework: Vanilla JS + CSS Transitions

**Decision**: Tetap vanilla JS tanpa framework, gunakan CSS transitions untuk animasi.

**Why**:
- Konsisten dengan codebase existing
- Tidak perlu build step
- Ukuran ekstensi tetap kecil (<50KB)

**Alternatives considered**:
- *Preact/Alpine.js*: Terlalu besar untuk extension
- *Web Components*: Overkill untuk use case ini

### 4. Typing Indicator: CSS Animation

**Decision**: Gunakan CSS keyframe animation untuk typing indicator (tiga titik bergerak).

**Why**:
- Tidak perlu JavaScript untuk animasi
- Performa lebih baik dari JS-based animation
- Konsisten dengan design system existing

### 5. Keyboard Shortcuts: Document-level Event Listener

**Decision**: Gunakan `document.addEventListener('keydown')` di sidepanel.js.

**Why**:
- Simple dan reliable
- Tidak perlu permissions tambahan
- Bisa di-disable jika ada konflik

## Risks / Trade-offs

- **[Popup blocked]** → Browser mungkin memblokir popup. Mitigation: User harus mengizinkan popup untuk extension, tampilkan instruksi jelas.

- **[Session token expired]** → Token website mungkin expired sebelum exchange. Mitigation: Refresh token sebelum exchange, handle error gracefully.

- **[CSS animation performance]** → Animation mungkin lag di perangkat lambat. Mitigation: Gunakan `will-change` dan `transform` untuk GPU acceleration.

- **[Keyboard shortcut conflict]** → Shortcut mungkin konflik dengan website lain. Mitigation: Gunakan Ctrl+组合 yang jarang dipakai, dan buat user bisa customize di versi mendatang.

## Migration Plan

1. Deploy backend endpoint `/api/auth/session-exchange` terlebih dahulu
2. Update extension dengan session sync logic
3. Test dengan website yang sudah login
4. Rollback: Nonaktifkan session sync, kembali ke OTP manual

## Open Questions

- Apakah perlu rate limiting khusus untuk session-exchange endpoint?
- Bagaimana handle case dimana user login di multiple devices?
