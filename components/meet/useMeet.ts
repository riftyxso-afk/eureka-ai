"use client";
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import type { MeetMember, MeetEvent } from '@/lib/meet';
import {createMeetAudio} from '@/lib/audio/meetAudio';
export type MeetRoom = {title:string;board:string;board_open:boolean;ai_busy_until:string;owner_id:string;code:string;voice_client:string|null;voice_provider:'momo'|'lala'|null};
export async function meetRequest(body:Record<string,unknown>,signal?:AbortSignal){
 const response=await apiFetch('/api/meet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Ruang belum bisa dihubungkan');return data;
}
export function useMeet(id:string,invite:string){
 const [joined,setJoined]=useState(false),[joining,setJoining]=useState(false),[error,setError]=useState('');
 const [room,setRoom]=useState<MeetRoom|null>(null),[members,setMembers]=useState<MeetMember[]>([]),[events,setEvents]=useState<MeetEvent[]>([]);
 const [streams,setStreams]=useState<Record<string,MediaStream>>({}),[local,setLocal]=useState<MediaStream|null>(null);
 const [mic,setMic]=useState(true),[camera,setCamera]=useState(true),[relay,setRelay]=useState(true);
 const [clientId,setClientId]=useState('');
 const client=useRef(''),peers=useRef(new Map<string,{pc:RTCPeerConnection;pending:RTCIceCandidateInit[]}>()),media=useRef<MediaStream|null>(null);
 const alive=useRef(true),lock=useRef(false),ice=useRef<RTCIceServer[]>([]),cursor=useRef(0);
 const audio=useRef<ReturnType<typeof createMeetAudio>|null>(null);
 const [tutorInput,setTutorInput]=useState<MediaStream|null>(null);
 const [screen,setScreen]=useState<MediaStream|null>(null),[screenBusy,setScreenBusy]=useState(false);
 const display=useRef<MediaStream|null>(null),screenLock=useRef(false);
 const act=(body:Record<string,unknown>)=>meetRequest({...body,roomId:id,clientId:client.current});
 function close(){display.current?.getTracks().forEach(t=>{t.onended=null;t.stop();});display.current=null;peers.current.forEach(p=>p.pc.close());peers.current.clear();media.current?.getTracks().forEach(t=>t.stop());media.current=null;void audio.current?.context.close();audio.current=null;}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;close();if(client.current)void meetRequest({action:'leave',roomId:id,clientId:client.current}).catch(()=>{});};},[id]);
 async function join(){
 if(lock.current)return;lock.current=true;setJoining(true);setError('');
 try{
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('Buka Eureka melalui HTTPS untuk mengaktifkan kamera dan mikrofon.');
 const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:{width:{ideal:640},height:{ideal:360},facingMode:'user'}});
 if(!alive.current){stream.getTracks().forEach(t=>t.stop());return;}
 media.current=stream;client.current=crypto.randomUUID();cursor.current=0;
 const context=new AudioContext();await context.resume();audio.current=createMeetAudio(context,stream);setTutorInput(audio.current.input.stream);
 setClientId(client.current);setMic(true);setCamera(true);setEvents([]);setRoom(null);
 const data=await act({action:'join',invite});
 if(!alive.current){close();return;}
 ice.current=data.iceServers;setRelay(data.relayReady);setLocal(stream);setJoined(true);
 }catch(cause){close();setError(cause instanceof Error?cause.message:'Izin kamera atau mikrofon belum tersedia. Periksa pengaturan browser.');}
 finally{lock.current=false;if(alive.current)setJoining(false);}
 }
 useEffect(()=>{
 if(!joined)return;let stopped=false;const controller=new AbortController();
 const report=(cause:unknown)=>{if(!stopped)setError(cause instanceof Error?cause.message:'Koneksi ruang terputus. Mencoba lagi…');};
 function peer(memberId:string){
 const existing=peers.current.get(memberId);if(existing)return existing;
 const pc=new RTCPeerConnection({iceServers:ice.current});const p={pc,pending:[] as RTCIceCandidateInit[]};peers.current.set(memberId,p);
 (display.current||media.current)?.getVideoTracks().forEach(track=>pc.addTrack(track,media.current!));
 audio.current?.uplink.stream.getTracks().forEach(track=>pc.addTrack(track,media.current!));
 pc.onicecandidate=e=>{if(e.candidate&&!stopped)void act({action:'signal',recipient:memberId,signal:{candidate:e.candidate.toJSON()}}).catch(report);};
 pc.ontrack=e=>{if(!stopped){setStreams(old=>({...old,[memberId]:e.streams[0]}));if(e.track.kind==='audio'&&audio.current&&!audio.current.inputs.has(e.track.id)){const source=audio.current.context.createMediaStreamSource(new MediaStream([e.track]));source.connect(audio.current.input);audio.current.inputs.set(e.track.id,source);e.track.onended=()=>{source.disconnect();audio.current?.inputs.delete(e.track.id);};}}};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')report(new Error('Koneksi video gagal. Coba bergabung kembali. Jaringan ini mungkin memerlukan TURN.'));};
 return p;
 }
 async function poll(){
 try{
 const response=await apiFetch(`/api/meet?id=${id}&client=${client.current}&after=${cursor.current}`,{signal:controller.signal});
 const data=await response.json();if(!response.ok)throw new Error(data.error);if(stopped)return;
 setRoom(data.room);setMembers(data.members);
 for(const member of data.members as MeetMember[]){if(member.id===client.current)continue;if(!peers.current.has(member.id)){
 const p=peer(member.id);
 if(client.current<member.id){await p.pc.setLocalDescription(await p.pc.createOffer());await act({action:'signal',recipient:member.id,signal:{description:p.pc.localDescription}});}
 }}
 for(const [memberId,p] of peers.current){if(!data.members.some((m:MeetMember)=>m.id===memberId)){p.pc.close();peers.current.delete(memberId);setStreams(old=>{const next={...old};delete next[memberId];return next;});}}
 for(const event of data.events as MeetEvent[]){
 if(event.id<=cursor.current)continue;
 if(event.kind==='signal'&&event.sender!==client.current&&data.members.some((m:MeetMember)=>m.id===event.sender)){
 const p=peer(event.sender),payload=event.payload as {description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit};
 if(payload.description){await p.pc.setRemoteDescription(payload.description);for(const c of p.pending)await p.pc.addIceCandidate(c);p.pending=[];
 if(payload.description.type==='offer'){await p.pc.setLocalDescription(await p.pc.createAnswer());await act({action:'signal',recipient:event.sender,signal:{description:p.pc.localDescription}});}}
 if(payload.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(payload.candidate);else p.pending.push(payload.candidate);}
 }else if(event.kind!=='signal')setEvents(old=>[...old,event].slice(-500));
 cursor.current=event.id;
 }
 }catch(cause){if(!controller.signal.aborted)report(cause);}
 if(!stopped)timer=setTimeout(()=>void poll(),1500);
 }
 let timer:ReturnType<typeof setTimeout>;void poll();return()=>{stopped=true;controller.abort();clearTimeout(timer);};
 // A joined room owns a single signaling loop. Requests read current refs.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[joined,id]);
 function toggle(kind:'audio'|'video'){const enabled=kind==='audio'?!mic:!camera;media.current?.getTracks().filter(t=>t.kind===kind).forEach(t=>{t.enabled=enabled;});if(kind==='audio')setMic(enabled);else setCamera(enabled);}
 async function leave(){close();setScreen(null);setJoined(false);setLocal(null);setStreams({});await act({action:'leave'}).catch(()=>{});}
 async function replaceVideo(track:MediaStreamTrack|null){await Promise.all([...peers.current.values()].map(({pc})=>{const sender=pc.getSenders().find(s=>s.track?.kind==='video');return sender?.replaceTrack(track);}));}
 async function stopScreen(){const previous=display.current;if(!previous)return;screenLock.current=true;setScreenBusy(true);try{display.current=null;previous.getTracks().forEach(t=>{t.onended=null;t.stop();});setScreen(null);await replaceVideo(media.current?.getVideoTracks()[0]||null).catch(()=>setError('Kamera belum pulih. Coba bergabung kembali.'));await act({action:'screen',open:false}).catch(()=>{});}finally{screenLock.current=false;setScreenBusy(false);}}
 async function shareScreen(){
 if(screenLock.current)return;
 if(display.current){await stopScreen();return;}
 if(!navigator.mediaDevices?.getDisplayMedia){setError('Berbagi layar belum didukung browser ini. Gunakan browser desktop; kamu tetap bisa melihat layar teman.');return;}
 screenLock.current=true;setScreenBusy(true);
 try{const captured=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1280},frameRate:{ideal:10,max:15}},audio:false});
 if(!alive.current||!media.current){captured.getTracks().forEach(t=>t.stop());return;}
 display.current=captured;const track=captured.getVideoTracks()[0];if(!track)throw new Error('Layar belum dapat dibagikan.');
 track.onended=()=>void stopScreen();await replaceVideo(track);await act({action:'screen',open:true});setScreen(captured);
 }catch(cause){await stopScreen();if(!(cause instanceof DOMException&&cause.name==='NotAllowedError'))setError('Layar belum dapat dibagikan. Coba pilih tab atau jendela lain.');}
 finally{screenLock.current=false;setScreenBusy(false);}
 }
 function broadcastTutor(stream:MediaStream){const a=audio.current;if(!a)return;a.source?.disconnect();a.source=a.context.createMediaStreamSource(stream);a.source.connect(a.output);}
 function stopTutorAudio(){audio.current?.source?.disconnect();}
 const screenStates=new Map<string,MeetEvent>();for(const event of events)if(event.kind==='screen')screenStates.set(event.sender,event);
 const presenter=[...screenStates.values()].filter(e=>e.payload.active===true&&members.some(m=>m.id===e.sender)).sort((a,b)=>b.id-a.id)[0];
 const sharedScreen=screen|| (presenter&&presenter.sender!==clientId?streams[presenter.sender]:null);
 const screenName=screen?'Kamu':members.find(m=>m.id===presenter?.sender)?.name||'Peserta';
 return {joined,joining,error,setError,room,members,events,streams,local,mic,camera,relay,join,leave,toggle,act,clientId,tutorInput,broadcastTutor,stopTutorAudio,screen,sharedScreen,screenName,screenBusy,shareScreen};
}
