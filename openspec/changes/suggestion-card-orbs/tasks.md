## 1. Implementasi Kartu dengan Orb

- [x] 1.1 Tambahkan state `loadingCard` di `components/dashboard/AssistantHub.tsx` dan ganti ikon statis pada kartu "Tanya Apa Sasa" menjadi `EurekaOrb variant="thinking"` saat loading; verifikasi klik menampilkan orb compose inline
- [x] 1.2 Ganti ikon kartu "Kerjakan Tugas" menjadi `EurekaOrb variant="working"` saat loading dan tampilkan label "Menyusun langkah penyelesaian..."; verifikasi klik menampilkan orb working inline
- [x] 1.3 Pastikan kedua kartu kembali ke tampilan awal dalam ≤500ms dan tidak memblokir edit composer; verifikasi composer tetap dapat diedit setelah klik kartu
- [x] 1.4 Uji preferensi `prefers-reduced-motion: reduce` — orb harus tampil statis tanpa animasi; verifikasi di DevTools Rendering

## 2. Verifikasi

- [x] 2.1 Jalankan `npx tsc --noEmit` dan `npm run lint` — keduanya harus bersih
- [x] 2.2 Uji manual klik kedua kartu secara terpisah dan rapid-click; pastikan tidak ada sesi duplikat dan tidak ada layout shift
