import StudyRoom from "@/components/dashboard/StudyRoom";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudyRoom noteId={id} initialTab="quiz" />;
}
