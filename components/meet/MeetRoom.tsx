"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {Mic,MicOff,Video,VideoOff,PhoneOff,Link as LinkIcon,PanelTop,Send,Sparkles,Download,Share2} from 'lucide-react';
import MarkdownView from '@/components/asisten/MarkdownView';
import {useMeet} from './useMeet';
import MeetRecap from './MeetRecap';
import './meet.css';
function Tile({stream,name,local=false}:{stream?:MediaStream;name:string;local?:boolean}){
 return <article className="meet-tile"><video autoPlay playsInline muted={local} ref={element=>{if(element&&element.srcObject!==stream)element.srcObject=stream||null;}}/><span>{name}</span></article>;
}
export default function MeetRoom({id,invite}:{id:string;invite:string}){
 const meet=useMeet(id,invite),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [draw,setDraw]=useState(false);const points=useRef<number[][]>([]),svg=useRef<SVGSVGElement>(null);
 async function send(ai:boolean){if(!draft.trim()||busy)return;setBusy(true);meet.setError('');try{await meet.act({action:ai?'ai':'chat',text:draft});setDraft('');}catch(e){meet.setError((e as Error).message);}finally{setBusy(false);}}
 async function invitePeople(){const url=location.href;if(navigator.share){try{await navigator.share({title:meet.room?.title||'Belajar bareng di Eureka',text:'Ayo belajar bersama Momo!',url});return;}catch{}}
 try{await navigator.clipboard.writeText(url);setNotice('Tautan undangan disalin. Kirim ke temanmu.');}catch{setNotice('Salin tautan undangan dari alamat browser.');}}
 const aiBusy=busy||!!meet.room&&new Date(meet.room.ai_busy_until).getTime()>Date.now();
 if(!meet.joined)return <main className="meet-lobby"><Link href="/dashboard-v2/teman">← Teman belajar</Link><div><img src="/icons/momo-192.png" alt="Momo" width={64} height={64}/><small>EUREKA MEET · BETA</small><h1>Satu ruang.<br/>Paham bersama.</h1><p>Undang hingga 6 peserta. Diskusikan materi bersama Momo dan gunakan papan tutor yang sama.</p><button disabled={meet.joining} onClick={()=>void meet.join()}>{meet.joining?'Menghubungkan kamera…':'Izinkan kamera & masuk'}</button><p>Kamera dan mikrofon akan meminta izin. Belum merekam atau menyimpan video.</p>{meet.error&&<p role="alert">{meet.error}</p>}</div></main>;
 return <main className="meet-room" data-board={meet.room?.board_open||false}>
 <header><div><strong>{meet.room?.title||'Menghubungkan ruang…'}</strong><small>{meet.members.length}/6 peserta · Momo AI</small></div><button onClick={()=>void invitePeople()}><LinkIcon size={17}/>Undang teman</button></header>
 {!meet.relay&&<p className="meet-notice">TURN belum dikonfigurasi. Sebagian jaringan seluler/Wi-Fi mungkin tidak dapat saling terhubung.</p>}
 {(meet.error||notice)&&<p className="meet-notice" role="status">{meet.error||notice}</p>}
 <div className="meet-workspace"><section className="meet-stage">
 <div className="meet-videos"><Tile stream={meet.local||undefined} name="Kamu" local/>{meet.members.filter(m=>m.id!==meet.clientId).map(m=><Tile key={m.id} stream={meet.streams[m.id]} name={m.name}/>)}<article className="meet-tile meet-momo"><img src="/icons/momo-192.png" alt="Momo"/><span>{aiBusy?'Momo sedang menyiapkan materi…':'Momo · tutor kelompok'}</span></article></div>
 {meet.room?.board_open&&<section className="meet-board"><header><strong>Papan tutor bersama</strong><div><button aria-pressed={draw} onClick={()=>setDraw(!draw)}>{draw?'Selesai menulis':'Coret papan'}</button><button onClick={()=>void meet.act({action:'board',open:false}).catch(e=>meet.setError(e.message))}>Tutup papan</button></div></header>
 {aiBusy&&<p role="status">Momo sedang menyusun penjelasan untuk semua peserta…</p>}
 <div className="meet-board-content"><MarkdownView content={meet.room.board||'Tanyakan sesuatu kepada Momo untuk mulai mengisi papan.'}/></div>
 <svg ref={svg} className="meet-drawing" viewBox="0 0 1000 500" data-draw={draw} onPointerDown={e=>{if(!draw)return;const r=e.currentTarget.getBoundingClientRect();points.current=[[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]];e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!draw||!e.currentTarget.hasPointerCapture(e.pointerId)||points.current.length>=300)return;const r=e.currentTarget.getBoundingClientRect();points.current.push([Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))]);e.currentTarget.querySelector('[data-preview]')?.setAttribute('points',points.current.map(p=>`${p[0]*1000},${p[1]*500}`).join(' '));}} onPointerUp={e=>{if(points.current.length>1)void meet.act({action:'stroke',points:points.current}).catch(err=>meet.setError(err.message));points.current=[];e.currentTarget.querySelector('[data-preview]')?.setAttribute('points','');}}>
 {meet.events.filter(e=>e.kind==='stroke').map(e=><polyline key={e.id} points={(e.payload.points as number[][]).map(p=>`${p[0]*1000},${p[1]*500}`).join(' ')}/>)}<polyline data-preview/>
 </svg>
 <button onClick={async()=>{const {downloadStudyDocx}=await import('@/lib/study-docx');downloadStudyDocx(meet.room!.title,meet.room!.board,[]);}}><Download size={16}/>Simpan materi Word</button>
 <MeetRecap title={meet.room.title} material={meet.room.board}/>
 </section>}
 </section><aside className="meet-chat"><header><strong>Diskusi & Momo</strong><span>Semua peserta</span></header><div className="meet-messages">{meet.events.filter(e=>e.kind==='chat').map(e=><article key={e.id}><strong>{String(e.payload.name)}</strong><p>{String(e.payload.text)}</p></article>)}{!meet.events.some(e=>e.kind==='chat')&&<p>Panggil Momo untuk menjelaskan topik, membuat rangkuman, soal latihan, atau materi di papan.</p>}</div><form onSubmit={e=>{e.preventDefault();void send(false);}}><textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={6000} rows={2} placeholder="Tulis materi atau pertanyaan…" aria-label="Pesan ruang belajar"/><div><button type="button" disabled={aiBusy||!draft.trim()} onClick={()=>void send(true)}><Sparkles size={16}/>Tanya Momo</button><button disabled={busy||!draft.trim()} aria-label="Kirim ke peserta"><Send size={17}/></button></div></form></aside></div>
 <footer><span>Belajar bersama · Beta</span><div><button aria-label={meet.mic?'Bisukan mikrofon':'Aktifkan mikrofon'} aria-pressed={meet.mic} onClick={()=>meet.toggle('audio')}>{meet.mic?<Mic/>:<MicOff/>}</button><button aria-label={meet.camera?'Matikan kamera':'Aktifkan kamera'} aria-pressed={meet.camera} onClick={()=>meet.toggle('video')}>{meet.camera?<Video/>:<VideoOff/>}</button><button aria-label="Buka papan bersama" onClick={()=>void meet.act({action:'board',open:!meet.room?.board_open}).catch(e=>meet.setError(e.message))}><PanelTop/></button><button className="meet-hangup" aria-label="Keluar ruang" onClick={()=>void meet.leave()}><PhoneOff/></button></div><button onClick={()=>void invitePeople()}><Share2 size={18}/>Bagikan</button></footer>
 </main>;
}
