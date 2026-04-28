import { supabase } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";
import type { YearlyLedgerEntry } from "@/types/finance";

const TABLE_NAME = "property_loan_ledger";

type LedgerRow = {
  id: string | number;
  property_id: string;
  year: number | string | null;
  interest: number | string | null;
  principal: number | string | null;
  balance: number | string | null;
  source: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT_COLUMNS = `
  id,
  property_id,
  year,
  interest,
  principal,
  balance,
  source,
  created_at,
  updated_at
`;

export type CreateYearlyLedgerEntryInput = {
  propertyId: string;
  year: number | string;
  interest: number | string;
  principal: number | string;
  balance: number | string;
  source?: string | null;
};

export type UpdateYearlyLedgerEntryInput = {
  year?: number | string;
  interest?: number | string;
  principal?: number | string;
  balance?: number | string;
  source?: string | null;
};

function assertNonEmptyString(value: unknown, fieldName: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Ungültiger Wert für "${fieldName}".`);
  }
  return normalized;
}

function parseNumber(value: unknown, fieldName: string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`"${fieldName}" ist keine gültige Zahl.`);
    }
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new Error(`"${fieldName}" darf nicht leer sein.`);
    }

    const normalized = trimmed
      .replace(/\s/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");

    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {
      throw new Error(`"${fieldName}" ist keine gültige Zahl.`);
    }

    return parsed;
  }

  throw new Error(`"${fieldName}" hat einen ungültigen Typ.`);
}

function parseOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  return parseNumber(value, fieldName);
}

function parseYear(value: unknown): number {
  const year = Math.trunc(parseNumber(value, "year"));

  if (year < 1900 || year > 3000) {
    throw new Error(`"year" ist ungültig.`);
  }

  return year;
}

function parseOptionalYear(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return parseYear(value);
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRow(row: LedgerRow): YearlyLedgerEntry {
  const interest = row.interest == null ? 0 : parseNumber(row.interest, "interest");
  const principal = row.principal == null ? 0 : parseNumber(row.principal, "principal");
  const balance = row.balance == null ? 0 : parseNumber(row.balance, "balance");

  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    year: row.year == null ? 0 : parseYear(row.year),
    interestPayment: interest,
    principalPayment: principal,
    remainingBalance: balance,
    interest,
    principal,
    balance,
    source: toNullableString(row.source),
  };
}

function sortRows(rows: YearlyLedgerEntry[]): YearlyLedgerEntry[] {
  return [...rows].sort((a, b) => a.year - b.year);
}

function buildCreatePayload(input: CreateYearlyLedgerEntryInput) {
  return {
    property_id: assertNonEmptyString(input.propertyId, "propertyId"),
    year: parseYear(input.year),
    interest: parseNumber(input.interest, "interest"),
    principal: parseNumber(input.principal, "principal"),
    balance: parseNumber(input.balance, "balance"),
    source: toNullableString(input.source),
  };
}

function buildUpdatePayload(input: UpdateYearlyLedgerEntryInput) {
  const payload: Record<string, unknown> = {};

  const year = parseOptionalYear(input.year);
  const interest = parseOptionalNumber(input.interest, "interest");
  const principal = parseOptionalNumber(input.principal, "principal");
  const balance = parseOptionalNumber(input.balance, "balance");

  if (year !== undefined) payload.year = year;
  if (interest !== undefined) payload.interest = interest;
  if (principal !== undefined) payload.principal = principal;
  if (balance !== undefined) payload.balance = balance;
  if (input.source !== undefined) payload.source = toNullableString(input.source);

  return payload;
}

function throwSupabaseError(context: string, error: PostgrestError | null): never {
  if (!error) {
    throw new Error(`${context}: Unbekannter Datenbankfehler.`);
  }

  console.error(`${context} failed`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });

  throw new Error(
    `${context}: ${error.message}${
      error.details ? ` | Details: ${error.details}` : ""
    }${error.hint ? ` | Hint: ${error.hint}` : ""}`
  );
}

export const ledgerService = {
  async getByPropertyId(propertyId: string): Promise<YearlyLedgerEntry[]> {
    const safePropertyId = assertNonEmptyString(propertyId, "propertyId");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq("property_id", safePropertyId)
      .order("year", { ascending: true });

    console.log("ledgerService.getByPropertyId", {
      propertyId: safePropertyId,
      rowCount: data?.length ?? 0,
      error,
    });

    if (error) {
      throwSupabaseError("ledgerService.getByPropertyId", error);
    }

    return sortRows((data ?? []).map((row) => normalizeRow(row as LedgerRow)));
  },

  async getById(id: string | number): Promise<YearlyLedgerEntry | null> {
    const safeId = assertNonEmptyString(id, "id");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq("id", safeId)
      .maybeSingle();

    if (error) {
      throwSupabaseError("ledgerService.getById", error);
    }

    return data ? normalizeRow(data as LedgerRow) : null;
  },

  async create(input: CreateYearlyLedgerEntryInput): Promise<YearlyLedgerEntry> {
    const payload = buildCreatePayload(input);

    console.log("ledgerService.create.payload", payload);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throwSupabaseError("ledgerService.create", error);
    }

    return normalizeRow(data as LedgerRow);
  },

  async update(id: string | number, input: UpdateYearlyLedgerEntryInput): Promise<YearlyLedgerEntry> {
    const safeId = assertNonEmptyString(id, "id");
    const payload = buildUpdatePayload(input);

    if (Object.keys(payload).length === 0) {
      throw new Error("Es gibt keine Felder zum Aktualisieren.");
    }

    console.log("ledgerService.update.start", {
      id: safeId,
      payload,
    });

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", safeId)
      .select(SELECT_COLUMNS)
      .single();

    console.log("ledgerService.update.result", {
      id: safeId,
      payload,
      data,
      error,
    });

    if (error) {
      throwSupabaseError("ledgerService.update", error);
    }

    return normalizeRow(data as LedgerRow);
  },

  async remove(id: string | number): Promise<void> {
    const safeId = assertNonEmptyString(id, "id");

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", safeId);

    if (error) {
      throwSupabaseError("ledgerService.remove", error);
    }
  },
};

export type { YearlyLedgerEntry };
export default ledgerService;