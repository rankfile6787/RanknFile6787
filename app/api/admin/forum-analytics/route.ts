import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data, error } = await supabase.rpc("get_forum_analytics");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { analytics: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
