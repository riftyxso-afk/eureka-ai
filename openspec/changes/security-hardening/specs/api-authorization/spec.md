## Purpose

Memastikan seluruh endpoint API yang menyentuh data pengguna memverifikasi identitas melalui JWT Supabase dan memaksa kepemilikan resource, sehingga userId yang dikirim client tidak pernah dipercaya tanpa verifikasi token.

## ADDED Requirements

### Requirement: Verifikasi JWT pada semua endpoint data pengguna

Semua endpoint API yang membaca atau menulis data milik pengguna (profil, catatan, progres, teman, notifikasi, ujian, sesi AI, job) WAJIB memverifikasi access token Supabase dari header `Authorization: Bearer`. Permintaan tanpa token atau dengan token tidak valid WAJIB ditolak (401). userId yang dikirim via query/body TIDAK boleh dipercaya tanpa memaksa `token.user.id === userId` (403 bila berbeda).

#### Scenario: Permintaan tanpa token
- **WHEN** client memanggil endpoint data pengguna tanpa header Authorization
- **THEN** endpoint menolak dengan status 401 dan tidak memproses permintaan

#### Scenario: Token valid tetapi userId param berbeda
- **WHEN** client mengirim token valid milik user A tetapi menyertakan userId user B di query/body
- **THEN** endpoint menolak dengan status 403 dan tidak mengembalikan atau mengubah data

#### Scenario: Token valid dan userId cocok
- **WHEN** client mengirim token valid yang cocok dengan userId yang diminta
- **THEN** endpoint memproses permintaan sesuai kepemilikan resource

### Requirement: Autentikasi gagal-aman (fail closed)

Bila Supabase tidak terkonfigurasi (env hilang atau salah), endpoint data pengguna WAJIB menolak permintaan (fail closed) — TIDAK boleh mempercayai userId dari client sebagai pengganti verifikasi. Mode pengembangan lokal tanpa DB hanya boleh diaktifkan lewat flag env eksplisit dan TIDAK boleh aktif di produksi.

#### Scenario: Env Supabase hilang di produksi
- **WHEN** deployment produksi tidak memiliki konfigurasi Supabase yang valid
- **THEN** setiap permintaan ke endpoint data pengguna ditolak, bukan diteruskan dengan userId yang dipercaya

#### Scenario: Fallback percaya userId dihapus
- **WHEN** konfigurasi Supabase valid
- **THEN** tidak ada jalur kode yang meneruskan permintaan tanpa verifikasi token, apa pun kondisinya

### Requirement: Gating plan premium ditentukan server-side

Keputusan entitlement (plan free/pro/premium, akses fitur berbayar) WAJIB ditentukan server-side dari sumber data langganan (tabel plan/langganan), dan TIDAK boleh dapat diubah atau dipalsukan dari nilai yang dikirim client. Endpoint profil tidak boleh mengubah plan berdasarkan input client.

#### Scenario: Client memalsukan plan
- **WHEN** client mengirim nilai `plan: "pro"` atau field entitlement lain melalui API
- **THEN** sistem mengabaikan nilai tersebut dan menghitung entitlement dari data langganan server-side

#### Scenario: Perubahan plan via endpoint profil
- **WHEN** permintaan mengubah profil menyertakan perubahan plan
- **THEN** perubahan plan ditolak/diabaikan; plan hanya berubah lewat alur langganan resmi