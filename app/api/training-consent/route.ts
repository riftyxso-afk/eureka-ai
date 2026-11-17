import {NextRequest} from 'next/server';
import {z} from 'zod';
import {requireAuth} from '@/lib/assistant/auth';
import {getSession,getMessages} from '@/lib/assistant/store';
import {db} from '@/lib/supabase/admin';
import {trainingPair} from '@/lib/trainingPair';
import { connectorById } from "@/lib/connectors/catalog";
import {checkRateLimit,ensureRateLimitPrune} from '@/lib/rateLimit';
export const runtime='nodejs';
export async function GET(req:NextRequest){const auth=await requireAuth(req.headers.get('authorization'));if(!auth.userId)return Response.json({error:auth.error},{status:auth.status});const {data,error}=await db().from('ai_training_samples').select('id,status,consent_at,prompt').eq('user_id',auth.userId).order('consent_at',{ascending:false}).limit(30);return error?Response.json({error:'Kontribusi belum dimuat.'},{status:503}):Response.json({samples:data,trainingAvailable:false},{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });

  const input = z.object({
    action: z.enum(["preview", "approve"]),
    sessionId: z.string().uuid(),
    answer: z.string().min(30).max(60_000),
    consentVersion: z.literal("shared-model-training-v1").optional(),
  }).safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Contoh tidak valid." }, { status: 400 });
  const { action, sessionId, answer, consentVersion } = input.data;
  if (action === "approve" && !consentVersion) {
    return Response.json({ error: "Persetujuan eksplisit diperlukan." }, { status: 400 });
  }

  ensureRateLimitPrune();
  if (!checkRateLimit("training-consent:" + auth.userId, 40, 3_600_000).ok) {
    return Response.json({ error: "Coba lagi nanti." }, { status: 429 });
  }
  if (!await getSession(sessionId, auth.userId)) {
    return Response.json({ error: "Percakapan tidak ditemukan." }, { status: 404 });
  }

  const messages = await getMessages(sessionId, auth.userId);
  const index = messages.findLastIndex(message => message.role === "assistant" && message.content === answer);
  if (index < 1) {
    return Response.json({ error: "Jawaban tersimpan tidak ditemukan. Muat ulang percakapan." }, { status: 404 });
  }
  // Follow-up answers can contain Google data from earlier turns in either mode.
  const usesGoogle = messages.slice(0, index + 1).some(message =>
    (message.toolCalls ?? []).concat(message.study?.toolCalls ?? [])
      .some(call => connectorById(call.provider)?.group === "google"));
  if (usesGoogle) {
    return Response.json({ error: "Percakapan yang menggunakan konektor Google tidak dapat dikontribusikan untuk pelatihan AI." }, { status: 403 });
  }

  const user = messages.slice(0, index).findLast(message => message.role === "user");
  if (!user) return Response.json({ error: "Pertanyaan asal tidak ditemukan." }, { status: 404 });

  try {
    const pair = trainingPair(user.content, messages[index].content);
    if (action === "preview") return Response.json(pair, { headers: { "Cache-Control": "private, no-store" } });
    const { error } = await db().from("ai_training_samples").upsert({
      ...pair, user_id: auth.userId, session_id: sessionId, message_id: messages[index].id, consent_version: consentVersion,
    }, { onConflict: "user_id,sample_hash", ignoreDuplicates: true });
    if (error) throw error;
    return Response.json({ ok: true, status: "consented", message: "Contoh disetujui untuk dataset. Pelatihan belum dijalankan." });
  } catch (cause) {
    const error = cause instanceof Error && cause.message.startsWith("Contoh") ? cause.message : "Contoh belum tersimpan.";
    return Response.json({ error }, { status: 400 });
  }
}
export async function DELETE(req:NextRequest){const auth=await requireAuth(req.headers.get('authorization'));if(!auth.userId)return Response.json({error:auth.error},{status:auth.status});const id=z.string().uuid().safeParse(req.nextUrl.searchParams.get('id'));if(!id.success)return Response.json({error:'Contoh tidak valid.'},{status:400});const {data,error}=await db().from('ai_training_samples').delete().eq('id',id.data).eq('user_id',auth.userId).in('status',['consented','reviewed']).select('id');if(error)return Response.json({error:'Contoh belum ditarik.'},{status:503});if(!data?.length)return Response.json({error:'Contoh tidak tersedia atau pelatihan sudah dimulai.'},{status:409});return Response.json({ok:true});}
