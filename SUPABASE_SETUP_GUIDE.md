# 🎉 SUPABASE INTEGRATION PRODUCTION GUIDE

## ✅ COMPLETED FEATURES

### 1. Full Database Migration to Supabase
- ✅ **lib/supabase/client.ts** - Client dengan TypeScript types lengkap
- ✅ **lib/supabase/notes.ts** - Functions untuk notes & chunks operations
- ✅ **lib/collab.ts** - Collaboration system (presence, chat, versions) migrated
- ✅ **lib/rag/store.ts** - RAG storage menggunakan Supabase instead of file system

### 2. Complete SQL Schema (`supabase_schema.sql`)
Includes tables:
- **notes** - Catatan utama dengan judul, summary, subject
- **chunks** - Text chunks untuk RAG dengan vector embedding (1536 dim)
- **presence** - Real-time collaboration tracking
- **chat_messages** - Chat history per note
- **note_versions** - Version history notes
- **invite_tokens** - Collaboration invitation system
- **collaborators** - Collaborator management
- **documents** - Document tracking & processing
- **jobs** - Background job queue
- **subjects** - Subject categories

Features:
- ✅ pgvector extension untuk similarity search
- ✅ Row Level Security (RLS) policies
- ✅ Real-time subscriptions enabled
- ✅ Vector similarity RPC function `match_chunks`
- ✅ Automatic timestamps trigger

### 3. Production Deployment Status
- ✅ Code pushed to GitHub: https://github.com/riftyxso-afk/eureka-ai
- ✅ Build successful locally
- ⚠️ **READY FOR DEPLOYMENT TO VERCEL**

---

## 🚀 QUICK START SETUP

### Step 1: Create Supabase Project
```bash
1. Buka https://supabase.com
2. Sign up / Login
3. Create New Project
4. Pilih plan Free
5. Wait ~2 minutes for provisioning
```

### Step 2: Run SQL Schema
```bash
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor" (left sidebar)
3. Copy/PASTE entire contents of supabase_schema.sql
4. Click "Run" button
5. Verify success message
```

### Step 3: Get API Credentials
```bash
1. Go to Settings > API
2. Copy these values:
   - PROJECT URL (under Project URLs)
   - anon/public key (under anon/Public)
   - service_role key (under Service Role Secret - IMPORTANT!)
```

### Step 4: Update Environment Variables
Edit `.env.local`:
```env
# Replace with YOUR actual Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Existing AI providers (keep your existing keys)
AI_PROVIDER=openagentic
OPENAGENTIC_API_KEY=your-openagentic-key-here
OPENAGENTIC_BASE_URL=https://openagentic.id/api/v1
OPENAGENTIC_MODEL=qwen3.8-max
OPENROUTER_API_KEY=your-openrouter-key-here
FIRECRAWL_API_KEY=your-firecrawl-key-here
```

### Step 5: Deploy to Vercel
```bash
# Login to Vercel CLI
vercel login

# Deploy with all environment variables
vercel --prod

# OR deploy via Vercel Dashboard:
# 1. Go to vercel.com
# 2. Connect GitHub repository
# 3. Configure environment variables in Settings > Environment Variables
# 4. Add all vars from .env.local except ones marked as sensitive
# 5. Deploy
```

### Step 6: Verify Deployment
```bash
# Check if deployment is live
curl https://eureka-ai-flax.vercel.app/api/notes # Should return 401 or list

# Or open browser and test features:
https://eureka-ai-flax.vercel.app
```

---

## 🔐 GOOGLE LOGIN (OAuth) — SETUP SEKALI SAJA

Login/daftar dengan Google memakai provider OAuth bawaan Supabase
(`supabase.auth.signInWithOAuth({ provider: "google" })`). Tanpa env var baru di frontend.

### Step 1: Buat OAuth Client di Google Cloud Console
```bash
1. Buka https://console.cloud.google.com → buat/pilih project
2. Menu: APIs & Services → OAuth consent screen
   - Pilih External (atau Internal bila akun Workspace) → isi nama aplikasi, email, logo opsional → Save
3. Menu: APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs → Add URI:
       https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
     (ganti <SUPABASE_PROJECT_REF> dengan ref project Supabase-mu, mis. abcdefghijklmnopqrst)
   - Klik Create → salin Client ID & Client Secret
```

### Step 2: Aktifkan Provider Google di Supabase Dashboard
```bash
1. Supabase Dashboard → Authentication → Providers → Google
2. Klik tombol Enable
3. Paste Client ID & Client Secret dari Google Cloud Console
4. Klik Save
```

### Step 3: Izinkan Redirect URL aplikasi
```bash
Supabase Dashboard → Authentication → URL Configuration:
- Site URL: https://www.eureka-ai.web.id
- Additional Redirect URLs → tambahkan:
    https://www.eureka-ai.web.id/auth/callback
    http://localhost:3000/auth/callback   # untuk dev
- Save
```

### Cara kerja di aplikasi
```text
Klik "Masuk/Daftar dengan Google"
  → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: <site>/auth/callback })
  → Google meminta izin akun
  → kembali ke /auth/callback (token otomatis dideteksi supabase-js)
  → sesi di-cache ke localStorage, identitas didaftarkan ke backend teman
  → redirect ke /onboarding (user baru) atau /dashboard (user lama)
```

> ⚠️ Catatan: bila email Google sudah pernah didaftarkan dengan kata sandi (belum di-*link* ke
> Google), Supabase akan menolak login Google dengan pesan akun sudah terdaftar. Solusi: masuk
> sekali dengan kata sandi lewat /login, lalu dari halaman profil hubungkan akun Google
> (fitur *link identity* — akan tersedia di update berikutnya).

---

## 📊 DATABASE SCHEMA OVERVIEW

```sql
-- Core Tables
notes (id, user_id, title, summary, subject, timestamps)
chunks (id, note_id, chapter_id, text, embedding vector, created_at)
presence (note_id, user_id, name, role, last_active)

-- Collaboration
chat_messages (id, note_id, sender_name, content, parent_id, is_ai)
note_versions (id, note_id, version_number, title, summary, changed_by)
invite_tokens (token, note_id, invitee_name, role, expires_at)
collaborators (note_id, user_id, name, role, status)

-- Processing
documents (id, url, status, source_type, metadata)
jobs (id, note_id, progress, status, message, result)

-- Reference
subjects (id, name, icon, color)
```

---

## 🔧 KEY FUNCTIONS AVAILABLE

### Notes & Chunks
```typescript
import { saveNoteWithChunks, getNoteWithChunks, listNotes, searchChunks }
from '@/lib/supabase/notes';
```

### Collaboration
```typescript
import { setPresence, addChatMessage, listVersions } 
from '@/lib/collab';
```

### RAG Features
```typescript
import { embedTexts } from '@/lib/rag/embed';
```

---

## ⚡ PERFORMANCE NOTES

1. **Vector Search**: Uses PostgreSQL's `pgvector` extension with cosine similarity
2. **Real-time Updates**: Supabase Realtime enabled on all tables
3. **Row Level Security**: Users can only access their own data
4. **Background Jobs**: Process-heavy tasks run async to avoid blocking
5. **Memory Storage**: Presence/Collaboration data in-memory for speed

---

## 🐛 TROUBLESHOOTING

### Issue: Connection fails
**Solution**: Verify environment variables are correct in Vercel dashboard

### Issue: Vector search not working  
**Solution**: Ensure pgvector extension installed (check SQL schema output)

### Issue: RLS policy blocks access
**Solution**: Verify `auth.uid() = user_id` pattern in RLS policies

### Issue: CORS errors
**Solution**: Set correct CORS headers in Supabase dashboard settings

---

## 📈 NEXT STEPS (TODO)

After Supabase integration complete:
1. ✅ Fix remaining TypeScript errors in lib/types.ts
2. ✅ Deploy to Vercel successfully
3. ⏳ Remove all mock data files
4. ⏳ Implement AI per bab feature enhancement
5. ⏳ Fix document fetching for cleaner results
6. ⏳ Add AI profile analysis to onboarding
7. ⏳ Enable real-time sync across pages

---

## 💡 ENVIRONMENT VARIABLES SUMMARY

Required in both `.env.local` and Vercel Dashboard:

| Variable | Description | Sensitive |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) | **YES!** |
| `AI_PROVIDER` | OpenAgentic/OpenAI/AIMurah | No |
| `OPENAGENTIC_API_KEY` | AI provider key | **YES!** |
| `OPENROUTER_API_KEY` | Fallback AI key | **YES!** |
| `FIRECRAWL_API_KEY` | Web scraping key | **YES!** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | No |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key (server only) | **YES!** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID — untuk gambar AI PDF (opsional) | No |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (izin Workers AI:Run) — gambar AI PDF | No |

---

## 🛡️ CAPTCHA — Cloudflare Turnstile (login/register)

Opsional tapi disarankan. Tanpa key, verifikasi dilewati (mode dev).

1. Daftar/gratis di https://dash.cloudflare.com/sign-up → **Turnstile**
2. Tambahkan situs → salin **Site Key** & **Secret Key**
3. Isi di `.env.local` dan Vercel Dashboard:
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA...
   TURNSTILE_SECRET_KEY=0x4AAAA...
   ```
4. Redeploy. Widget muncul di halaman login & register; token diverifikasi
   server-side di `/api/auth/otp` (kirim & verifikasi kode OTP) dan
   `/api/auth/verify-captcha` (login kata sandi).

## ⚙️ Proteksi overload & rate limit (anti-borong token AI)

- **Kapasitas generate serentak (lintas server)**: global maksimal 5 proses
  generate (catatan + PDF) di semua server; per-user maksimal 1 proses aktif.
  Penghitungan lewat tabel `jobs` Supabase (status `processing` segar) —
  tidak perlu migrasi baru.
- **Rate limit per user per jam**: 3× generate catatan, 5× regenerate
  catatan/bab, 5× dokumen PDF, 40× pesan chat (in-memory sliding window;
  paling kuat di backend VPS satu proses).
- Saat kapasitas penuh: respons 429 / event error dengan pesan
  "Server sedang sibuk. Coba lagi dalam beberapa menit ya 🙏".

---

**Status**: ✅ READY FOR PRODUCTION DEPLOYMENT!
