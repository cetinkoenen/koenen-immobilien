// src/services/ledgerService.ts

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
};

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

const ledgerSelect = `
  id,
  property_id,
  year,
  interest,
  principal,
  balance,
  source
`;

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
  return Math.trunc(toNumber(value));
}

function normalizeLedgerRow(row: LedgerRow): YearlyLedgerEntry {
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

function mapCreateInputToRow(input: CreateYearlyLedgerEntryInput) {
  return {
    property_id: input.propertyId,
    year: input.year,
    interest: input.interest,
    principal: input.principal,
    balance: input.balance,
    source: input.source ?? null,
  };
}

function mapUpdateInputToRow(input: UpdateYearlyLedgerEntryInput) {
  const payload: Partial<{
    year: number;
    interest: number;
    principal: number;
    balance: number;
    source: string | null;
  }> = {};

  if (input.year !== undefined) {
    payload.year = input.year;
  }

  if (input.interest !== undefined) {
    payload.interest = input.interest;
  }

  if (input.principal !== undefined) {
    payload.principal = input.principal;
  }

  if (input.balance !== undefined) {
    payload.balance = input.balance;
  }

  if (input.source !== undefined) {
    payload.source = input.source ?? null;
  }

  return payload;
}

export const ledgerService = {
  async getByPropertyId(propertyId: string): Promise<YearlyLedgerEntry[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(ledgerSelect)
      .eq("property_id", propertyId)
      .order("year", { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as LedgerRow[]).map(normalizeLedgerRow);
  },

  async getById(id: string): Promise<YearlyLedgerEntry | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(ledgerSelect)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return normalizeLedgerRow(data as LedgerRow);
  },

  async create(input: CreateYearlyLedgerEntryInput): Promise<YearlyLedgerEntry> {
    const payload = mapCreateInputToRow(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select(ledgerSelect)
      .single();

    if (error) {
      throw error;
    }

    return normalizeLedgerRow(data as LedgerRow);
  },

  async update(
    id: string,
    input: UpdateYearlyLedgerEntryInput
  ): Promise<YearlyLedgerEntry> {
    const payload = mapUpdateInputToRow(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", id)
      .select(ledgerSelect)
      .single();

    if (error) {
      throw error;
    }

    return normalizeLedgerRow(data as LedgerRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  },
};

export type { YearlyLedgerEntry };