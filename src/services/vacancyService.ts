import { supabase } from "../lib/supabase";

export type VacancyStatus = "active" | "planned" | "ended";
export type VacancyType = "manual" | "contract_ended" | "notice" | "other";

export type UnitVacancy = {
  id: string;
  user_id: string;
  property_id: string;
  object_code: string | null;
  object_label: string | null;
  unit_label: string | null;
  vacancy_type: VacancyType;
  status: VacancyStatus;
  start_date: string;
  end_date: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VacancyInput = {
  propertyId: string;
  objectCode?: string | null;
  objectLabel?: string | null;
  unitLabel?: string | null;
  vacancyType?: VacancyType;
  status?: VacancyStatus;
  startDate: string;
  endDate?: string | null;
  reason?: string | null;
  notes?: string | null;
};

export type VacancyFilters = {
  propertyId?: string;
  status?: VacancyStatus | "all";
  from?: string;
  to?: string;
};

function cleanText(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned : null;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Nicht eingeloggt.");
  return userId;
}

export function isVacancyActiveInRange(vacancy: Pick<UnitVacancy, "start_date" | "end_date" | "status">, start: string, end: string): boolean {
  if (vacancy.status === "ended") return false;
  if (vacancy.start_date > end) return false;
  if (vacancy.end_date && vacancy.end_date < start) return false;
  return true;
}

export function isVacancyInRange(vacancy: Pick<UnitVacancy, "start_date" | "end_date">, start: string, end: string): boolean {
  if (vacancy.start_date > end) return false;
  if (vacancy.end_date && vacancy.end_date < start) return false;
  return true;
}

export function isEndedTenancyVacancySignal(vacancy: Pick<UnitVacancy, "end_date" | "vacancy_type" | "reason" | "notes">): boolean {
  if (!vacancy.end_date) return false;
  if (vacancy.vacancy_type === "contract_ended" || vacancy.vacancy_type === "notice") return true;
  const text = normalizeText(`${vacancy.reason ?? ""} ${vacancy.notes ?? ""}`);
  return text.includes("kuendigung") || text.includes("kundigung") || text.includes("mietende") || text.includes("mietzeitraum") || text.includes("auszug");
}

export function effectiveVacancyStartDate(vacancy: Pick<UnitVacancy, "start_date" | "end_date" | "status" | "vacancy_type" | "reason" | "notes">): string {
  if (vacancy.status === "ended" && isEndedTenancyVacancySignal(vacancy)) {
    return addDays(vacancy.end_date!, 1);
  }
  return vacancy.start_date;
}

export function isVacancyEffectivelyActiveInRange(
  vacancy: Pick<UnitVacancy, "start_date" | "end_date" | "status" | "vacancy_type" | "reason" | "notes">,
  start: string,
  end: string,
): boolean {
  if (vacancy.status === "ended" && isEndedTenancyVacancySignal(vacancy)) {
    return effectiveVacancyStartDate(vacancy) <= end;
  }
  return isVacancyActiveInRange(vacancy, start, end);
}

export function effectiveVacancyStatusForRange(
  vacancy: Pick<UnitVacancy, "start_date" | "end_date" | "status" | "vacancy_type" | "reason" | "notes">,
  start: string,
  end: string,
): VacancyStatus {
  if (isVacancyEffectivelyActiveInRange(vacancy, start, end)) return "active";
  return vacancy.status;
}

export async function listVacancies(filters: VacancyFilters = {}): Promise<UnitVacancy[]> {
  const userId = await getCurrentUserId();
  let query = supabase
    .from("unit_vacancies")
    .select("*")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("start_date", { ascending: false });

  if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.to) query = query.lte("start_date", filters.to);
  if (filters.from) query = query.or(`end_date.is.null,end_date.gte.${filters.from}`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UnitVacancy[];
}

function addOneDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

type RentalVacancyRow = {
  id: string;
  property_id: string;
  rent_type: string | null;
  start_date: string | null;
  end_date: string | null;
};

export async function listDerivedVacanciesFromEndedRentals(
  propertyIds: string[],
  monthStart: string,
  monthEnd: string,
  labelByPropertyId: Record<string, string>,
): Promise<UnitVacancy[]> {
  const validIds = [...new Set(propertyIds.filter(Boolean))];
  if (!validIds.length) return [];

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("portfolio_property_rentals")
    .select("id,property_id,rent_type,start_date,end_date")
    .in("property_id", validIds)
    .order("start_date", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as RentalVacancyRow[];
  const byProperty = new Map<string, RentalVacancyRow[]>();
  for (const row of rows) {
    const list = byProperty.get(row.property_id) ?? [];
    list.push(row);
    byProperty.set(row.property_id, list);
  }

  const result: UnitVacancy[] = [];

  for (const [propertyId, rentals] of byProperty.entries()) {
    const hasActiveInMonth = rentals.some((row) => {
      if (!row.start_date) return false;
      if (row.start_date > monthEnd) return false;
      if (row.end_date && row.end_date < monthStart) return false;
      return true;
    });
    if (hasActiveInMonth) continue;

    const latestEnded = rentals
      .filter((row) => row.end_date && row.end_date < monthStart)
      .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)))[0];

    if (!latestEnded?.end_date) continue;

    result.push({
      id: `derived-rental-${latestEnded.id}`,
      user_id: userId,
      property_id: propertyId,
      object_code: null,
      object_label: labelByPropertyId[propertyId] ?? null,
      unit_label: latestEnded.rent_type || null,
      vacancy_type: "contract_ended",
      status: "active",
      start_date: addOneDay(latestEnded.end_date),
      end_date: null,
      reason: "Automatisch erkannt: letzter Vermietungszeitraum ist beendet.",
      notes: null,
      created_at: latestEnded.end_date,
      updated_at: latestEnded.end_date,
    });
  }

  return result;
}

export async function createVacancy(input: VacancyInput): Promise<UnitVacancy> {
  const userId = await getCurrentUserId();
  const propertyId = cleanText(input.propertyId);
  if (!propertyId) throw new Error("Bitte eine Immobilie auswählen.");
  if (!cleanText(input.startDate)) throw new Error("Bitte ein Startdatum eintragen.");

  const payload = {
    user_id: userId,
    property_id: propertyId,
    object_code: cleanText(input.objectCode),
    object_label: cleanText(input.objectLabel),
    unit_label: cleanText(input.unitLabel),
    vacancy_type: input.vacancyType ?? "manual",
    status: input.status ?? "active",
    start_date: cleanText(input.startDate),
    end_date: cleanText(input.endDate),
    reason: cleanText(input.reason),
    notes: cleanText(input.notes),
  };

  const { data, error } = await supabase.from("unit_vacancies").insert(payload).select("*").single();
  if (error) throw error;
  return data as UnitVacancy;
}

export async function updateVacancy(id: string, input: Partial<VacancyInput>): Promise<UnitVacancy> {
  const payload = {
    object_code: input.objectCode === undefined ? undefined : cleanText(input.objectCode),
    object_label: input.objectLabel === undefined ? undefined : cleanText(input.objectLabel),
    unit_label: input.unitLabel === undefined ? undefined : cleanText(input.unitLabel),
    vacancy_type: input.vacancyType,
    status: input.status,
    start_date: input.startDate === undefined ? undefined : cleanText(input.startDate),
    end_date: input.endDate === undefined ? undefined : cleanText(input.endDate),
    reason: input.reason === undefined ? undefined : cleanText(input.reason),
    notes: input.notes === undefined ? undefined : cleanText(input.notes),
  };

  const { data, error } = await supabase
    .from("unit_vacancies")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as UnitVacancy;
}

export async function archiveVacancy(id: string): Promise<void> {
  const { error } = await supabase
    .from("unit_vacancies")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), status: "ended" })
    .eq("id", id);

  if (error) throw error;
}
