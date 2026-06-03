import { NextResponse, type NextRequest } from "next/server";
import {
  defaultNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/lib/notifications";
import { createServiceSupabase } from "@/lib/supabase";

const preferenceKeys: NotificationPreferenceKey[] = [
  "forum_posts",
  "forum_replies",
  "incentive_updates",
  "new_flyers",
  "new_resources",
];

function normalizePreferences(value: unknown): NotificationPreferences {
  const input = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
  return preferenceKeys.reduce(
    (preferences, key) => ({
      ...preferences,
      [key]: typeof input[key] === "boolean" ? Boolean(input[key]) : defaultNotificationPreferences[key],
    }),
    { ...defaultNotificationPreferences }
  );
}

function parseSubscription(value: unknown) {
  const subscription = typeof value === "object" && value ? (value as Record<string, any>) : null;
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");

  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const subscription = parseSubscription(body?.subscription);

  if (!subscription) {
    return NextResponse.json({ error: "A valid push subscription is required." }, { status: 400 });
  }

  const preferences = normalizePreferences(body?.preferences);
  const supabase = createServiceSupabase();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      ...subscription,
      preferences,
      user_agent: request.headers.get("user-agent") || null,
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, preferences });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const endpoint = String(body?.endpoint || "");

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint is required." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
