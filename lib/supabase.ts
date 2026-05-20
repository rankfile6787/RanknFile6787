import { createClient } from "@supabase/supabase-js";
import type { CommentCategory, CommentStatus, ForumComment } from "./types";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createBrowserSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export function createServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase service environment variables are not configured.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

export function normalizeComment(row: Record<string, unknown>): ForumComment {
  return {
    id: String(row.id),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    created_at: String(row.created_at || row.timestamp || ""),
    display_name: String(row.display_name || "Rank & File"),
    category: normalizeCategory(row.category),
    body: String(row.body || row.comment || ""),
    status: normalizeStatus(row.status),
    website: row.website ? String(row.website) : null,
    ip_hash: row.ip_hash ? String(row.ip_hash) : null,
  };
}

export function normalizeCategory(value: unknown): CommentCategory {
  const category = String(value || "").trim().toLowerCase();
  if (category === "news" || category === "questions") return category;
  return "general";
}

export function normalizeStatus(value: unknown): CommentStatus {
  const status = String(value || "").trim().toLowerCase();
  if (status === "approved" || status === "rejected") return status;
  return "pending";
}

export function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
