import { requireAuth, requirePro } from "@/lib/assistant/auth";
/** Development opens courses to signed-in testers; production retains the plan policy. */
export function requireCourseAccess(header: string | null) {
  return process.env.NODE_ENV === "development" ? requireAuth(header) : requirePro(header);
}
