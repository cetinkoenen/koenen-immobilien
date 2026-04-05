import { supabase } from "@/lib/supabase";
import type { PropertyIncome } from "@/types/propertyIncome";

const TABLE_NAME = "property_income";

type PropertyIncomeRow = {
  id: string;
  property_id: string;
  annual_rent: number | string | null;
  other_income: number | string | null;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLUMNS = `
  id,
  property_id,
  annual_rent,
  other_income,
  created_at,
  updated_at
`;

export type CreatePropertyIncomeInput = {
  propertyId: string;
  annualRent: number;
  otherIncome: number;
};

export type UpdatePropertyIncomeInput = {
  annualRent?: number;
  otherIncome?: number;
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

function normalizeRow(row: PropertyIncomeRow): PropertyIncome {
  return {
    id: assertNonEmptyString(row.id, "row.id"),
    propertyId: assertNonEmptyString(row.property_id, "row.property_id"),
    annualRent: toNumber(row.annual_rent, 0),
    otherIncome: toNumber(row.other_income, 0),
  };
}

function mapCreatePayload(input: CreatePropertyIncomeInput) {
  return {
    property_id: assertNonEmptyString(input.propertyId, "propertyId"),
    annual_rent: toNumber(input.annualRent, 0),
    other_income: toNumber(input.otherIncome, 0),
  };
}

function mapUpdatePayload(input: UpdatePropertyIncomeInput) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.annualRent !== undefined) {
    payload.annual_rent = toNumber(input.annualRent, 0);
  }

  if (input.otherIncome !== undefined) {
    payload.other_income = toNumber(input.otherIncome, 0);
  }

  return payload;
}

function throwQueryError(action: string, error: unknown): never {
  if (error instanceof Error) {
    throw new Error(`propertyIncomeService.${action} fehlgeschlagen: ${error.message}`);
  }

  throw new Error(`propertyIncomeService.${action} fehlgeschlagen.`);
}

export const propertyIncomeService = {
  async getByPropertyId(propertyId: string): Promise<PropertyIncome | null> {
    const safePropertyId = assertNonEmptyString(propertyId, "propertyId");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq("property_id", safePropertyId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throwQueryError("getByPropertyId", error);
    }

    const row = data?.[0];
    return row ? normalizeRow(row as PropertyIncomeRow) : null;
  },

  async create(input: CreatePropertyIncomeInput): Promise<PropertyIncome> {
    const payload = mapCreatePayload(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throwQueryError("create", error);
    }

    return normalizeRow(data as PropertyIncomeRow);
  },

  async update(id: string, input: UpdatePropertyIncomeInput): Promise<PropertyIncome> {
    const safeId = assertNonEmptyString(id, "id");
    const payload = mapUpdatePayload(input);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq("id", safeId)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throwQueryError("update", error);
    }

    return normalizeRow(data as PropertyIncomeRow);
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

  async upsertByPropertyId(
    propertyId: string,
    input: { annualRent: number; otherIncome: number },
  ): Promise<PropertyIncome> {
    const safePropertyId = assertNonEmptyString(propertyId, "propertyId");
    const existing = await this.getByPropertyId(safePropertyId);

    if (!existing) {
      return this.create({
        propertyId: safePropertyId,
        annualRent: input.annualRent,
        otherIncome: input.otherIncome,
      });
    }

    return this.update(existing.id, {
      annualRent: input.annualRent,
      otherIncome: input.otherIncome,
    });
  },
};

export default propertyIncomeService;