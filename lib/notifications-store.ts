/**
 * Store Notifikasi — Supabase.
 * Tabel: notifications
 */
import { db } from "./supabase/admin";

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "mention"
  | "achievement"
  | "note_ready"
  | "exam_reminder"
  | "task_reminder";

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

function mapRow(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  };
}

/** Kirim notifikasi untuk satu user. */
export async function pushNotification(
  userId: string,
  input: NotificationInput
): Promise<AppNotification> {
  const client = db();
  const { data, error } = await client
    .from("notifications")
    .insert({
      user_id: userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

/** Daftar notifikasi terbaru dulu. */
export async function listNotifications(
  userId: string,
  limit = 30
): Promise<AppNotification[]> {
  const client = db();
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function countUnread(userId: string): Promise<number> {
  const client = db();
  const { data, error } = await client
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
  return (data ?? []).length;
}

/** Tandai dibaca: semua bila ids kosong, atau hanya id yang dipilih. */
export async function markNotificationsRead(
  userId: string,
  ids?: string[]
): Promise<number> {
  const client = db();
  let query = client
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }
  const { data, error } = await query.select("id");

  if (error) throw error;
  return (data ?? []).length;
}
