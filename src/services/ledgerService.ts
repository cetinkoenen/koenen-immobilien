import { supabase } from "@/lib/supabase";
import type { YearlyLedgerEntry } from "@/types/finance";

const TABLE_NAME = "property_loan_ledger";

type LedgerRow = {
  id: string;
  property_id: string;
  year: number | string | null;
  interest: number | string | null;
  principal: number | string | null;
  balance: number | string | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const selectColumns = `
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
  year: number;
  interest: number;
  principal: number;
  balance: number;
  source?: string | null;
};

export type UpdateYearlyLedgerEntryInput = {
  year?: number;
  interest?: number;
  principal?: number;
  balance?: number;
  source?: string | null;
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
    const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toYear(value: unknown): number {
  return Math.trunc(toNumber(value, 0));
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeRow(row: LedgerRow): YearlyLedgerEntry {
  const interest = toNumber(row.interest, 0);
  const principal = toNumber(row.principal, 0);
  const balance = toNumber(row.balance, 0);

  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    year: toYear(row.year),
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

function mapCreatePayload(input: CreateYearlyLedgerEntryInput) {
  return {
    property_id: assertNonEmptyString(input.propertyId, "propertyId"),
    year: toYear(input.year),
    interest: toNumber(input.interest, 0),
    principal: toNumber(input.principal, 0),
    balance: toNumber(input.balance, 0),
    source: toNullableString(input.source),
  };
}

function mapUpdatePayload(input: UpdateYearlyLedgerEntryInput) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.year !== undefined) payload.year = toYear(input.year);
  if (input.interest !== undefined) payload.interest = toNumber(input.interest, 0);
  if (input.principal !== undefined) payload.principal = toNumber(input.principal, 0);
  if (input.balance !== undefined) payload.balance = toNumber(input.balance, 0);
  if (input.source !== undefined) payload.source = toNullableString(input.source);

  return payload;
}

export const ledgerService = {
  async getByPropertyId(propertyId: string): Promise<YearlyLedgerEntry[]> {
    const safePropertyId = assertNonEmptyString(propertyId, "propertyId");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(selectColumns)
      .eq("property_id", safePropertyId)
      .order("year", { ascending: true });

    console.log("ledgerService.getByPropertyId", {
      propertyId: safePropertyId,
      rowCount: data?.length ?? 0,
      error,
    });

    if (error) {
      throw error;
    }

    return sortRows((data ?? []).map((row) => normalizeRow(row as LedgerRow)));
  },

  async getById(id: string): Promise<YearlyLedgerEntry | null> {
    const safeId = assertNonEmptyString(id, "id");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(selectColumns)
      .eq("id", safeId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? normalizeRow(data as LedgerRow) : null;
  },

  async create(input: CreateYearlyLedgerEntryInput): Promise<YearlyLedgerEntry> {
    const payload = mapCreatePayload(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select(selectColumns)
      .single();

    if (error) {
      throw error;
    }

    return normalizeRow(data as LedgerRow);
  },

  async update(id: string, input: UpdateYearlyLedgerEntryInput): Promise<YearlyLedgerEntry> {
    const safeId = assertNonEmptyString(id, "id");
    const payload = mapUpdatePayload(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", safeId)
      .select(selectColumns)
      .single();

    if (error) {
      throw error;
    }

    return normalizeRow(data as LedgerRow);
  },

  async remove(id: string): Promise<void> {
    const safeId = assertNonEmptyString(id, "id");

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", safeId);

    if (error) {
      throw error;
    }
  },
};

export type { YearlyLedgerEntry };
export default ledgerService;