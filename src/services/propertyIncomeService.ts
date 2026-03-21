// src/services/propertyIncomeService.ts
import { supabase } from "@/lib/supabase";
import type { PropertyIncome } from "@/types/propertyIncome";

export type CreatePropertyIncomeInput = {
  propertyId: string;
  annualRent: number;
  otherIncome: number;
};

export type UpdatePropertyIncomeInput = {
  annualRent?: number;
  otherIncome?: number;
};

type PropertyIncomeRow = {
  id: string;
  property_id: string;
  annual_rent: number | null;
  other_income: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizePropertyIncome(row: PropertyIncomeRow): PropertyIncome {
  return {
    id: row.id,
    propertyId: row.property_id,
    annualRent: Number(row.annual_rent ?? 0),
    otherIncome: Number(row.other_income ?? 0),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export const propertyIncomeService = {
  async getByPropertyId(propertyId: string): Promise<PropertyIncome | null> {
    const { data, error } = await supabase
      .from("property_income")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return normalizePropertyIncome(data as PropertyIncomeRow);
  },

  async create(input: CreatePropertyIncomeInput): Promise<PropertyIncome> {
    const payload = {
      property_id: input.propertyId,
      annual_rent: input.annualRent,
      other_income: input.otherIncome,
    };

    const { data, error } = await supabase
      .from("property_income")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return normalizePropertyIncome(data as PropertyIncomeRow);
  },

  async update(id: string, input: UpdatePropertyIncomeInput): Promise<PropertyIncome> {
    const payload: {
      annual_rent?: number;
      other_income?: number;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (input.annualRent !== undefined) {
      payload.annual_rent = input.annualRent;
    }

    if (input.otherIncome !== undefined) {
      payload.other_income = input.otherIncome;
    }

    const { data, error } = await supabase
      .from("property_income")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return normalizePropertyIncome(data as PropertyIncomeRow);
  },

  async upsertByPropertyId(
    propertyId: string,
    input: { annualRent: number; otherIncome: number }
  ): Promise<PropertyIncome> {
    const existing = await this.getByPropertyId(propertyId);

    if (!existing) {
      return this.create({
        propertyId,
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