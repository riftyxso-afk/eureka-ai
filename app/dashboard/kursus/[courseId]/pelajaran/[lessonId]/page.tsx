import { redirect } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  redirect(`/dashboard-v2/kursus/${encodeURIComponent(courseId)}/pelajaran/${encodeURIComponent(lessonId)}`);
}
