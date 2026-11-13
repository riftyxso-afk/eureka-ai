export type ChecklistProfile = { name?: string; username?: string; profileData?: Record<string, unknown> };
export function profileChecklist(profile: ChecklistProfile) {
  const data = profile.profileData ?? {};
  const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const student = data.education !== "lainnya";
  return [
    { id: "identity", label: "Nama dan username", done: filled(profile.name) && filled(profile.username), href: "/dashboard-v2/profil#profile-name" },
    { id: "education", label: student ? "Jenjang dan kelas / semester" : "Jenjang pendidikan", done: filled(data.education) && (!student || filled(data.grade)), href: "/dashboard-v2/profil#profile-education" },
    ...(student ? [{ id: "school", label: "Sekolah atau kampus", done: filled(data.school), href: "/dashboard-v2/profil#profile-school" }] : []),
    { id: "preferences", label: "Preferensi belajarmu", done: filled(data.weakTopic) && filled(data.learningHabit) && filled(data.peakHour) && Boolean(data.psyAnswers && typeof data.psyAnswers === "object" && Object.keys(data.psyAnswers).length), href: "/onboarding?resume=1&focus=preferences" },
  ];
}
