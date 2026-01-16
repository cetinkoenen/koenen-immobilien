// src/lib/supabaseClient.ts

/**
 * ⚠️ WICHTIG
 * Diese Datei darf KEINEN eigenen Supabase-Client erzeugen.
 * Sie re-exportiert ausschließlich die Singleton-Instanz aus `supabase.ts`.
 *
 * Grund:
 * - Mehrere createClient()-Instanzen = verlorene Session
 * - verlorene Session = auth.uid() === null
 * - auth.uid() === null = RLS blockiert
 */

export { supabase } from "./supabase";
export type { SupabaseClient } from "@supabase/supabase-js";
