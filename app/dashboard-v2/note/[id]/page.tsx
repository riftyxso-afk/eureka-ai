import { studyRoomTab } from "@/lib/studyRoom";
import StudyRoom from "@/components/dashboard/StudyRoom";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; chapter?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const chapter = query.chapter && /^\d+$/.test(query.chapter) ? Number(query.chapter) : null;
  return <StudyRoom key={id} noteId={id} initialTab={studyRoomTab(query.tab)} initialChapter={chapter} />;
}
