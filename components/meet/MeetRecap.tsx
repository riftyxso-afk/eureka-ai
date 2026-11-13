"use client";
import {useRef,useState} from 'react';
import {Share2} from 'lucide-react';
export default function MeetRecap({title,material}:{title:string;material:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const card=useRef<HTMLDivElement>(null);
 async function share(){if(!card.current||busy)return;setBusy(true);setError('');try{
 const {toBlob}=await import('html-to-image');const blob=await toBlob(card.current,{pixelRatio:2,backgroundColor:'#7548c1'});if(!blob)throw new Error('Kartu belum bisa dibuat');
 const file=new File([blob],'belajar-bersama-eureka.png',{type:'image/png'});
 if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Hari ini aku belajar',text:'Belajar bersama Momo di Eureka'});
 else {const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError('Kartu belum bisa dibagikan. Coba lagi.');}finally{setBusy(false);}}
 return <div className="meet-recap"><button disabled={!material} onClick={()=>setOpen(!open)}><Share2 size={16}/>Kartu belajarku</button>{open&&<div>
 <p>Pratinjau sebelum dibagikan. Periksa isi materi yang akan terlihat oleh orang lain.</p>
 <div ref={card} className="meet-recap-card"><span>eureka! / belajar bersama</span><img src="/icons/momo-192.png" width={72} height={72} alt="Momo"/><small>HARI INI AKU BELAJAR</small><h2>{title}</h2><p>{material.replace(/[#*`>|]/g,'').slice(0,220)}</p><footer>Bareng Momo, pelan-pelan jadi paham.<br/>eureka-ai.web.id</footer></div>
 <button disabled={busy} onClick={()=>void share()}>{busy?'Menyiapkan kartu…':'Bagikan / unduh gambar'}</button>{error&&<p role="alert">{error}</p>}</div>}</div>;
}
