import { z } from "zod";

export const studyInteractionSchema = z.object({
  question: z.object({
    prompt: z.string().min(5).max(500),
    options: z.array(z.string().min(1).max(240)).length(4),
    correct: z.number().int().min(0).max(3),
    explanation: z.string().min(5).max(900),
  }).optional(),
  steps: z.array(z.string().min(3).max(240)).max(7),
  suggestions: z.array(z.string().min(5).max(240)).max(3),
});

export type StudyInteraction = z.infer<typeof studyInteractionSchema>;
export type SavedStudyResponse = {
  title: string;
  document: boolean;
  interaction: StudyInteraction;
};
