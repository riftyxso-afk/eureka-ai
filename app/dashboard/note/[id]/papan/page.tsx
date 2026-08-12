"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Eraser,
  Loader2,
  Phone,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { getUserId, getUserName } from "@/lib/identity";

const BOARD_W = 1200;
const BOARD_H = 620;

const COLORS = [
  { value: "#3B2F2F", label: "Hitam" },
  { value: "#EF4444", label: "Merah" },
  { value: "#3B82F6", label: "Biru" },
  { value: "#10B981", label: "Hijau" },
  { value: "#F59E0B", label: "Oranye" },
  { value: "#8B5CF6", label: "Ungu" },
];

const SIZES = [
  { value: 3, label: "Tipis" },
  { value: 7, label: "Sedang" },
  { value: 14, label: "Tebal" },
];

const POLL_MS = 1500;
const HEARTBEAT_MS = 20000;
const PRESENCE_POLL_MS = 10000;
const PRESENCE_COLORS = [
  "bg-violet-300 text-violet-900",
  "bg-amber-300 text-amber-900",
  "bg-emerald-300 text-emerald-900",
  "bg-sky-300 text-sky-900",
  "bg-rose-300 text-rose-900",
];

interface BoardStroke {
  id: string;
  authorId: string;
  authorName: string;
  color: string;
  size: number;
  points: number[][];
  createdAt: string;
}

interface PresenceEntry {
  name: string;
  role: string;
  lastActive: number;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function WhiteboardPage() {
  const params = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<BoardStroke[]>([]);
  const [strokes, setStrokes] = useState<BoardStroke[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(SIZES[1].value);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(true);

  const drawing = useRef(false);
  const currentStroke = useRef<number[][]>([]);
  const clearedAtRef = useRef(0);

  const userId = getUserId();
  const userName = getUserName();

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // Ambil judul catatan
  useEffect(() => {
    apiFetch(`/api/notes/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.note?.title) setNoteTitle(data.note.title);
      })
      .catch(() => {});
  }, [params.id]);

  // Gambar ulang semua goresan
  useEffect(() => {
    strokesRef.current = strokes;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    ctx.fillStyle = "#FFFDF6";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    for (const s of strokes) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < s.points.length; i++) {
        const [x, y] = s.points[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  // Sinkronisasi realtime (polling)
  useEffect(() => {
    const fetchBoard = async () => {
      try {
        const res = await apiFetch(`/api/notes/${params.id}/board`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.clearedAt > clearedAtRef.current) {
          clearedAtRef.current = data.clearedAt;
          setStrokes([]);
        }
        setStrokes((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          const fresh = (data.strokes ?? []).filter(
            (s: BoardStroke) => !seen.has(s.id)
          );
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        if (Array.isArray(data.presence)) setPresence(data.presence);
      } catch {
        // abaikan
      } finally {
        setLoadingBoard(false);
      }
    };
    fetchBoard();
    const timer = setInterval(fetchBoard, POLL_MS);
    return () => clearInterval(timer);
  }, [params.id]);

  // Kehadiran (heartbeat + polling)
  useEffect(() => {
    const heartbeat = () => {
      apiFetch(`/api/notes/${params.id}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: userName, role: "viewer" }),
      }).catch(() => {});
    };
    const poll = async () => {
      try {
        const res = await apiFetch(`/api/notes/${params.id}/presence`);
        if (res.ok) {
          const data = await res.json();
          setPresence(Object.values(data.presence ?? {}));
        }
      } catch {
        // abaikan
      }
    };
    heartbeat();
    poll();
    const hb = setInterval(heartbeat, HEARTBEAT_MS);
    const pl = setInterval(poll, PRESENCE_POLL_MS);
    return () => {
      clearInterval(hb);
      clearInterval(pl);
    };
  }, [params.id, userId, userName]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * BOARD_W,
      ((e.clientY - rect.top) / rect.height) * BOARD_H,
    ] as const;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const pos = getPos(e);
    if (!pos) return;
    drawing.current = true;
    currentStroke.current = [[pos[0], pos[1]]];
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const pos = getPos(e);
    if (!pos) return;
    const pts = currentStroke.current;
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[0] - pos[0]) < 2 && Math.abs(last[1] - pos[1]) < 2) {
      return;
    }
    pts.push([pos[0], pos[1]]);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(pos[0], pos[1]);
    ctx.stroke();
  };

  const handlePointerUp = async () => {
    if (!drawing.current) return;
    drawing.current = false;
    const pts = currentStroke.current;
    if (pts.length < 2) return;
    currentStroke.current = [];

    const local: BoardStroke = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorId: userId,
      authorName: userName,
      color,
      size,
      points: pts,
      createdAt: new Date().toISOString(),
    };
    setStrokes((prev) => [...prev, local]);

    try {
      const res = await apiFetch(`/api/notes/${params.id}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stroke",
          stroke: {
            authorId: userId,
            authorName: userName,
            color,
            size,
            points: pts,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Ganti stroke lokal dengan id server (supaya tidak dobel saat poll)
        setStrokes((prev) =>
          prev.map((s) => (s.id === local.id ? data.stroke : s))
        );
      }
    } catch {
      // abaikan
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Bersihkan semua goresan di papan tulis?")) return;
    try {
      await apiFetch(`/api/notes/${params.id}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      clearedAtRef.current = Date.now();
      setStrokes([]);
      notify("Papan dibersihkan ðŸ§¹");
    } catch {
      notify("Gagal membersihkan papan.");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/dashboard/note/${params.id}/papan`
      );
      notify("Link papan tulis disalin! ðŸ”—");
    } catch {
      notify("Gagal menyalin link.");
    }
  };

  const handleCall = (type: "vc" | "audio") => {
    notify(
      type === "vc"
        ? "Video call segera hadir! ðŸš§"
        : "Panggilan suara segera hadir! ðŸš§"
    );
  };

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={`/dashboard/note/${params.id}`}
            aria-label="Kembali ke catatan"
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-3"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-clay-muted">
              Papan Tulis Kolaboratif
            </div>
            <h1 className="mt-0.5 line-clamp-1 text-lg font-extrabold text-clay-dark sm:text-xl">
              {noteTitle || "Memuat catatan..."}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => handleCall("audio")}
            className="btn-clay-ghost !min-h-[44px] !px-3 text-sm sm:!px-4"
            title="Panggilan suara (segera hadir)"
          >
            <Phone size={16} />
            <span className="ml-2 hidden sm:inline">Panggilan</span>
          </button>
          <button
            onClick={() => handleCall("vc")}
            className="btn-clay-ghost !min-h-[44px] !px-3 text-sm sm:!px-4"
            title="Video call (segera hadir)"
          >
            <Video size={16} />
            <span className="ml-2 hidden sm:inline">Video Call</span>
          </button>
          <button
            onClick={handleShare}
            className="btn-clay-primary !min-h-[44px] !px-3 text-sm sm:!px-4"
          >
            <Share2 size={16} />
            <span className="ml-2 hidden sm:inline">Bagikan</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card-clay mt-4 flex flex-wrap items-center gap-4 !p-4">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.label}
              aria-label={`Warna ${c.label}`}
              className={`h-10 w-10 rounded-full transition-all duration-75 active:translate-y-0.5 sm:h-8 sm:w-8 ${
                color === c.value
                  ? "ring-2 ring-clay-primary ring-offset-2"
                  : ""
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSize(s.value)}
              title={s.label}
              aria-label={`Ukuran ${s.label}`}
              className={`btn-clay-ghost !min-h-[44px] !px-3 text-xs sm:!min-h-[36px] ${
                size === s.value
                  ? "!border-clay-primary !bg-clay-primary !text-white !shadow-clay-sm"
                  : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleClear}
          className="btn-clay-ghost !min-h-[44px] !px-4 text-xs sm:!min-h-[36px]"
        >
          <Eraser size={14} className="mr-1.5" />
          Hapus Semua
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Users size={16} className="text-clay-primary" />
          <span className="text-xs font-extrabold text-clay-muted">
            {presence.length} sedang melihat
          </span>
          <div className="flex -space-x-2">
            {presence.slice(0, 5).map((p, i) => (
              <span
                key={`${p.name}-${i}`}
                title={p.name}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-extrabold ${PRESENCE_COLORS[i % PRESENCE_COLORS.length]}`}
              >
                {initials(p.name)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Papan */}
      <div className="card-clay mt-4 !p-2 sm:!p-3">
        <div className="relative overflow-hidden rounded-clay-md bg-[#FFFDF6]">
          {loadingBoard && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
              <span className="flex items-center gap-2 text-sm font-extrabold text-clay-muted">
                <Loader2 size={18} className="animate-spin" />
                Memuat papan...
              </span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={BOARD_W}
            height={BOARD_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="block w-full cursor-crosshair touch-none select-none"
          />
        </div>
        <p className="px-2 py-2 text-center text-xs font-semibold text-clay-muted">
          Gambar bersama temanmu secara realtime â€” setiap goresan langsung
          tersinkron otomatis
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="card-clay whitespace-nowrap px-5 py-3 text-sm font-extrabold text-clay-dark shadow-clay">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
