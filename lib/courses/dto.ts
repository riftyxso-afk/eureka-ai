import type { Course, CourseLesson, CourseOverview, LearnerQuestion } from "./types";

/** Silabus boleh memuat struktur, bukan isi latihan atau kunci jawaban. */
export function toSyllabusOverview(overview: CourseOverview): CourseOverview {
  return {
    ...overview,
    course: {
      ...overview.course,
      modules: overview.course.modules.map((module) => ({
        ...module,
        lessons: module.lessons.map((lesson) => ({ ...lesson, blocks: [], questions: [] })),
      })),
    },
  };
}

export function toLearnerLesson(lesson: CourseLesson): Omit<CourseLesson, "questions"> & { questions: LearnerQuestion[] } {
  return {
    ...lesson,
    questions: lesson.questions.map((question): LearnerQuestion => ({
      id: question.id,
      prompt: question.prompt,
      options: [...question.options],
    })),
  };
}

export function toSyllabusPreview(course: Course): Course {
  return {
    ...course,
    modules: course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({ ...lesson, blocks: [], questions: [], status: "pending" })),
    })),
  };
}
