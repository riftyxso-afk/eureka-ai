#!/usr/bin/env bash
# ============================================================
# Deploy backend Eureka.AI di VPS.
# Jalankan DI VPS dari folder repo (mis. /var/www/eureka-backend):
#   bash backend/deploy.sh
# Prasyarat:
#   - repo sudah di-clone & pernah jalan (backend/.env.local sudah diisi)
#   - pm2 (disarankan) ATAU systemd — skrip mendeteksi keduanya
# ============================================================
set -euo pipefail

# ── 1. Ambil kode terbaru ─────────────────────────────────
echo "── 1/5 git pull"
cd "$(dirname "$0")/.."            # pindah ke root repo
git pull origin master

# ── 2. Install dependensi ──────────────────────────────────
echo "── 2/5 npm ci"
cd backend
npm ci

# ── 3. Cek env ─────────────────────────────────────────────
echo "── 3/5 cek .env.local"
if [ ! -f .env.local ]; then
  echo "⚠️  backend/.env.local TIDAK ADA. Salin dari .env.example dan isi nilai produksi:"
  echo "    cp .env.example .env.local && nano .env.local"
  echo "    (wajib: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI keys,"
  echo "     PAKASIR_PROJECT, PAKASIR_API_KEY, PAKASIR_REDIRECT_URL, RESEND_API_KEY, CORS_ORIGIN)"
  exit 1
fi
echo "   ✓ .env.local ada"

# ── 4. Restart proses ──────────────────────────────────────
echo "── 4/5 restart"
RESTARTED=0
if command -v pm2 >/dev/null 2>&1 && pm2 describe eureka-backend >/dev/null 2>&1; then
  pm2 restart eureka-backend --update-env
  RESTARTED=1
elif command -v systemctl >/dev/null 2>&1 && systemctl list-units --type=service 2>/dev/null | grep -q "eureka-backend"; then
  sudo systemctl restart eureka-backend
  RESTARTED=1
fi
if [ "$RESTARTED" -eq 0 ]; then
  echo "⚠️  pm2/systemd 'eureka-backend' tidak ditemukan — jalankan manual:"
  echo "    (opsi a) pm2 start npm --name eureka-backend -- run start && pm2 save"
  echo "    (opsi b) nohup npm run start > /tmp/eureka-backend.log 2>&1 &"
  exit 1
fi

# ── 5. Health check ────────────────────────────────────────
echo "── 5/5 health check"
sleep 3
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ || echo "000")
echo "   localhost:3001 → HTTP $CODE"
if [ "$CODE" = "000" ]; then
  echo "❌ Server tidak merespon — cek log: pm2 logs eureka-backend (atau /tmp/eureka-backend.log)"
  exit 1
fi

echo
echo "✅ Deploy selesai. Verifikasi webhook:"
echo "   - Webhook Pakasir di dashboard → https://<domain>/api/payments/webhook"
echo "   - Cek dari luar: curl -s https://<domain>/ | head -5"
