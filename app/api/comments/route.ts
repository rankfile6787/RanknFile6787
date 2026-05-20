import { NextResponse, type NextRequest } from "next/server";
import backupComments from "@/public/comments.backup.json";
import { createServiceSupabase, getAdminEmails, isSupabaseConfigured, normalizeCategory, normalizeComment } from "@/lib/supabase";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function isAdminRequest(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;

  const supabase = createServiceSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return false;

  const allowedEmails = getAdminEmails();
  return allowedEmails.includes(data.user.email.toLowerCase());
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") || "approved";

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const rows = (backupComments as Record<string, unknown>[])
      .map(normalizeComment)
      .filter((comment) => (status === "all" ? true : comment.status === "approved"));
    return NextResponse.json({ comments: rows, source: "backup" });
  }

  if (status !== "approved" && !(await isAdminRequest(request))) {
    return jsonError("Admin access is required.", 401);
  }

  const supabase = createServiceSupabase();
  let query = supabase.from("comments").select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ comments: (data || []).map(normalizeComment), source: "supabase" });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError("Supabase is not configured yet.", 503);
  }

  const body = await request.json().catch(() => null);
  const comment = String(body?.comment || "").trim();
  const website = String(body?.website || "").trim();

  if (website) return NextResponse.json({ ok: true });
  if (!comment) return jsonError("Comment is required.");
  if (comment.length > 3000) return jsonError("Comment must be 3000 characters or fewer.");

  const payload = {
    id: `p_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
    parent_id: body?.parent_id ? String(body.parent_id) : null,
    display_name: String(body?.display_name || "Rank & File").trim() || "Rank & File",
    category: normalizeCategory(body?.category),
    body: comment,
    status: "pending",
    website: null,
    ip_hash: null,
  };

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("comments").insert(payload);
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true, id: payload.id });
}
