import assert from "node:assert/strict";
import { agendaProgress, isoDate, scheduleDayForDate, weekDates, weeklyQuestProgress } from "../lib/schedule-quest";
import { addScheduleEntry, addTask, deleteScheduleEntry, getSchedule, scheduleSessionKey, toggleScheduleSession, toggleTask, type ScheduleEntry, type TaskItem } from "../lib/schedule-store";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "window", { value: { localStorage: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
} }, configurable: true });

const entries: ScheduleEntry[] = [{ id: "math", day: "Rabu", start: "08:00", end: "09:00", subject: "Matematika", color: "#ffeeaa" }];
const tasks: TaskItem[] = [
  { id: "due", title: "Latihan", dueDate: "2026-11-04", done: false, createdAt: 1 },
  { id: "undated", title: "Baca", done: true, createdAt: 2 },
];
assert.equal(scheduleDayForDate("2026-11-04"), "Rabu");
assert.equal(scheduleDayForDate("2026-11-08"), "Minggu");
assert.deepEqual(weekDates(new Date(2026, 10, 8, 12)), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
assert.deepEqual(weekDates(new Date(2027, 0, 1, 12)), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
assert.equal(isoDate(new Date(2026, 10, 4, 0, 1)), "2026-11-04");
const completed = [scheduleSessionKey("2026-11-04", "math")];
assert.deepEqual(agendaProgress("2026-11-04", entries, tasks, completed), { total: 2, done: 1, percent: 50 });
assert.deepEqual(agendaProgress("2026-11-11", entries, tasks, completed), { total: 1, done: 0, percent: 0 });
assert.deepEqual(agendaProgress("2026-11-05", entries, tasks, completed), { total: 0, done: 0, percent: 0 });
assert.deepEqual(weeklyQuestProgress(new Date(2026, 10, 4), entries, tasks, completed), { total: 2, done: 1, percent: 50 });

memory.set("eureka_schedule", JSON.stringify({ entries, tasks }));
assert.deepEqual(getSchedule().completedSessions, [], "legacy storage remains compatible");
assert.equal(toggleScheduleSession("2026-11-04", "math"), true);
assert.deepEqual(getSchedule().completedSessions, completed);
assert.equal(toggleScheduleSession("2026-11-04", "math"), false);
assert.deepEqual(getSchedule().completedSessions, []);
toggleScheduleSession("2026-11-04", "math");
toggleScheduleSession("2026-11-11", "math");
toggleTask("due");
assert.equal(getSchedule().tasks.find(task => task.id === "due")?.done, true);
assert.deepEqual(agendaProgress("2026-11-04", entries, getSchedule().tasks, getSchedule().completedSessions), { total: 2, done: 2, percent: 100 });
deleteScheduleEntry("math");
assert.deepEqual(getSchedule().completedSessions, [], "deleting a class cleans completion keys");
assert.equal(getSchedule().tasks.length, 2);
const added = addScheduleEntry({ day: "Senin", start: "08:00", end: "09:00", subject: "Biologi" });
assert.ok(added.color);
addTask({ title: "Tugas baru" });
assert.equal(getSchedule().tasks.length, 3);
memory.set("eureka_schedule", "not json");
assert.deepEqual(getSchedule(), { entries: [], tasks: [], completedSessions: [] });
console.log("PASS: schedule dates, real daily/weekly progress, legacy storage, completion persistence and deletion cleanup");
