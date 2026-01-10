// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* =========================
   ENV VARS
========================= */

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

/* =========================
   VALIDATION
========================= */

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase environment variables:", {
    VITE_SUPABASE_URL: SUPABASE_URL ? "OK" : "MISSING",
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "OK" : "MISSING",
  });

  throw new Error(
    "Supabase ENV fehlt. Bitte setze VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env oder .env.local und starte den Dev-Server neu."
  );
}

/* =========================
   CLIENT
========================= */

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
