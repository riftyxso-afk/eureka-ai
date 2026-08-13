/**
 * Supabase Client Setup (anon key — untuk auth di sisi client).
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrl.includes(".supabase.co") &&
    supabaseAnonKey.length > 40 &&
    supabaseAnonKey.startsWith("eyJ")
  );
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Ambil access token Supabase saat ini (untuk header Authorization).
 * Null bila belum login / Supabase belum dikonfigurasi.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export type Database = {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          summary: string;
          subject: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          summary: string;
          subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          summary?: string;
          subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chunks: {
        Row: {
          id: string;
          note_id: string;
          chapter_id: number;
          text: string;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          chapter_id: number;
          text: string;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          chapter_id?: number;
          text?: string;
          embedding?: number[] | null;
          created_at?: string;
        };
      };
      presence: {
        Row: {
          note_id: string;
          user_id: string;
          name: string;
          role: 'editor' | 'viewer';
          last_active: number;
          created_at: string;
        };
        Insert: {
          note_id: string;
          user_id: string;
          name: string;
          role: 'editor' | 'viewer';
          last_active: number;
          created_at?: string;
        };
        Update: {
          note_id?: string;
          user_id?: string;
          name?: string;
          role?: 'editor' | 'viewer';
          last_active?: number;
          created_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          note_id: string;
          sender_name: string;
          content: string;
          parent_id: string | null;
          is_ai: boolean;
          mentions: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          sender_name: string;
          content: string;
          parent_id?: string | null;
          is_ai?: boolean;
          mentions?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          sender_name?: string;
          content?: string;
          parent_id?: string | null;
          is_ai?: boolean;
          mentions?: string[] | null;
          created_at?: string;
        };
      };
      versions: {
        Row: {
          id: string;
          note_id: string;
          version: number;
          title: string;
          summary: string;
          changed_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          version: number;
          title: string;
          summary: string;
          changed_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          version?: number;
          title?: string;
          summary?: string;
          changed_by?: string;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          profile_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          profile_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          profile_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          url: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          source_type: 'pdf' | 'web' | 'drive';
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          source_type: 'pdf' | 'web' | 'drive';
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          url?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          source_type?: 'pdf' | 'web' | 'drive';
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          note_id: string;
          progress: number;
          status: 'queued' | 'processing' | 'completed' | 'failed';
          message: string | null;
          result: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          progress: number;
          status: 'queued' | 'processing' | 'completed' | 'failed';
          message?: string | null;
          result?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          progress?: number;
          status?: 'queued' | 'processing' | 'completed' | 'failed';
          message?: string | null;
          result?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string | null;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string | null;
          color?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: number[];
          note_id?: string;
          similarity_threshold?: number;
          top_k?: number;
        };
        Returns: {
          id: string;
          note_id: string;
          chapter_id: number;
          text: string;
          embedding: number[];
          similarity: number;
        }[];
      };
    };
    Enums: {};
  };
};
