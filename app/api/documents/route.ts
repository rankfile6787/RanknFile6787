import { NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") || "resources";
  if (!["flyers", "resources"].includes(section)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("managed_documents")
    .select("*")
    .eq("section", section)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data || [] });
}
