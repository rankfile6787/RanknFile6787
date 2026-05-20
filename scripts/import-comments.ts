import { loadEnvConfig } from "@next/env";
import { createServiceSupabase, normalizeCategory, normalizeStatus } from "../lib/supabase";
import { parseCsv } from "../lib/csv";

loadEnvConfig(process.cwd());

const sheetUrl =
  process.env.COMMENTS_SHEET_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/1XRg4oFTZYJiA3JK6nPf9FEhKGDfp1ya1VH3pFR4fRBE/export?format=csv";

function requireValue(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  requireValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  requireValue(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(sheetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet CSV: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv).map((row) => ({
    id: String(row.id || crypto.randomUUID()),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    created_at: row.timestamp ? new Date(String(row.timestamp)).toISOString() : new Date().toISOString(),
    display_name: String(row.display_name || "Rank & File").trim() || "Rank & File",
    category: normalizeCategory(row.category),
    body: String(row.comment || "").trim(),
    status: normalizeStatus(row.status),
    website: row.website ? String(row.website) : null,
    ip_hash: row.ip_hash ? String(row.ip_hash) : null,
  }));

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("comments").upsert(rows, { onConflict: "id" });

  if (error) throw error;
  console.log(`Imported ${rows.length} comments from Google Sheets.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
