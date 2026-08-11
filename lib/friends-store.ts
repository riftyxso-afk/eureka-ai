/**
 * Store MVP untuk fitur Teman (Fase kolaborasi).
 * Persistensi file JSON lokal: data/friends.json
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const FRIENDS_FILE = path.join(DATA_DIR, "friends.json");

export type FriendshipStatus = "pending" | "accepted";

export interface FriendUser {
  id: string;
  name: string;
  createdAt: string;
}

export interface Friendship {
  id: string;
  fromId: string;
  toId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export type FriendRelation =
  | "self"
  | "friend"
  | "incoming"
  | "outgoing"
  | "none";

interface FriendsStore {
  users: Record<string, FriendUser>;
  friendships: Friendship[];
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

async function readStore(): Promise<FriendsStore> {
  try {
    const raw = await fs.readFile(FRIENDS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<FriendsStore>;
    return { users: {}, friendships: [], ...parsed };
  } catch {
    return { users: {}, friendships: [] };
  }
}

async function writeStore(store: FriendsStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FRIENDS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Daftarkan user (buat jika belum ada). */
export function ensureUser(id: string, name: string): Promise<FriendUser> {
  return withLock(async () => {
    const store = await readStore();
    const cleanName = name.trim().slice(0, 60) || "Pengguna";
    let user = store.users[id];
    if (!user) {
      user = { id, name: cleanName, createdAt: new Date().toISOString() };
      store.users[id] = user;
      await writeStore(store);
    } else if (user.name !== cleanName && cleanName !== "Pengguna") {
      user.name = cleanName;
      await writeStore(store);
    }
    return user;
  });
}

function relationFor(
  store: FriendsStore,
  selfId: string,
  otherId: string
): FriendRelation {
  if (otherId === selfId) return "self";
  const fships = store.friendships.filter(
    (f) =>
      (f.fromId === selfId && f.toId === otherId) ||
      (f.fromId === otherId && f.toId === selfId)
  );
  if (fships.length === 0) return "none";
  const accepted = fships.some((f) => f.status === "accepted");
  if (accepted) return "friend";
  const incoming = fships.some(
    (f) => f.status === "pending" && f.toId === selfId
  );
  return incoming ? "incoming" : "outgoing";
}

/** Cari user berdasarkan nama (case-insensitive), kecuali diri sendiri. */
export function searchUsers(
  selfId: string,
  query: string,
  limit = 20
): Promise<{ user: FriendUser; relation: FriendRelation }[]> {
  return withLock(async () => {
    const store = await readStore();
    const q = query.trim().toLowerCase();
    const matches = Object.values(store.users)
      .filter((u) => u.id !== selfId && (q === "" || u.name.toLowerCase().includes(q)))
      .slice(0, limit);
    return matches.map((user) => ({
      user,
      relation: relationFor(store, selfId, user.id),
    }));
  });
}

/** Kirim permintaan pertemanan. Target dibuatkan bila belum terdaftar. */
export function sendFriendRequest(
  fromId: string,
  toName: string
): Promise<{ ok: boolean; relation: FriendRelation; target?: FriendUser }> {
  return withLock(async () => {
    const store = await readStore();
    const cleanName = toName.trim().slice(0, 60);
    if (!cleanName) throw new Error("Nama teman kosong.");

    let target = Object.values(store.users).find(
      (u) => u.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (!target) {
      target = { id: randomUUID(), name: cleanName, createdAt: new Date().toISOString() };
      store.users[target.id] = target;
    }
    if (target.id === fromId) {
      throw new Error("Tidak bisa berteman dengan diri sendiri.");
    }

    const existing = store.friendships.find(
      (f) =>
        (f.fromId === fromId && f.toId === target!.id) ||
        (f.fromId === target!.id && f.toId === fromId)
    );
    if (existing) {
      if (existing.status === "accepted") {
        return { ok: false, relation: "friend", target };
      }
      if (existing.toId === fromId) {
        // Sudah ada undangan masuk → langsung terima
        existing.status = "accepted";
        await writeStore(store);
        return { ok: true, relation: "friend", target };
      }
      return { ok: false, relation: "outgoing", target };
    }

    store.friendships.push({
      id: randomUUID(),
      fromId,
      toId: target.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    await writeStore(store);
    return { ok: true, relation: "outgoing", target };
  });
}

function friendshipBetween(store: FriendsStore, a: string, b: string) {
  return store.friendships.find(
    (f) =>
      (f.fromId === a && f.toId === b) || (f.fromId === b && f.toId === a)
  );
}

export function listFriends(userId: string): Promise<FriendUser[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.friendships
      .filter(
        (f) =>
          f.status === "accepted" &&
          (f.fromId === userId || f.toId === userId)
      )
      .map((f) => store.users[f.fromId === userId ? f.toId : f.fromId])
      .filter((u): u is FriendUser => Boolean(u))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function listIncomingRequests(
  userId: string
): Promise<FriendUser[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.friendships
      .filter((f) => f.status === "pending" && f.toId === userId)
      .map((f) => store.users[f.fromId])
      .filter((u): u is FriendUser => Boolean(u));
  });
}

export function listOutgoingRequests(
  userId: string
): Promise<FriendUser[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.friendships
      .filter((f) => f.status === "pending" && f.fromId === userId)
      .map((f) => store.users[f.toId])
      .filter((u): u is FriendUser => Boolean(u));
  });
}

export function acceptFriendRequest(
  userId: string,
  fromId: string
): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const fs = friendshipBetween(store, userId, fromId);
    if (!fs || fs.status !== "pending" || fs.fromId !== fromId) return false;
    fs.status = "accepted";
    await writeStore(store);
    return true;
  });
}

export function declineFriendRequest(
  userId: string,
  fromId: string
): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const fs = friendshipBetween(store, userId, fromId);
    if (!fs) return false;
    store.friendships = store.friendships.filter((f) => f.id !== fs.id);
    await writeStore(store);
    return true;
  });
}

export function removeFriend(
  userId: string,
  friendId: string
): Promise<void> {
  return withLock(async () => {
    const store = await readStore();
    const fs = friendshipBetween(store, userId, friendId);
    if (fs) {
      store.friendships = store.friendships.filter((f) => f.id !== fs.id);
      await writeStore(store);
    }
  });
}
