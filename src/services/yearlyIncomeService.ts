import { supabase } from "@/lib/supabase";
import type { YearlyIncomeEntry } from "@/types/finance";

export type CreateYearlyIncomeEntryInput = {
  property_id: string;
  year: number;
  annual_rent: number;
  other_income: number;
  source?: string | null;
};

export type UpdateYearlyIncomeEntryInput = {
  year?: number;
  annual_rent?: number;
  other_income?: number;
  source?: string | null;
};

export const yearlyIncomeService = {
  async getByPropertyId(propertyId: string): Promise<YearlyIncomeEntry[]> {
    const { data, error } = await supabase
      .from("yearly_property_income")
      .select("*")
      .eq("property_id", propertyId)
      .order("year", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as YearlyIncomeEntry[];
  },

  async create(input: CreateYearlyIncomeEntryInput): Promise<YearlyIncomeEntry> {
    const payload = {
      property_id: input.property_id,
      year: input.year,
      annual_rent: input.annual_rent,
      other_income: input.other_income,
      source: input.source ?? null,
    };

    const { data, error } = await supabase
      .from("yearly_property_income")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as YearlyIncomeEntry;
  },

  async update(
    id: string,
    input: UpdateYearlyIncomeEntryInput
  ): Promise<YearlyIncomeEntry> {
    const payload: UpdateYearlyIncomeEntryInput = {};

    if (input.year !== undefined) {
      payload.year = input.year;
    }

    if (input.annual_rent !== undefined) {
      payload.annual_rent = input.annual_rent;
    }

    if (input.other_income !== undefined) {
      payload.other_income = input.other_income;
    }

    if (input.source !== undefined) {
      payload.source = input.source ?? null;
    }

    const { data, error } = await supabase
      .from("yearly_property_income")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as YearlyIncomeEntry;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("yearly_property_income")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  },

  async upsertByPropertyIdAndYear(
    propertyId: string,
    year: number,
    input: {
      annual_rent: number;
      other_income: number;
      source?: string | null;
    }
  ): Promise<YearlyIncomeEntry> {
    const payload = {
      property_id: propertyId,
      year,
      annual_rent: input.annual_rent,
      other_income: input.other_income,
      source: input.source ?? null,
    };

    const { data, error } = await supabase
      .from("yearly_property_income")
      .upsert(payload, {
        onConflict: "property_id,year",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as YearlyIncomeEntry;
  },
};