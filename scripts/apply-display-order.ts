import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import pg from "pg";

loadEnvConfig(process.cwd());

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set; skipping direct SQL migration.");
    return;
  }

  const sql = (await readFile("supabase/election-display-order.sql", "utf8")).replace(/^\uFEFF/, "");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
  console.log("Applied display_order migration.");
}

main().catch((error) => {
  console.warn(`Could not apply display_order migration: ${error.message}`);
  process.exit(0);
});
