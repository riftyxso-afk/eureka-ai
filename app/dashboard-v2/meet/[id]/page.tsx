import MeetRoom from '@/components/meet/MeetRoom';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{invite?:string}>}){
 const {id}=await params;const {invite}=await searchParams;return <MeetRoom id={id} invite={invite||''}/>;
}
