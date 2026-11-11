import { NextRequest, NextResponse } from "next/server";
import { requirePro } from "@/lib/assistant/auth";
import { listFriends } from "@/lib/friends-store";
import { pushNotification, listNotifications } from "@/lib/notifications-store";
import { POST as shareNote } from "@/app/api/notes/[id]/share/route";
import { POST as shareChat } from "@/app/api/assistant/sessions/[sessionId]/share/route";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const auth = await requirePro(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({error:auth.error},{status:auth.status});
  try { return NextResponse.json({friends: await listFriends(auth.userId), items:(await listNotifications(auth.userId,100)).filter(item => item.type === "mention" && item.link?.startsWith("/share/"))}); }
  catch { return NextResponse.json({error:"Kiriman belum bisa dimuat."},{status:500}); }
}
export async function POST(req: NextRequest) {
  const auth = await requirePro(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({error:auth.error},{status:auth.status});
  try {
    const body = await req.json();
    if (!['note','chat'].includes(body.kind) || typeof body.id !== 'string' || body.id.length > 100) return NextResponse.json({error:"Pilih materi yang ingin dikirim."},{status:400});
    const friends = await listFriends(auth.userId);
    if (!friends.some(friend => friend.id === body.friendId)) return NextResponse.json({error:"Penerima harus sudah menjadi teman."},{status:403});
    const request = new NextRequest(req.url,{method:'POST',headers:{authorization:req.headers.get('authorization') || '', 'Content-Type':'application/json'},body:JSON.stringify({userId:auth.userId})});
    const shared = body.kind === 'note' ? await shareNote(request,{params:Promise.resolve({id:body.id})}) : await shareChat(request,{params:Promise.resolve({sessionId:body.id})});
    const data = await shared.json();
    if (!shared.ok) return NextResponse.json(data,{status:shared.status});
    const link = new URL(data.url).pathname;
    await pushNotification(body.friendId,{type:'mention',title:body.kind === 'note' ? 'Catatan dari teman' : 'Percakapan AI dari teman',message:typeof body.message === 'string' ? body.message.trim().slice(0,500) || 'Temanmu membagikan materi untuk dipelajari bersama.' : 'Temanmu membagikan materi untuk dipelajari bersama.',link});
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:'Kiriman gagal. Coba lagi.'},{status:500}); }
}
