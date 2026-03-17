import { supabase } from "@/lib/supabase";

export type Property = {
  id: string;
  name: string | null;
  title: string | null;
  address: string | null;
  city: string | null;
  created_at: string | null;
};

const PROPERTY_TABLE = "properties";

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

function normalizePropertyRow(row: RawPropertyRow): Property {
  return {
    id: toRequiredString(row.id),
    name: toNullableString(row.name),
    title: toNullableString(row.title),
    address: toNullableString(row.address),
    city: toNullableString(row.city),
    created_at: toNullableString(row.created_at),
  };
}

export async function getPropertyById(
  propertyId: string
): Promise<Property | null> {
  const trimmedPropertyId = propertyId?.trim();

  if (!trimmedPropertyId) {
    throw new Error("Es wurde keine gültige propertyId übergeben.");
  }

  console.log("propertyService.getPropertyById:start", {
    table: PROPERTY_TABLE,
    propertyId: trimmedPropertyId,
  });

  const { data, error } = await supabase
    .from(PROPERTY_TABLE)
    .select("*")
    .eq("id", trimmedPropertyId)
    .maybeSingle();

  console.log("propertyService.getPropertyById:result", {
    propertyId: trimmedPropertyId,
    data,
    error,
  });

  if (error) {
    throw new Error(`Objekt konnte nicht geladen werden: ${error.message}`);
  }

  if (!data) {
    console.warn("propertyService.getPropertyById:no-data", {
      propertyId: trimmedPropertyId,
    });
    return null;
  }

  const normalized = normalizePropertyRow(data as RawPropertyRow);

  console.log("propertyService.getPropertyById:normalized", normalized);

  return normalized;
}