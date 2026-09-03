## Context

Saat ini Eureka.AI hanya hidup di web app (eureka-ai.web.id); belum ada kode ekstensi di repo. Backend sudah punya endpoint chat & notes yang dipakai web app, dan file `eureka-ai-extension-design.md` menetapkan sistem desain (claymorphism, token warna, Fredoka + Plus Jakarta Sans, motion 100–200ms, tap target 40px, `prefers-reduced-motion`). Lihat `proposal.md - Why` untuk motivasi.

## Goals / Non-Goals

**Goals:**

- Struktur ekstensi Manifest V3 mandiri di `extension/` yang tidak mengganggu build web app yang ada.
- Semua alur MVP bekerja lewat endpoint backend yang sudah ada, dengan satu endpoint tambahan hanya bila payload ekstensi terbukti tidak muat.
- UI side panel 1:1 mengikuti sistem desain ekstensi (satu fokus per layar, dua tombol Tanya/Catat dengan satu highlight).

**Non-Goals:**

- Fitur Fase 2/3 PRD, Firefox, OCR, voice, on-device grading, fingerprinting soal.
- Perubahan skema database web app; perubahan perilaku endpoint yang dipakai web app.

## Decisions

**Keputusan: Direktori `extension/` terpisah (manifest, background service worker, content script, side-panel UI) di luar build Next.js.**

- Alternatif: monorepo workspace dengan build terpadu — ditolak, menambah kompleksitas build untuk MVP; skrip build terpisah cukup.
- Rationale: isolasi total; web app tidak berisiko regresi.

**Keputusan: Reuse endpoint chat & notes backend; tambah `notes-from-extension` hanya bila payload (URL, domain, snippet) terbukti tidak muat di endpoint notes yang ada.**

- Alternatif: endpoint khusus sejak awal — ditolak, duplikasi logika notes sebelum terbukti perlu.
- Rationale: sesuai arahan PRD §7; satu sumber kebenaran logika catatan.

**Keputusan: Auth via token sesi web app yang disimpan di `chrome.storage.local` (login sekali di web app, ekstensi memakai token itu).**

- Alternatif: flow OAuth penuh di dalam ekstensi — ditolak, UX lebih berat untuk MVP.
- Rationale: memenuhi DoD "login sekali, sesi persisten" dengan usaha minimal.

**Keputusan: Ekstraksi konten tab memakai parsing readability-style di content script yang hanya disuntik atas aksi eksplisit (`activeTab` + `scripting`), tanpa tracking pasif.**

- Alternatif: ekstraksi selalu-aktif per tab — ditolak, melanggar batasan privasi PRD §8 dan berisiko gagal review Chrome Web Store.
- Rationale: kepatuhan review + kepercayaan orang tua/sekolah.

**Keputusan: Side panel meniru layout §5 design doc (header logo+streak, bubble Socratic kiri + bubble user kanan, dua tombol Tanya/Catat dengan satu highlight) dan motion §7 (panel 200ms ease-out, tombol 100ms pressed, streak pop sekali).**

- Rationale: konsistensi dengan sistem desain yang sudah disetujui; tidak ada keputusan visual baru di tahap ini.

## Risks / Trade-offs

- [Ekstraksi gagal di situs berat-JS atau PDF viewer tertentu] → Mitigasi: pesan jelas + fallback salin manual; DoD hanya menuntut 3 jenis situs.
- [Review Chrome Web Store menolak wording/permissions] → Mitigasi: permission minimal sesuai PRD §7, justifikasi eksplisit, hindari klaim "block" agresif di Fase 1.
- [Sinkron catatan >5 detik saat backend lambat] → Mitigasi: tulis optimistis + retry antrean lokal, tampilkan status di panel.
- [Content script memperlambat halaman] → Mitigasi: script hanya jalan atas aksi, tanpa observer persisten.

## Migration Plan

1. Kembangkan dengan `chrome://extensions` mode developer (load unpacked) — tanpa deploy.
2. Uji DoD MVP (§10 PRD) di 3 jenis situs + sinkron <5 detik + sesi persisten.
3. Submit ke Chrome Web Store (privacy policy + justifikasi permission); rollback = tarik/unpublish listing, web app tidak tersentuh.

## Open Questions

- Zona waktu reset streak harian (WIB vs lokal perangkat)? — Ditunda, tidak mengubah approach; default zona perangkat, finalisasi sebelum rilis.
- Perlu ikon varian untuk Edge vs Chrome? — Ditunda, satu set ikon cukup untuk MVP.
