import { NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("election_materials")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ material: data });
}
