#!/usr/bin/env python3
"""Sinkronkan variabel backend yang diperlukan dari .env.local lokal → VPS.
Hanya menimpa variabel yang KOSONG/belum ada di VPS (tidak menimpa yang sudah
terisi). Key berpindah via SFTP, tidak lewat argumen/log."""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import paramiko

HOST = "103.92.214.253"
PW = os.environ.get("VPS_PW", "")
if not PW:
    print("Set env VPS_PW", file=sys.stderr)
    sys.exit(2)

# Variabel yang dibutuhkan backend (frontend-only vars di-skip).
WANTED = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JUANROUTER_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAGENTIC_API_KEY",
    "AI_PROVIDER",
    "AI_API_KEY",
    "AI_BASE_URL",
    "AI_MODEL",
    "FIRECRAWL_API_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "PAKASIR_PROJECT",
    "PAKASIR_API_KEY",
    "PAKASIR_REDIRECT_URL",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "NVIDIA_NIM_API_KEY",
    "CORS_ORIGIN",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "SUMOPOD_API_KEY",
]

def read_env(path):
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            i = line.find("=")
            if i > 0 and not line.strip().startswith("#"):
                out[line[:i].strip()] = line[i + 1:].strip()
    return out

local = read_env(".env.local")

t = paramiko.Transport((HOST, 22))
t.connect(username="root", password=PW)
sftp = paramiko.SFTPClient.from_transport(t)
with sftp.open("/opt/eureka-ai/.env.local", "r") as f:
    content = f.read().decode("utf-8")

lines = content.splitlines()
existing = {}
for i, line in enumerate(lines):
    j = line.find("=")
    if j > 0 and not line.strip().startswith("#"):
        existing[line[:j].strip()] = i

changed = []
for k in WANTED:
    v = local.get(k, "")
    if not v:
        continue
    if k in existing:
        raw = lines[existing[k]]
        current = raw.split("=", 1)[1].strip() if "=" in raw else ""
        if current != "":
            continue  # sudah terisi — jangan sentuh
        lines[existing[k]] = f"{k}={v}"
        changed.append(f"{k} (mengisi kosong)")
    else:
        lines.append(f"{k}={v}")
        changed.append(k)

new_content = "\n".join(lines) + "\n"
with sftp.open("/opt/eureka-ai/.env.local", "w") as f:
    f.write(new_content)
sftp.close()
t.close()

print("Variabel diperbarui/ditambahkan di VPS:")
for c in changed:
    print("  -", c)
print(f"total: {len(changed)}")
