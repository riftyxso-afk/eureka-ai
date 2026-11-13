import { ONBOARDING_STEPS, PSY_QUESTIONS, isUsernameValid, normalizeUsername } from "./onboardingContent";

export type OnboardingFocus = "preferences" | null;

export interface OnboardingQuery {
  resumeMode: boolean;
  focus: OnboardingFocus;
}

export interface ResumeUserProfile {
  name?: string | null;
  username?: string | null;
  profileData?: Record<string, unknown> | null;
}

export interface OnboardingStateSnapshot {
  name: string;
  username: string;
  education?: string;
  school?: string;
  grade?: string;
  psyAnswers?: Record<string, string>;
  weakTopic?: string;
  learningHabit?: string;
  peakHour?: string;
}

const filled = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function parseOnboardingQuery(search: string): OnboardingQuery {
  try {
    const params = new URLSearchParams(search);
    const resumeMode = params.get("resume") === "1";
    const rawFocus = params.get("focus");
    const focus: OnboardingFocus = rawFocus === "preferences" ? "preferences" : null;
    return { resumeMode: resumeMode || focus === "preferences", focus };
  } catch {
    return { resumeMode: false, focus: null };
  }
}

export function firstPreferenceStepIndex(): number {
  const psyIdx = ONBOARDING_STEPS.findIndex((s) => s.key === "psyTest");
  if (psyIdx >= 0) return psyIdx;
  const weakIdx = ONBOARDING_STEPS.findIndex((s) => s.key === "weakTopic");
  return weakIdx >= 0 ? weakIdx : 0;
}

function isStepDone(
  index: number,
  user: ResumeUserProfile,
  data: Record<string, unknown>
): boolean {
  const step = ONBOARDING_STEPS[index];
  if (!step) return true;
  const psyAnswers =
    data.psyAnswers && typeof data.psyAnswers === "object"
      ? (data.psyAnswers as Record<string, unknown>)
      : {};
  const isNonStudent = data.education === "lainnya";

  switch (step.key) {
    case "name":
      return filled(user.name) && user.name.trim().length >= 2;
    case "username":
      return filled(user.username) && isUsernameValid(normalizeUsername(user.username));
    case "education":
      return filled(data.education);
    case "school":
      return isNonStudent || filled(data.school);
    case "grade":
      return isNonStudent || filled(data.grade);
    case "psyTest": {
      const q = step.psyIndex != null ? PSY_QUESTIONS[step.psyIndex] : null;
      return q ? filled(psyAnswers[q.id]) : true;
    }
    case "weakTopic":
      return filled(data.weakTopic);
    case "learningHabit":
      return filled(data.learningHabit);
    case "peakHour":
      return filled(data.peakHour);
    default:
      return false;
  }
}

export function resolveOnboardingStartStep(
  user: ResumeUserProfile | null | undefined,
  focus: OnboardingFocus
): number {
  const safeUser: ResumeUserProfile = user ?? {};
  const data = (safeUser.profileData ?? {}) as Record<string, unknown>;
  const prefStart = firstPreferenceStepIndex();

  if (focus === "preferences") {
    for (let i = prefStart; i < ONBOARDING_STEPS.length; i += 1) {
      if (!isStepDone(i, safeUser, data)) return i;
    }
    return prefStart;
  }

  for (let i = 0; i < ONBOARDING_STEPS.length; i += 1) {
    if (!isStepDone(i, safeUser, data)) return i;
  }
  return prefStart;
}

export function extractOnboardingPatch(
  user: ResumeUserProfile | null | undefined
): Partial<OnboardingStateSnapshot> {
  if (!user) return {};
  const data = (user.profileData ?? {}) as Record<string, unknown>;
  const patch: Partial<OnboardingStateSnapshot> = {};

  if (filled(user.name)) patch.name = user.name.trim();
  if (filled(user.username)) patch.username = user.username.trim();
  if (filled(data.education)) patch.education = data.education;
  if (filled(data.school)) patch.school = data.school.trim();
  if (filled(data.grade)) patch.grade = data.grade;
  if (data.psyAnswers && typeof data.psyAnswers === "object") {
    const cleanAnswers: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.psyAnswers as Record<string, unknown>)) {
      if (filled(v)) cleanAnswers[k] = v;
    }
    if (Object.keys(cleanAnswers).length > 0) patch.psyAnswers = cleanAnswers;
  }
  if (filled(data.weakTopic)) patch.weakTopic = data.weakTopic;
  if (filled(data.learningHabit)) patch.learningHabit = data.learningHabit;
  if (filled(data.peakHour)) patch.peakHour = data.peakHour;

  return patch;
}

export function buildOnboardingProfilePayload(args: {
  userId: string;
  email: string;
  data: OnboardingStateSnapshot;
  cleanUsername: string;
  analysis?: unknown;
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  plan?: "pro" | "free";
}): Record<string, unknown> {
  const { userId, email, data, cleanUsername, analysis, onboardingCompleted, onboardingSkipped, plan } = args;
  const profileData: Record<string, unknown> = {};

  if (filled(data.education)) profileData.education = data.education;
  if (filled(data.school)) profileData.school = data.school.trim();
  if (filled(data.grade)) profileData.grade = data.grade;
  if (data.psyAnswers && Object.keys(data.psyAnswers).length > 0) {
    profileData.psyAnswers = data.psyAnswers;
  }
  if (filled(data.weakTopic)) profileData.weakTopic = data.weakTopic;
  if (filled(data.learningHabit)) profileData.learningHabit = data.learningHabit;
  if (filled(data.peakHour)) profileData.peakHour = data.peakHour;
  if (analysis !== undefined && analysis !== null) profileData.analysis = analysis;
  if (typeof onboardingSkipped === "boolean") {
    profileData.onboardingSkipped = onboardingSkipped;
  }

  const payload: Record<string, unknown> = {
    userId,
    email,
    profileData,
  };
  if (filled(data.name) && data.name.trim().length >= 2) {
    payload.name = data.name.trim();
  }
  if (isUsernameValid(cleanUsername)) {
    payload.username = cleanUsername;
  }
  if (typeof onboardingCompleted === "boolean") {
    payload.onboardingCompleted = onboardingCompleted;
  }
  if (plan) {
    payload.plan = plan;
  }
  return payload;
}
