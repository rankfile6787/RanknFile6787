import { NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

const idPattern = /^[A-Za-z0-9_-]{16,80}$/;
const botPattern = /bot|crawler|spider|headless|preview|slurp|bingpreview|facebookexternalhit/i;

function hasMatchingOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").toLowerCase();
    return Boolean(requestHost && originHost === requestHost);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";
  if (botPattern.test(userAgent)) return NextResponse.json({ ok: true, ignored: true });
  if (!hasMatchingOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const eventId = String(body?.event_id || "").trim();
  const visitorId = String(body?.visitor_id || "").trim();
  const sessionId = String(body?.session_id || "").trim();

  if (![eventId, visitorId, sessionId].every((value) => idPattern.test(value))) {
    return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("forum_analytics_events").insert({
    event_id: eventId,
    visitor_id: visitorId,
    session_id: sessionId,
  });

  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Could not record forum analytics." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
