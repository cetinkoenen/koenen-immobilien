// src/lib/supabaseAdmin.ts
if (typeof window !== "undefined") {
  throw new Error("supabaseAdmin must never run in the browser");
}

import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("SUPABASE_URL fehlt in environment");
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt in environment");

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
    global: {
      headers: {
        // optional, aber hilfreich
        "X-Client-Info": "koenen-admin-dashboard",
      },
    },
  });
}
