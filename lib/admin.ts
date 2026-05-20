import type { NextRequest } from "next/server";
import { createServiceSupabase, getAdminEmails } from "./supabase";

export async function getAdminUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabase = createServiceSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const allowedEmails = getAdminEmails();
  if (!allowedEmails.includes(data.user.email.toLowerCase())) return null;

  return data.user;
}

export function adminError() {
  return Response.json({ error: "Admin access is required." }, { status: 401 });
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
