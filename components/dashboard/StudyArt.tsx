import Image from "next/image";

export type StudyArtName =
  | "map" | "friends" | "gear" | "search" | "invite" | "send" | "inbox" | "palette"
  | "profile" | "sun" | "moon" | "system" | "notebook" | "target" | "graduation" | "trophy";

export default function StudyArt({ name, size = 28 }: { name: StudyArtName; size?: number }) {
  return <Image className="study-art" src={`/dashboard-icons/study/${name}.webp`} alt="" width={size} height={size} unoptimized />;
}
