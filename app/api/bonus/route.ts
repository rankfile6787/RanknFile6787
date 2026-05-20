import { NextResponse } from "next/server";
import backupRows from "@/public/production-bonus.backup.json";
import { createServiceSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ rows: backupRows, source: "backup" });
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("production_bonus_rows")
    .select("*")
    .order("week_ending", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [], source: "supabase" });
}
