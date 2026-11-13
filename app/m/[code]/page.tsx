import JoinMeet from '@/components/meet/JoinMeet';
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params;return <main style={{maxWidth:520,margin:'10vh auto',padding:24}}><h1>Undangan belajar bersama</h1><p>Masuk ke akun Eureka, lalu tekan Gabung ruang.</p><div className="meet-join-code"><JoinMeet initialCode={code}/></div></main>;}
