export function isDashboardV2(pathname: string) {
  return /^\/(?:id\/|en\/)?dashboard-v2(?:\/|$)/.test(pathname);
}

export function v2NotePath(noteId: string, chapterId?: number) {
  const path = `/dashboard-v2/note/${encodeURIComponent(noteId)}`;
  return chapterId != null && chapterId > 0 ? `${path}?tab=notes&chapter=${chapterId}` : path;
}
