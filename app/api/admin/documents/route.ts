import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser, slugify } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase";

const sections = new Set(["flyers", "resources"]);

async function uploadFile(file: File, section: string) {
  const supabase = createServiceSupabase();
  const bucket = "rankandfile6787";
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => null);

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${section}/${Date.now()}-${slugify(file.name)}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_path: path, file_url: data.publicUrl };
}

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") || "flyers";
  const includeDrafts = request.nextUrl.searchParams.get("admin") === "1";
  const isAdmin = includeDrafts ? await getAdminUser(request) : null;

  if (!sections.has(section)) return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  if (includeDrafts && !isAdmin) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const supabase = createServiceSupabase();
  let query = supabase.from("managed_documents").select("*").eq("section", section).order("created_at", { ascending: false });
  if (!includeDrafts) query = query.eq("status", "published");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const formData = await request.formData();
  const section = String(formData.get("section") || "flyers");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "published") === "draft" ? "draft" : "published";
  const externalUrl = String(formData.get("external_url") || "").trim();
  const file = formData.get("file");

  if (!sections.has(section)) return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  let upload = { file_url: externalUrl || null, file_path: null as string | null };
  if (file instanceof File && file.size > 0) upload = await uploadFile(file, section);

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("managed_documents").insert({
    section,
    title,
    description: description || null,
    status,
    file_url: upload.file_url,
    file_path: upload.file_path,
    updated_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Document id is required." }, { status: 400 });

  const supabase = createServiceSupabase();
  const { data: document, error: fetchError } = await supabase
    .from("managed_documents")
    .select("file_path")
    .eq("id", id)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const { error } = await supabase.from("managed_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (document?.file_path) {
    await supabase.storage.from("rankandfile6787").remove([document.file_path]).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
