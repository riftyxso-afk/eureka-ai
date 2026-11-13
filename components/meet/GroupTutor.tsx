"use client";
import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, AudioLines } from 'lucide-react';
import { useMomoCall, type CallProvider } from '@/components/assistant/useMomoCall';
import type { useMeet } from './useMeet';
import { getUserId } from '@/lib/identity';
import { meetGreeting, meetTutorContext } from '@/lib/meetTutor';
const labels = { idle: 'Siap menemani', permission: 'Memeriksa mikrofon', connecting: 'Menghubungkan', listening: 'Mendengarkan kalian', thinking: 'Memikirkan jawaban', searching: 'Mencari informasi', working: 'Menyiapkan papan', speaking: 'Sedang berbicara' };
export default function GroupTutor({ meet }: { meet: ReturnType<typeof useMeet> }) {
  const [provider, setProvider] = useState<CallProvider | null>(null);
  const [pending, setPending] = useState(false), [camera, setCamera] = useState(false), [lala, setLala] = useState(false);
  const latest = useRef(meet);
  useEffect(() => { latest.current = meet; }, [meet]);
  const hook = useMomoCall(() => { setProvider(null); latest.current.stopTutorAudio(); void latest.current.act({ action: 'voice', provider: null }).catch(() => {}); });
  const { sendVideoFrame, updateContext, level, sendText } = hook;
  const video = useRef<HTMLVideoElement>(null), orb = useRef<HTMLSpanElement>(null);
  const owner = meet.room?.owner_id === getUserId();
  const active = !!meet.room?.voice_client && meet.members.some(m => m.id === meet.room?.voice_client);
  const name = (provider || meet.room?.voice_provider) === 'momo' ? 'Momo' : 'Lala';
  const remote = [...meet.events].reverse().find(e => e.kind === 'tutor-state' && e.sender === meet.room?.voice_client);
  const remotePhase = String(remote?.payload.phase || 'listening') as keyof typeof labels;
  const phase = provider ? hook.phase : active ? remotePhase : 'idle';
  const caption = provider ? hook.reply : active ? String(remote?.payload.text || '') : '';
  const source = provider === 'lala' ? meet.sharedScreen || (camera ? meet.local : null) : null;
  useEffect(() => { let alive = true; import('@/lib/apiClient').then(({ apiFetch }) => apiFetch('/api/call/session')).then(r => r.json()).then(d => { if (alive) setLala(d.lala === true); }).catch(() => {}); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (hook.phase === 'idle' && provider && !pending) { setProvider(null); latest.current.stopTutorAudio(); void latest.current.act({ action: 'voice', provider: null }).catch(() => {}); }
  }, [hook.phase, provider, pending]);
  useEffect(() => {
    if (!source || provider !== 'lala') return;
    const canvas = document.createElement('canvas');
    const timer = setInterval(() => {
      const v = video.current; if (!v || v.readyState < 2 || !v.videoWidth) return;
      const scale = Math.min(768 / v.videoWidth, 768 / v.videoHeight);
      canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
      const c = canvas.getContext('2d'); if (!c) return;
      c.drawImage(v, 0, 0, canvas.width, canvas.height);
      sendVideoFrame(canvas.toDataURL('image/jpeg', .55).split(',')[1]);
    }, 1200);
    return () => clearInterval(timer);
  }, [source, provider, sendVideoFrame]);
  const context = meetTutorContext(meet.room?.title || 'Belajar kelompok', meet.room?.board || '', meet.members, meet.sharedScreen ? meet.screenName : undefined);
  const contextKey = JSON.stringify(context), lastContext = useRef('');
  const questionCursor = useRef(0);
  useEffect(() => {
    if (!provider || hook.phase !== 'listening') return;
    const next = meet.events.find(event => event.kind === 'tutor-question' && event.id > questionCursor.current);
    if (next && sendText(`${String(next.payload.name)} meminta: ${String(next.payload.text)}`)) questionCursor.current = next.id;
  }, [provider, hook.phase, sendText, meet.events]);
  useEffect(() => {
    if (!provider || hook.phase !== 'listening' || lastContext.current === contextKey) return;
    lastContext.current = contextKey;
    updateContext(JSON.parse(contextKey));
  }, [provider, hook.phase, contextKey, updateContext]);
  const state = useRef({ phase: hook.phase, text: hook.reply });
  useEffect(() => { state.current = { phase: hook.phase, text: hook.reply }; }, [hook.phase, hook.reply]);
  useEffect(() => {
    if (!provider) return;
    let last = '';
    const timer = setInterval(() => { const next = JSON.stringify(state.current); if (last === next) return; last = next; void latest.current.act({ action: 'tutor-state', ...state.current, text: state.current.text.slice(-6000) }).catch(() => {}); }, 2000);
    return () => clearInterval(timer);
  }, [provider]);
  useEffect(() => {
    let raf: number;
    const tick = () => { if (orb.current) orb.current.style.transform = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : `scale(${1 + (provider ? level() : phase === 'speaking' ? .5 : 0) * .16})`; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [level, provider, phase]);
  async function start(p: CallProvider) {
    if (pending || provider || !meet.tutorInput) return;
    setPending(true); meet.setError('');
    try {
      await meet.act({ action: 'voice', provider: p }); setProvider(p); lastContext.current = contextKey;
      questionCursor.current = Math.max(0, ...meet.events.map(event => event.id));
      await hook.start(p, context, { input: meet.tutorInput, greeting: meetGreeting(p, meet.members), onOutput: stream => latest.current.broadcastTutor(stream), onTutorRequest: async (prompt, action) => {
        if (/tutup.*papan/i.test(prompt)) { await latest.current.act({ action: 'board', open: false }); return 'Papan bersama sudah ditutup.'; }
        if (/buka.*papan/i.test(prompt) && !/buat|tulis|jelaskan/i.test(prompt)) { await latest.current.act({ action: 'board', open: true }); return 'Papan bersama sudah dibuka.'; }
        if (action === 'delete') return 'Penghapusan catatan pribadi tidak tersedia dari tutor kelompok.';
        if (action === 'read' || action === 'list') return latest.current.room?.board || 'Papan bersama masih kosong.';
        await latest.current.act({ action: 'ai', text: prompt }); return 'Materi sudah ditampilkan di papan bersama. Mari kita bahas langkah demi langkah.';
      } });
    } catch (e) { meet.setError((e as Error).message); setProvider(null); meet.stopTutorAudio(); await meet.act({ action: 'voice', provider: null }).catch(() => {}); }
    finally { setPending(false); }
  }
  function stop() { hook.stop(); meet.stopTutorAudio(); setProvider(null); setCamera(false); void meet.act({ action: 'voice', provider: null }).catch(e => meet.setError(e.message)); }
  return <aside className="meet-voice-panel" aria-label="Tutor voice kelompok">
    <header><span className="meet-voice-label"><AudioLines size={16}/> TEMAN BICARA</span><span className="meet-live-badge">{active || provider ? 'Live' : 'Voice'}</span></header>
    <div className="meet-voice-center"><div className="meet-orb-halo" data-active={phase === 'speaking'}><span ref={orb} className="meet-tutor-orb" data-provider={(provider || meet.room?.voice_provider) ?? 'lala'}/></div>
      <h2>{provider || active ? name : 'Belajar bareng Lala'}</h2><p className="meet-voice-status" role="status">{pending ? 'Menghubungkan teman bicara…' : labels[phase] || 'Mendengarkan kalian'}</p>
      <div className="meet-voice-people">{meet.members.map(m => <span key={m.id}>{m.name}</span>)}</div>
    </div>
    <div className="meet-voice-caption" aria-live="polite" aria-atomic="true"><p>{caption || (active || provider ? 'Bicara langsung. Tutor mendengar percakapan di ruang ini.' : 'Sapa Lala, tanyakan materi, atau minta penjelasan di papan bersama.')}</p></div>
    {meet.sharedScreen && <p className="meet-vision-status">{provider === 'lala' || (active && meet.room?.voice_provider === 'lala') ? `Lala dapat melihat layar ${meet.screenName}` : `Layar ${meet.screenName} dibagikan ke peserta`}</p>}
    <div className="meet-voice-controls">
      {owner && !provider && <><button className="meet-start-lala" disabled={pending || !lala || active} onClick={() => void start('lala')}><Phone size={17}/> Mulai Lala</button><button disabled={pending || active} onClick={() => void start('momo')}>Pakai Momo</button></>}
      {provider && <><button className="meet-end-tutor" onClick={stop}><PhoneOff size={17}/> Akhiri tutor</button>{provider === 'lala' && <button aria-pressed={camera} onClick={() => setCamera(!camera)}>{camera ? <VideoOff size={17}/> : <Video size={17}/>} {camera ? 'Hentikan kamera ke Lala' : 'Perlihatkan kamera ke Lala'}</button>}</>}
      {!owner && <small>{active ? 'Jawaban suara terdengar oleh semua peserta.' : 'Pembuat ruang dapat memulai tutor suara.'}</small>}
    </div>
    <p className="meet-voice-privacy">Saat aktif, suara ruang diproses AI. Lala juga melihat layar yang kalian bagikan. Gunakan headset.</p>
    {hook.error && <p role="alert" className="meet-notice">{hook.error}</p>}
    <video hidden muted autoPlay playsInline ref={el => { video.current = el; if (el && el.srcObject !== source) el.srcObject = source; }}/>
  </aside>;
}
