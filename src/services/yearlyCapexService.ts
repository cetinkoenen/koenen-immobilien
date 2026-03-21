import { supabase } from "@/lib/supabase";
import type { DbYearlyCapexEntry, YearlyCapexEntry } from "@/types/finance";

function mapDbYearlyCapexEntry(row: DbYearlyCapexEntry): YearlyCapexEntry {
  return {
    id: row.id,
    propertyId: row.property_id,
    year: row.year,
    amount: Number(row.amount ?? 0),
    category: row.category,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreateYearlyCapexInput = {
  propertyId: string;
  year: number;
  amount: number;
  category?: string | null;
  note?: string | null;
};

export type UpdateYearlyCapexInput = Partial<{
  year: number;
  amount: number;
  category: string | null;
  note: string | null;
}>;

export const yearlyCapexService = {
  async getByPropertyId(propertyId: string): Promise<YearlyCapexEntry[]> {
    const { data, error } = await supabase
      .from("yearly_capex_entries")
      .select("*")
      .eq("property_id", propertyId)
      .order("year", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => mapDbYearlyCapexEntry(row as DbYearlyCapexEntry));
  },

  async getById(id: string): Promise<YearlyCapexEntry | null> {
    const { data, error } = await supabase
      .from("yearly_capex_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return mapDbYearlyCapexEntry(data as DbYearlyCapexEntry);
  },

  async create(input: CreateYearlyCapexInput): Promise<YearlyCapexEntry> {
    const { data, error } = await supabase
      .from("yearly_capex_entries")
      .insert({
        property_id: input.propertyId,
        year: input.year,
        amount: input.amount,
        category: input.category ?? null,
        note: input.note ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapDbYearlyCapexEntry(data as DbYearlyCapexEntry);
  },

  async update(
    id: string,
    updates: UpdateYearlyCapexInput
  ): Promise<YearlyCapexEntry> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.year !== undefined) {
      dbUpdates.year = updates.year;
    }

    if (updates.amount !== undefined) {
      dbUpdates.amount = updates.amount;
    }

    if (updates.category !== undefined) {
      dbUpdates.category = updates.category;
    }

    if (updates.note !== undefined) {
      dbUpdates.note = updates.note;
    }

    const { data, error } = await supabase
      .from("yearly_capex_entries")
      .update(dbUpdates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapDbYearlyCapexEntry(data as DbYearlyCapexEntry);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("yearly_capex_entries")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  },

  async upsertByPropertyIdAndYear(
    input: CreateYearlyCapexInput
  ): Promise<YearlyCapexEntry> {
    const { data, error } = await supabase
      .from("yearly_capex_entries")
      .upsert(
        {
          property_id: input.propertyId,
          year: input.year,
          amount: input.amount,
          category: input.category ?? null,
          note: input.note ?? null,
        },
        {
          onConflict: "property_id,year",
        }
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapDbYearlyCapexEntry(data as DbYearlyCapexEntry);
  },
};