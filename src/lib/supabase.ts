// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* =========================
   ENV VARS
========================= */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* =========================
   VALIDATION
========================= */

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase environment variables", {
    VITE_SUPABASE_URL: SUPABASE_URL ? "OK" : "MISSING",
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "OK" : "MISSING",
  });

  throw new Error(
    "Supabase ENV fehlt. Bitte setze VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY " +
      "in .env oder .env.local und starte den Dev-Server neu."
  );
}

/* =========================
   SINGLETON CLIENT
========================= */
/**
 * ⚠️ WICHTIG
 * - Es darf im Projekt NUR diese createClient-Instanz geben
 * - Alle Imports müssen von genau dieser Datei kommen
 * - Sonst gehen Sessions verloren → auth.uid() = NULL → RLS blockiert
 */

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,        // Session in localStorage
      autoRefreshToken: true,      // Token automatisch erneuern
      detectSessionInUrl: true,    // OAuth / Magic Links
      storageKey: "sb-auth-token", // explizit setzen → verhindert Konflikte
    },
    global: {
      headers: {
        "X-Client-Info": "vite-react-app",
      },
    },
  }
);
