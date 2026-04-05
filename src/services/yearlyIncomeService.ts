import { supabase } from "@/lib/supabase";
import type { YearlyIncomeEntry } from "@/types/finance";

const TABLE_NAME = "yearly_property_income";
const GENERATE_RPC_NAME = "generate_yearly_property_income";

type YearlyIncomeRow = {
  id: string;
  property_id: string;
  year: number | string | null;
  annual_rent: number | string | null;
  other_income: number | string | null;
  source: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT_COLUMNS = `
  id,
  property_id,
  year,
  annual_rent,
  other_income,
  source,
  created_at,
  updated_at
`;

export type CreateYearlyIncomeEntryInput = {
  propertyId: string;
  year: number;
  annualRent: number;
  otherIncome: number;
  source?: string | null;
};

export type UpdateYearlyIncomeEntryInput = {
  year?: number;
  annualRent?: number;
  otherIncome?: number;
  source?: string | null;
};

export type GenerateYearlyIncomeInput = {
  propertyId: string;
  startYear?: number;
  yearCount?: number;
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
  const parsed = Math.trunc(toNumber(value, Number.NaN));

  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 3000) {
    throw new Error("Ungültiges Jahr.");
  }

  return parsed;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRow(row: YearlyIncomeRow): YearlyIncomeEntry {
  const annualRent = toNumber(row.annual_rent, 0);
  const otherIncome = toNumber(row.other_income, 0);
  const year = toYear(row.year);

  return {
    id: assertNonEmptyString(row.id, "row.id"),
    propertyId: assertNonEmptyString(row.property_id, "row.property_id"),
    year,
    annualRent,
    otherIncome,

    // Legacy-Kompatibilität
    annual_rent: annualRent,
    other_income: otherIncome,

    source: toNullableString(row.source),
  };
}

function normalizeRows(rows: YearlyIncomeRow[] | null | undefined): YearlyIncomeEntry[] {
  return (rows ?? []).map(normalizeRow).sort((a, b) => a.year - b.year);
}

function buildCreatePayload(input: CreateYearlyIncomeEntryInput) {
  return {
    property_id: assertNonEmptyString(input.propertyId, "propertyId"),
    year: toYear(input.year),
    annual_rent: toNumber(input.annualRent, 0),
    other_income: toNumber(input.otherIncome, 0),
    source: toNullableString(input.source),
  };
}

function buildUpdatePayload(input: UpdateYearlyIncomeEntryInput) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.year !== undefined) {
    payload.year = toYear(input.year);
  }

  if (input.annualRent !== undefined) {
    payload.annual_rent = toNumber(input.annualRent, 0);
  }

  if (input.otherIncome !== undefined) {
    payload.other_income = toNumber(input.otherIncome, 0);
  }

  if (input.source !== undefined) {
    payload.source = toNullableString(input.source);
  }

  return payload;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unbekannter Fehler";
}

function throwQueryError(action: string, error: unknown): never {
  throw new Error(`yearlyIncomeService.${action} fehlgeschlagen: ${getErrorMessage(error)}`);
}

export const yearlyIncomeService = {
  async getByPropertyId(propertyId: string): Promise<YearlyIncomeEntry[]> {
    const safePropertyId = assertNonEmptyString(propertyId, "propertyId");

    console.log("[yearlyIncomeService.getByPropertyId] start", {
      propertyId: safePropertyId,
    });

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq("property_id", safePropertyId)
      .order("year", { ascending: true });

    console.log("[yearlyIncomeService.getByPropertyId] result", {
      propertyId: safePropertyId,
      rowCount: data?.length ?? 0,
      data,
      error,
    });

    if (error) {
      throwQueryError("getByPropertyId", error);
    }

    return normalizeRows((data ?? []) as YearlyIncomeRow[]);
  },

  async generateForProperty(input: GenerateYearlyIncomeInput): Promise<void> {
    const propertyId = assertNonEmptyString(input.propertyId, "propertyId");
    const startYear = input.startYear ?? 2024;
    const yearCount = input.yearCount ?? 10;

    console.warn("[yearlyIncomeService.generateForProperty] calling RPC", {
      propertyId,
      startYear,
      yearCount,
    });

    const { data, error } = await supabase.rpc(GENERATE_RPC_NAME, {
      p_property_id: propertyId,
      p_start_year: startYear,
      p_year_count: yearCount,
    });

    console.log("[yearlyIncomeService.generateForProperty] RPC result", {
      propertyId,
      data,
      error,
    });

    if (error) {
      throwQueryError("generateForProperty", error);
    }
  },

  async ensureGeneratedForProperty(
    propertyId: string,
    options?: {
      startYear?: number;
      yearCount?: number;
    },
  ): Promise<YearlyIncomeEntry[]> {
    const safePropertyId = assertNonEmptyString(propertyId, "propertyId");

    console.log("[yearlyIncomeService.ensureGeneratedForProperty] start", {
      propertyId: safePropertyId,
      options,
    });

    const existingRows = await this.getByPropertyId(safePropertyId);

    console.log("[yearlyIncomeService.ensureGeneratedForProperty] existing rows", {
      propertyId: safePropertyId,
      existingCount: existingRows.length,
      existingRows,
    });

    if (existingRows.length > 0) {
      console.log("[yearlyIncomeService.ensureGeneratedForProperty] skip generation", {
        propertyId: safePropertyId,
        existingCount: existingRows.length,
      });

      return existingRows;
    }

    await this.generateForProperty({
      propertyId: safePropertyId,
      startYear: options?.startYear ?? 2024,
      yearCount: options?.yearCount ?? 10,
    });

    console.log("[yearlyIncomeService.ensureGeneratedForProperty] reloading after RPC", {
      propertyId: safePropertyId,
    });

    const reloadedRows = await this.getByPropertyId(safePropertyId);

    console.log("[yearlyIncomeService.ensureGeneratedForProperty] reloaded rows", {
      propertyId: safePropertyId,
      reloadedCount: reloadedRows.length,
      reloadedRows,
    });

    return reloadedRows;
  },

  async create(input: CreateYearlyIncomeEntryInput): Promise<YearlyIncomeEntry> {
    const payload = buildCreatePayload(input);

    console.log("[yearlyIncomeService.create] start", { payload });

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select(SELECT_COLUMNS)
      .single();

    console.log("[yearlyIncomeService.create] result", { data, error });

    if (error) {
      throwQueryError("create", error);
    }

    return normalizeRow(data as YearlyIncomeRow);
  },

  async update(id: string, input: UpdateYearlyIncomeEntryInput): Promise<YearlyIncomeEntry> {
    const safeId = assertNonEmptyString(id, "id");
    const payload = buildUpdatePayload(input);

    console.log("[yearlyIncomeService.update] start", {
      id: safeId,
      payload,
    });

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", safeId)
      .select(SELECT_COLUMNS)
      .single();

    console.log("[yearlyIncomeService.update] result", {
      id: safeId,
      data,
      error,
    });

    if (error) {
      throwQueryError("update", error);
    }

    return normalizeRow(data as YearlyIncomeRow);
  },

  async remove(id: string): Promise<void> {
    const safeId = assertNonEmptyString(id, "id");

    console.log("[yearlyIncomeService.remove] start", { id: safeId });

    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", safeId);

    console.log("[yearlyIncomeService.remove] result", {
      id: safeId,
      error,
    });

    if (error) {
      throwQueryError("remove", error);
    }
  },

  async upsertByPropertyIdAndYear(
    propertyId: string,
    year: number,
    input: {
      annualRent: number;
      otherIncome: number;
      source?: string | null;
    },
  ): Promise<YearlyIncomeEntry> {
    const payload = {
      property_id: assertNonEmptyString(propertyId, "propertyId"),
      year: toYear(year),
      annual_rent: toNumber(input.annualRent, 0),
      other_income: toNumber(input.otherIncome, 0),
      source: toNullableString(input.source),
      updated_at: new Date().toISOString(),
    };

    console.log("[yearlyIncomeService.upsertByPropertyIdAndYear] start", {
      payload,
    });

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(payload, {
        onConflict: "property_id,year",
      })
      .select(SELECT_COLUMNS)
      .single();

    console.log("[yearlyIncomeService.upsertByPropertyIdAndYear] result", {
      payload,
      data,
      error,
    });

    if (error) {
      throwQueryError("upsertByPropertyIdAndYear", error);
    }

    return normalizeRow(data as YearlyIncomeRow);
  },
};

export default yearlyIncomeService;