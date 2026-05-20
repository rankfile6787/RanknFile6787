import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("election_materials")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ materials: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  const action = String(body?.action || "");

  if (!id || !["approve", "reject", "update"].includes(action)) {
    return NextResponse.json({ error: "Valid id and action are required." }, { status: 400 });
  }

  if (action === "update") {
    const updates: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of ["candidate_name", "position", "material_kind", "summary", "external_url", "status"]) {
      if (body?.[key] !== undefined) updates[key] = String(body[key] || "").trim() || null;
    }
    if (body?.display_order !== undefined) updates.display_order = String(Number(body.display_order || 0));
    if (updates.status && !["pending", "approved", "rejected"].includes(updates.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    if (updates.material_kind && !["incumbent", "candidate", "campaign-material"].includes(updates.material_kind)) {
      return NextResponse.json({ error: "Invalid material kind." }, { status: 400 });
    }
    if (!updates.summary) delete updates.summary;
    if (!updates.external_url) delete updates.external_url;

    const supabase = createServiceSupabase();
    const { error } = await supabase.from("election_materials").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const timestampColumn = action === "approve" ? "approved_at" : "rejected_at";
  const userColumn = action === "approve" ? "approved_by" : "rejected_by";

  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("election_materials")
    .update({
      status,
      updated_at: new Date().toISOString(),
      [timestampColumn]: new Date().toISOString(),
      [userColumn]: user.id,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
