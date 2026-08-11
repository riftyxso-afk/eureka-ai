/**
 * Store MVP untuk Fase 1 kolaborasi (catatan kolaboratif & chat).
 * Persistensi file JSON lokal: data/collab.json
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const COLLAB_FILE = path.join(DATA_DIR, "collab.json");

export type CollabRole = "editor" | "viewer";

export interface Collaborator {
  id: string;
  name: string;
  role: CollabRole;
  invitedAt: string;
  status: "pending" | "accepted";
}

export interface ChatMessage {
  id: string;
  senderName: string;
  content: string;
  parentId?: string;
  createdAt: string;
  isAI?: boolean;
  /** Nama yang disebut via @mention (tanpa @). */
  mentions?: string[];
}

export interface PresenceEntry {
  name: string;
  role: CollabRole;
  lastActive: number;
}

export interface NoteVersion {
  version: number;
  title: string;
  summary: string;
  changedBy: string;
  createdAt: string;
}

interface NoteCollab {
  inviteToken: string;
  collaborators: Collaborator[];
  versions: NoteVersion[];
}

interface CollabStore {
  notes: Record<string, NoteCollab>;
  chat: Record<string, ChatMessage[]>;
  presence: Record<string, Record<string, PresenceEntry>>;
}

const PRESENCE_TTL_MS = 60_000;

function emptyStore(): CollabStore {
  return { notes: {}, chat: {}, presence: {} };
}

/**
 * Mutex sederhana: serialisasi semua operasi read-modify-write pada file.
 * Tanpa ini, tulis yang bersamaan (heartbeat presence, chat, dll) bisa
 * saling menimpa dan menghapus data.
 */
let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readCollab(): Promise<CollabStore> {
  try {
    const raw = await fs.readFile(COLLAB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CollabStore>;
    return { ...emptyStore(), ...parsed };
  } catch {
    return emptyStore();
  }
}

async function writeCollab(store: CollabStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(COLLAB_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Ambil data kolaborasi note; buat otomatis jika belum ada (dengan token undangan). */
export function getNoteCollab(noteId: string): Promise<NoteCollab> {
  return withLock(async () => {
    const store = await readCollab();
    if (!store.notes[noteId]) {
      store.notes[noteId] = {
        inviteToken: randomUUID().replace(/-/g, "").slice(0, 12),
        collaborators: [],
        versions: [],
      };
      await writeCollab(store);
    }
    return store.notes[noteId];
  });
}

export function addCollaborator(
  noteId: string,
  name: string,
  role: CollabRole
): Promise<{ collaborator: Collaborator; inviteToken: string }> {
  return withLock(async () => {
    const store = await readCollab();
    const note = store.notes[noteId] ?? {
      inviteToken: randomUUID().replace(/-/g, "").slice(0, 12),
      collaborators: [],
      versions: [],
    };
    if (!store.notes[noteId]) store.notes[noteId] = note;
    const collaborator: Collaborator = {
      id: randomUUID(),
      name,
      role,
      invitedAt: new Date().toISOString(),
      status: "pending",
    };
    note.collaborators.push(collaborator);
    await writeCollab(store);
    return { collaborator, inviteToken: note.inviteToken };
  });
}

export function acceptInvite(noteId: string, token: string): Promise<boolean> {
  return withLock(async () => {
    const store = await readCollab();
    const note = store.notes[noteId];
    if (!note || note.inviteToken !== token) return false;
    // Accept undangan yang statusnya pending pertama kali
    const pending = note.collaborators.find((c) => c.status === "pending");
    if (pending) {
      pending.status = "accepted";
      await writeCollab(store);
    }
    return true;
  });
}

export function removeCollaborator(
  noteId: string,
  collaboratorId: string
): Promise<void> {
  return withLock(async () => {
    const store = await readCollab();
    const note = store.notes[noteId];
    if (note) {
      note.collaborators = note.collaborators.filter(
        (c) => c.id !== collaboratorId
      );
      await writeCollab(store);
    }
  });
}

export function addChatMessage(
  noteId: string,
  senderName: string,
  content: string,
  parentId?: string,
  isAI = false,
  mentions: string[] = []
): Promise<ChatMessage> {
  return withLock(async () => {
    const store = await readCollab();
    const messages = store.chat[noteId] ?? [];
    const message: ChatMessage = {
      id: randomUUID(),
      senderName,
      content,
      parentId,
      createdAt: new Date().toISOString(),
      isAI,
      mentions,
    };
    messages.push(message);
    store.chat[noteId] = messages.slice(-500);
    await writeCollab(store);
    return message;
  });
}

export async function listChatMessages(noteId: string): Promise<ChatMessage[]> {
  const store = await readCollab();
  return store.chat[noteId] ?? [];
}

export function setPresence(
  noteId: string,
  userId: string,
  entry: PresenceEntry
): Promise<void> {
  return withLock(async () => {
    const store = await readCollab();
    const room = store.presence[noteId] ?? {};
    room[userId] = entry;
    // Bersihkan yang sudah tidak aktif
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    for (const [key, value] of Object.entries(room)) {
      if (value.lastActive < cutoff) delete room[key];
    }
    store.presence[noteId] = room;
    await writeCollab(store);
  });
}

export async function listPresence(
  noteId: string
): Promise<Record<string, PresenceEntry>> {
  const store = await readCollab();
  const room = store.presence[noteId] ?? {};
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  const active: Record<string, PresenceEntry> = {};
  for (const [key, value] of Object.entries(room)) {
    if (value.lastActive >= cutoff) active[key] = value;
  }
  return active;
}

export function addVersion(
  noteId: string,
  version: Omit<NoteVersion, "version" | "createdAt">
): Promise<NoteVersion> {
  return withLock(async () => {
    const store = await readCollab();
    const note = store.notes[noteId] ?? {
      inviteToken: randomUUID().replace(/-/g, "").slice(0, 12),
      collaborators: [],
      versions: [],
    };
    if (!store.notes[noteId]) store.notes[noteId] = note;
    const next: NoteVersion = {
      ...version,
      version: note.versions.length + 1,
      createdAt: new Date().toISOString(),
    };
    note.versions.push(next);
    await writeCollab(store);
    return next;
  });
}

export async function listVersions(noteId: string): Promise<NoteVersion[]> {
  const store = await readCollab();
  return [...(store.notes[noteId]?.versions ?? [])].reverse();
}

/** Ambil versi spesifik untuk direstore. */
export async function getVersion(
  noteId: string,
  version: number
): Promise<NoteVersion | null> {
  const store = await readCollab();
  return (
    store.notes[noteId]?.versions.find((v) => v.version === version) ?? null
  );
}
