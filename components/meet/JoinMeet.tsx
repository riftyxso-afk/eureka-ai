"use client";
import "./meet.css";
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {meetRequest} from './useMeet';
export default function JoinMeet({initialCode=''}:{initialCode?:string}){const [code,setCode]=useState(initialCode),[error,setError]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await meetRequest({action:'resolve',code:code.replace(/[^a-f0-9]/gi,'').toUpperCase()});router.push(`/dashboard-v2/meet/${r.id}?invite=${r.invite}`);}catch(e){setError((e as Error).message);setBusy(false);}}}><label>Kode ruang<input value={code} onChange={e=>setCode(e.target.value)} placeholder="ABCD-1234-EF56" autoCapitalize="characters" maxLength={14}/></label><button className="flow-button" disabled={busy||code.replace(/[^a-f0-9]/gi,'').length!==12}>{busy?'Mencari ruang…':'Gabung ruang'}</button>{error&&<p role="alert">{error} <Link href={`/login?next=${encodeURIComponent('/m/'+code.replace(/[^a-f0-9]/gi,'').toUpperCase())}`}>Masuk akun Eureka</Link></p>}</form>;}
