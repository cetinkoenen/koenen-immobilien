import { supabase } from "../lib/supabaseClient";

export type PropertyExtraInfo = {
  livingArea: string;
  rooms: string;
  coldRent: string;
  operatingCosts: string;
  totalRent: string;
  marketValue: string;
  equipment: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

export const PROPERTY_EXTRA_TABLE = "property_extra_info";
export const PORTFOLIO_EXTRA_STORAGE_KEY = "koenen:portfolio:object-overview-extra:v4";
export const TENANT_STORAGE_KEY = "koenen:mieteruebersicht:tenant-info:v3";

export const emptyPropertyExtra: PropertyExtraInfo = {
  livingArea: "",
  rooms: "",
  coldRent: "",
  operatingCosts: "",
  totalRent: "",
  marketValue: "",
  equipment: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
};

type DbRow = {
  property_id: string;
  living_area?: string | null;
  rooms?: string | null;
  cold_rent?: string | null;
  operating_costs?: string | null;
  total_rent?: string | null;
  market_value?: string | null;
  equipment?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
};

function normalizeExtra(value: Partial<PropertyExtraInfo> | null | undefined): PropertyExtraInfo {
  return { ...emptyPropertyExtra, ...(value ?? {}) };
}

function rowToExtra(row: DbRow): PropertyExtraInfo {
  return {
    livingArea: row.living_area ?? "",
    rooms: row.rooms ?? "",
    coldRent: row.cold_rent ?? "",
    operatingCosts: row.operating_costs ?? "",
    totalRent: row.total_rent ?? "",
    marketValue: row.market_value ?? "",
    equipment: row.equipment ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
  };
}

function extraToDb(propertyId: string, userId: string, extra: PropertyExtraInfo) {
  return {
    property_id: propertyId,
    user_id: userId,
    living_area: extra.livingArea || null,
    rooms: extra.rooms || null,
    cold_rent: extra.coldRent || null,
    operating_costs: extra.operatingCosts || null,
    total_rent: extra.totalRent || null,
    market_value: extra.marketValue || null,
    equipment: extra.equipment || null,
    first_name: extra.firstName || null,
    last_name: extra.lastName || null,
    phone: extra.phone || null,
    email: extra.email || null,
    updated_at: new Date().toISOString(),
  };
}

function hasAnyValue(extra: PropertyExtraInfo): boolean {
  return Object.values(extra).some((value) => String(value ?? "").trim() !== "");
}

function readJsonRecord(key: string): Record<string, any> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadLocalPortfolioExtras(): Record<string, PropertyExtraInfo> {
  try {
    const raw =
      window.localStorage.getItem(PORTFOLIO_EXTRA_STORAGE_KEY) ??
      window.localStorage.getItem("koenen:portfolio:object-overview-extra:v3") ??
      window.localStorage.getItem("koenen:portfolio:object-overview-extra:v2");
    const parsed = raw ? (JSON.parse(raw) as Record<string, Partial<PropertyExtraInfo>>) : {};
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, normalizeExtra(value)]));
  } catch {
    return {};
  }
}

export function loadLocalTenantExtras(): Record<string, PropertyExtraInfo> {
  const current = readJsonRecord(TENANT_STORAGE_KEY);
  const legacy = readJsonRecord("koenen:mieteruebersicht:tenant-info:v2");
  const source = { ...legacy, ...current };
  return Object.fromEntries(
    Object.entries(source).map(([key, value]: [string, any]) => [
      key,
      normalizeExtra({
        firstName: value?.firstName ?? "",
        lastName: value?.lastName ?? "",
        phone: value?.phone ?? "",
        email: value?.email ?? "",
      }),
    ])
  );
}

export function writeLocalPortfolioExtras(data: Record<string, PropertyExtraInfo>) {
  window.localStorage.setItem(PORTFOLIO_EXTRA_STORAGE_KEY, JSON.stringify(data));
}

export function writeLocalTenantExtras(data: Record<string, PropertyExtraInfo>) {
  const tenantOnly = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      {
        firstName: value.firstName,
        lastName: value.lastName,
        phone: value.phone,
        email: value.email,
      },
    ])
  );
  window.localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenantOnly));
}

export function mergeExtra(base: PropertyExtraInfo, incoming: Partial<PropertyExtraInfo>): PropertyExtraInfo {
  return { ...base, ...incoming };
}

export function mergeLocalSources(): Record<string, PropertyExtraInfo> {
  const portfolio = loadLocalPortfolioExtras();
  const tenants = loadLocalTenantExtras();
  const keys = new Set([...Object.keys(portfolio), ...Object.keys(tenants)]);
  const merged: Record<string, PropertyExtraInfo> = {};
  for (const key of keys) merged[key] = { ...emptyPropertyExtra, ...(portfolio[key] ?? {}), ...(tenants[key] ?? {}) };
  return merged;
}

export async function fetchPropertyExtras(propertyIds: string[]): Promise<Record<string, PropertyExtraInfo>> {
  const ids = [...new Set(propertyIds.filter(Boolean).map(String))];
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from(PROPERTY_EXTRA_TABLE)
    .select(
      "property_id,living_area,rooms,cold_rent,operating_costs,total_rent,market_value,equipment,first_name,last_name,phone,email"
    )
    .in("property_id", ids);

  if (error) throw error;

  return Object.fromEntries(((data ?? []) as DbRow[]).map((row) => [String(row.property_id), rowToExtra(row)]));
}

export async function savePropertyExtra(propertyId: string, extra: PropertyExtraInfo): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Nicht eingeloggt. Bitte neu einloggen und erneut speichern.");

  const { error } = await supabase
    .from(PROPERTY_EXTRA_TABLE)
    .upsert(extraToDb(propertyId, user.id, normalizeExtra(extra)), { onConflict: "user_id,property_id" });

  if (error) throw error;
}

export async function migrateLocalExtrasToSupabase(
  propertyIds: string[],
  local: Record<string, PropertyExtraInfo>,
  remote: Record<string, PropertyExtraInfo>
): Promise<void> {
  const idsToMigrate = propertyIds.filter((id) => !remote[id] && hasAnyValue(local[id] ?? emptyPropertyExtra));
  for (const id of idsToMigrate) {
    await savePropertyExtra(id, local[id]);
  }
}
