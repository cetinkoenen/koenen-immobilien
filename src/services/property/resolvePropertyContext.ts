import { supabase } from "../../lib/supabaseClient";

export async function resolvePropertyContext(propertyId: string) {
  if (!propertyId) return null;

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  if (error) {
    console.warn("resolvePropertyContext error:", error.message);
  }

  return {
    propertyId,
    property: property ?? null,
  };
}
