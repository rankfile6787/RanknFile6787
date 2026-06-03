import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { sendPushNotification } from "@/lib/notifications";
import { createServiceSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("production_bonus_rows")
    .select("*")
    .order("week_ending", { ascending: false })
    .limit(52);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser(request);
  if (!user) return NextResponse.json({ error: "Admin access is required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const weekEnding = String(body?.week_ending || "").trim();
  if (!weekEnding) return NextResponse.json({ error: "Week ending is required." }, { status: 400 });

  const payload = {
    week_ending: weekEnding,
    coke: String(body?.coke || "").trim() || null,
    primary_area: String(body?.primary_area || "").trim() || null,
    hot_roll: String(body?.hot_roll || "").trim() || null,
    finishing: String(body?.finishing || "").trim() || null,
    plate: String(body?.plate || "").trim() || null,
    plant_avg: String(body?.plant_avg || "").trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("production_bonus_rows").upsert(payload, { onConflict: "week_ending" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendPushNotification({
    type: "incentive_updates",
    title: "Incentive update posted",
    body: `Production bonus data was updated for week ending ${weekEnding}.`,
    url: "/production-bonus",
  });

  return NextResponse.json({ ok: true });
}
