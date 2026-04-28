import { supabase } from "../lib/supabase";

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

export const PROPERTY_EXTRA_STORAGE_KEY = "koenen:portfolio:object-overview-extra:v4";
const OLD_KEYS = [
  "koenen:portfolio:object-overview-extra:v3",
  "koenen:portfolio:object-overview-extra:v2",
  "koenen:mieteruebersicht:tenant-info:v3",
  "koenen:mieteruebersicht:tenant-info:v2",
];

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

function normalize(value: any): PropertyExtraInfo {
  return {
    ...emptyPropertyExtra,
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
}

export function readLocalPropertyExtras(): Record<string, PropertyExtraInfo> {
  const merged: Record<string, PropertyExtraInfo> = {};
  for (const key of [...OLD_KEYS, PROPERTY_EXTRA_STORAGE_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, any>;
      for (const [propertyId, value] of Object.entries(parsed)) {
        merged[propertyId] = { ...(merged[propertyId] ?? emptyPropertyExtra), ...normalize(value) };
      }
    } catch {
      // ignore broken local data
    }
  }
  return merged;
}

export function writeLocalPropertyExtras(data: Record<string, PropertyExtraInfo>) {
  window.localStorage.setItem(PROPERTY_EXTRA_STORAGE_KEY, JSON.stringify(data));
}

export function writeLocalPropertyExtra(propertyId: string, extra: PropertyExtraInfo) {
  const all = readLocalPropertyExtras();
  all[propertyId] = normalize(extra);
  writeLocalPropertyExtras(all);
}

function isMissingTableError(message: string) {
  const text = message.toLowerCase();
  return text.includes("property_extra_info") && (text.includes("schema cache") || text.includes("does not exist") || text.includes("could not find"));
}

export async function loadPropertyExtras(): Promise<{ data: Record<string, PropertyExtraInfo>; warning?: string }> {
  const local = readLocalPropertyExtras();
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { data: local };

    const { data, error } = await supabase.from("property_extra_info").select("*");
    if (error) {
      if (isMissingTableError(error.message)) return { data: local, warning: "Supabase-Tabelle property_extra_info fehlt noch. Lokale Daten werden verwendet." };
      return { data: local, warning: error.message };
    }

    const remote: Record<string, PropertyExtraInfo> = {};
    for (const row of data ?? []) {
      const propertyId = String((row as any).property_id ?? "");
      if (!propertyId) continue;
      remote[propertyId] = normalize(row);
    }
    const merged = { ...local, ...remote };
    writeLocalPropertyExtras(merged);
    return { data: merged };
  } catch (err: any) {
    return { data: local, warning: err?.message ?? "Supabase-Daten konnten nicht geladen werden." };
  }
}

export async function savePropertyExtra(propertyId: string, extra: PropertyExtraInfo): Promise<{ ok: boolean; message: string }> {
  const normalized = normalize(extra);
  writeLocalPropertyExtra(propertyId, normalized);

  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { ok: true, message: "Lokal gespeichert. Für Supabase bitte einloggen." };

    const payload = {
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
    };

    const { error } = await supabase.from("property_extra_info").upsert(payload, { onConflict: "user_id,property_id" });
    if (error) {
      if (isMissingTableError(error.message)) {
        return { ok: true, message: "Lokal gespeichert. Supabase-SQL für property_extra_info muss noch ausgeführt werden." };
      }
      return { ok: true, message: `Lokal gespeichert. Supabase-Hinweis: ${error.message}` };
    }
    return { ok: true, message: "Gespeichert" };
  } catch (err: any) {
    return { ok: true, message: `Lokal gespeichert. Supabase-Hinweis: ${err?.message ?? "unbekannter Fehler"}` };
  }
}
