#!/usr/bin/env python3
"""Salin nilai JUANROUTER_API_KEY dari .env.local lokal → .env.local VPS (via SFTP).
Key hanya berpindah laptop→VPS; tidak ditulis ke argumen/log."""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import paramiko

HOST = "103.92.214.253"
PW = os.environ.get("VPS_PW", "")
if not PW:
    print("Set env VPS_PW", file=sys.stderr)
    sys.exit(2)

# Baca key dari .env.local lokal.
key = ""
with open(".env.local", encoding="utf-8") as f:
    for line in f:
        if line.startswith("JUANROUTER_API_KEY="):
            key = line.split("=", 1)[1].strip()
            break
if not key:
    print("JUANROUTER_API_KEY tidak ditemukan di .env.local lokal", file=sys.stderr)
    sys.exit(1)

t = paramiko.Transport((HOST, 22))
t.connect(username="root", password=PW)
sftp = paramiko.SFTPClient.from_transport(t)
with sftp.open("/opt/eureka-ai/.env.local", "r") as f:
    content = f.read().decode("utf-8")

lines = []
found = False
for line in content.splitlines():
    if line.startswith("JUANROUTER_API_KEY="):
        lines.append(f"JUANROUTER_API_KEY={key}")
        found = True
    else:
        lines.append(line)
if not found:
    lines.append(f"JUANROUTER_API_KEY={key}")
new_content = "\n".join(lines) + "\n"

with sftp.open("/opt/eureka-ai/.env.local", "w") as f:
    f.write(new_content)
sftp.close()
t.close()

print("JUANROUTER_API_KEY diperbarui di VPS (key tersembunyi).")
