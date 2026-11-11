"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { useDashboardNotes } from "@/components/dashboard/useDashboardNotes";
type Item = { id:string;title:string };
type Inbox = Item & {message:string;link:string};
export default function FriendSharing() {
  const {notes} = useDashboardNotes(true);
  const [friends,setFriends] = useState<{id:string;name:string}[]>([]);
  const [sessions,setSessions] = useState<Item[]>([]);
  const [inbox,setInbox] = useState<Inbox[]>([]);
  const [friendId,setFriendId] = useState("");
  const [kind,setKind] = useState("note");
  const [id,setId] = useState("");
  const [message,setMessage] = useState("");
  const [status,setStatus] = useState("");
  const [busy,setBusy] = useState(false);
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const results = await Promise.all(["/api/assistant/sessions?userId="+encodeURIComponent(getUserId()),"/api/friends/send"].map(async url => {const res=await apiFetch(url,{signal:controller.signal});const data=await res.json();if(!res.ok)throw Error(data.error || "Data belum bisa dimuat.");return data;}));
        if(controller.signal.aborted)return;
        setFriends(results[1].friends);
        setSessions(results[0].sessions);setInbox(results[1].items);
      } catch(error) {if(!controller.signal.aborted)setStatus(error instanceof Error ? error.message : "Gagal memuat.");}
    }
    void load();return ()=>controller.abort();
  },[revision]);
  async function send() {
    if(busy)return;setBusy(true);setStatus("");
    try {const res=await apiFetch('/api/friends/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({friendId,kind,id,message})});const data=await res.json();if(!res.ok)throw Error(data.error);setStatus('Berhasil dikirim ke teman.');setMessage('');}
    catch(error){setStatus(error instanceof Error?error.message:'Gagal mengirim.');}finally{setBusy(false);}
  }
  return <section className="mission-learning mission-learning-form"><h2>Berbagi dengan teman</h2><button onClick={()=>setRevision(value=>value+1)}>Muat ulang teman dan kiriman</button><form onSubmit={event=>{event.preventDefault();void send();}}><label>Teman penerima<select required value={friendId} onChange={event=>setFriendId(event.target.value)}><option value="">Pilih teman yang sudah terhubung</option>{friends.map(friend=><option key={friend.id} value={friend.id}>{friend.name}</option>)}</select></label><label>Jenis materi<select value={kind} onChange={event=>{setKind(event.target.value);setId('');}}><option value="note">Catatan</option><option value="chat">Percakapan dan respons AI</option></select></label><label>Materi yang dibagikan<select required value={id} onChange={event=>setId(event.target.value)}><option value="">Pilih materi</option>{(kind==='note'?notes:sessions).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Pesan untuk teman<textarea value={message} maxLength={500} onChange={event=>setMessage(event.target.value)} /></label><p>Pengiriman membuat tautan baca yang dapat diteruskan. Percakapan dibagikan beserta seluruh responsnya.</p><button className="mission-start" disabled={busy}>Kirim ke teman</button></form><p role="status">{status}</p><h2>Kiriman untukmu</h2>{inbox.length?inbox.map(item=><article key={item.id}><h3>{item.title}</h3><p>{item.message}</p><Link href={item.link}>Buka materi</Link></article>):<p>Kiriman dari teman akan tampil di sini.</p>}</section>;
}
