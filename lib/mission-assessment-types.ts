export type MissionQuestion =
  | { id: number; type: "abc"; prompt: string; options: string[] }
  | { id: number; type: "essay"; prompt: string };

export type MissionGrade = {
  id: number;
  status: "benar" | "sebagian" | "salah" | "tidak terbaca";
  feedback: string;
};

export type MissionAssessment = { quizToken: string; questions: MissionQuestion[] };
