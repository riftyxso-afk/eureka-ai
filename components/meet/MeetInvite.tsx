"use client";
import {useEffect,useState,useRef} from 'react';
import Image from 'next/image';
export default function MeetInvite({code,onClose}:{code:string;onClose:()=>void}){
 const [qr,setQr]=useState(''),[error,setError]=useState(''),[url,setUrl]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 useEffect(()=>{let active=true;const link=`${location.origin}/m/${code}`;setUrl(link);import('qrcode').then(q=>q.toDataURL(link,{width:240,margin:4})).then(data=>{if(active)setQr(data);}).catch(()=>setError('QR belum dapat dibuat. Gunakan kode di bawah.'));return()=>{active=false;};},[code]);
 return <dialog ref={dialog} className="meet-invite" aria-label="Undang teman" onCancel={e=>{e.preventDefault();onClose();}}><header><strong>Belajar bareng, lebih gampang</strong><button onClick={onClose}>Tutup</button></header>{qr&&<Image src={qr} alt="QR undangan ruang belajar" width={240} height={240} unoptimized/>}<p>Pindai QR atau masukkan kode di menu Teman belajar.</p><strong className="meet-room-code">{code.match(/.{1,4}/g)?.join('-')}</strong><input readOnly value={url} aria-label="Tautan undangan pendek" onFocus={e=>e.target.select()}/><button onClick={async()=>{try{if(navigator.share)await navigator.share({title:'Belajar bersama Momo',url});else{await navigator.clipboard.writeText(url);setError('Tautan disalin.');}}catch{setError('Salin tautan dari kolom di atas.');}}}>Bagikan tautan</button>{error&&<p role="status">{error}</p>}</dialog>;
}
