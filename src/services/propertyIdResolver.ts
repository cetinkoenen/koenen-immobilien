import { supabase } from "@/lib/supabase";

function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export async function resolveBestFinancePropertyId(
  routePropertyId: string | null | undefined
): Promise<string> {
  const id = toSafeString(routePropertyId);

  if (!id) return "";

  // Fall 1: Route zeigt direkt auf portfolio_properties.id
  const portfolioById = await supabase
    .from("portfolio_properties")
    .select("id, core_property_id")
    .eq("id", id)
    .maybeSingle();

  console.log("propertyIdResolver.portfolioById", {
    routePropertyId: id,
    data: portfolioById.data,
    error: portfolioById.error,
  });

  if (!portfolioById.error && portfolioById.data?.core_property_id) {
    return toSafeString(portfolioById.data.core_property_id);
  }

  // Fall 2: Route zeigt direkt auf properties.id
  const propertyById = await supabase
    .from("properties")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  console.log("propertyIdResolver.propertyById", {
    routePropertyId: id,
    data: propertyById.data,
    error: propertyById.error,
  });

  if (!propertyById.error && propertyById.data?.id) {
    return toSafeString(propertyById.data.id);
  }

  // Fall 3: Route zeigt evtl. schon auf core_property_id eines portfolio-Objekts
  const portfolioByCoreId = await supabase
    .from("portfolio_properties")
    .select("id, core_property_id")
    .eq("core_property_id", id)
    .limit(1);

  console.log("propertyIdResolver.portfolioByCoreId", {
    routePropertyId: id,
    data: portfolioByCoreId.data,
    error: portfolioByCoreId.error,
  });

  if (!portfolioByCoreId.error && Array.isArray(portfolioByCoreId.data) && portfolioByCoreId.data.length > 0) {
    return id;
  }

  // Fallback: Original-ID zurückgeben
  return id;
}
