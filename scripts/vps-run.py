#!/usr/bin/env python3
"""Jalankan perintah di VPS via SSH password (paramiko).
Pakai: VPS_PW=... python vps-run.py "perintah" [--timeout detik]
Password TIDAK disimpan — hanya dibaca dari env saat run."""
import os
import sys

import paramiko

# Windows console (cp1252) menolak emoji/unicode dari output deploy — paksa UTF-8.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = "103.92.214.253"
USER = "root"
PW = os.environ.get("VPS_PW", "")
if not PW:
    print("Set env VPS_PW dulu", file=sys.stderr)
    sys.exit(2)

cmd = sys.argv[1]
timeout = 600
if "--timeout" in sys.argv:
    timeout = int(sys.argv[sys.argv.index("--timeout") + 1])

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PW, timeout=20)
chan = client.get_transport().open_session()
chan.settimeout(timeout)
chan.get_pty()
chan.exec_command(cmd)
out = b""
while True:
    try:
        data = chan.recv(65536)
    except Exception as e:
        print(f"\n[timeout/error: {e}]", file=sys.stderr)
        break
    if not data:
        break
    out += data
    sys.stdout.write(data.decode("utf-8", "replace"))
    sys.stdout.flush()
code = chan.recv_exit_status() if chan.exit_status_ready() else -1
client.close()
sys.exit(code if code >= 0 else 1)
