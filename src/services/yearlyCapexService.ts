import { supabase } from "@/lib/supabase";
import type { YearlyCapexEntry } from "@/types/finance";

const TABLE_NAME = "yearly_capex_entries";

type YearlyCapexRow = {
  id: string;
  property_id: string;
  year: number | string | null;
  amount: number | string | null;
  category: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLUMNS = `
  id,
  property_id,
  year,
  amount,
  category,
  note,
  created_at,
  updated_at
`;

export type CreateYearlyCapexInput = {
  propertyId: string;
  year: number;
  amount: number;
  category?: string | null;
  note?: string | null;
};

export type UpdateYearlyCapexInput = {
  year?: number;
  amount?: number;
  category?: string | null;
  note?: string | null;
};

function assertNonEmptyString(value: unknown, fieldName: string): string {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw new Error(`Ungültiger Wert für ${fieldName}.`);
  }

  return normalized;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/\s+/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");

    if (!normalized) return fallback;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toYear(value: unknown): number {
  const year = Math.trunc(toNumber(value, 0));
  if (year < 0) return 0;
  return year;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRow(row: YearlyCapexRow): YearlyCapexEntry {
  return {
    id: assertNonEmptyString(row.id, "row.id"),
    propertyId: assertNonEmptyString(row.property_id, "row.property_id"),
    year: toYear(row.year),
    amount: toNumber(row.amount, 0),
    category: toNullableString(row.category),
    note: toNullableString(row.note),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function normalizeRows(rows: YearlyCapexRow[] | null | undefined): YearlyCapexEntry[] {
  return (rows ?? []).map(normalizeRow).sort((a, b) => a.year - b.year);
}

function buildCreatePayload(input: CreateYearlyCapexInput) {
  return {
    property_id: assertNonEmptyString(input.propertyId, "propertyId"),
    year: toYear(input.year),
    amount: toNumber(input.amount, 0),
    category: toNullableString(input.category),
    note: toNullableString(input.note),
  };
}

function buildUpdatePayload(input: UpdateYearlyCapexInput) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.year !== undefined) {
    payload.year = toYear(input.year);
  }

  if (input.amount !== undefined) {
    payload.amount = toNumber(input.amount, 0);
  }

  if (input.category !== undefined) {
    payload.category = toNullableString(input.category);
  }

  if (input.note !== undefined) {
    payload.note = toNullableString(input.note);
  }

  return payload;
}

function throwQueryError(action: string, error: unknown): never {
  if (error instanceof Error) {
    throw new Error(`yearlyCapexService.${action} fehlgeschlagen: ${error.message}`);
  }

  throw new Error(`yearlyCapexService.${action} fehlgeschlagen.`);
}

export const yearlyCapexService = {
  async getByPropertyId(propertyId: string): Promise<YearlyCapexEntry[]> {
    const safePropertyId = assertNonEmptyString(propertyId, "propertyId");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq("property_id", safePropertyId)
      .order("year", { ascending: true });

    console.log("yearlyCapexService.getByPropertyId", {
      table: TABLE_NAME,
      propertyId: safePropertyId,
      rowCount: data?.length ?? 0,
      error,
    });

    if (error) {
      throwQueryError("getByPropertyId", error);
    }

    return normalizeRows((data ?? []) as YearlyCapexRow[]);
  },

  async getById(id: string): Promise<YearlyCapexEntry | null> {
    const safeId = assertNonEmptyString(id, "id");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq("id", safeId)
      .maybeSingle();

    if (error) {
      throwQueryError("getById", error);
    }

    return data ? normalizeRow(data as YearlyCapexRow) : null;
  },

  async create(input: CreateYearlyCapexInput): Promise<YearlyCapexEntry> {
    const payload = buildCreatePayload(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throwQueryError("create", error);
    }

    return normalizeRow(data as YearlyCapexRow);
  },

  async update(id: string, input: UpdateYearlyCapexInput): Promise<YearlyCapexEntry> {
    const safeId = assertNonEmptyString(id, "id");
    const payload = buildUpdatePayload(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", safeId)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throwQueryError("update", error);
    }

    return normalizeRow(data as YearlyCapexRow);
  },

  async remove(id: string): Promise<void> {
    const safeId = assertNonEmptyString(id, "id");

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", safeId);

    if (error) {
      throwQueryError("remove", error);
    }
  },

  async upsertByPropertyIdAndYear(
    input: CreateYearlyCapexInput
  ): Promise<YearlyCapexEntry> {
    const payload = buildCreatePayload(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: "property_id,year" })
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throwQueryError("upsertByPropertyIdAndYear", error);
    }

    return normalizeRow(data as YearlyCapexRow);
  },
};

export default yearlyCapexService;
