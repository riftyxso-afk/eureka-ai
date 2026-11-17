# Mengaktifkan konektor Eureka

Pengaturan → Konektor berisi 17 aplikasi dalam tabel di bawah. Akses akun tersimpan per pengguna dengan enkripsi AES-256-GCM. Semua rute API juga terdaftar di backend Hono.

## Konfigurasi server

Jalankan supabase_patch_031_connectors.sql pada project Supabase Eureka. Tabel hanya dapat diakses dengan service role.

Isi variabel pada server yang menerima callback OAuth.

    CONNECTOR_PUBLIC_ORIGIN=https://eureka-api.kapibara.ai.id
    CONNECTOR_APP_ORIGIN=https://www.eureka-ai.web.id
    CONNECTOR_ENCRYPTION_KEY=
    CONNECTOR_GOOGLE_CLIENT_ID=
    CONNECTOR_GOOGLE_CLIENT_SECRET=
    CONNECTOR_CANVA_CLIENT_ID=
    CONNECTOR_CANVA_CLIENT_SECRET=
    CONNECTOR_NOTION_CLIENT_ID=
    CONNECTOR_NOTION_CLIENT_SECRET=

Gunakan secret acak minimal 32 karakter untuk CONNECTOR_ENCRYPTION_KEY. Pertahankan key selama token tersimpan. Penggantian key memerlukan pengguna menghubungkan ulang semua aplikasi.

Daftarkan redirect yang sama persis di Google Cloud Console, Canva Developer Portal, dan Notion.

    https://eureka-api.kapibara.ai.id/api/connectors/callback

Google memerlukan OAuth web application dan aktivasi Drive, Docs, Sheets, Slides, Calendar, dan Gmail API. Tambahkan akun penguji selama aplikasi dalam mode testing. Scope Drive dan Gmail dapat memerlukan verifikasi Google sebelum akses publik.

Callback OAuth menyimpan grant sementara terenkripsi selama lima menit. Frontend kemudian memanggil POST /api/connectors/complete dengan sesi Eureka yang sama dengan pemilik permintaan. Grant baru diaktifkan setelah pemeriksaan akun ini berhasil. Callback sekali pakai, akses lintas akun, dan refresh setelah disconnect ditolak.

Canva memerlukan aplikasi OAuth pengguna dengan PKCE. Di Canva Developer Portal, aktifkan `design:meta:read`, `design:content:read`, `design:content:write`, `brandtemplate:meta:read`, dan `brandtemplate:content:read`. Pengguna yang sudah terhubung dapat menyambungkan ulang Canva untuk memberi scope tambahan.

Notion memerlukan public integration. Pengguna memilih halaman yang dapat diakses pada halaman persetujuan Notion. Aktifkan kapabilitas baca dan tambah konten pada integrasi jika ingin membuat catatan.

## Penggunaan

1. Buka Pengaturan → Konektor dan pilih aplikasi.
2. Pilih hanya baca atau baca & tulis, lalu lanjutkan ke login resmi provider.
3. Kembali ke chat dan sebut nama aplikasi, misalnya “Cari materi biologi di Google Drive”, “Buat dokumen Google Docs tentang fotosintesis”, atau “Buat poster fotosintesis di Canva”.
4. Untuk membaca Docs, Sheets atau Slides, sertakan tautan/id dokumen. Untuk Notion, pilih halaman induk lewat hasil pencarian sebelum meminta catatan baru.
5. Lepas koneksi lewat Pengaturan untuk menghapus token tersimpan di Eureka. Izin integrasi juga dapat dicabut melalui pengaturan keamanan provider.

Hasil alat masuk sebagai konteks jawaban pada Chat dan Belajar. Tautan asli provider dapat dibuka dari jawaban. Pembuatan dokumen dicatat per permintaan agar retry permintaan yang sama tidak otomatis membuat salinan baru. Jika terjadi kegagalan setelah provider menerima perubahan, periksa aplikasi sebelum mencoba lagi.

## Semua provider dan konfigurasi

| Konektor | Kredensial | Izin dan tindakan tersedia |
| --- | --- | --- |
| Drive | OAuth Google web app | drive.readonly untuk cari/baca, ditambah drive.file untuk menyimpan file baru |
| Docs | OAuth Google | documents.readonly atau documents untuk baca/buat dokumen |
| Sheets | OAuth Google | spreadsheets.readonly atau spreadsheets untuk baca/buat tabel |
| Slides | OAuth Google | presentations.readonly atau presentations untuk baca/buat presentasi |
| Calendar | OAuth Google | calendar.events.readonly atau calendar.events untuk baca/buat jadwal |
| Gmail | OAuth Google | gmail.readonly, cari dan baca email |
| Canva | OAuth Canva | design:meta:read dan design:content:read untuk metadata dan kolom desain, brandtemplate:meta:read dan brandtemplate:content:read untuk template, design:content:write untuk pengisian |
| Notion | Public OAuth integration | Baca konten dan insert content pada halaman pilihan pengguna |
| OneDrive / Microsoft 365 | Delegated Microsoft Graph access token | Files.Read untuk mencari dokumen. Token kedaluwarsa memerlukan koneksi ulang |
| Teams | Delegated Microsoft Graph access token | ChannelMessage.Read.All sesuai persetujuan tenant, membaca channel berdasarkan teamId:channelId |
| Todoist | Personal API token | Baca daftar tugas dan buat tugas |
| Trello | API_KEY:TOKEN | Izin read/write, pencarian kartu dan pembuatan kartu berdasarkan idList |
| Slack | User OAuth token | search:read dan chat:write, cari diskusi dan kirim pesan ke channel eksplisit |
| Discord | Bot token | View Channel, Read Message History, Send Messages pada channel yang disetujui |
| Zotero | Library API key | Baca pustaka, cari referensi |
| GitHub | Fine-grained personal access token | Baca issue dan buat issue pada repositori pilihan. Issues write diperlukan untuk membuat |

Token aplikasi dimasukkan pada halaman izin provider di Pengaturan. Jangan memasukkannya ke chat. Tidak ada token yang dikirim ke model AI. Eureka memvalidasi token melalui endpoint identitas provider sebelum menyimpannya.

Registrasi provider:

- Google — https://console.cloud.google.com/apis/credentials
- Canva — https://www.canva.com/developers/
- Notion — https://www.notion.so/profile/integrations
- Microsoft — https://entra.microsoft.com/
- Todoist — Settings → Integrations → Developer pada akun Todoist
- Trello — https://trello.com/power-ups/admin
- Slack — https://api.slack.com/apps
- Discord — https://discord.com/developers/applications
- Zotero — https://www.zotero.org/settings/keys
- GitHub — https://github.com/settings/personal-access-tokens

Microsoft access token yang dimasukkan manual bukan koneksi OAuth tahan lama. Jika layanan memerlukan token refresh otomatis, integrasi OAuth Microsoft tambahan masih diperlukan.

## Pemeriksaan sebelum rilis publik

- Jalankan migrasi 031 termasuk kolom pending_credentials. Pastikan tiga tabel menolak akses anon/authenticated dan hanya service_role yang dapat mengaksesnya.
- Pasang variabel CONNECTOR_* hanya pada backend produksi, dengan key enkripsi yang sama selama grant tersimpan.
- Pastikan redirect URI di setiap portal sama persis dengan CONNECTOR_PUBLIC_ORIGIN/api/connectors/callback. Canva tidak menerima aplikasi tanpa redirect URI terdaftar.
- Google testing hanya menerima test user. Untuk rilis publik, gunakan OAuth milik Eureka, lengkapi branding/audience, aktifkan API yang digunakan, dan selesaikan verifikasi scope yang diwajibkan Google.
- Notion harus public OAuth integration dengan URL redirect dan kapabilitas sesuai tindakan. Token internal Notion bukan pengganti client secret OAuth.
- Uji login, pencarian, pembuatan hasil yang disetujui, token refresh dan disconnect dengan akun provider sungguhan. Status Tersedia hanya berarti konfigurasi server lengkap, bukan grant pengguna sudah berhasil.
- Microsoft/Teams masih menggunakan token manual sementara; jangan menyebutnya koneksi OAuth permanen.

## Streaming tool call

Chat dan Belajar mengirim event SSE tool_call dengan id, provider, action, status, label, dan tautan hasil. Kartu menerima perubahan running, completed, error, atau pending dari eksekusi server. Event dikirim saat pekerjaan berlangsung melalui aliran yang sama dengan token jawaban AI. Riwayat kartu disimpan dalam metadata sources pesan, sehingga tidak memerlukan kolom baru di ai_chat_messages.

Di prompt bar, buka + → Konektor. Semua 17 aplikasi tampil dengan logo, pencarian, dan status koneksi. Pilihan aktif tampil sebagai pill yang dapat dihapus. Permintaan membawa id konektor ke backend dan tidak boleh dialihkan diam-diam ke aplikasi lain. Aplikasi belum terhubung membuka pengaturan di tab baru agar draft chat tetap ada.

Saat pengguna meminta “Buat poster di Canva”, Eureka menampilkan Brand Templates yang dapat diakses oleh akun Canva pengguna. Pilih **Pilih template** untuk membaca kolom teks atau **Template berikutnya** untuk melanjutkan daftar. Untuk mengisi template, lanjutkan dengan brief atau perintah seperti “Isi judul dengan Hemat Energi dan subjudul dengan Aksi Kecil di Sekolah”. Eureka memakai Autofill untuk membuat salinan desain dari template yang dipilih. Untuk mengedit desain yang sudah ada, sebutkan perubahan dan sertakan tautan desain Canva pada perintah yang sama.

Brand Templates dan Autofill mengikuti paket Canva, seperti Pro, Teams, dan Enterprise. Eureka menelusuri Brand Templates akun atau tim. Galeri publik Canva dapat dibuka melalui tautan di hasil pencarian. Untuk mengisi teks, template atau desain harus memiliki kolom yang diberi label lewat **Bulk Create → Labels** di editor Canva. Jika belum ada kolom, pengguna dapat membuka desain di editor. Pembuatan dan perubahan isi membutuhkan izin **baca & tulis**.

Tindakan dan kemampuan tersedia sesuai tabel. Implementasi ini menjalankan satu aksi konektor per giliran. Alur multiaplikasi otomatis dalam satu giliran, editor blok baru, sinkronisasi sumber berkala, dan perizinan ruang kolaborasi masih memerlukan tahap pengembangan tersendiri.
