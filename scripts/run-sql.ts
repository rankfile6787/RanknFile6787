import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

loadEnvConfig(process.cwd());

const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error("Usage: npm.cmd run db:run -- <path-to-sql-file>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in .env.");
  process.exit(1);
}

async function main() {
  const filePath = resolve(process.cwd(), sqlFile);
  const sql = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
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

  console.log(`Ran SQL file: ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
