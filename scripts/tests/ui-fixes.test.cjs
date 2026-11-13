const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function loadTs() {
  const modules = new Map();
  function read(relative) {
    const cleanRel = relative.replace(/^@\//, "");
    const candidate = cleanRel.endsWith(".ts") ? cleanRel : `${cleanRel}.ts`;
    const filename = path.join(root, candidate);
    if (modules.has(filename)) return modules.get(filename);
    const mod = { exports: {} };
    modules.set(filename, mod.exports);
    const source = fs.readFileSync(filename, "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    const sandbox = {
      exports: mod.exports,
      module: mod,
      require: (name) => {
        if (name.startsWith("@/")) return read(name);
        if (name.startsWith(".")) {
          const resolved = path.relative(root, path.resolve(path.dirname(filename), name)).replaceAll("\\", "/");
          return read(resolved);
        }
        return require(name);
      },
      URLSearchParams,
      Date,
      Math,
      Object,
      Array,
      Number,
      String,
      Boolean,
      encodeURIComponent,
      Intl,
    };
    vm.runInNewContext(code, sandbox, { filename });
    return mod.exports;
  }
  return read;
}

test("profileChecklist routes 'Preferensi belajarmu' directly to preference onboarding focus", () => {
  const load = loadTs();
  const { profileChecklist } = load("lib/profileChecklist");
  const items = profileChecklist({
    name: "Rafa",
    username: "rafa_ai",
    profileData: { education: "kuliah", grade: "Semester 4", school: "ITB" },
  });
  const pref = items.find((item) => item.id === "preferences");
  assert.ok(pref);
  assert.equal(pref.done, false);
  assert.equal(pref.href, "/onboarding?resume=1&focus=preferences");
});

test("parseOnboardingQuery and resolveOnboardingStartStep jump straight to preferences without step-0 restart", () => {
  const load = loadTs();
  const {
    parseOnboardingQuery,
    firstPreferenceStepIndex,
    resolveOnboardingStartStep,
    extractOnboardingPatch,
    buildOnboardingProfilePayload,
  } = load("lib/onboardingResume");
  const { ONBOARDING_STEPS, PSY_QUESTIONS } = load("lib/onboardingContent");

  assert.deepEqual({ ...parseOnboardingQuery("?resume=1&focus=preferences") }, {
    resumeMode: true,
    focus: "preferences",
  });
  assert.deepEqual({ ...parseOnboardingQuery("?focus=preferences") }, {
    resumeMode: true,
    focus: "preferences",
  });
  assert.deepEqual({ ...parseOnboardingQuery("") }, {
    resumeMode: false,
    focus: null,
  });

  const prefStart = firstPreferenceStepIndex();
  assert.equal(ONBOARDING_STEPS[prefStart].key, "psyTest");
  assert.ok(prefStart > 0);

  // Even when identity fields are blank, focus=preferences starts at first psyTest step, never name/intro.
  assert.equal(
    resolveOnboardingStartStep({ name: "", username: "", profileData: {} }, "preferences"),
    prefStart
  );

  // Skips answered psyTest questions and lands on first unanswered question.
  const partialPsy = {
    [PSY_QUESTIONS[0].id]: "visual",
    [PSY_QUESTIONS[1].id]: "soal",
  };
  const nextPsyIdx = resolveOnboardingStartStep(
    { name: "Rafa", username: "rafa_ai", profileData: { psyAnswers: partialPsy } },
    "preferences"
  );
  assert.equal(ONBOARDING_STEPS[nextPsyIdx].key, "psyTest");
  assert.equal(ONBOARDING_STEPS[nextPsyIdx].psyIndex, 2);

  // Lands on weakTopic when all psyQuestions are already filled.
  const allPsy = Object.fromEntries(PSY_QUESTIONS.map((q) => [q.id, q.options[0].trait]));
  const weakIdx = resolveOnboardingStartStep(
    { name: "Rafa", username: "rafa_ai", profileData: { psyAnswers: allPsy } },
    "preferences"
  );
  assert.equal(ONBOARDING_STEPS[weakIdx].key, "weakTopic");

  // Generic resume skips non-student school & grade when education is 'lainnya'.
  const genericIdx = resolveOnboardingStartStep(
    { name: "Rafa", username: "rafa_ai", profileData: { education: "lainnya" } },
    null
  );
  assert.equal(genericIdx, prefStart);

  // Hydrates patch and avoids sending empty username/name during partial resume saves.
  const patch = extractOnboardingPatch({
    name: " Rafa ",
    username: "",
    profileData: { education: "sma", school: " SMA 1 ", psyAnswers: { q1: "visual" } },
  });
  assert.equal(patch.name, "Rafa");
  assert.equal(patch.username, undefined);
  assert.equal(patch.school, "SMA 1");

  const safeBody = buildOnboardingProfilePayload({
    userId: "u1",
    email: "u@example.com",
    data: {
      name: "",
      username: "",
      education: "",
      school: "",
      grade: "",
      psyAnswers: { [PSY_QUESTIONS[0].id]: "visual" },
      weakTopic: "matematika",
      learningHabit: "",
      peakHour: "",
    },
    cleanUsername: "",
    onboardingCompleted: true,
  });
  assert.equal("username" in safeBody, false);
  assert.equal("name" in safeBody, false);
  assert.equal(safeBody.profileData.weakTopic, "matematika");
});

test("agenticGreeting adapts to activities, due flashcards, recent sessions, mode, effort, and time of day", () => {
  const load = loadTs();
  const { buildAgenticCandidates, selectAgenticGreeting } = load("lib/dashboard/agenticGreeting");

  const morning = new Date(2026, 10, 13, 8, 30, 0);
  const dueResult = selectAgenticGreeting({
    userName: "Rafa Pratama",
    now: morning,
    mode: "ask",
    effort: "Seimbang",
    stats: { streak: 4, level: 3, dueCards: 5, nextDueNoteId: "n-due" },
    recentNotes: [{ id: "n-1", title: "Termodinamika Lanjut", subject: "Fisika" }],
    recentSessions: [{ id: "s-1", title: "Hukum II Termodinamika", updatedAt: new Date(2026, 10, 13, 7, 0, 0).toISOString() }],
    profile: {
      name: "Rafa Pratama",
      profileData: { weakTopic: "matematika", learningHabit: "latihan_soal", peakHour: "pagi" },
    },
  });

  assert.equal(dueResult.id, "due-cards");
  assert.match(dueResult.headline, /Rafa/);
  assert.match(dueResult.headline, /5 kartu/);
  assert.match(dueResult.eyebrow, /Jam fokus favoritmu/);
  assert.equal(dueResult.primaryAction.href, "/dashboard-v2/note/n-due/flashcards");
  assert.equal(dueResult.secondaryAction.href, "/dashboard-v2/note/n-due/quiz");

  const legacyStats = selectAgenticGreeting({
    mode: "ask",
    effort: "Seimbang",
    stats: { dueCards: 5 },
    recentNotes: [{ id: "n-1", title: "Catatan tanpa kartu jatuh tempo" }],
  });
  assert.equal(legacyStats.primaryAction.href, "/dashboard-v2/catatan");

  // Switching to Note mode reacts immediately at index 0.
  const noteModeResult = selectAgenticGreeting({
    userName: "Rafa",
    now: morning,
    mode: "note",
    effort: "Mendalam",
    stats: { dueCards: 5, totalNotes: 2 },
    recentNotes: [{ id: "n-1", title: "Kalkulus" }],
    recentSessions: [{ id: "s-1", title: "Integral Lipat", updatedAt: morning.toISOString() }],
    profile: { profileData: { learningHabit: "ringkasan" } },
  });
  assert.equal(noteModeResult.id, "mode-note");
  assert.equal(noteModeResult.primaryAction.mode, "note");
  assert.match(noteModeResult.primaryAction.label, /Integral Lipat/);

  // Recent chat session points to valid /dashboard-v2/tanya-momo/<id> route.
  const candidates = buildAgenticCandidates({
    userName: "Rafa",
    now: new Date(2026, 10, 13, 21, 0, 0),
    mode: "ask",
    effort: "Mendalam",
    stats: { dueCards: 0, streak: 1 },
    recentSessions: [{ id: "sess-abc", title: "Aljabar Linear Vektor", updatedAt: new Date(2026, 10, 13, 19, 0, 0).toISOString() }],
    profile: { profileData: { weakTopic: "matematika", peakHour: "malam" } },
  });

  const sessionCard = candidates.find((c) => c.id === "recent-session");
  assert.ok(sessionCard);
  assert.equal(sessionCard.primaryAction.href, "/dashboard-v2/tanya-momo/sess-abc");

  const longTitle = "Setup Google Colab untuk Fine-tuning Model Bahasa";
  const noteCard = buildAgenticCandidates({
    mode: "ask",
    effort: "Seimbang",
    recentNotes: [{ id: "n-1", title: longTitle, subject: "Umum" }],
  }).find((candidate) => candidate.id === "recent-note");
  assert.equal(noteCard.headline, "Mau latihan dari catatanmu?");
  assert.equal(noteCard.subline, longTitle);
  assert.equal(noteCard.eyebrow, "Catatan terbarumu");

  const deepCard = candidates.find((c) => c.id === "effort-deep");
  assert.ok(deepCard);
  assert.match(deepCard.subline, /Matematika & hitungan/);

  // Generic 'Aktivitas belajar' labels should stay concise without repeating 'Aktivitas belajar'.
  const recentActivityResult = selectAgenticGreeting({
    userName: "riftyxso",
    now: morning,
    mode: "ask",
    effort: "Seimbang",
    stats: {
      level: 3,
      dueCards: 0,
      recentActivity: [{ date: morning.toISOString(), xp: 10, label: "Aktivitas belajar" }],
    },
  });
  assert.equal(recentActivityResult.id, "recent-activity");
  assert.doesNotMatch(recentActivityResult.subline, /Aktivitas terakhir: Aktivitas belajar/i);
  assert.ok(recentActivityResult.headline.length <= 48);
  assert.ok(recentActivityResult.subline.length <= 64);

  // Rotation advances across personalized cards automatically.
  const first = selectAgenticGreeting({
    userName: "Rafa",
    now: morning,
    mode: "ask",
    effort: "Kilat",
    stats: { dueCards: 2 },
    rotationIndex: 0,
  });
  const second = selectAgenticGreeting({
    userName: "Rafa",
    now: morning,
    mode: "ask",
    effort: "Kilat",
    stats: { dueCards: 2 },
    rotationIndex: 1,
  });
  assert.notEqual(first.id, second.id);

  // Dashboard V2 hero auto-rotates without rendering a manual refresh button.
  const dashboardSrc = fs.readFileSync(path.join(root, "app/dashboard-v2/page.tsx"), "utf8");
  assert.doesNotMatch(dashboardSrc, /dv2-greeting-cycle|RotateCw/);
});

test("Effort slider max state and permanent ProfileChecklist dismissal guards exist in UI sources", () => {
  const promptBarJsx = fs.readFileSync(path.join(root, "components/asisten/reactbits/PromptBar.jsx"), "utf8");
  const promptBarCss = fs.readFileSync(path.join(root, "components/asisten/reactbits/PromptBar.css"), "utf8");
  const checklistTsx = fs.readFileSync(path.join(root, "components/tutorial/ProfileChecklist.tsx"), "utf8");

  assert.match(promptBarJsx, /sparkColor === 'transparent'/);
  assert.match(promptBarJsx, /'--pb-effort-accent': effortAccent/);
  assert.match(promptBarCss, /var\(--pb-effort-accent/);
  assert.match(checklistTsx, /eureka:profile-checklist:dismissed:/);
  assert.match(checklistTsx, /if \(!loaded \|\| dismissed \|\| !profile\) return null;/);
  assert.match(checklistTsx, /dismissPermanently/);
});
