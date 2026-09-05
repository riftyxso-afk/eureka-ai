# Deployment Produksi — Eureka.AI

Panduan go-live Eureka.AI:

- **Frontend**: Next.js di **Vercel** (sudah terhubung ke repo).
- **Backend**: server Node (Express/Hono) di **VPS milikmu** (port 3001) — frontend memanggil backend via `NEXT_PUBLIC_API_URL`.

---

## 1. Variabel Lingkungan

### 1.1 Frontend (Vercel → Settings → Environment Variables)

| Variabel | Wajib | Sumber |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **YES** | URL backend produksi, mis. `https://api.eureka-ai.web.id` (tanpa `/` di akhir) |
| `NEXT_PUBLIC_SUPABASE_URL` | **YES** | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **YES** | Supabase Dashboard → API (anon public key) |
| `JUANROUTER_API_KEY` | **YES** | **WAJIB untuk semua generate TEKS** (chat, catatan, kuis, judul) — router.juan.web.id → Dashboard → API Keys |
| `OPENROUTER_API_KEY` | No | Fallback DARURAT teks bila seluruh Juan Router gagal — openrouter.ai/keys |
| `OPENAGENTIC_API_KEY` | No | KHUSUS text-to-image (Eureka Draw & ilustrasi); tanpa ini hanya fitur gambar nonaktif |
| `OPENAGENTIC_IMAGE_MODEL` | No | Model gambar OpenAgentic (default `ali-qwen-image-2.0-pro`) |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | No | Provider embedding/transkripsi (belum tersedia di Juan Router; default openagentic) |
| `OPENAI_API_KEY` | No | Bila memakai provider OpenAI |
| `FIRECRAWL_API_KEY` | No | Web search (fitur Pro) |
| `RESEND_API_KEY` | **YES** | Resend (email OTP/welcome/premium) — awalan `re_` |
| `RESEND_FROM_EMAIL` | No | Pengirim email, mis. `Eureka.AI <noreply@domainmu.com>` |
| `PAKASIR_PROJECT` | **YES** | Slug proyek Pakasir (dari app.pakasir.com → detail proyek) |
| `PAKASIR_API_KEY` | **YES** | API key Pakasir |
| `PAKASIR_REDIRECT_URL` | **YES** | `https://www.eureka-ai.web.id/dashboard?upgrade=done` |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | No | Gambar AI PDF (opsional) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | CAPTCHA Cloudflare Turnstile (bila dipakai) |

> Redeploy setelah mengubah env. Jangan pernah menaruh rahasia di repo — `.env.example` hanya placeholder.

### 1.2 Backend (VPS)

Buat file `/var/www/eureka-backend/.env` (salin dari `backend/.env.example`):

| Variabel | Wajib | Sumber |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **YES** | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | Supabase → service_role key (RAHASIA — jangan bocor ke frontend) |
| `JUANROUTER_API_KEY` | **YES** | **WAJIB untuk semua generate TEKS** — router.juan.web.id |
| `OPENROUTER_API_KEY` | No | Fallback DARURAT teks bila seluruh Juan Router gagal |
| `OPENAGENTIC_API_KEY` | No | KHUSUS text-to-image (tanpa ini hanya fitur gambar nonaktif) |
| `OPENAGENTIC_IMAGE_MODEL` | No | Model gambar OpenAgentic (default `ali-qwen-image-2.0-pro`) |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | No | Provider embedding/transkripsi (default openagentic) |
| `FIRECRAWL_API_KEY` | No | Web search |
| `SUMOPOD_API_KEY` | No | Ekstraksi audio/video (opsional) |
| `RESEND_API_KEY` | **YES** | Resend — awalan `re_` |
| `RESEND_FROM_EMAIL` | No | Pengirim email |
| `CORS_ORIGIN` | **YES** | Origin FRONTEND yang diizinkan memanggil API (BUKAN domain backend), mis. `https://www.eureka-ai.web.id` (pisahkan koma bila banyak). Setiap origin harus lengkap dengan `https://`. Bila kosong atau `*` di produksi, backend menolak SEMUA permintaan lintas-origin (fail-closed) |
| `PORT` | No | Default `3001` |
| `PAKASIR_PROJECT` | **YES** | Slug proyek Pakasir |
| `PAKASIR_API_KEY` | **YES** | API key Pakasir |
| `PAKASIR_REDIRECT_URL` | **YES** | Redirect produksi |

---

## 2. Setup Backend di VPS

```bash
# 1) Pastikan Node 20+
node -v

# 2) Salin kode & install
git clone <repo-url> /var/www/eureka-backend
cd /var/www/eureka-backend/backend
npm ci
# Isi .env sesuai tabel 1.2, lalu:

# 3) Build & jalankan (contoh pakai pm2)
npm run build
pm2 start npm --name eureka-backend -- run start
pm2 save && pm2 startup

# 4) Reverse proxy (contoh Nginx) → forward ke 127.0.0.1:3001
#    server { server_name api.eureka-ai.web.id; location / { proxy_pass http://127.0.0.1:3001; ... } }
```

Cek sehat:

```bash
curl -s http://localhost:3001/ | head -5
# dan dari luar: curl -s https://api.eureka-ai.web.id/
```

---

## 3. Konfigurasi Pakasir (dashboard app.pakasir.com → Edit Proyek)

| Setting | Nilai |
|---|---|
| **Webhook URL** | `https://api.eureka-ai.web.id/api/payments/webhook` (arahkan ke domain backend yang menerima webhook) |
| **Redirect / callback** | dikendalikan `PAKASIR_REDIRECT_URL` = `https://www.eureka-ai.web.id/dashboard?upgrade=done` |

> Webhook Pakasir tidak bersignature — server memverifikasi `project` + `order_id`/`amount` lalu mengonfirmasi via API `transactiondetail` (fail-closed). Pastikan domain webhook di atas **dapat diakses publik** (bukan localhost).

---

## 4. Checklist Verifikasi Pasca-Deploy

- [ ] `GET https://api.eureka-ai.web.id/` → 200 (backend sehat)
- [ ] `https://www.eureka-ai.web.id/` → landing page termuat, navbar & CTA berfungsi
- [ ] `https://www.eureka-ai.web.id/sitemap.xml` → memuat URL halaman publik
- [ ] `https://www.eureka-ai.web.id/robots.txt` → mengizinkan index + referensi sitemap
- [ ] `/pricing` → pilih paket → halaman bayar Pakasir terbuka (`app.pakasir.com/pay/...`)
- [ ] Bayar (sandbox) → kembali ke `/dashboard?upgrade=done` → ±15 dtk popup sukses + email premium masuk
- [ ] `/api/payments/status` → `isPremium: true` setelah pembayaran terverifikasi
- [ ] Login/register OTP → email kode masuk (Resend)
- [ ] Google Search Console: submit `sitemap.xml`, cek metadata & JSON-LD halaman
- [ ] Header respons: `content-security-policy`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `strict-transport-security` (produksi HTTPS) ada di halaman & API

---

## 4b. Rotasi `SUPABASE_SERVICE_ROLE_KEY` (wajib sebelum go-live)

Key lama pernah terekspos di riwayat git → **rotasi wajib**:

1. Supabase Dashboard → Project Settings → **API Keys** → `service_role` → **Reveal** → **Regenerate** (key lama langsung nonaktif).
2. Update `SUPABASE_SERVICE_ROLE_KEY` di **semua** tempat: env VPS backend (`/var/www/eureka-backend/backend/.env`), Vercel (frontend, bila dipakai), dan `.env.local` lokal.
3. Restart backend (`pm2 reload eureka-backend`) lalu verifikasi: `curl -s https://api.eureka-ai.web.id/api/health` → 200, dan `/api/payments/status` masih `isPremium` benar.
4. Setelah aplikasi berjalan normal dengan key baru, jalankan `git log -S "<fragment-key-lama>"` — hasil kosong berarti key lama sudah tidak ada di sejarah yang aktif; bersihkan sisa riwayat dengan `git filter-repo`/BFG bila diperlukan (task 1.5).

---

## 5. Rollback

- **Frontend**: Vercel → Deployments → pilih versi sebelumnya → Promote.
- **Backend**: `pm2 reload eureka-backend` ke versi commit sebelumnya (`git checkout <rev> && npm ci && npm run build && pm2 reload`).
- **DB**: semua patch bersifat aditif (kecuali migrasi pembayaran yang menyebutkan DROP — backup Supabase dulu). Rollback referral = drop kolom `referral_code/referred_by/referral_rewarded`.
