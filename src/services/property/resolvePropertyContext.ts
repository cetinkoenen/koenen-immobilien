import { supabase } from "../../lib/supabaseClient";

function toSafeString(value: unknown): string {
  return String(value ?? "").trim();
}

function pickDisplayName(row: Record<string, unknown> | null | undefined): string | undefined {
  if (!row) return undefined;
  return [row.name, row.title, row.property_name, row.object_name, row.address, row.street]
    .map(toSafeString)
    .find(Boolean);
}

function pickAddress(row: Record<string, unknown> | null | undefined): string | undefined {
  if (!row) return undefined;
  return [row.address, row.street, row.location, row.city]
    .map(toSafeString)
    .find(Boolean);
}

async function hasRows(table: string, propertyId: string): Promise<boolean> {
  if (!propertyId) return false;

  const { data, error } = await supabase
    .from(table)
    .select("property_id")
    .eq("property_id", propertyId)
    .limit(1);

  return !error && Array.isArray(data) && data.length > 0;
}

async function bestIdForTables(candidates: string[], tables: string[]): Promise<string> {
  const cleanCandidates = Array.from(new Set(candidates.map(toSafeString).filter(Boolean)));
  for (const candidate of cleanCandidates) {
    const checks = await Promise.all(tables.map((table) => hasRows(table, candidate)));
    if (checks.some(Boolean)) return candidate;
  }
  return cleanCandidates[0] ?? "";
}

export async function resolvePropertyContext(propertyId: string) {
  const routeId = toSafeString(propertyId);
  if (!routeId) return null;

  const [propertyById, portfolioById, portfolioByCoreId] = await Promise.all([
    supabase.from("properties").select("*").eq("id", routeId).maybeSingle(),
    supabase.from("portfolio_properties").select("*").eq("id", routeId).maybeSingle(),
    supabase.from("portfolio_properties").select("*").eq("core_property_id", routeId).maybeSingle(),
  ]);

  if (propertyById.error) console.warn("resolvePropertyContext properties error:", propertyById.error.message);
  if (portfolioById.error) console.warn("resolvePropertyContext portfolio id error:", portfolioById.error.message);
  if (portfolioByCoreId.error) console.warn("resolvePropertyContext portfolio core error:", portfolioByCoreId.error.message);

  const portfolio = (portfolioById.data ?? portfolioByCoreId.data ?? null) as Record<string, unknown> | null;
  const property = (propertyById.data ?? null) as Record<string, unknown> | null;
  const corePropertyId = toSafeString(portfolio?.core_property_id) || toSafeString(property?.id);
  const portfolioPropertyId = toSafeString(portfolio?.id);

  const candidates = [routeId, corePropertyId, portfolioPropertyId].filter(Boolean);
  const incomePropertyId = await bestIdForTables(candidates, [
    "property_income",
    "yearly_property_income",
    "yearly_capex_entries",
  ]);
  const ledgerPropertyId = await bestIdForTables(candidates, ["property_loan_ledger"]);

  return {
    propertyId: routeId,
    property: property ?? portfolio ?? null,
    incomePropertyId: incomePropertyId || routeId,
    ledgerPropertyId: ledgerPropertyId || routeId,
    portfolioPropertyId: portfolioPropertyId || undefined,
    corePropertyId: corePropertyId || undefined,
    displayName: pickDisplayName(portfolio) ?? pickDisplayName(property),
    address: pickAddress(portfolio) ?? pickAddress(property),
  };
}

export type ResolvedPropertyContext = {
  propertyId: string;
  property: any;
  incomePropertyId?: string;
  ledgerPropertyId?: string;
  portfolioPropertyId?: string;
  corePropertyId?: string;
  displayName?: string;
  address?: string;
};
