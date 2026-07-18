import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { stdin } from "node:process";

const users = [
  { email: "nihal.koenen@gmail.com", role: "viewer" },
  { email: "cetin.koenen@gmail.com", role: "viewer" },
];

async function loadDotenv(path) {
  if (!path) return;

  const content = await readFile(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (isQuoted) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value.replace(/\\n/g, "\n");
  }
}

async function readPasswordFromStdin() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

await loadDotenv(process.env.DOTENV_PATH);

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountId = process.env.KOENEN_ACCOUNT_ID;
let password = process.env.READONLY_USER_PASSWORD;

if (!password && process.env.READONLY_USER_PASSWORD_STDIN === "1") {
  password = await readPasswordFromStdin();
}

if (!url || !serviceRole || !password) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY und READONLY_USER_PASSWORD muessen gesetzt sein oder READONLY_USER_PASSWORD_STDIN=1 nutzen.");
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }

  return null;
}

async function resolveAccountId() {
  if (accountId) return accountId;

  const admin = await findUserByEmail("info.koenen@gmail.com");
  if (!admin?.id) return null;

  const { data, error } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", admin.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.account_id ?? null;
}

const resolvedAccountId = await resolveAccountId();

for (const user of users) {
  let authUser = await findUserByEmail(user.email);

  if (authUser?.id) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { role: user.role, access: "readonly" },
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { role: user.role, access: "readonly" },
    });
    if (error) throw error;
    authUser = data.user;
  }

  await supabase.from("app_user_access").upsert({
    email: user.email,
    role: user.role,
    requires_login_approval: true,
    approved_at: null,
    is_active: true,
  });

  if (resolvedAccountId && authUser?.id) {
    await supabase.from("account_members").upsert({
      account_id: resolvedAccountId,
      user_id: authUser.id,
      role: user.role,
    });
  }

  console.log(`${user.email}: Passwort/Readonly aktualisiert${resolvedAccountId ? " und account_members viewer gesetzt" : ""}`);
}
