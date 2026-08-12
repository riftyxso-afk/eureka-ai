# Eureka.AI — Backend API (Hono + tsx)
#
# Build context = ROOT repo (eureka-ai/), karena backend memuat route dari
# app/api/ dan lib/ di repo root via honoAdapter. Jangan build dari folder
# backend/ saja — route yang di-mount tidak akan ditemukan.
#
# Build lokal:  docker build -f backend/Dockerfile -t eureka-api .
# Jalankan:     docker run -p 3001:3001 --env-file .env.local eureka-api

FROM node:22-alpine AS base
WORKDIR /app

# ─── 1. Manifest root dulu (cache layer npm) ────────────────────
COPY package.json package-lock.json ./
# --omit=dev: puppeteeer/typescript/eslint dll tidak dibutuhkan saat runtime
RUN npm install --omit=dev --no-audit --no-fund

# ─── 2. Manifest backend (hono, @hono/node-server, tsx) ─────────
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm install --no-audit --no-fund

# ─── 3. Seluruh source repo ─────────────────────────────────────
# (node_modules & secret di-exclude via .dockerignore di root)
COPY . .

WORKDIR /app/backend
ENV NODE_ENV=production
# Render meng-inject PORT sendiri; fallback 3001 untuk lokal/Docker manual
EXPOSE 3001
CMD ["npm", "run", "start"]
