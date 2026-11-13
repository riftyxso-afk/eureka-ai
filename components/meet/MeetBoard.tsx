"use client";
import { lazy, Suspense, useState } from 'react';
import { BookOpen, Network, Pencil, X, AudioLines, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import MarkdownView from '@/components/asisten/MarkdownView';
import StudyMindmap from '@/components/dashboard/StudyMindmap';
import { boardMap, boardSections } from '@/lib/meetBoard';
import type { useMeet } from './useMeet';
import MeetRecap from './MeetRecap';
const DocumentEditor=lazy(()=>import('@/components/dashboard/DocumentEditor'));
export default function MeetBoard({meet,busy}:{meet:ReturnType<typeof useMeet>;busy:boolean}){
 const [view,setView]=useState<'document'|'map'|'edit'>('document'),[dirty,setDirty]=useState(false),[step,setStep]=useState(0);
 const [base,setBase]=useState('');const board=meet.room?.board||'',title=meet.room?.title||'Materi bersama';
 const sections=boardSections(board),index=Math.min(step,Math.max(0,sections.length-1));
 const progress=[...meet.events].reverse().find(e=>e.kind==='board-progress');
 const stage=String(progress?.payload.stage||'thinking');
 const status=stage==='saving'?'Menyimpan materi bersama…':stage==='writing'?'Menulis dan menyusun bagian materi…':'Memahami topik dan menyusun penjelasan…';
 function change(next:typeof view){if(dirty&&next!=='edit'){meet.setError('Simpan atau batalkan perubahan di editor terlebih dahulu.');return;}if(next==='edit')setBase(board);setView(next);}
 function explain(content:string){if(!meet.room?.voice_client){meet.setError('Mulai Lala atau Momo di panel voice untuk mendengar penjelasan.');return;}void meet.act({action:'tutor-question',text:`Jelaskan satu per satu dengan detail dan bahasa sederhana, berikan contoh konkret, lalu tanyakan satu pertanyaan pemahaman sebelum lanjut. Fokus bagian ini: ${content.slice(0,1600)}`}).catch(e=>meet.setError(e.message));}
 return <section className="meet-board meet-notebook" aria-label="Catatan dan papan tutor">
  <header className="meet-notebook-header"><div><small>CATATAN RUANG</small><strong>{title}</strong></div><button aria-label="Tutup papan" onClick={()=>{if(dirty){meet.setError('Simpan atau batalkan perubahan terlebih dahulu.');return;}void meet.act({action:'board',open:false}).catch(e=>meet.setError(e.message));}}><X size={18}/></button></header>
  <nav className="meet-notebook-tabs" aria-label="Tampilan papan"><button aria-pressed={view==='document'} onClick={()=>change('document')}><BookOpen size={15}/>Dokumen</button><button aria-pressed={view==='map'} onClick={()=>change('map')}><Network size={15}/>Peta konsep</button><button disabled={busy||!board} aria-pressed={view==='edit'} onClick={()=>change('edit')}><Pencil size={15}/>Edit</button><button disabled={!board||busy||dirty} className="meet-notebook-download" aria-label="Unduh materi Word" onClick={async()=>{const {downloadStudyDocx}=await import('@/lib/study-docx');downloadStudyDocx(title,board,[]);}}><Download size={15}/><span>Word</span></button></nav>
  {busy&&<div className="meet-board-generation" role="status"><span className="meet-writing-mark"><span/><span/><span/></span><div><strong>{status}</strong><small>{stage==='writing'?`${board.length.toLocaleString('id-ID')} karakter diterima · tersinkron ke peserta`:'Menunggu keluaran AI pertama'}</small></div><div className="meet-generation-lines" aria-hidden="true"><i/><i/><i/></div></div>}
  {!busy&&stage==='error'&&<p className="meet-board-warning">Pembuatan materi terhenti. Isi yang sudah diterima tetap ditampilkan; minta tutor melanjutkan.</p>}
  {view==='edit'?<Suspense fallback={<p>Menyiapkan editor…</p>}><DocumentEditor noteId="" title={title} content={base} label="Papan tutor bersama" onDirtyChange={setDirty} onSaved={()=>{setDirty(false);setView('document');}} saveOverride={async(content,original)=>{await meet.act({action:'board-save',content,original});return {title,content};}}/></Suspense>:<>
   {view==='map'?<StudyMindmap nodes={boardMap(board,title)} busy={busy} onExplore={explain}/>:<div className="meet-document"><MarkdownView content={board||'Mulai tutor suara, lalu minta Lala membuat materi di papan.'}/></div>}
   {!!sections.length&&!busy&&<div className="meet-explain-step"><div><small>BAHAS BERTAHAP · {index+1}/{sections.length}</small><strong>{sections[index].title}</strong></div><div><button disabled={index===0} aria-label="Bagian sebelumnya" onClick={()=>setStep(index-1)}><ChevronLeft size={17}/></button><button className="meet-explain-action" onClick={()=>explain(sections[index].content)}><AudioLines size={16}/>Jelaskan bagian ini</button><button disabled={index>=sections.length-1} aria-label="Bagian berikutnya" onClick={()=>setStep(index+1)}><ChevronRight size={17}/></button></div></div>}
   <details className="meet-board-share"><summary>Bagikan hasil belajar</summary><MeetRecap title={title} material={board}/></details>
  </>}
 </section>;
}
