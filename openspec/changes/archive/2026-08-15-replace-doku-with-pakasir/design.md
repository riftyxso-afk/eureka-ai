## Context

Integrasi DOKU baru selesai (checkout `checkout/v1/payment`, webhook verifikasi HMAC-SHA256 fail-closed, tabel `doku_payment_requests`/`doku_notification_events`, env `DOKU_*`, redirect netral `?upgrade=done` + polling popup). User meminta penggantian total ke **Pakasir** (app.pakasir.com) dan penghapusan semua jejak DOKU.

Fakta Pakasir dari docs (pakasir.com/p/docs):
- Hosted payment page: `https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}&redirect={redirect}` — tombol kembali ke merchant hanya muncul setelah bayar sukses.
- Webhook (tanpa signature): `POST {amount, order_id, project, status:"completed", payment_method, completed_at}`.
- API verifikasi status (disarankan docs): `GET /api/transactiondetail?project=&amount=&order_id=&api_key=` → `{transaction:{status}}`.
- Sandbox: `POST /api/paymentsimulation` untuk mensimulasikan pembayaran + memicu webhook.
- Tidak ada base URL terpisah untuk sandbox (mode sandbox = properti proyek).

Motivasi lengkap: lihat proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- Checkout via hosted payment page Pakasir (pilihan user) — redirect user ke `app.pakasir.com/pay/...`.
- Verifikasi webhook fail-closed tanpa HMAC: project slug + order_id/amount tercatat + konfirmasi `transactiondetail`.
- Aktivasi premium 30 hari per status `completed`, idempotensi, tanpa aktivasi pada status lain.
- Hapus seluruh jejak DOKU (kode, env, DB, UI, docs, skrip tes).

**Non-Goals:**
- Tidak mengubah model bisnis (1x bayar = 30 hari, tier promo/normal, diskon, trial, gating).
- Tidak menampilkan QR/VA inline (hosted page, bukan integrasi API `transactioncreate`).
- Tidak mengubah `plan-badge`, popup polling `?upgrade=done`, endpoint status/trial/cancel.

## Decisions

### 1. Checkout: hosted payment page (bukan API transactioncreate)
Checkout route membangun URL `https://app.pakasir.com/pay/{PAKASIR_PROJECT}/{amount}?order_id={invoice}&redirect={encodeURIComponent(redirectUrl)}` dan mengembalikan `{ link, transactionId: invoice, amount, discount }`. `redirectUrl` = `PAKASIR_REDIRECT_URL` atau fallback `${origin}/dashboard?upgrade=done` (netral, konsisten dengan behavior yang di-archive).
- **Alternatif**: API `transactioncreate` + render QR/VA inline — lebih banyak kerja (render QR, layar tunggu, polling) dan mengubah UX; ditolak oleh pilihan user.
- `order_id` = `generateInvoiceNumber()` (EKA…, alfanumerik ≤30 char) — aman untuk URL & webhook.
- Keuntungan: tidak ada panggilan API saat checkout (URL murni), sehingga alur diskon & pencatatan payment request tidak punya titik gagal eksternal.

### 2. Webhook: verifikasi fail-closed tanpa signature
Pakasir tidak menandatangani webhook. Verifikasi berlapis:
1. `project` webhook === `PAKASIR_PROJECT` (fail-closed; selain itu abaikan/tolak).
2. `order_id` tercatat di `pakasir_payment_requests` DAN `amount` webhook === amount tercatat (membawa tier + harga diskon final).
3. Konfirmasi authoritative: `GET /api/transactiondetail` (pakai `PAKASIR_API_KEY`) → `status === "completed"` → aktivasi premium 30 hari (tier dari request tercatat).
4. Idempotensi: insert `pakasir_notification_events` (unique `order_id`) di awal — duplikat → 200 tanpa aktivasi.
- Bila `transactiondetail` error/tak terjangkau → balas 5xx TANPA aktivasi (Pakasir diharapkan retry; aktivasi aman karena hanya lewat status confirmed).
- Bila `transactiondetail` status ≠ completed → 200 tanpa aktivasi.
- **Alternatif**: percaya webhook + cocokkan order saja (minimal docs) — ditolak: tanpa signature, replay/forgery risk; `transactiondetail` adalah verifikasi resmi yang disarankan docs.

### 3. `lib/pakasir.ts` (pengganti `lib/doku.ts`)
- `isPakasirConfigured()` — cek `PAKASIR_PROJECT` & `PAKASIR_API_KEY` terisi (bukan placeholder).
- `buildPayUrl({ amount, orderId, redirectUrl })` — encode `redirect` query.
- `verifyTransactionDetail({ orderId, amount })` — GET `transactiondetail`, timeout 10 dtk, return status string / throw.
- Hapus `lib/doku.ts` (fungsi signature, sanitize, dll. tidak lagi dipakai).

### 4. Database: patch 010 (drop DOKU, buat Pakasir)
- Drop tabel `doku_payment_requests`, `doku_notification_events`; drop kolom `users.doku_invoice_number`, `users.doku_transaction_id`.
- Buat `pakasir_payment_requests` (`order_id` unique, `user_id`, `tier`, `amount`, `status`, `paid_at`), `pakasir_notification_events` (`order_id` unique, `payload jsonb`, `status`, `created_at`), kolom `users.pakasir_invoice_number`, `users.pakasir_transaction_id`.
- Kolom premium (`is_premium`, `premium_tier`, `premium_until`, `trial_claimed_at`) tidak berubah.
- ⚠️ Backup dulu (migration menghapus data DOKU lama).

### 5. Redirect & popup: tidak berubah
`?upgrade=done` + `PremiumSuccessPopup` polling tetap. Pakasir hanya redirect setelah sukses (batal = user tetap di halaman Pakasir, tidak kembali) — popup sukses tetap hanya muncul saat server konfirmasi premium (aman untuk webhook yang tertunda). Perubahan frontend hanya label "DOKU" → "Pakasir".

### 6. Env
`PAKASIR_PROJECT`, `PAKASIR_API_KEY`, `PAKASIR_REDIRECT_URL` (default `${origin}/dashboard?upgrade=done`); hapus `DOKU_*` dari semua file env. Tidak perlu env sandbox terpisah (host sama; mode sandbox = properti proyek).

## Risks / Trade-offs

- [Webhook Pakasir tanpa signature → spoofing] → Verifikasi fail-closed (project + order + amount + `transactiondetail` authoritative).
- [`transactiondetail` error/lambat menambah jalur kegagalan] → Timeout 10 dtk + balas 5xx tanpa aktivasi agar Pakasir retry; tidak pernah mengaktifkan tanpa konfirmasi.
- [Kebijakan retry Pakasir pada 5xx tidak terdokumentasi] → Asumsi retry; bila tidak, transaksi tertunda sampai verifikasi manual — tercatat sebagai open question.
- [Migration menghapus data DOKU] → Backup Supabase dulu; rollback = restore backup + revert kode/env.
- [Pay URL & API tidak membedakan sandbox/produksi] → Uji sandbox via `paymentsimulation`; go-live cukup isi env produksi.

## Migration Plan

1. Terapkan kode (`lib/pakasir.ts`, checkout/webhook, hapus `lib/doku.ts`) + migration SQL 010 (backup dulu).
2. Ganti env `DOKU_*` → `PAKASIR_*` di `.env.local`, dashboard hosting (Vercel/Render), docs.
3. Set Webhook URL Pakasir (project) ke `https://<domain>/api/payments/webhook`.
4. Uji sandbox: checkout → hosted page → `paymentsimulation` → webhook → premium 30 hari; kasus salah status → tanpa aktivasi.
5. Rollback: restore DB backup + kembalikan kode/env DOKU.

## Open Questions

- Apakah `paymentsimulation` mencatat transaksi yang bisa diverifikasi `transactiondetail` (untuk E2E sandbox)? — dikonfirmasi saat uji.
- Kebijakan retry webhook Pakasir pada 5xx — tidak terdokumentasi; dianggap retry.
