"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  Check,
  Loader2,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { getUserId, getUserName } from "@/lib/identity";

interface FriendEntry {
  id: string;
  name: string;
  relation: "self" | "friend" | "incoming" | "outgoing" | "none";
}

interface RequestEntry {
  id: string;
  name: string;
}

const AVATAR_COLORS = [
  "bg-violet-300 text-violet-900",
  "bg-amber-300 text-amber-900",
  "bg-emerald-300 text-emerald-900",
  "bg-sky-300 text-sky-900",
  "bg-rose-300 text-rose-900",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % AVATAR_COLORS.length;
}

const RELATION_LABEL: Record<string, string> = {
  self: "Kamu",
  friend: "Teman",
  incoming: "Menunggu respons kamu",
  outgoing: "Menunggu diterima",
  none: "Belum berteman",
};

export default function FriendsPage() {
  const userId = getUserId();
  const userName = getUserName();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendEntry[]>([]);
  const [friends, setFriends] = useState<RequestEntry[]>([]);
  const [incoming, setIncoming] = useState<RequestEntry[]>([]);
  const [outgoing, setOutgoing] = useState<RequestEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const loadAll = useCallback(async () => {
    try {
      const [friendsRes, reqRes] = await Promise.all([
        apiFetch(`/api/friends?userId=${userId}&name=${encodeURIComponent(userName)}`),
        apiFetch(`/api/friends/requests?userId=${userId}`),
      ]);
      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.users.filter((u: FriendEntry) => u.relation === "friend"));
      }
      if (reqRes.ok) {
        const data = await reqRes.json();
        setIncoming(data.incoming ?? []);
        setOutgoing(data.outgoing ?? []);
      }
    } catch {
      // abaikan
    }
  }, [userId, userName]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/api/friends?userId=${userId}&name=${encodeURIComponent(userName)}&q=${encodeURIComponent(q)}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.users ?? []);
      }
    } catch {
      // abaikan
    } finally {
      setSearching(false);
    }
  };

  const addFriend = async (targetName: string) => {
    setBusyId(`add-${targetName}`);
    try {
      const res = await apiFetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          userId,
          name: userName,
          targetName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menambah teman.");
      if (data.relation === "friend") {
        notify(`${targetName} sekarang temanmu! 🎉`);
      } else {
        notify(`Permintaan pertemanan dikirim ke ${targetName} ✉️`);
      }
      setQuery("");
      setResults([]);
      await loadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal menambah teman.");
    } finally {
      setBusyId(null);
    }
  };

  const respondRequest = async (action: "accept" | "decline", fromId: string, name: string) => {
    setBusyId(`${action}-${fromId}`);
    try {
      await apiFetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, fromId, name: userName }),
      });
      notify(
        action === "accept" ? `${name} diterima sebagai teman! 🎉` : `Permintaan ${name} ditolak.`
      );
      await loadAll();
    } catch {
      notify("Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusyId(null);
    }
  };

  const removeFriend = async (friendId: string, name: string) => {
    if (!window.confirm(`Hapus ${name} dari daftar teman?`)) return;
    setBusyId(`del-${friendId}`);
    try {
      await apiFetch(`/api/friends/${friendId}?userId=${userId}`, { method: "DELETE" });
      notify(`${name} dihapus dari daftar teman.`);
      await loadAll();
    } catch {
      notify("Gagal menghapus teman.");
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (
    key: string,
    name: string,
    sub: string,
    actions: React.ReactNode,
    busy = false
  ) => (
    <li
      key={key}
      className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-clay-shadow/40 bg-white/60 p-3"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AVATAR_COLORS[colorIndex(name)]}`}
      >
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-extrabold text-clay-dark">
          {name}
        </div>
        <div className="text-xs font-semibold text-clay-muted">{sub}</div>
      </div>
      {busy ? (
        <Loader2 size={18} className="animate-spin text-clay-primary" />
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </li>
  );

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Users size={28} className="text-clay-primary" />
        <h1 className="text-2xl font-extrabold sm:text-3xl">Teman</h1>
      </div>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        Cari teman, kirim undangan, dan belajar bareng
      </p>

      {/* Pencarian */}
      <div className="mt-6">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
          />
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Cari nama teman..."
            className="input-clay w-full !pl-12"
          />
        </div>

        {searching && (
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-clay-muted">
            <Loader2 size={15} className="animate-spin" /> Mencari...
          </p>
        )}

        {!searching && results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r) =>
              renderRow(
                r.id,
                r.name,
                RELATION_LABEL[r.relation] ?? "",
                r.relation === "self" ? (
                  <span className="rounded-full bg-clay-beige px-3 py-1 text-xs font-extrabold text-clay-muted">
                    Kamu
                  </span>
                ) : r.relation === "none" || r.relation === "incoming" ? (
                  <button
                    onClick={() => addFriend(r.name)}
                    className="btn-clay-primary !min-h-[44px] !px-3 text-xs"
                  >
                    <UserPlus size={14} className="mr-1" />
                    {r.relation === "incoming" ? "Terima" : "Tambah"}
                  </button>
                ) : (
                  <span className="rounded-full bg-clay-beige px-3 py-1 text-xs font-extrabold text-clay-muted">
                    ✓ {RELATION_LABEL[r.relation]}
                  </span>
                ),
                busyId === `add-${r.name}`
              )
            )}
          </ul>
        )}

        {!searching && query.trim().length > 0 && results.length === 0 && (
          <div className="mt-3 rounded-2xl border-2 border-dashed border-clay-shadow/40 p-4">
            <p className="text-sm font-semibold text-clay-muted">
              Tidak ada pengguna bernama{" "}
              <b className="text-clay-dark">“{query.trim()}”</b> yang terdaftar.
              Pastikan temanmu sudah membuat akun Eureka.AI, lalu cari dengan
              nama atau @username-nya.
            </p>
          </div>
        )}
      </div>

      {/* Permintaan masuk */}
      {incoming.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-extrabold text-clay-dark">
            Permintaan Masuk ({incoming.length})
          </h2>
          <ul className="space-y-2">
            {incoming.map((r) =>
              renderRow(
                r.id,
                r.name,
                "Ingin berteman denganmu",
                <>
                  <button
                    onClick={() => respondRequest("accept", r.id, r.name)}
                    className="btn-clay-primary !min-h-[44px] !px-3 text-xs"
                  >
                    <Check size={14} className="mr-1" />
                    Terima
                  </button>
                  <button
                    onClick={() => respondRequest("decline", r.id, r.name)}
                    className="btn-clay-ghost !min-h-[44px] !px-3 text-xs"
                  >
                    <X size={14} className="mr-1" />
                    Tolak
                  </button>
                </>,
                busyId === `accept-${r.id}` || busyId === `decline-${r.id}`
              )
            )}
          </ul>
        </div>
      )}

      {/* Undangan terkirim */}
      {outgoing.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-extrabold text-clay-dark">
            Menunggu Diterima ({outgoing.length})
          </h2>
          <ul className="space-y-2">
            {outgoing.map((r) =>
              renderRow(r.id, r.name, "Permintaan menunggu respons", (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">
                  ⏳ Menunggu
                </span>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Daftar teman */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold text-clay-dark">
          Daftar Teman ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-6 text-center text-sm font-semibold text-clay-muted">
            Belum ada teman. Cari dan undang temanmu di atas! 👋
          </p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) =>
              renderRow(
                f.id,
                f.name,
                "Teman",
                <button
                  onClick={() => removeFriend(f.id, f.name)}
                  aria-label={`Hapus ${f.name}`}
                  className="btn-clay-ghost !min-h-[44px] !px-3"
                >
                  <Trash2 size={15} className="text-clay-muted" />
                </button>,
                busyId === `del-${f.id}`
              )
            )}
          </ul>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div className="card-clay whitespace-normal break-words px-5 py-3 text-center text-sm font-extrabold text-clay-dark shadow-clay">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
