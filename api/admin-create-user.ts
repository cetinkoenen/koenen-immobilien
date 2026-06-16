import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";

const ADMIN_EMAIL = "info.koenen@gmail.com";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

async function requireAdmin(req: any) {
  const authHeader = String(req.headers.authorization ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) throw new Error("Auth token missing");

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase public env fehlt");

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || normalizeEmail(data.user?.email) !== ADMIN_EMAIL) {
    throw new Error("Nur Admin darf User anlegen.");
  }
  return data.user;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await requireAdmin(req);

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? "");
    const role = req.body?.role === "admin" ? "admin" : "viewer";
    const requiresApproval = Boolean(req.body?.requiresApproval);

    if (!email || !password) {
      res.status(400).json({ error: "E-Mail und Passwort sind Pflicht." });
      return;
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, access: role === "viewer" ? "readonly" : "admin" },
    });

    if (error && !error.message.toLowerCase().includes("already")) throw error;

    await admin.from("app_user_access").upsert({
      email,
      role,
      requires_login_approval: requiresApproval,
      approved_at: requiresApproval ? null : new Date().toISOString(),
      is_active: true,
    });

    const accountId = String(req.body?.accountId ?? process.env.KOENEN_ACCOUNT_ID ?? "").trim();
    const userId = data.user?.id;
    if (accountId && userId) {
      await admin.from("account_members").upsert({
        account_id: accountId,
        user_id: userId,
        role,
      });
    }

    res.status(200).json({ ok: true, userId: userId ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "User konnte nicht angelegt werden.";
    res.status(500).json({ error: message });
  }
}
