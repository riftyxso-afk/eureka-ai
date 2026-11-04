import assert from "node:assert/strict";
import { CURATED_COURSES } from "../lib/courses/catalog";
import { toLearnerLesson, toSyllabusOverview } from "../lib/courses/dto";
import { buildCourseProgress, courseLessons, summarizeCourse } from "../lib/courses/types";
import { normalizePersonalDraft, validatePersonalCourseInput } from "../lib/courses/generator";

assert.equal(CURATED_COURSES.length, 3);
const allIds = new Set<string>();
let lessonCount = 0;
let questionCount = 0;
for (const course of CURATED_COURSES) {
  assert.equal(course.version, 1);
  assert.equal(course.sourceKind, "curated");
  assert.ok(!allIds.has(course.id)); allIds.add(course.id);
  const lessons = courseLessons(course);
  assert.equal(lessons.length, 4);
  assert.equal(course.estimatedMinutes, lessons.reduce((sum, lesson) => sum + lesson.minutes, 0));
  assert.ok(course.sources.every((source) => source.url.startsWith("https://")));
  for (const lesson of lessons) {
    lessonCount++;
    assert.ok(!allIds.has(lesson.id)); allIds.add(lesson.id);
    assert.ok(lesson.minutes >= 5 && lesson.minutes <= 15);
    assert.ok(lesson.objectives.length >= 2);
    assert.ok(lesson.blocks.length >= 3);
    assert.equal(lesson.questions.length, 2);
    assert.ok(lesson.sources.every((source) => source.url.startsWith("https://")));
    const learner = toLearnerLesson(lesson);
    const serialized = JSON.stringify(learner.questions);
    assert.ok(!serialized.includes("answer") && !serialized.includes("explanation"), "learner DTO leaks answer data");
    for (const question of lesson.questions) {
      questionCount++;
      assert.ok(!allIds.has(question.id)); allIds.add(question.id);
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
      assert.ok(question.explanation.length > 10);
    }
  }
  const summary = summarizeCourse(course);
  assert.equal(summary.lessonCount, 4);
  const safe = toSyllabusOverview({ course, enrolled: false, progress: buildCourseProgress(course, []), lessons: [], storage: "local" });
  assert.ok(courseLessons(safe.course).every((lesson) => lesson.blocks.length === 0 && lesson.questions.length === 0));
}
assert.equal(lessonCount, 12);
assert.equal(questionCount, 24);

const course = CURATED_COURSES[0];
const lessons = courseLessons(course);
const progress = buildCourseProgress(course, [{ lessonId: lessons[0].id, status: "completed", bestScore: 100, completedAt: "2026-11-04T00:00:00Z" }]);
assert.deepEqual(progress, { completedLessons: 1, totalLessons: 4, percent: 25, currentLessonId: lessons[1].id });
assert.equal(buildCourseProgress(course, lessons.map((lesson) => ({ lessonId: lesson.id, status: "completed", bestScore: 100, completedAt: "2026-11-04T00:00:00Z" }))).percent, 100);

assert.throws(() => validatePersonalCourseInput({ topic: "x", goal: "short" }));
const input = validatePersonalCourseInput({ topic: "  Fotografi dasar  ", goal: "  Mengambil foto produk yang lebih jelas  ", minutesPerDay: 999 });
assert.equal(input.topic, "Fotografi dasar");
assert.equal(input.minutesPerDay, 120);
const draft = normalizePersonalDraft({
  ...course, id: "excel-kerja", sourceKind: "curated", title: "Kursus pribadi", outcome: "Mampu menyelesaikan proyek sederhana",
  modules: course.modules.slice(0, 2),
});
assert.ok(draft.id.startsWith("custom-") && draft.id !== course.id);
assert.equal(draft.sourceKind, "generated");
assert.ok(courseLessons(draft).every((lesson) => lesson.status === "pending" && lesson.blocks.length === 0 && lesson.questions.length === 0));
assert.ok(!JSON.stringify(draft).includes("explanation"), "client supplied answers must be discarded");
console.log(`PASS courses: ${CURATED_COURSES.length} courses, ${lessonCount} lessons, ${questionCount} questions, sanitized DTOs, progress, and draft validation`);
