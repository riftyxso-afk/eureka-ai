"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Video} from 'lucide-react';
import {meetRequest} from './useMeet';
export default function CreateMeet(){const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[title,setTitle]=useState('Belajar bareng Momo');return <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',marginTop:16}}><label style={{display:'grid',gap:5,fontSize:13}}>Topik ruang<input style={{padding:'10px 12px',borderRadius:10,border:'1px solid currentColor',background:'transparent',minHeight:44,maxWidth:'100%'}} value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></label><button className="flow-button" disabled={busy||title.trim().length<3} onClick={async()=>{setBusy(true);setError('');try{const room=await meetRequest({action:'create',title:title.trim()});router.push(`/dashboard-v2/meet/${room.id}?invite=${room.invite}`);}catch(e){setError((e as Error).message);setBusy(false);}}}><Video size={20}/>{busy?'Membuka ruang…':'Buat ruang belajar · Beta'}</button>{error&&<p role="alert">{error}</p>}</div>;}
