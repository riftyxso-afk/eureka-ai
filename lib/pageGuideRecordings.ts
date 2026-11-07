import type { PageGuide, PageGuideId } from "./pageGuides";

const RECORDED_GUIDES = [
  "dashboard", "room-learn", "room-notes", "room-mindmap", "room-quiz", "room-cards",
  "room-sources", "room-ask", "room-podcast", "room-scratch", "chat", "library",
  "subjects", "missions", "schedule", "leaderboard", "profile", "courses", "settings",
  "streaks", "friends", "guide", "tasks", "music",
] as const satisfies readonly PageGuideId[];

export const PAGE_GUIDE_RECORDINGS = Object.fromEntries(
  RECORDED_GUIDES.map(id => [id, { src: `/tutorials/${id}.mp4`, poster: `/tutorials/${id}.webp` }]),
) as Partial<Record<PageGuideId, NonNullable<PageGuide["recording"]>>>;
