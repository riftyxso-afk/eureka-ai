"use client";
import {useState} from 'react';
import Link from 'next/link';
import {Mic,MicOff,Video,VideoOff,PhoneOff,Link as LinkIcon,PanelTop,Share2,MonitorUp} from 'lucide-react';
import MeetBoard from './MeetBoard';
import {useMeet} from './useMeet';
import GroupTutor from './GroupTutor';
import MeetInvite from './MeetInvite';
import './meet.css';
function Tile({stream,name,local=false}:{stream?:MediaStream;name:string;local?:boolean}){
 return <article className="meet-tile"><video autoPlay playsInline muted={local} ref={element=>{if(element&&element.srcObject!==stream)element.srcObject=stream||null;}}/><span>{name}</span></article>;
}
export default function MeetRoom({id,invite}:{id:string;invite:string}){
 const meet=useMeet(id,invite),[inviteOpen,setInviteOpen]=useState(false);

 function invitePeople(){setInviteOpen(true);}
 const aiBusy=!!meet.room&&new Date(meet.room.ai_busy_until).getTime()>Date.now();
 if(!meet.joined)return <main className="meet-lobby"><Link href="/dashboard-v2/teman">← Teman belajar</Link><div><img src="/icons/momo-192.png" alt="Momo" width={64} height={64}/><small>EUREKA MEET · BETA</small><h1>Satu ruang.<br/>Paham bersama.</h1><p>Undang hingga 6 peserta. Diskusikan materi bersama Momo dan gunakan papan tutor yang sama.</p><button disabled={meet.joining} onClick={()=>void meet.join()}>{meet.joining?'Menghubungkan kamera…':'Izinkan kamera & masuk'}</button><p>Kamera dan mikrofon akan meminta izin. Saat tutor suara aktif, suara peserta dikirim ke AI agar bisa berdiskusi bersama. Lala dapat melihat layar yang dibagikan. Kamera dikirim ke Lala hanya jika pembuat ruang memilih memperlihatkan kamera.</p>{meet.error&&<p role="alert">{meet.error}</p>}</div></main>;
 return <main className="meet-room" data-board={meet.room?.board_open||false} data-screen={!!meet.sharedScreen}>
 <header><div><strong>{meet.room?.title||'Menghubungkan ruang…'}</strong><small>{meet.members.length}/6 peserta · Tutor voice</small></div><button onClick={()=>void invitePeople()}><LinkIcon size={17}/>Undang teman</button></header>
 {!meet.relay&&<p className="meet-notice">TURN belum dikonfigurasi. Sebagian jaringan seluler/Wi-Fi mungkin tidak dapat saling terhubung.</p>}
 {meet.error&&<p className="meet-notice" role="status">{meet.error}</p>}
 {inviteOpen&&meet.room?.code&&<MeetInvite code={meet.room.code} onClose={()=>setInviteOpen(false)}/>}
 <div className="meet-workspace"><section className="meet-stage">
 <div className="meet-videos"><Tile stream={meet.local||undefined} name="Kamu" local/>{meet.members.filter(m=>m.id!==meet.clientId).map(m=><Tile key={m.id} stream={meet.streams[m.id]} name={m.name}/>)}</div>
 {meet.sharedScreen&&<section className="meet-screen-stage" aria-label={"Layar "+meet.screenName}><header><span><MonitorUp size={16}/> {meet.screenName} membagikan layar</span><small>Bahas lewat suara dengan Lala</small></header><video autoPlay muted playsInline ref={el=>{if(el&&el.srcObject!==meet.sharedScreen)el.srcObject=meet.sharedScreen;}}/></section>}
 {meet.room?.board_open&&<MeetBoard meet={meet} busy={aiBusy}/>}
 </section><GroupTutor meet={meet}/></div>
 <footer><span>Belajar bersama · Beta</span><div><button aria-label={meet.mic?'Bisukan mikrofon':'Aktifkan mikrofon'} aria-pressed={meet.mic} onClick={()=>meet.toggle('audio')}>{meet.mic?<Mic/>:<MicOff/>}</button><button aria-label={meet.camera?'Matikan kamera':'Aktifkan kamera'} aria-pressed={meet.camera} onClick={()=>meet.toggle('video')}>{meet.camera?<Video/>:<VideoOff/>}</button><button aria-label={meet.screen?"Hentikan berbagi layar":"Bagikan layar ke peserta dan Lala"} aria-pressed={!!meet.screen} disabled={meet.screenBusy} onClick={()=>void meet.shareScreen()}><MonitorUp/></button><button aria-label="Buka papan bersama" onClick={()=>void meet.act({action:'board',open:!meet.room?.board_open}).catch(e=>meet.setError(e.message))}><PanelTop/></button><button className="meet-hangup" aria-label="Keluar ruang" onClick={()=>void meet.leave()}><PhoneOff/></button></div><button onClick={()=>void invitePeople()}><Share2 size={18}/>Bagikan</button></footer>
 </main>;
}
