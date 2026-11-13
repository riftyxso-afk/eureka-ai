"use client";
import {useEffect,useRef,useState} from 'react';
import {useMomoCall,type CallProvider} from '@/components/assistant/useMomoCall';
import type {useMeet} from './useMeet';
import {getUserId} from '@/lib/identity';
export default function GroupTutor({meet}:{meet:ReturnType<typeof useMeet>}){
 const [provider,setProvider]=useState<CallProvider|null>(null),[pending,setPending]=useState(false),[camera,setCamera]=useState(false),[lala,setLala]=useState(false);
 const hook=useMomoCall(()=>{setProvider(null);meet.stopTutorAudio();void meet.act({action:'voice',provider:null}).catch(()=>{});});
 const {sendVideoFrame,level}=hook;
 const video=useRef<HTMLVideoElement>(null),orb=useRef<HTMLSpanElement>(null);
 const labels={idle:'Siap',permission:'Memeriksa mikrofon',connecting:'Menghubungkan',listening:'Mendengarkan peserta',thinking:'Berpikir',searching:'Mencari informasi',working:'Menyiapkan materi',speaking:'Berbicara'};
 const owner=meet.room?.owner_id===getUserId();
 const sharedActive=meet.room?.voice_client&&meet.members.some(m=>m.id===meet.room?.voice_client);
 useEffect(()=>{import('@/lib/apiClient').then(({apiFetch})=>apiFetch('/api/call/session')).then(r=>r.json()).then(d=>setLala(d.lala===true)).catch(()=>{});},[]);
 useEffect(()=>{if(hook.phase==='idle'&&provider&&!pending){setProvider(null);meet.stopTutorAudio();void meet.act({action:'voice',provider:null}).catch(()=>{});} // eslint-disable-next-line react-hooks/exhaustive-deps
 },[hook.phase,provider,pending]);
 useEffect(()=>{if(!camera||provider!=='lala')return;const canvas=document.createElement('canvas');canvas.width=480;canvas.height=270;
 const timer=setInterval(()=>{const v=video.current;if(!v||v.readyState<2)return;const c=canvas.getContext('2d');if(!c)return;c.drawImage(v,0,0,480,270);sendVideoFrame(canvas.toDataURL('image/jpeg',.5).split(',')[1]);},1500);return()=>clearInterval(timer);
 },[camera,provider,sendVideoFrame]);
 useEffect(()=>{let raf:number;const tick=()=>{if(orb.current)orb.current.style.transform=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'none':`scale(${1+level()*.12})`;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[level]);
 async function start(p:CallProvider){if(pending||provider||!meet.tutorInput)return;setPending(true);try{
 await meet.act({action:'voice',provider:p});setProvider(p);
 await hook.start(p,{title:meet.room?.title||'Belajar kelompok',material:`Kamu sedang berada dalam ruang belajar kelompok. Sapa semua peserta dan jelaskan topik ini. Permintaan membuat materi harus ditampilkan di papan bersama. Papan saat ini: ${meet.room?.board||'Belum ada materi.'}`},{input:meet.tutorInput,onOutput:meet.broadcastTutor,onTutorRequest:async (prompt,action)=>{if(action==='delete')return 'Penghapusan catatan pribadi tidak tersedia dari tutor kelompok.';if(action==='read'||action==='list')return meet.room?.board||'Papan bersama masih kosong.';await meet.act({action:'ai',text:prompt});return 'Materi sudah ditampilkan di papan bersama. Mari kita bahas langkah demi langkah.';}});
 }catch(e){meet.setError((e as Error).message);setProvider(null);}finally{setPending(false);}}
 function stop(){hook.stop();meet.stopTutorAudio();setProvider(null);setCamera(false);void meet.act({action:'voice',provider:null}).catch(e=>meet.setError(e.message));}
 return <section className="meet-group-tutor" aria-label="Tutor suara langsung"><span ref={orb} className="meet-tutor-orb" data-provider={provider||meet.room?.voice_provider||'momo'}/><div><strong>{provider?`${provider==='momo'?'Momo':'Lala'} · ${labels[hook.phase]}`:sharedActive?`${meet.room?.voice_provider==='lala'?'Lala':'Momo'} sedang di ruang`:'Tutor suara realtime'}</strong><p>Jika aktif, suara peserta dikirim ke tutor AI dan jawabannya terdengar oleh semua orang. Gunakan headset.</p>
 {owner&&!provider&&<div><button disabled={pending||!!sharedActive} onClick={()=>void start('momo')}>Mulai Momo</button><button disabled={pending||!lala||!!sharedActive} onClick={()=>void start('lala')}>Mulai Lala</button></div>}
 {provider&&<div><button onClick={stop}>Hentikan tutor</button>{provider==='lala'&&<button aria-pressed={camera} onClick={()=>setCamera(!camera)}>{camera?'Hentikan':'Bagikan'} kamera kamu ke Lala</button>}</div>}
 {!owner&&!sharedActive&&<small>Pembuat ruang dapat mengaktifkan Momo atau Lala.</small>}
 {hook.error&&<p role="alert">{hook.error}</p>}{hook.reply&&<p className="meet-tutor-caption">{hook.reply}</p>}
 </div><video hidden muted autoPlay playsInline ref={el=>{video.current=el;if(el&&el.srcObject!==meet.local)el.srcObject=meet.local;}}/></section>;
}
