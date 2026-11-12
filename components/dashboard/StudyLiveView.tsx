"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export default function StudyLiveView() {
  const screen = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Menghubungkan tampilan live…");
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let failed = false;
    const target = screen.current;
    let socket: WebSocket | undefined;
    let remote: import("@novnc/novnc").default | undefined;
    const timeout = setTimeout(() => fail("Tampilan live terlalu lama terhubung. Coba lagi."), 30000);
    function fail(message: string) {
      if (disposed || failed) return;
      failed = true;
      controller.abort();
      clearTimeout(timeout);
      setStatus(message); setError(true);
      remote?.disconnect();
      socket?.close();
    }
    async function connect() {
      setError(false); setStatus("Menghubungkan tampilan live…");
      try {
        const [{ default: RFB }, response] = await Promise.all([
          import("@novnc/novnc"),
          apiFetch("/api/study-agent?view=live", { signal: controller.signal }),
        ]);
        const data = await response.json();
        if (disposed || failed) return;
        if (!response.ok) throw new Error(data.error || "Tampilan live belum tersedia.");
        const url = new URL(data.wsUrl);
        if (url.protocol !== "wss:" || url.hostname !== "mcp.box.simular.ai" || typeof data.token !== "string") throw new Error("Alamat tampilan live tidak valid.");
        socket = new WebSocket(url.href);
        socket.binaryType = "arraybuffer";
        socket.onopen = () => socket?.send(data.token);
        socket.onerror = () => fail("Koneksi tampilan live terputus. Coba lagi.");
        socket.onclose = () => fail("Tampilan live terputus. Hubungkan kembali untuk melanjutkan.");
        socket.onmessage = event => {
          if (disposed || !screen.current || !socket) return;
          socket.onmessage = null;
          try {
            const ack = JSON.parse(String(event.data));
            if (ack.error) throw new Error("Koneksi ditolak.");
            remote = new RFB(screen.current, socket, { shared: true });
            remote.viewOnly = true;
            remote.scaleViewport = true;
            remote.background = "#191919";
            remote.addEventListener("connect", () => { clearTimeout(timeout); if (!disposed) setStatus("Live · layar Momo"); });
            remote.addEventListener("disconnect", () => fail("Tampilan live terputus. Coba hubungkan kembali."));
            remote.addEventListener("securityfailure", () => fail("Akses tampilan live kedaluwarsa. Hubungkan kembali."));
          } catch { fail("Tampilan live belum bisa dibuka. Coba lagi."); }
        };
      } catch (cause) {
        if (!controller.signal.aborted) fail(cause instanceof Error ? cause.message : "Tampilan live belum tersedia.");
      }
    }
    void connect();
    return () => {
      disposed = true; clearTimeout(timeout); controller.abort();
      remote?.disconnect(); socket?.close();
      target?.replaceChildren();
    };
  }, [attempt]);

  return <div className="study-live-view">
    <div className="study-live-status" role="status">{status}{error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Hubungkan kembali</button>}</div>
    <div className="study-live-screen" ref={screen} aria-label="Layar browser Momo secara langsung" />
  </div>;
}
