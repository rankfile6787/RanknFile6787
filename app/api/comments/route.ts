import { NextResponse, type NextRequest } from "next/server";
import { excerpt, sendPushNotification } from "@/lib/notifications";
import backupComments from "@/public/comments.backup.json";
import { createServiceSupabase, getAdminEmails, isSupabaseConfigured, normalizeCategory, normalizeComment } from "@/lib/supabase";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
const maxImageSize = 8 * 1024 * 1024;

async function uploadImage(file: File, id: string) {
  const extension = imageTypes[file.type];
  if (!extension) throw new Error("Upload a JPG, PNG, WEBP, or GIF image.");
  if (file.size > maxImageSize) throw new Error("Image must be 8 MB or smaller.");
  const bytes = await file.arrayBuffer();
  const header = new Uint8Array(bytes.slice(0, 12));
  const matches = file.type === "image/jpeg" ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : file.type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value)
    : file.type === "image/gif" ? String.fromCharCode(...header.slice(0, 6)) === "GIF87a" || String.fromCharCode(...header.slice(0, 6)) === "GIF89a"
    : String.fromCharCode(...header.slice(0, 4)) === "RIFF" && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  if (!matches) throw new Error("The selected file is not a valid image.");
  const supabase = createServiceSupabase();
  const path = `forum/${id}.${extension}`;
  const { error } = await supabase.storage.from("rankandfile6787").upload(path, bytes, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  return { image_path: path, image_url: supabase.storage.from("rankandfile6787").getPublicUrl(path).data.publicUrl };
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

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Could not read your post.");
  const comment = String(form.get("comment") || "").trim();
  const website = String(form.get("website") || "").trim();
  const image = form.get("image");

  if (website) return NextResponse.json({ ok: true });
  if (!comment && !(image instanceof File && image.size > 0)) return jsonError("Write a message or add an image.");
  if (comment.length > 3000) return jsonError("Comment must be 3000 characters or fewer.");
  const id = `p_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let upload: { image_path: string | null; image_url: string | null } = { image_path: null, image_url: null };
  try {
    if (image instanceof File && image.size > 0) upload = await uploadImage(image, id);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not upload image.");
  }

  const payload = {
    id,
    parent_id: form.get("parent_id") ? String(form.get("parent_id")) : null,
    display_name: String(form.get("display_name") || "Rank & File").trim().slice(0, 80) || "Rank & File",
    category: normalizeCategory(form.get("category")),
    body: comment,
    ...upload,
    status: "pending",
    website: null,
    ip_hash: null,
  };

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("comments").insert(payload);
  if (error) {
    if (upload.image_path) await supabase.storage.from("rankandfile6787").remove([upload.image_path]);
    return jsonError(error.message, 500);
  }

  await sendPushNotification({
    type: "pending_comments",
    title: "Forum comment needs review",
    body: `${payload.display_name}: ${excerpt(payload.body || "Image post")}`,
    url: "/admin",
    audience: "admin",
  });

  return NextResponse.json({ ok: true, id: payload.id });
}
