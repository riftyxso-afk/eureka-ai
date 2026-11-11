"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Inbox, Send } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { useDashboardNotes } from "@/components/dashboard/useDashboardNotes";

type Item = { id: string; title: string };
type ReceivedItem = Item & { message: string; link: string };
type Directory = { friends: { id: string; name: string }[]; items: ReceivedItem[] };

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Data belum bisa dimuat. Coba lagi.");
  return data;
}

export default function FriendSharing({
  mode, onFindFriends,
}: { mode: "share" | "inbox" | null; onFindFriends: () => void }) {
  const { notes, loading: notesLoading, error: notesError, refresh: refreshNotes } = useDashboardNotes(mode === "share");
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [sessions, setSessions] = useState<Item[]>([]);
  const [directoryError, setDirectoryError] = useState("");
  const [sessionsError, setSessionsError] = useState("");
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [kind, setKind] = useState("note");
  const [id, setId] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const [status, setStatus] = useState("");
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const sending = useRef(false);
  const needsSessions = mode === "share" && kind === "chat";

  useEffect(() => {
    if (!mode) return;
    const request = new AbortController();
    apiFetch("/api/friends/send", { signal: request.signal })
      .then(readResponse<Directory>)
      .then(data => { if (!request.signal.aborted) { setDirectory(data); setDirectoryError(""); } })
      .catch(error => { if (!request.signal.aborted) setDirectoryError(error.message); });
    return () => request.abort();
  }, [mode, revision]);

  useEffect(() => {
    if (!needsSessions) return;
    const request = new AbortController();
    setSessionsLoading(true);
    setSessionsError("");
    apiFetch("/api/assistant/sessions?userId=" + encodeURIComponent(getUserId()), { signal: request.signal })
      .then(readResponse<{ sessions: Item[] }>)
      .then(data => { if (!request.signal.aborted) setSessions(data.sessions); })
      .catch(error => { if (!request.signal.aborted) setSessionsError(error.message); })
      .finally(() => { if (!request.signal.aborted) setSessionsLoading(false); });
    return () => request.abort();
  }, [needsSessions, revision]);

  const items = kind === "note" ? notes : sessions;
  const item = items.find(entry => entry.id === id);
  const friend = directory?.friends.find(entry => entry.id === friendId);
  const materialsLoading = kind === "note" ? notesLoading : sessionsLoading;

  async function send() {
    if (sending.current || !friend || !item) return;
    sending.current = true;
    setBusy(true);
    setSendError("");
    try {
      await readResponse(await apiFetch("/api/friends/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, kind, id, message }),
      }));
      setStatus("Materi berhasil dikirim ke " + friend.name + ".");
      setMessage("");
      setId("");
      setReview(false);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Gagal mengirim. Coba lagi.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function retry() {
    setDirectoryError("");
    setSessionsError("");
    setRevision(value => value + 1);
  }

  if (!mode) return null;
  if (directoryError) return <div className="flow-empty"><p role="alert">{directoryError}</p><button className="flow-button secondary" type="button" onClick={retry}>Muat ulang</button></div>;
  if (!directory) return <p className="flow-description" role="status">Memuat {mode === "inbox" ? "kiriman" : "daftar teman"}...</p>;
  if (mode === "inbox") {
    return directory.items.length ? (
      <ul className="flow-inbox">
        {directory.items.map(entry => (
          <li className="flow-list-row" key={entry.id}>
            <Inbox size={20} aria-hidden="true" />
            <div><strong>{entry.title}</strong><p>{entry.message}</p></div>
            <Link href={entry.link} className="flow-button secondary">Buka materi <ArrowUpRight size={15} /></Link>
          </li>
        ))}
      </ul>
    ) : <p className="flow-empty">Materi yang dibagikan teman akan muncul di sini.</p>;
  }
  if (!directory.friends.length) {
    return <div className="flow-empty"><p>Tambahkan teman terlebih dahulu agar bisa mengirim materi.</p><button className="flow-button" type="button" onClick={onFindFriends}>Cari teman</button></div>;
  }

  return (
    <form className="flow-form share-form" onSubmit={event => {
      event.preventDefault();
      if (review) void send();
      else if (item && friend) { setStatus(""); setSendError(""); setReview(true); }
    }}>
      <p className="flow-description">{review ? "2 dari 2 · Tinjau kiriman" : "1 dari 2 · Pilih penerima dan materi"}</p>
      {status && <p className="flow-success" role="status">{status}</p>}
      {review && friend && item ? (
        <>
          <dl className="flow-summary"><div><dt>Kepada</dt><dd>{friend.name}</dd></div><div><dt>Materi</dt><dd>{item.title}</dd></div></dl>
          <label>Pesan opsional<textarea value={message} maxLength={500} onChange={event => setMessage(event.target.value)} disabled={busy} /></label>
          <p className="flow-description">Tautan baca dapat diteruskan.{kind === "chat" && " Seluruh isi percakapan akan dibagikan."}</p>
          {sendError && <p className="flow-error" role="alert">{sendError}</p>}
          <div className="flow-actions">
            <button className="flow-button secondary" type="button" disabled={busy} onClick={() => setReview(false)}>Kembali</button>
            <button className="flow-button" disabled={busy} type="submit"><Send size={16} /> {busy ? "Mengirim..." : "Kirim materi"}</button>
          </div>
        </>
      ) : (
        <>
          <label>Teman penerima
            <select required value={friendId} onChange={event => { setFriendId(event.target.value); setReview(false); }}>
              <option value="">Pilih teman</option>
              {directory.friends.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          <label>Jenis materi
            <select value={kind} onChange={event => { setKind(event.target.value); setId(""); setReview(false); }}>
              <option value="note">Catatan</option><option value="chat">Percakapan AI</option>
            </select>
          </label>
          <label>Materi yang dibagikan
            <select required value={id} onChange={event => { setId(event.target.value); setReview(false); }} disabled={materialsLoading || !items.length}>
              <option value="">{materialsLoading ? "Memuat materi..." : items.length ? "Pilih materi" : "Belum ada materi"}</option>
              {items.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
            </select>
          </label>
          {kind === "note" && notesError && <p className="flow-error" role="alert">{notesError} <button className="flow-text-action" type="button" onClick={refreshNotes}>Muat ulang</button></p>}
          {kind === "chat" && sessionsError && <p className="flow-error" role="alert">{sessionsError} <button className="flow-text-action" type="button" onClick={retry}>Muat ulang</button></p>}
          <div className="flow-actions"><button className="flow-button" type="submit" disabled={!friend || !item}>Tinjau kiriman</button></div>
        </>
      )}
    </form>
  );
}
