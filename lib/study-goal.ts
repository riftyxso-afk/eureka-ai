export const studyTargets = [0, 1, 3, 7, 14, 30] as const;
export function studyGoalPrompt(prompt: string, days: number) {
  const text = prompt.trim();
  return studyTargets.includes(days as typeof studyTargets[number]) && days > 0
    ? `${text}\n\nSusun rencana belajar selama ${days} hari dengan langkah bertahap dan latihan pemahaman. Sesuaikan beban belajar dengan topik; tanyakan tingkat pemahamanku bila belum jelas.`
    : text;
}
