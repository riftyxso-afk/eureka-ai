import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function main() {
  const workspace = process.cwd();
  const directory = await mkdtemp(path.join(tmpdir(), "eureka-course-tests-"));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  Object.assign(process.env, { NODE_ENV: "development" });
  process.chdir(directory);
  try {
    const { CURATED_COURSES } = await import("../lib/courses/catalog");
    const { courseLessons } = await import("../lib/courses/types");
    const { normalizePersonalDraft } = await import("../lib/courses/generator");
    const service = await import("../lib/courses/server");
    const user = "course-test-owner";
    const course = CURATED_COURSES[0];
    const lessons = courseLessons(course);
    const first = lessons[0];
    const answers = Object.fromEntries(first.questions.map((question) => [question.id, question.answer]));
    await assert.rejects(service.submitAttempt(user, course.id, first.id, answers, "not-enrolled-01"), /Ikuti kursus/);
    await service.enrollInCourse(user, course.id);
    const wrong = Object.fromEntries(first.questions.map((question) => [question.id, (question.answer + 1) % 4]));
    const failed = await service.submitAttempt(user, course.id, first.id, wrong, "wrong-attempt-01");
    assert.equal(failed.passed, false);
    assert.equal(failed.progress.percent, 0);
    const passed = await service.submitAttempt(user, course.id, first.id, answers, "passing-attempt-01");
    assert.equal(passed.score, 100);
    assert.equal(passed.progress.percent, 25);
    assert.equal(passed.xpAwarded, 0, "development local storage must not claim account XP");
    const retry = await service.submitAttempt(user, course.id, first.id, wrong, "passing-attempt-01");
    assert.deepEqual(retry, passed, "same idempotency key returns original result even with changed input");
    const reEnrolled = await service.enrollInCourse(user, course.id);
    assert.equal(reEnrolled?.progress.currentLessonId, lessons[1].id, "resume pointer must survive enrollment retry");
    assert.equal((await service.getCourseOverview(user, course.id))?.progress.percent, 25);
    for (const remaining of lessons.slice(1)) {
      const result = await service.submitAttempt(user, course.id, remaining.id, Object.fromEntries(remaining.questions.map((question) => [question.id, question.answer])), `complete-${remaining.id}`);
      assert.equal(result.passed, true);
    }
    assert.equal((await service.getCourseOverview(user, course.id))?.progress.percent, 100, "all curated lessons can be completed without a paywall");
    await assert.rejects(service.submitAttempt(user, course.id, first.id, {}, "invalid-answers-01"), /Jawab semua/);
    const personal = normalizePersonalDraft({ ...course, title: "Kursus integrasi", outcome: "Mampu membuat proyek mandiri" });
    await service.savePersonalCourse(user, personal);
    await assert.rejects(service.getCourseOverview("another-user", personal.id), /bukan milikmu/);
    assert.ok(!(await service.getCourseCatalog("another-user")).courses.some((item) => item.id === personal.id));
    const generated = { ...courseLessons(personal)[0], blocks: first.blocks, questions: first.questions.map((question, index) => ({ ...question, id: `${courseLessons(personal)[0].id}-q${index + 1}` })), status: "ready" as const };
    await service.updateGeneratedLesson(user, personal.id, generated, { attempt: 1, inputHash: "content-v1" });
    await service.savePersonalCourse(user, personal);
    assert.equal((await service.getLessonForUser(user, personal.id, generated.id))?.lesson.status, "ready", "create retries must not erase generated content");
    for (let index = 0; index < 3; index++) assert.equal(await service.consumeCourseAiQuota(user, "create", 3), true);
    assert.equal(await service.consumeCourseAiQuota(user, "create", 3), false);
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => service.consumeCourseAiQuota("concurrent-user", "tutor", 3)));
    assert.equal(outcomes.filter(Boolean).length, 3, "quota writes must be serialized");
    Object.assign(process.env, { NODE_ENV: "production" });
    await assert.rejects(service.getCourseCatalog(user), /Penyimpanan kursus belum dikonfigurasi/, "production must never silently fall back to local JSON");
    Object.assign(process.env, { NODE_ENV: "development" });
    await writeFile(path.join(directory, "data", "courses.local.json"), "broken json", "utf8");
    await assert.rejects(service.getCourseCatalog(user), /JSON|Unexpected/);
    console.log("PASS course server: grading, retry idempotency, resume, ownership, draft preservation, concurrent quotas, and corruption fail-closed");
  } finally {
    process.chdir(workspace);
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
