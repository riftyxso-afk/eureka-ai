#!/usr/bin/env bash
#
# Eureka.AI — Setup nginx reverse proxy + SSL (Let's Encrypt) di VPS
#
# Tujuan:
#   https://api-eureka.web.id  →  127.0.0.1:3001  (backend Hono via pm2)
#
# Prasyarat:
#   1. Domain api-eureka.web.id sudah punya A record → IP VPS kamu
#      (di panel domain: A record, name "api-eureka" atau "@", value IP_VPS)
#   2. Backend sudah jalan: curl http://localhost:3001/api/health OK
#   3. Akses root & port 80/443 terbuka
#
# Cara pakai:
#   ssh root@IP_VPS
#   curl -sL https://raw.githubusercontent.com/riftyxso-afk/eureka-ai/master/scripts/setup-nginx-ssl.sh -o setup-nginx-ssl.sh
#   bash setup-nginx-ssl.sh
#
set -euo pipefail

DOMAIN="${DOMAIN:-api-eureka.web.id}"
UPSTREAM="${UPSTREAM:-127.0.0.1:3001}"
CERT_EMAIL="${CERT_EMAIL:-admin@${DOMAIN}}"   # ganti dengan email asli kalau mau

echo "==> [1/5] Install nginx + certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> [2/5] Buat konfigurasi site untuk ${DOMAIN}"
cat > /etc/nginx/sites-available/eureka-api <<EOF
# Eureka.AI backend — reverse proxy → http://${UPSTREAM}
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Batas upload besar (unggah file catatan/video)
    client_max_body_size 100m;

    location / {
        proxy_pass http://${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # PENTING untuk SSE (EventSource) — progress job tidak boleh di-buffer
        proxy_buffering off;
        proxy_cache off;

        # Job AI bisa lama — jangan putus koneksi
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF

# Aktifkan site (hapus default kalau ada)
ln -sf /etc/nginx/sites-available/eureka-api /etc/nginx/sites-enabled/eureka-api
rm -f /etc/nginx/sites-enabled/default

echo "==> [3/5] Test konfigurasi nginx"
nginx -t
systemctl reload nginx
systemctl enable nginx

echo "==> [4/5] Terbitkan SSL via Let's Encrypt"
certbot --nginx -d "${DOMAIN}" \
  --non-interactive --agree-tos -m "${CERT_EMAIL}" \
  --redirect

echo "==> [5/5] Verifikasi"
echo "    - Site: https://${DOMAIN}"
echo "    - Health: https://${DOMAIN}/api/health"
echo "    - Renewal otomatis: $(certbot renew --dry-run 2>&1 | grep -c 'no renewals\|not yet due\|success' || true)"

# Firewall
if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' >/dev/null 2>&1 || ufw allow 80,443/tcp >/dev/null 2>&1 || true
  echo "    - Firewall: port 80/443 diizinkan"
fi

echo ""
echo "✅ SELESAI!"
echo "   Cek dari laptop: curl https://${DOMAIN}/api/health"
echo ""
echo "📌 Setelah ini di Vercel (frontend):"
echo "   NEXT_PUBLIC_API_URL=https://${DOMAIN}"
echo "   CORS_ORIGIN di .env.local VPS = URL frontend Vercel kamu"
