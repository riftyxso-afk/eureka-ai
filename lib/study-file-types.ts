import { z } from "zod";

export const studyFileSchema = z.object({
  id: z.string().uuid(), name: z.string().min(1).max(160),
  mime: z.string().min(1).max(120), size: z.number().int().min(1).max(8 * 1024 * 1024),
});
export type StudyFile = z.infer<typeof studyFileSchema>;
