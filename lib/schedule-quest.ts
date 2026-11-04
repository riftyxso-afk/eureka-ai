import {
  SCHEDULE_DAYS,
  scheduleSessionKey,
  type ScheduleDay,
  type ScheduleEntry,
  type TaskItem,
} from "./schedule-store";

export interface QuestProgress {
  total: number;
  done: number;
  percent: number;
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromIso(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function scheduleDayForDate(value: string): ScheduleDay {
  return SCHEDULE_DAYS[(dateFromIso(value).getDay() + 6) % 7];
}

export function weekDates(anchor: Date): string[] {
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return isoDate(date);
  });
}

export function agendaProgress(
  date: string,
  entries: ScheduleEntry[],
  tasks: TaskItem[],
  completedSessions: string[]
): QuestProgress {
  const classes = entries.filter((entry) => entry.day === scheduleDayForDate(date));
  const dueTasks = tasks.filter((task) => task.dueDate === date);
  const done = classes.filter((entry) => completedSessions.includes(scheduleSessionKey(date, entry.id))).length
    + dueTasks.filter((task) => task.done).length;
  const total = classes.length + dueTasks.length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function weeklyQuestProgress(
  anchor: Date,
  entries: ScheduleEntry[],
  tasks: TaskItem[],
  completedSessions: string[]
): QuestProgress {
  const progress = weekDates(anchor).reduce((week, date) => {
    const day = agendaProgress(date, entries, tasks, completedSessions);
    return { total: week.total + day.total, done: week.done + day.done };
  }, { total: 0, done: 0 });
  return withPercent(progress);
}

export function withPercent(progress: Omit<QuestProgress, "percent">): QuestProgress {
  return { ...progress, percent: progress.total ? Math.round((progress.done / progress.total) * 100) : 0 };
}

export function formatQuestDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateFromIso(value));
}

export function formatDue(dueDate?: string): string {
  if (!dueDate) return "Tanpa tenggat";
  const date = dateFromIso(dueDate);
  if (Number.isNaN(date.getTime())) return dueDate;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
