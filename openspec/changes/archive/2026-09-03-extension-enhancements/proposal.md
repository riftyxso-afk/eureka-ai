## Why

Ekstensi Eureka.AI saat ini meminta login manual melalui OTP email setiap kali dipasang, meskipun user sudah login di website. Proses login yang terpisah menciptakan gesekan (friction) yang tidak perlu dan menurunkan engagement. Selain itu, UI ekstensi masih dasar — tidak ada loading states, animasi transisi, atau feedback visual yang membuat pengalaman terasa "hidup".

## What Changes

- **Session sync dari website**: Ekstensi mendeteksi session Supabase yang sudah aktif di website (`eureka-ai.web.id`) dan langsung login tanpa OTP. Jika session web masih valid, ekstensi langsung masuk ke view chat.
- **Auto-redirect login**: Jika session web belum ada, ekstensi menawarkan login via popup website (OAuth/OTP) lalu menerima session token kembali ke extension.
- **UI interaktif yang lebih baik**: Loading skeleton saat fetch, transisi halus antar view (login → chat → draft), toast notifikasi yang lebih menarik, typing indicator saat AI merespons, dan empty state yang informatif.
- **Badge & notifikasi**: Jika ada pesan baru atau catatan berhasil disimpan, badge notifikasi muncul di icon toolbar.
- **Keyboard shortcuts**: Ctrl+Enter untuk kirim pesan, Escape untuk close draft, dll.

## Capabilities

### New Capabilities
- `browser-extension/session-sync`: Sinkronisasi session Supabase dari website ke extension (login otomatis tanpa OTP)
- `browser-extension/ui-enhancements`: Peningkatan UI/UX ekstensi — loading states, transisi, typing indicator, keyboard shortcuts

### Modified Capabilities
<!-- Tidak ada capability yang diubah requirement-nya secara spec-level -->

## Impact

- **Backend**: Endpoint baru `/api/auth/session-sync` untuk validasi session token dari extension
- **Extension**: `sidepanel.js` dan `sidepanel.html` — perubahan signifikan pada flow login dan UI
- **Supabase**: Session cookie dari website perlu bisa diakses oleh extension (same-domain cookie strategy)
- **Manifest**: Mungkin perlu tambah permissions jika pakai `cookies` API
