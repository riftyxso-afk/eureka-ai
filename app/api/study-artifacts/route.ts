import {NextRequest} from 'next/server';
import {requireAuth} from '@/lib/assistant/auth';
import {getSession} from '@/lib/assistant/store';
import {db} from '@/lib/supabase/admin';
import {saveStudyArtifact,studyArtifactInput} from '@/lib/study-artifacts';
import {z} from 'zod';
import {checkRateLimit,ensureRateLimitPrune} from '@/lib/rateLimit';
export const runtime='nodejs';
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });
  const sessionId = z.string().uuid().safeParse(req.nextUrl.searchParams.get("sessionId"));
  const artifactId = z.string().uuid().nullable().safeParse(req.nextUrl.searchParams.get("artifactId"));
  if (!sessionId.success || !artifactId.success) return Response.json({ error: "Percakapan atau artefak tidak valid." }, { status: 400 });

  const userId = auth.userId;
  const ownedArtifacts = () => db().from("study_artifacts").select("*").eq("user_id", userId).eq("session_id", sessionId.data);
  const { data, error } = await ownedArtifacts().order("updated_at", { ascending: false }).limit(30);
  if (error) return Response.json({ error: "Artefak belum dimuat." }, { status: 503 });
  if (artifactId.data && !data.some(artifact => artifact.id === artifactId.data)) {
    const { data: selected, error: selectionError } = await ownedArtifacts().eq("id", artifactId.data).maybeSingle();
    if (selectionError) return Response.json({ error: "Artefak belum dimuat." }, { status: 503 });
    if (!selected) return Response.json({ error: "Artefak tidak ditemukan." }, { status: 404 });
    data.push(selected);
  }
  return Response.json({ artifacts: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });
  const input = studyArtifactInput.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Isi artefak tidak valid." }, { status: 400 });
  if (!await getSession(input.data.sessionId, auth.userId)) return Response.json({ error: "Percakapan tidak ditemukan." }, { status: 404 });
  ensureRateLimitPrune();
  if (!checkRateLimit("study-artifact:" + auth.userId, 30, 3600000).ok) {
    return Response.json({ error: "Tunggu sebelum membuat artefak lagi." }, { status: 429 });
  }
  try {
    return Response.json(await saveStudyArtifact(auth.userId, input.data));
  } catch {
    return Response.json({ error: "Artefak belum tersimpan." }, { status: 503 });
  }
}
export async function PUT(req:NextRequest){const auth=await requireAuth(req.headers.get('authorization'));if(!auth.userId)return Response.json({error:auth.error},{status:auth.status});const b=z.object({id:z.string().uuid(),revision:z.number().int().min(1),content:z.string().max(60000)}).safeParse(await req.json().catch(()=>null));if(!b.success)return Response.json({error:'Perubahan tidak valid.'},{status:400});const {data,error}=await db().from('study_artifacts').update({content:b.data.content,revision:b.data.revision+1,updated_at:new Date().toISOString()}).eq('id',b.data.id).eq('user_id',auth.userId).eq('revision',b.data.revision).select('*').maybeSingle();if(error)return Response.json({error:'Perubahan belum tersimpan.'},{status:503});if(!data)return Response.json({error:'Artefak berubah atau tidak tersedia. Muat ulang sebelum mengedit.'},{status:409});return Response.json(data);}
