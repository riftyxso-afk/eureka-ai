FROM node:22-alpine AS base
WORKDIR /app

# Repo root (frontend + lib + app/api + backend) dimasukkan penuh
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .

WORKDIR /app/backend
EXPOSE 3001
CMD ["npx", "tsx", "src/server.ts"]