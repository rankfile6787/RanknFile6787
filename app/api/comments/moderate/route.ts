import { NextResponse, type NextRequest } from "next/server";
import { excerpt, sendPushNotification } from "@/lib/notifications";
import { createServiceSupabase, getAdminEmails } from "@/lib/supabase";

async function getAdminUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabase = createServiceSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const allowedEmails = getAdminEmails();
  if (!allowedEmails.includes(data.user.email.toLowerCase())) return null;
  return data.user;
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  const action = String(body?.action || "");

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "A valid comment id and action are required." }, { status: 400 });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const timestampColumn = action === "approve" ? "approved_at" : "rejected_at";
  const userColumn = action === "approve" ? "approved_by" : "rejected_by";

  const supabase = createServiceSupabase();
  const { data: comment, error } = await supabase
    .from("comments")
    .update({
      status,
      [timestampColumn]: new Date().toISOString(),
      [userColumn]: user.id,
    })
    .eq("id", id)
    .select("id, parent_id, display_name, body")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: user.id,
    action,
    entity_type: "comment",
    entity_id: id,
  });

  if (action === "approve" && comment) {
    const isReply = Boolean(comment.parent_id);
    await sendPushNotification({
      type: isReply ? "forum_replies" : "forum_posts",
      title: isReply ? "New forum reply" : "New forum post",
      body: `${comment.display_name || "Rank & File"}: ${excerpt(comment.body || "")}`,
      url: "/forum",
    });
  }

  return NextResponse.json({ ok: true });
}
