import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser, slugify } from "@/lib/admin";
import { excerpt, sendPushNotification } from "@/lib/notifications";
import { createServiceSupabase } from "@/lib/supabase";

const topics = new Set(["flyer", "suggestion", "site-issue", "other"]);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageSize = 8 * 1024 * 1024;

async function uploadImage(file: File) {
  if (!imageTypes.has(file.type)) {
    throw new Error("Upload a JPG, PNG, WEBP, or GIF image.");
  }
  if (file.size > maxImageSize) {
    throw new Error("Image must be 8 MB or smaller.");
  }

  const supabase = createServiceSupabase();
  const bucket = "rankandfile6787";
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => null);

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `contact/${Date.now()}-${slugify(file.name)}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { image_path: path, image_url: data.publicUrl };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const website = String(formData.get("website") || "").trim();
  if (website) return NextResponse.json({ ok: true });

  const name = String(formData.get("name") || "").trim();
  const contact = String(formData.get("contact") || "").trim();
  const topicInput = String(formData.get("topic") || "other");
  const topic = topics.has(topicInput) ? topicInput : "other";
  const message = String(formData.get("message") || "").trim();
  const file = formData.get("image");

  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (message.length > 3000) return NextResponse.json({ error: "Message must be 3000 characters or fewer." }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "Name must be 120 characters or fewer." }, { status: 400 });
  if (contact.length > 180) return NextResponse.json({ error: "Contact info must be 180 characters or fewer." }, { status: 400 });

  let upload = { image_url: null as string | null, image_path: null as string | null };
  try {
    if (file instanceof File && file.size > 0) upload = await uploadImage(file);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload image." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("contact_submissions").insert({
    name: name || null,
    contact: contact || null,
    topic,
    message,
    image_url: upload.image_url,
    image_path: upload.image_path,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendPushNotification({
    type: "contact_submissions",
    title: "New contact submission",
    body: `${topic}: ${excerpt(message)}`,
    url: "/admin",
    audience: "admin",
  });

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status") || "new";
  const supabase = createServiceSupabase();
  let query = supabase.from("contact_submissions").select("*").order("created_at", { ascending: false });
  if (["new", "reviewed", "archived"].includes(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data || [] });
}

export async function PATCH(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  const status = String(body?.status || "");
  if (!id || !["new", "reviewed", "archived"].includes(status)) {
    return NextResponse.json({ error: "A valid id and status are required." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("contact_submissions").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Submission id is required." }, { status: 400 });

  const supabase = createServiceSupabase();
  const { data: submission, error: fetchError } = await supabase
    .from("contact_submissions")
    .select("image_path")
    .eq("id", id)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const { error } = await supabase.from("contact_submissions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (submission?.image_path) {
    await supabase.storage.from("rankandfile6787").remove([submission.image_path]).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
