import { createClient } from "@supabase/supabase-js";

function getEnvVar(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = import.meta.env[name];

  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} fehlt oder ist leer. Bitte prüfe deine .env Datei.`);
  }

  return value;
}

const supabaseUrl = getEnvVar("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});