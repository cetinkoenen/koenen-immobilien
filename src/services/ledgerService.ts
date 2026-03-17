import { supabase } from "../lib/supabase";

const TABLE_NAME = "property_loan_ledger";

const DB_COLUMNS = {
  id: "id",
  propertyId: "property_id",
  year: "year",
  interest: "interest",
  principal: "principal",
  balance: "balance",
  source: "source",
} as const;

export interface YearlyLedgerEntry {
  id: string;
  propertyId: string;
  year: number;
  interest: number;
  principal: number;
  balance: number;
  source: string | null;
}

export interface CreateYearlyLedgerEntryInput {
  propertyId: string;
  year: number;
  interest: number;
  principal: number;
  balance: number;
  source?: string | null;
}

export interface UpdateYearlyLedgerEntryInput {
  year?: number;
  interest?: number;
  principal?: number;
  balance?: number;
  source?: string | null;
}

type LedgerRow = {
  id: string;
  property_id: string;
  year: number | string | null;
  interest: number | string | null;
  principal: number | string | null;
  balance: number | string | null;
  source: string | null;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toYear(value: unknown): number {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function mapRowToYearlyLedgerEntry(row: LedgerRow): YearlyLedgerEntry {
  return {
    id: row.id,
    propertyId: row.property_id,
    year: toYear(row.year),
    interest: toNumber(row.interest),
    principal: toNumber(row.principal),
    balance: toNumber(row.balance),
    source: row.source ?? null,
  };
}

function mapCreateInputToDb(input: CreateYearlyLedgerEntryInput) {
  return {
    [DB_COLUMNS.propertyId]: input.propertyId,
    [DB_COLUMNS.year]: input.year,
    [DB_COLUMNS.interest]: input.interest,
    [DB_COLUMNS.principal]: input.principal,
    [DB_COLUMNS.balance]: input.balance,
    [DB_COLUMNS.source]: input.source ?? null,
  };
}

function mapUpdateInputToDb(input: UpdateYearlyLedgerEntryInput) {
  const payload: Record<string, unknown> = {};

  if (input.year !== undefined) {
    payload[DB_COLUMNS.year] = input.year;
  }

  if (input.interest !== undefined) {
    payload[DB_COLUMNS.interest] = input.interest;
  }

  if (input.principal !== undefined) {
    payload[DB_COLUMNS.principal] = input.principal;
  }

  if (input.balance !== undefined) {
    payload[DB_COLUMNS.balance] = input.balance;
  }

  if (input.source !== undefined) {
    payload[DB_COLUMNS.source] = input.source;
  }

  return payload;
}

export const ledgerService = {
  async getByPropertyId(propertyId: string): Promise<YearlyLedgerEntry[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        `
        id,
        property_id,
        year,
        interest,
        principal,
        balance,
        source
      `
      )
      .eq(DB_COLUMNS.propertyId, propertyId)
      .order(DB_COLUMNS.year, { ascending: true });

    if (error) {
      console.error("Error loading yearly ledger:", error);
      throw new Error("Jahresledger konnte nicht geladen werden.");
    }

    return ((data ?? []) as LedgerRow[])
      .map(mapRowToYearlyLedgerEntry)
      .sort((a, b) => a.year - b.year);
  },

  async getById(id: string): Promise<YearlyLedgerEntry | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        `
        id,
        property_id,
        year,
        interest,
        principal,
        balance,
        source
      `
      )
      .eq(DB_COLUMNS.id, id)
      .maybeSingle();

    if (error) {
      console.error("Error loading yearly ledger entry:", error);
      throw new Error("Jahreseintrag konnte nicht geladen werden.");
    }

    if (!data) {
      return null;
    }

    return mapRowToYearlyLedgerEntry(data as LedgerRow);
  },

  async create(
    input: CreateYearlyLedgerEntryInput
  ): Promise<YearlyLedgerEntry> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(mapCreateInputToDb(input))
      .select(
        `
        id,
        property_id,
        year,
        interest,
        principal,
        balance,
        source
      `
      )
      .single();

    if (error) {
      console.error("Error creating yearly ledger entry:", error);
      throw new Error("Jahreseintrag konnte nicht erstellt werden.");
    }

    return mapRowToYearlyLedgerEntry(data as LedgerRow);
  },

  async update(
    id: string,
    input: UpdateYearlyLedgerEntryInput
  ): Promise<YearlyLedgerEntry> {
    const payload = mapUpdateInputToDb(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq(DB_COLUMNS.id, id)
      .select(
        `
        id,
        property_id,
        year,
        interest,
        principal,
        balance,
        source
      `
      )
      .single();

    if (error) {
      console.error("Error updating yearly ledger entry:", error);
      throw new Error("Jahreseintrag konnte nicht aktualisiert werden.");
    }

    return mapRowToYearlyLedgerEntry(data as LedgerRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq(DB_COLUMNS.id, id);

    if (error) {
      console.error("Error deleting yearly ledger entry:", error);
      throw new Error("Jahreseintrag konnte nicht gelöscht werden.");
    }
  },
};