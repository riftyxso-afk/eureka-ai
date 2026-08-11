/**
 * Store MVP untuk Notifikasi (realtime via polling).
 * Persistensi file JSON lokal: data/notifications.json
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const NOTIF_FILE = path.join(DATA_DIR, "notifications.json");

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "mention"
  | "achievement"
  | "note_ready";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readStore(): Promise<AppNotification[]> {
  try {
    const raw = await fs.readFile(NOTIF_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed.filter((n) => n && n.id) : [];
  } catch {
    return [];
  }
}

async function writeStore(store: AppNotification[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(NOTIF_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Kirim notifikasi untuk satu user. */
export function pushNotification(
  userId: string,
  input: NotificationInput
): Promise<AppNotification> {
  return withLock(async () => {
    const store = await readStore();
    const notification: AppNotification = {
      id: randomUUID(),
      userId,
      ...input,
      read: false,
      createdAt: new Date().toISOString(),
    };
    store.push(notification);
    await writeStore(store);
    return notification;
  });
}

/** Daftar notifikasi terbaru dulu. */
export function listNotifications(
  userId: string,
  limit = 30
): Promise<AppNotification[]> {
  return withLock(async () => {
    const store = await readStore();
    return store
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  });
}

export function countUnread(userId: string): Promise<number> {
  return withLock(async () => {
    const store = await readStore();
    return store.filter((n) => n.userId === userId && !n.read).length;
  });
}

/** Tandai dibaca: semua bila ids kosong, atau hanya id yang dipilih. */
export function markNotificationsRead(
  userId: string,
  ids?: string[]
): Promise<number> {
  return withLock(async () => {
    const store = await readStore();
    let changed = 0;
    for (const n of store) {
      if (n.userId !== userId || n.read) continue;
      if (ids && ids.length > 0 && !ids.includes(n.id)) continue;
      n.read = true;
      changed++;
    }
    if (changed > 0) await writeStore(store);
    return changed;
  });
}
