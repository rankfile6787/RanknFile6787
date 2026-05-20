import { loadEnvConfig } from "@next/env";
import { createServiceSupabase } from "../lib/supabase";

loadEnvConfig(process.cwd());

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: npm exec tsx scripts/create-admin-user.ts <email> <temporary-password>");
  process.exit(1);
}

async function main() {
  const supabase = createServiceSupabase();
  const metadata = { force_password_change: true };

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error) {
    console.log(`Created admin user ${email}.`);
    return;
  }

  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw error;

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (updateError) throw updateError;
  console.log(`Updated existing admin user ${email}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
