/**
 * Supabase-based Collaboration System
 * Complete replacement of file-based collab system with database storage
 */

import { supabase } from './supabase/client';
import { randomUUID } from 'crypto';

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

interface InviteToken {
  token: string;
  noteId: string;
  inviteeName: string;
  role: CollabRole;
  createdAt: string;
}

// Constants
const PRESENCE_TTL_MS = 60_000; // 1 minute TTL for presence entries

/**
 * Get note collaboration data (invite token, collaborators, versions)
 */
export async function getNoteCollaboration(noteId: string) {
  try {
    const { data: versions, error } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .order('version_number', { ascending: true });

    if (error) throw error;

    return {
      inviteToken: randomUUID().replace(/-/g, "").slice(0, 12), // Generate new invite token
      collaborators: [], // Will be stored in a separate table
      versions: versions ?? [],
    };
  } catch (error) {
    console.error('[getNoteCollaboration] Error:', error);
    return null;
  }
}

/**
 * Helper for API compatibility
 */
export async function getNoteCollab(noteId: string) {
  const result = await getNoteCollaboration(noteId);
  return result || { 
    inviteToken: randomUUID().replace(/-/g, "").slice(0, 12),
    collaborators: [],
    versions: [] 
  };
}

/**
 * Add collaborator to a note
 */
export async function addCollaborator(
  noteId: string,
  name: string,
  role: CollabRole
): Promise<{ collaborator: Collaborator; inviteToken: string }> {
  try {
    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    
    // Create invite token record
    await supabase.from('invite_tokens').insert({
      token: token,
      note_id: noteId,
      invitee_name: name,
      role: role,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });

    return {
      collaborator: {
        id: "", // Not yet accepted
        name: name,
        role: role,
        invitedAt: new Date().toISOString(),
        status: "pending",
      },
      inviteToken: token,
    };
  } catch (error) {
    console.error('[addCollaborator] Error:', error);
    throw error;
  }
}

/**
 * Accept an invite token
 */
export async function acceptInvite(noteId: string, token: string): Promise<boolean> {
  try {
    const { data: invite, error: fetchError } = await supabase
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .eq('note_id', noteId)
      .single();

    if (fetchError || !invite) return false;

    // Check if expired
    const expiresAt = new Date(invite.expires_at);
    if (expiresAt < new Date()) {
      return false;
    }

    // Mark as accepted
    await supabase
      .from('invite_tokens')
      .update({ status: 'accepted' })
      .eq('token', token);

    // Add to collaborators table
    await supabase.from('collaborators').upsert({
      note_id: noteId,
      user_id: "", // User ID will be set when they login
      name: invite.invitee_name,
      role: invite.role,
      invited_at: invite.created_at,
      status: 'accepted',
    }, { onConflict: 'note_id,user_id' });

    return true;
  } catch (error) {
    console.error('[acceptInvite] Error:', error);
    return false;
  }
}

/**
 * Remove a collaborator from a note
 */
export async function removeCollaborator(noteId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('collaborators')
      .delete()
      .eq('note_id', noteId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('[removeCollaborator] Error:', error);
    throw error;
  }
}

/**
 * Update note collaborator status
 */
export async function setCollaboratorStatus(
  noteId: string,
  userId: string,
  status: "pending" | "accepted"
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collaborators')
      .update({ status })
      .eq('note_id', noteId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * List all chat messages for a note
 */
export async function listChatMessages(noteId: string, limit = 50): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error('[listChatMessages] Error:', error);
    return [];
  }
}

/**
 * Add a chat message
 */
export async function addChatMessage(
  noteId: string,
  senderName: string,
  content: string,
  options?: {
    parentId?: string;
    isAI?: boolean;
    mentions?: string[];
  }
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        note_id: noteId,
        sender_name: senderName,
        content: content,
        parent_id: options?.parentId || null,
        is_ai: options?.isAI || false,
        mentions: options?.mentions || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('[addChatMessage] Error:', error);
    throw error;
  }
}

/**
 * Set user presence for real-time collaboration
 */
export async function setPresence(
  noteId: string,
  userId: string,
  entry: PresenceEntry
): Promise<void> {
  try {
    await supabase
      .from('presence')
      .upsert({
        note_id: noteId,
        user_id: userId,
        name: entry.name,
        role: entry.role,
        last_active: entry.lastActive,
        created_at: new Date().toISOString(),
      }, { onConflict: 'note_id,user_id' })
      .select()
      .single();
  } catch (error) {
    console.error('[setPresence] Error:', error);
    throw error;
  }
}

/**
 * List current presence (users currently viewing/editing the note)
 */
export async function listPresence(noteId: string): Promise<Map<string, PresenceEntry>> {
  try {
    const now = Date.now();
    
    const { data, error } = await supabase
      .from('presence')
      .select('*')
      .eq('note_id', noteId);

    if (error) throw error;

    // Filter out expired entries (TTL)
    const validPresence = new Map<string, PresenceEntry>();
    (data ?? []).forEach(entry => {
      if (now - entry.last_active < PRESENCE_TTL_MS) {
        validPresence.set(entry.user_id, {
          name: entry.name,
          role: entry.role as CollabRole,
          lastActive: entry.last_active,
        });
      }
    });

    return validPresence;
  } catch (error) {
    console.error('[listPresence] Error:', error);
    return new Map();
  }
}

/**
 * Remove user presence (on disconnect)
 */
export async function removePresence(noteId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('presence')
      .delete()
      .eq('note_id', noteId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('[removePresence] Error:', error);
  }
}

/**
 * Save a new version of a note
 */
export async function addVersion(
  noteId: string,
  version: Omit<NoteVersion, 'version'> & { version?: number }
): Promise<NoteVersion> {
  try {
    // Get current max version
    const { data: existingVersions } = await supabase
      .from('note_versions')
      .select('version_number')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (existingVersions?.[0]?.version_number ?? 0) + 1;
    
    const { data, error } = await supabase
      .from('note_versions')
      .insert({
        note_id: noteId,
        version_number: version.version || nextVersion,
        title: version.title,
        summary: version.summary,
        changed_by: version.changedBy,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return data as NoteVersion;
  } catch (error) {
    console.error('[addVersion] Error:', error);
    throw error;
  }
}

/**
 * List all versions of a note (reversed order)
 */
export async function listVersions(noteId: string): Promise<NoteVersion[]> {
  try {
    const { data, error } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error('[listVersions] Error:', error);
    return [];
  }
}

/**
 * Get a specific version
 */
export async function getVersion(
  noteId: string,
  versionNumber: number
): Promise<NoteVersion | null> {
  try {
    const { data, error } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .eq('version_number', versionNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data ?? null;
  } catch (error) {
    console.error('[getVersion] Error:', error);
    return null;
  }
}
