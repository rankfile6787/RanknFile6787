import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminEmails } from "@/lib/supabase";

function adminOriginFrom(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (origin.includes("admin.rankandfile6787.com")) return origin;
  return "https://admin.rankandfile6787.com";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const adminEmails = getAdminEmails();
  if (!adminEmails.includes(email)) {
    return NextResponse.json({ ok: true });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase public environment variables are not configured." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${adminOriginFrom(request)}/admin?reset=1`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
