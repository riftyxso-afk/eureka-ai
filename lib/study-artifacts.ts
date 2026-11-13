import { z } from "zod";
import { db } from "@/lib/supabase/admin";

export const studyArtifactInput = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  content: z.string().min(1).max(60000),
});

export async function saveStudyArtifact(userId: string, input: z.infer<typeof studyArtifactInput>) {
  const { data, error } = await db().from("study_artifacts").insert({
    user_id: userId,
    session_id: input.sessionId,
    title: input.title,
    content: input.content,
  }).select("id,title,content,revision").single();
  if (error || !data) throw new Error("Artefak belum tersimpan.");
  return data;
}
