import { supabase } from "@/lib/supabase";

export type Property = {
  id: string;
  name: string | null;
  title: string | null;
  address: string | null;
  city: string | null;
  created_at: string | null;
  source_table?: "properties" | "portfolio_properties";
};

type RawPropertyRow = Record<string, unknown>;

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function toRequiredString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizePropertyRow(
  row: RawPropertyRow,
  sourceTable: "properties" | "portfolio_properties"
): Property {
  return {
    id: toRequiredString(row.id),
    name: toNullableString(row.name),
    title: toNullableString(row.title ?? row.name),
    address: toNullableString(row.address),
    city: toNullableString(row.city),
    created_at: toNullableString(row.created_at),
    source_table: sourceTable,
  };
}

async function fetchFromTable(
  table: "properties" | "portfolio_properties",
  propertyId: string
): Promise<Property | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  console.log("propertyService.fetchFromTable", {
    table,
    propertyId,
    data,
    error,
  });

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return normalizePropertyRow(data as RawPropertyRow, table);
}

export async function getPropertyById(
  propertyId: string
): Promise<Property | null> {
  const trimmedPropertyId = propertyId?.trim();

  if (!trimmedPropertyId) {
    throw new Error("Es wurde keine gültige propertyId übergeben.");
  }

  const fromProperties = await fetchFromTable("properties", trimmedPropertyId);
  if (fromProperties) {
    return fromProperties;
  }

  const fromPortfolioProperties = await fetchFromTable(
    "portfolio_properties",
    trimmedPropertyId
  );
  if (fromPortfolioProperties) {
    return fromPortfolioProperties;
  }

  return null;
}
