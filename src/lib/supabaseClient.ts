// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log("SUPABASE_URL:", supabaseUrl);
console.log("SUPABASE_KEY prefix:", (supabaseAnonKey || "").slice(0, 12));

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check .env.local and restart dev server."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
