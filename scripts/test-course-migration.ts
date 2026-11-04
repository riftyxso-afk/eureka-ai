import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [sql, server, route] = await Promise.all([
    readFile("supabase_patch_022_courses.sql", "utf8"),
    readFile("lib/courses/server.ts", "utf8"),
    readFile("app/api/courses/route.ts", "utf8"),
  ]);

  assert.match(sql, /SELECT l\.title, l\.content_version INTO v_lesson_title, v_question_version/);
  assert.match(sql, /q\.lesson_id = p_lesson_id AND q\.version = v_question_version/);
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ""), /MAX\(\s*(?:q\.)?version\s*\)/i, "grading must not choose a stray highest question version");
  assert.match(sql, /p_job_attempt INTEGER,\s*p_input_hash TEXT/);
  assert.match(sql, /j\.attempts = p_job_attempt/);
  assert.match(sql, /SET status = 'done',[\s\S]*?AND j\.attempts = p_job_attempt/);
  assert.match(sql, /IF p_error IS NULL THEN/);
  assert.match(sql, /RETURN 'claimed:' \|\| v_job_attempt::TEXT/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.save_generated_lesson\(UUID, TEXT, TEXT, JSONB, JSONB\)/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.finish_course_lesson_generation\(UUID, TEXT, TEXT, TEXT, TEXT\)/);
  assert.match(server, /p_job_attempt: lease\.attempt, p_input_hash: lease\.inputHash/);
  assert.match(server, /p_job_attempt: attempt, p_error: errorText/);
  assert.doesNotMatch(server, /finish\(null\)/, "successful generation is completed atomically by save_generated_lesson");
  assert.match(server, /process\.env\.NODE_ENV === "production"/, "production mode must be checked before local fallback");
  assert.doesNotMatch(route, /if \(existing\) return/, "an existing course must resume enrollment and first-lesson generation");
  assert.match(route, /const course = existing\?\.course \?\? normalizePersonalDraft/);
  assert.match(route, /status: existing \? 200 : 201/);

  console.log("PASS course migration static contract; SQL was not executed");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
