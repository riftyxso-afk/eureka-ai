#!/usr/bin/env bash
#
# Eureka.AI — Deploy backend API ke VPS (Ubuntu/Debian) via Node + pm2
#
# Cara pakai:
#   1. SSH ke VPS kamu:  ssh root@IP_VPS
#   2. Salin script ini ke VPS, lalu jalankan:
#        bash deploy-vps.sh
#   3. Setelah selesai, isi .env.local:
#        nano /opt/eureka-ai/.env.local
#      (salin isi dari .env.local laptop kamu)
#   4. Restart:  pm2 restart eureka-api
#   5. Cek:      curl http://localhost:3001/api/health
#
# Prasyarat: Ubuntu 20.04/22.04/24.04 atau Debian 11/12, akses root.
set -euo pipefail

REPO_URL="https://github.com/riftyxso-afk/eureka-ai.git"
APP_DIR="/opt/eureka-ai"
BRANCH="master"
PORT="${PORT:-3001}"

echo "==> [1/6] Update sistem & install alat dasar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential ca-certificates gnupg

echo "==> [2/6] Install Node.js 22 (LTS)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "    Node: $(node -v) | npm: $(npm -v)"

echo "==> [3/6] Clone/update repo"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  mkdir -p "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo "==> [4/6] Install dependensi"
cd "$APP_DIR"
# Deps root (dipakai route app/api: next, supabase, openai, dll) — tanpa dev deps berat
npm install --omit=dev --no-audit --no-fund
# Deps backend (hono, @hono/node-server, tsx)
cd "$APP_DIR/backend"
npm install --no-audit --no-fund

echo "==> [5/6] Install & konfigurasi pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

cat > /opt/eureka-ai/backend/ecosystem.config.cjs <<'EOF'
/** pm2 config — Eureka.AI backend API */
module.exports = {
  apps: [
    {
      name: "eureka-api",
      cwd: "/opt/eureka-ai/backend",
      script: "node_modules/.bin/tsx",
      args: "src/server.ts",
      instances: 1,
      autorestart: true,
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3001",
      },
    },
  ],
};
EOF

echo "==> [6/6] Mulai service"
cd /opt/eureka-ai/backend
# Pastikan .env.local ada (dibaca otomatis oleh server.ts dari repo root)
if [ ! -f /opt/eureka-ai/.env.local ]; then
  echo "    ⚠️  /opt/eureka-ai/.env.local belum ada."
  echo "    Salin dari laptop:  scp .env.local root@IP_VPS:/opt/eureka-ai/.env.local"
fi
pm2 startOrRestart ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "✅ SELESAI!"
echo "   Cek status : pm2 status"
echo "   Cek health : curl http://localhost:3001/api/health"
echo "   Log        : pm2 logs eureka-api"
echo ""
echo "📌 Jangan lupa (opsional tapi disarankan):"
echo "   - Buka firewall port 3001 (ufw allow 3001) ATAU pasang nginx reverse proxy"
echo "   - Set NEXT_PUBLIC_API_URL=http://IP_VPS:3001 di Vercel"
echo "   - Disarankan beli domain + HTTPS via nginx/certbot"
