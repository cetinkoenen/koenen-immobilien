import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { propertyIncomeService } from "../../../services/propertyIncomeService";
import { yearlyIncomeService } from "../../../services/yearlyIncomeService";
import { yearlyCapexService } from "../../../services/yearlyCapexService";
import type { PropertyIncome } from "../../../types/propertyIncome";
import type { YearlyCapexEntry, YearlyIncomeEntry } from "../../../types/finance";

export type IncomeBundle = {
  propertyIncome: PropertyIncome | null;
  yearlyIncome: YearlyIncomeEntry[];
  yearlyCapex: YearlyCapexEntry[];
};

export type PropertyIncomeCreateInput = {
  annualRent: number;
  otherIncome: number;
};

export type PropertyIncomeUpdateInput = {
  annualRent?: number;
  otherIncome?: number;
};

export type YearlyIncomeCreateInput = {
  year: number;
  annual_rent: number;
  other_income?: number;
  source?: string | null;
};

export type YearlyIncomeUpdateInput = {
  year?: number;
  annual_rent?: number;
  other_income?: number;
  source?: string | null;
};

export type YearlyCapexCreateInput = {
  year: number;
  amount: number;
  category?: string | null;
  note?: string | null;
};

export type YearlyCapexUpdateInput = {
  year?: number;
  amount?: number;
  category?: string | null;
  note?: string | null;
};

type UseIncomeResult = {
  data: IncomeBundle;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  createPropertyIncome: (input: PropertyIncomeCreateInput) => Promise<PropertyIncome>;
  updatePropertyIncome: (
    id: string,
    input: PropertyIncomeUpdateInput
  ) => Promise<PropertyIncome>;
  deletePropertyIncome: (id: string) => Promise<void>;

  createYearlyIncome: (input: YearlyIncomeCreateInput) => Promise<YearlyIncomeEntry>;
  updateYearlyIncome: (
    id: string,
    input: YearlyIncomeUpdateInput
  ) => Promise<YearlyIncomeEntry>;
  deleteYearlyIncome: (id: string) => Promise<void>;

  createCapex: (input: YearlyCapexCreateInput) => Promise<YearlyCapexEntry>;
  updateCapex: (id: string, input: YearlyCapexUpdateInput) => Promise<YearlyCapexEntry>;
  deleteCapex: (id: string) => Promise<void>;
};

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
};

const toYear = (value: unknown, fallback = new Date().getFullYear()): number => {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1900 && num <= 3000 ? num : fallback;
};

const EMPTY_DATA: IncomeBundle = {
  propertyIncome: null,
  yearlyIncome: [],
  yearlyCapex: [],
};

export function useIncome(propertyId: string | undefined | null): UseIncomeResult {
  const [data, setData] = useState<IncomeBundle>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const validPropertyId = useMemo(() => {
    const value = String(propertyId ?? "").trim();
    return isUuid(value) ? value : null;
  }, [propertyId]);

  const load = useCallback(async () => {
    if (!validPropertyId) {
      setData(EMPTY_DATA);
      setError(propertyId ? "Ungültige propertyId (UUID erwartet)." : null);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const [propertyIncomeRaw, yearlyIncomeRaw, yearlyCapexRaw] = await Promise.all([
        propertyIncomeService.getByPropertyId(validPropertyId),
        yearlyIncomeService.getByPropertyId(validPropertyId),
        yearlyCapexService.getByPropertyId(validPropertyId),
      ]);

      if (requestId !== requestIdRef.current) return;

      setData({
        propertyIncome: propertyIncomeRaw,
        yearlyIncome: Array.isArray(yearlyIncomeRaw)
          ? [...yearlyIncomeRaw].sort((a, b) => toYear(a.year) - toYear(b.year))
          : [],
        yearlyCapex: Array.isArray(yearlyCapexRaw)
          ? [...yearlyCapexRaw].sort((a, b) => toYear(a.year) - toYear(b.year))
          : [],
      });
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message ?? "Fehler beim Laden der Income-Daten.");
      setData(EMPTY_DATA);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [propertyId, validPropertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const createPropertyIncome = useCallback(
    async (input: PropertyIncomeCreateInput): Promise<PropertyIncome> => {
      if (!validPropertyId) {
        throw new Error("Ungültige propertyId.");
      }

      const created = await propertyIncomeService.create({
        propertyId: validPropertyId,
        annualRent: toFiniteNumber(input.annualRent, 0),
        otherIncome: toFiniteNumber(input.otherIncome, 0),
      });

      setData((prev) => ({
        ...prev,
        propertyIncome: created,
      }));

      return created;
    },
    [validPropertyId]
  );

  const updatePropertyIncome = useCallback(
    async (id: string, input: PropertyIncomeUpdateInput): Promise<PropertyIncome> => {
      const payload: PropertyIncomeUpdateInput = {};

      if (input.annualRent !== undefined) {
        payload.annualRent = toFiniteNumber(input.annualRent, 0);
      }

      if (input.otherIncome !== undefined) {
        payload.otherIncome = toFiniteNumber(input.otherIncome, 0);
      }

      const updated = await propertyIncomeService.update(id, payload);

      setData((prev) => ({
        ...prev,
        propertyIncome: updated,
      }));

      return updated;
    },
    []
  );

  const deletePropertyIncome = useCallback(async (id: string): Promise<void> => {
    await propertyIncomeService.remove(id);

    setData((prev) => ({
      ...prev,
      propertyIncome: prev.propertyIncome?.id === id ? null : prev.propertyIncome,
    }));
  }, []);

  const createYearlyIncome = useCallback(
    async (input: YearlyIncomeCreateInput): Promise<YearlyIncomeEntry> => {
      if (!validPropertyId) {
        throw new Error("Ungültige propertyId.");
      }

      const created = await yearlyIncomeService.create({
        property_id: validPropertyId,
        year: toYear(input.year),
        annual_rent: toFiniteNumber(input.annual_rent, 0),
        other_income: toFiniteNumber(input.other_income ?? 0, 0),
        source: toNullableString(input.source),
      });

      setData((prev) => ({
        ...prev,
        yearlyIncome: [...prev.yearlyIncome, created].sort(
          (a, b) => toYear(a.year) - toYear(b.year)
        ),
      }));

      return created;
    },
    [validPropertyId]
  );

  const updateYearlyIncome = useCallback(
    async (id: string, input: YearlyIncomeUpdateInput): Promise<YearlyIncomeEntry> => {
      const payload: YearlyIncomeUpdateInput = {};

      if (input.year !== undefined) {
        payload.year = toYear(input.year);
      }

      if (input.annual_rent !== undefined) {
        payload.annual_rent = toFiniteNumber(input.annual_rent, 0);
      }

      if (input.other_income !== undefined) {
        payload.other_income = toFiniteNumber(input.other_income, 0);
      }

      if (input.source !== undefined) {
        payload.source = toNullableString(input.source);
      }

      const updated = await yearlyIncomeService.update(id, payload);

      setData((prev) => ({
        ...prev,
        yearlyIncome: prev.yearlyIncome
          .map((item) => (item.id === id ? updated : item))
          .sort((a, b) => toYear(a.year) - toYear(b.year)),
      }));

      return updated;
    },
    []
  );

  const deleteYearlyIncome = useCallback(async (id: string): Promise<void> => {
    await yearlyIncomeService.remove(id);

    setData((prev) => ({
      ...prev,
      yearlyIncome: prev.yearlyIncome.filter((item) => item.id !== id),
    }));
  }, []);

  const createCapex = useCallback(
    async (input: YearlyCapexCreateInput): Promise<YearlyCapexEntry> => {
      if (!validPropertyId) {
        throw new Error("Ungültige propertyId.");
      }

      const created = await yearlyCapexService.create({
        propertyId: validPropertyId,
        year: toYear(input.year),
        amount: toFiniteNumber(input.amount, 0),
        category: toNullableString(input.category),
        note: toNullableString(input.note),
      });

      setData((prev) => ({
        ...prev,
        yearlyCapex: [...prev.yearlyCapex, created].sort(
          (a, b) => toYear(a.year) - toYear(b.year)
        ),
      }));

      return created;
    },
    [validPropertyId]
  );

  const updateCapex = useCallback(
    async (id: string, input: YearlyCapexUpdateInput): Promise<YearlyCapexEntry> => {
      const payload: YearlyCapexUpdateInput = {};

      if (input.year !== undefined) {
        payload.year = toYear(input.year);
      }

      if (input.amount !== undefined) {
        payload.amount = toFiniteNumber(input.amount, 0);
      }

      if (input.category !== undefined) {
        payload.category = toNullableString(input.category);
      }

      if (input.note !== undefined) {
        payload.note = toNullableString(input.note);
      }

      const updated = await yearlyCapexService.update(id, payload);

      setData((prev) => ({
        ...prev,
        yearlyCapex: prev.yearlyCapex
          .map((item) => (item.id === id ? updated : item))
          .sort((a, b) => toYear(a.year) - toYear(b.year)),
      }));

      return updated;
    },
    []
  );

  const deleteCapex = useCallback(async (id: string): Promise<void> => {
    await yearlyCapexService.remove(id);

    setData((prev) => ({
      ...prev,
      yearlyCapex: prev.yearlyCapex.filter((item) => item.id !== id),
    }));
  }, []);

  return {
    data,
    isLoading,
    error,
    reload,
    createPropertyIncome,
    updatePropertyIncome,
    deletePropertyIncome,
    createYearlyIncome,
    updateYearlyIncome,
    deleteYearlyIncome,
    createCapex,
    updateCapex,
    deleteCapex,
  };
}
