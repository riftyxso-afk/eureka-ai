/**
 * Store fitur Teman — Supabase.
 * Tabel: users (profil publik) + friendships.
 * Catatan: teman hanya bisa ditambahkan antar akun yang sudah terdaftar.
 */
import { db } from "./supabase/admin";

export type FriendshipStatus = "pending" | "accepted";

export interface FriendUser {
  id: string;
  name: string;
  username?: string;
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

function mapUser(row: any): FriendUser {
  return {
    id: row.id,
    name: row.name ?? "Pengguna",
    username: row.username ?? undefined,
    createdAt: row.created_at,
  };
}

/** Daftarkan/update profil user (row dibuat otomatis oleh trigger auth). */
export async function ensureUser(
  id: string,
  name: string
): Promise<FriendUser> {
  const client = db();
  const cleanName = name.trim().slice(0, 60) || "Pengguna";

  const { data: row } = await client
    .from("users")
    .update({ name: cleanName })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (row) return mapUser(row);

  // Row belum ada (mis. akun dibuat tanpa trigger) — buat minimal.
  const { data: inserted, error } = await client
    .from("users")
    .insert({ id, email: `${id}@eureka.local`, name: cleanName })
    .select()
    .maybeSingle();
  if (error || !inserted) {
    return { id, name: cleanName, createdAt: new Date().toISOString() };
  }
  return mapUser(inserted);
}

/** Ambil semua relasi pertemanan yang melibatkan selfId dalam satu query. */
async function loadRelationships(
  client: ReturnType<typeof db>,
  selfId: string
): Promise<Map<string, FriendRelation>> {
  const { data, error } = await client
    .from("friendships")
    .select("from_id, to_id, status")
    .or(`from_id.eq.${selfId},to_id.eq.${selfId}`);

  if (error) throw error;

  const map = new Map<string, FriendRelation>();
  for (const f of data ?? []) {
    const other = f.from_id === selfId ? f.to_id : f.from_id;
    const current = map.get(other);
    if (f.status === "accepted") {
      map.set(other, "friend");
    } else if (!current || current === "none") {
      map.set(other, f.to_id === selfId ? "incoming" : "outgoing");
    }
  }
  return map;
}

/** Cari user berdasarkan nama ATAU @username (case-insensitive). */
export async function searchUsers(
  selfId: string,
  query: string,
  limit = 20
): Promise<{ user: FriendUser; relation: FriendRelation }[]> {
  const client = db();
  const q = query.trim().replace(/^@+/, "").toLowerCase();

  // Pakai function SECURITY DEFINER search_users (patch 017) — hanya
  // kolom publik (id, name, username) yang diekspos, tanpa email/profile_data.
  const { data } = await client.rpc("search_users", { q }).limit(limit);
  const rows = (data ?? []) as { id: string; name: string | null; username: string | null }[];

  const relations = await loadRelationships(client, selfId);
  return rows.map((r) => ({
    user: {
      id: r.id,
      name: r.name ?? "Pengguna",
      username: r.username ?? undefined,
      createdAt: new Date().toISOString(),
    },
    relation:
      r.id === selfId ? "self" : ((relations.get(r.id) ?? "none") as FriendRelation),
  }));
}

/** Kirim permintaan pertemanan ke akun yang sudah terdaftar (cari nama/@username). */
export async function sendFriendRequest(
  fromId: string,
  toName: string
): Promise<{ ok: boolean; relation: FriendRelation; target?: FriendUser }> {
  const client = db();
  const cleanName = toName.trim().slice(0, 60).replace(/^@+/, "");
  if (!cleanName) throw new Error("Nama teman kosong.");

  const { data: target } = await client
    .from("users")
    .select("id, name, username, created_at")
    .or(`name.ilike.${cleanName},username.ilike.${cleanName}`)
    .maybeSingle();

  if (!target) {
    throw new Error(
      `Tidak menemukan pengguna "${toName.trim()}". Cek nama/@username-nya — pastikan mereka sudah mendaftar di Eureka.AI.`
    );
  }
  if (target.id === fromId) {
    throw new Error("Tidak bisa berteman dengan diri sendiri.");
  }

  const { data: existing } = await client
    .from("friendships")
    .select("id, from_id, to_id, status")
    .or(`and(from_id.eq.${fromId},to_id.eq.${target.id}),and(from_id.eq.${target.id},to_id.eq.${fromId})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") {
      return { ok: false, relation: "friend", target: mapUser(target) };
    }
    if (existing.to_id === fromId) {
      // Sudah ada undangan masuk → langsung terima
      await client
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", existing.id);
      return { ok: true, relation: "friend", target: mapUser(target) };
    }
    return { ok: false, relation: "outgoing", target: mapUser(target) };
  }

  await client.from("friendships").insert({
    from_id: fromId,
    to_id: target.id,
    status: "pending",
  });
  return { ok: true, relation: "outgoing", target: mapUser(target) };
}

export async function listFriends(userId: string): Promise<FriendUser[]> {
  const client = db();
  const { data, error } = await client
    .from("friendships")
    .select("from_id, to_id")
    .eq("status", "accepted")
    .or(`from_id.eq.${userId},to_id.eq.${userId}`);

  if (error) throw error;

  const friendIds = (data ?? []).map((f) =>
    f.from_id === userId ? f.to_id : f.from_id
  );
  if (friendIds.length === 0) return [];

  const { data: rows } = await client
    .from("users")
    .select("id, name, created_at")
    .in("id", friendIds);

  return (rows ?? []).map(mapUser).sort((a, b) => a.name.localeCompare(b.name));
}

async function listRequests(
  userId: string,
  direction: "incoming" | "outgoing"
): Promise<FriendUser[]> {
  const client = db();
  const field = direction === "incoming" ? "to_id" : "from_id";
  const other = direction === "incoming" ? "from_id" : "to_id";

  const { data, error } = await client
    .from("friendships")
    .select(`${other}`)
    .eq("status", "pending")
    .eq(field, userId);

  if (error) throw error;

  const ids = (data ?? []).map((f: any) => f[other]);
  if (ids.length === 0) return [];

  const { data: rows } = await client
    .from("users")
    .select("id, name, created_at")
    .in("id", ids);

  return (rows ?? []).map(mapUser);
}

export function listIncomingRequests(userId: string): Promise<FriendUser[]> {
  return listRequests(userId, "incoming");
}

export function listOutgoingRequests(userId: string): Promise<FriendUser[]> {
  return listRequests(userId, "outgoing");
}

export async function acceptFriendRequest(
  userId: string,
  fromId: string
): Promise<boolean> {
  const client = db();
  const { data, error } = await client
    .from("friendships")
    .update({ status: "accepted" })
    .eq("from_id", fromId)
    .eq("to_id", userId)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function declineFriendRequest(
  userId: string,
  fromId: string
): Promise<boolean> {
  const client = db();
  const { error } = await client
    .from("friendships")
    .delete()
    .or(`and(from_id.eq.${fromId},to_id.eq.${userId}),and(from_id.eq.${userId},to_id.eq.${fromId})`);

  if (error) throw error;
  return true;
}

export async function removeFriend(
  userId: string,
  friendId: string
): Promise<void> {
  const client = db();
  const { error } = await client
    .from("friendships")
    .delete()
    .or(`and(from_id.eq.${userId},to_id.eq.${friendId}),and(from_id.eq.${friendId},to_id.eq.${userId})`);

  if (error) throw error;
}
