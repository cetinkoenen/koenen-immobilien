import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountId = process.env.KOENEN_ACCOUNT_ID;
const password = "iwillKommen13%";

const users = [
  { email: "nihal.koenen@gmail.com", role: "viewer" },
  { email: "cetin.koenen@gmail.com", role: "viewer" },
];

if (!url || !serviceRole) {
  throw new Error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein.");
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

for (const user of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { role: user.role, access: "readonly" },
  });

  if (error && !error.message.toLowerCase().includes("already")) {
    throw error;
  }

  const userId = data.user?.id;
  await supabase.from("app_user_access").upsert({
    email: user.email,
    role: user.role,
    requires_login_approval: true,
    approved_at: null,
    is_active: true,
  });

  if (accountId && userId) {
    await supabase.from("account_members").upsert({
      account_id: accountId,
      user_id: userId,
      role: user.role,
    });
  }

  console.log(`${user.email}: angelegt/aktualisiert${accountId ? " und account_members viewer gesetzt" : ""}`);
}
