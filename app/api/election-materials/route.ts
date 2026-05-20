import { NextResponse, type NextRequest } from "next/server";
import { slugify } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase";

async function uploadElectionFile(file: File) {
  const supabase = createServiceSupabase();
  const bucket = "rankandfile6787";
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => null);

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `election/${Date.now()}-${slugify(file.name)}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_path: path, file_url: data.publicUrl };
}

export async function GET() {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("election_materials")
    .select("*")
    .eq("status", "approved")
    .order("material_kind")
    .order("display_order", { ascending: true })
    .order("candidate_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ materials: data || [] });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const candidateName = String(formData.get("candidate_name") || "").trim();
  const position = String(formData.get("position") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const externalUrl = String(formData.get("external_url") || "").trim();
  const submitterName = String(formData.get("submitter_name") || "").trim();
  const submitterEmail = String(formData.get("submitter_email") || "").trim();
  const website = String(formData.get("website") || "").trim();
  const file = formData.get("file");

  if (website) return NextResponse.json({ ok: true });
  if (!candidateName || !position) {
    return NextResponse.json({ error: "Candidate name and position are required." }, { status: 400 });
  }

  let upload = { file_url: null as string | null, file_path: null as string | null };
  if (file instanceof File && file.size > 0) upload = await uploadElectionFile(file);

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("election_materials").insert({
    candidate_name: candidateName,
    position,
    material_kind: "campaign-material",
    summary: summary || null,
    external_url: externalUrl || null,
    file_url: upload.file_url,
    file_path: upload.file_path,
    submitter_name: submitterName || null,
    submitter_email: submitterEmail || null,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
