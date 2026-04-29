import { supabase } from "../lib/supabaseClient";

export type PropertyExtraInfo = {
  property_id?: string;
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
  living_area?: string;
  cold_rent?: string;
  operating_costs?: string;
  total_rent?: string;
  market_value?: string;
  first_name?: string;
  last_name?: string;
};

export type PropertyExtra = PropertyExtraInfo;

export const emptyPropertyExtra: PropertyExtraInfo = {
  property_id: "",
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
  living_area: "",
  cold_rent: "",
  operating_costs: "",
  total_rent: "",
  market_value: "",
  first_name: "",
  last_name: "",
};

const STORAGE_KEY = "koenen:property-extra-info:v5";
const OLD_KEYS = [
  "koenen:portfolio:object-overview-extra:v4",
  "koenen:portfolio:object-overview-extra:v3",
  "koenen:portfolio:object-overview-extra:v2",
  "koenen:mieteruebersicht:tenant-info:v3",
  "koenen:mieteruebersicht:tenant-info:v2",
  "koenen_property_extra_info",
];

function safeStorageGet(key: string) {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); } catch {}
}

function normalize(value: any): PropertyExtraInfo {
  const normalized: PropertyExtraInfo = {
    ...emptyPropertyExtra,
    property_id: String(value?.property_id ?? value?.propertyId ?? ""),
    livingArea: String(value?.livingArea ?? value?.living_area ?? ""),
    rooms: String(value?.rooms ?? ""),
    coldRent: String(value?.coldRent ?? value?.cold_rent ?? ""),
    operatingCosts: String(value?.operatingCosts ?? value?.operating_costs ?? ""),
    totalRent: String(value?.totalRent ?? value?.total_rent ?? ""),
    marketValue: String(value?.marketValue ?? value?.market_value ?? ""),
    equipment: String(value?.equipment ?? ""),
    firstName: String(value?.firstName ?? value?.first_name ?? ""),
    lastName: String(value?.lastName ?? value?.last_name ?? ""),
    phone: String(value?.phone ?? ""),
    email: String(value?.email ?? ""),
  };
  normalized.living_area = normalized.livingArea;
  normalized.cold_rent = normalized.coldRent;
  normalized.operating_costs = normalized.operatingCosts;
  normalized.total_rent = normalized.totalRent;
  normalized.market_value = normalized.marketValue;
  normalized.first_name = normalized.firstName;
  normalized.last_name = normalized.lastName;
  return normalized;
}

function readRecordFromStorage(key: string): Record<string, PropertyExtraInfo> {
  const raw = safeStorageGet(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, any>;
    const result: Record<string, PropertyExtraInfo> = {};
    for (const [propertyId, value] of Object.entries(parsed ?? {})) {
      result[propertyId] = { ...normalize(value), property_id: String((value as any)?.property_id ?? propertyId) };
    }
    return result;
  } catch { return {}; }
}

export function loadLocalTenantExtras(): Record<string, PropertyExtraInfo> {
  const merged: Record<string, PropertyExtraInfo> = {};
  for (const key of [...OLD_KEYS, STORAGE_KEY]) {
    const record = readRecordFromStorage(key);
    for (const [propertyId, value] of Object.entries(record)) {
      merged[propertyId] = { ...(merged[propertyId] ?? emptyPropertyExtra), ...normalize(value), property_id: propertyId };
    }
  }
  return merged;
}
export function mergeLocalSources(): Record<string, PropertyExtraInfo> { return loadLocalTenantExtras(); }

export function writeLocalTenantExtras(dataOrPropertyId: Record<string, PropertyExtraInfo> | string, extra?: Partial<PropertyExtraInfo>) {
  if (typeof dataOrPropertyId === "string") {
    const propertyId = dataOrPropertyId;
    const all = loadLocalTenantExtras();
    all[propertyId] = { ...(all[propertyId] ?? emptyPropertyExtra), ...normalize(extra ?? {}), property_id: propertyId };
    safeStorageSet(STORAGE_KEY, JSON.stringify(all));
    return;
  }
  safeStorageSet(STORAGE_KEY, JSON.stringify(dataOrPropertyId));
}
export function writeLocalPropertyExtras(dataOrPropertyId: Record<string, PropertyExtraInfo> | string, extra?: Partial<PropertyExtraInfo>) { writeLocalTenantExtras(dataOrPropertyId as any, extra); }
export function writeLocalPropertyExtra(propertyId: string, extra: Partial<PropertyExtraInfo>) { writeLocalTenantExtras(propertyId, extra); }

export async function fetchPropertyExtras(propertyIds?: string[]): Promise<Record<string, PropertyExtraInfo>> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return {};
  let query = supabase.from("property_extra_info").select("*").eq("user_id", user.id);
  if (propertyIds && propertyIds.length > 0) query = query.in("property_id", propertyIds);
  const { data, error } = await query;
  if (error) { console.warn("property_extra_info load skipped:", error.message); return {}; }
  const result: Record<string, PropertyExtraInfo> = {};
  for (const row of data ?? []) {
    const propertyId = String(row.property_id ?? "");
    if (!propertyId) continue;
    result[propertyId] = { ...normalize(row), property_id: propertyId };
  }
  return result;
}

export async function savePropertyExtra(propertyId: string, extra: Partial<PropertyExtraInfo>): Promise<{ ok: boolean; message: string; error?: unknown }> {
  const normalized = { ...normalize(extra), property_id: propertyId };
  writeLocalTenantExtras(propertyId, normalized);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: true, message: "Lokal gespeichert" };
  const { error } = await supabase.from("property_extra_info").upsert({
    user_id: user.id,
    property_id: propertyId,
    living_area: normalized.livingArea,
    rooms: normalized.rooms,
    cold_rent: normalized.coldRent,
    operating_costs: normalized.operatingCosts,
    total_rent: normalized.totalRent,
    market_value: normalized.marketValue,
    equipment: normalized.equipment,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    phone: normalized.phone,
    email: normalized.email,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,property_id" });
  if (error) { console.warn("property_extra_info save skipped:", error.message); return { ok: true, message: "Lokal gespeichert", error }; }
  return { ok: true, message: "Gespeichert" };
}
export async function savePropertyExtras(propertyId: string, extra: Partial<PropertyExtraInfo>) { return savePropertyExtra(propertyId, extra); }
export async function loadPropertyExtras(): Promise<Record<string, PropertyExtraInfo>> {
  const local = loadLocalTenantExtras();
  const remote = await fetchPropertyExtras();
  const merged = { ...local, ...remote };
  writeLocalTenantExtras(merged);
  return merged;
}
export async function loadAllPropertyExtras(): Promise<Record<string, PropertyExtraInfo>> { return loadPropertyExtras(); }
export async function loadPropertyExtra(propertyId: string): Promise<PropertyExtraInfo | null> { const all = await loadPropertyExtras(); return all[propertyId] ?? null; }
export async function migrateLocalExtrasToSupabase(propertyIds: string[], local: Record<string, PropertyExtraInfo>, remote: Record<string, PropertyExtraInfo>) {
  for (const propertyId of propertyIds) if (local[propertyId] && !remote[propertyId]) await savePropertyExtra(propertyId, local[propertyId]);
}
