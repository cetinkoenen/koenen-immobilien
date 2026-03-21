import { useCallback, useMemo, useState } from "react";
import { useAsyncResource } from "./useAsyncResource";
import type { MutationState } from "./types";

// An Projekt anpassen
import { propertyIncomeService } from "@/services/propertyIncomeService";
import { yearlyIncomeService } from "@/services/yearlyIncomeService";
import { yearlyCapexService } from "@/services/yearlyCapexService";

import type {
  PropertyIncome,
  UpdatePropertyIncomeInput,
} from "@/types/income";
import type {
  YearlyIncomeEntry,
  CreateYearlyIncomeInput,
  UpdateYearlyIncomeInput,
} from "@/types/yearlyIncome";
import type {
  YearlyCapexEntry,
  CreateYearlyCapexInput,
  UpdateYearlyCapexInput,
} from "@/types/yearlyCapex";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Ein unbekannter Fehler ist aufgetreten.";
}

function sortByYearAsc<T extends { year: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.year - b.year);
}

interface IncomeBundle {
  propertyIncome: PropertyIncome | null;
  yearlyIncomeEntries: YearlyIncomeEntry[];
  yearlyCapexEntries: YearlyCapexEntry[];
}

interface UseIncomeResult {
  propertyIncome: PropertyIncome | null;
  yearlyIncomeEntries: YearlyIncomeEntry[];
  yearlyCapexEntries: YearlyCapexEntry[];

  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  updatePropertyIncome: (input: UpdatePropertyIncomeInput) => Promise<void>;

  createYearlyIncome: (input: CreateYearlyIncomeInput) => Promise<void>;
  updateYearlyIncome: (id: string, input: UpdateYearlyIncomeInput) => Promise<void>;
  deleteYearlyIncome: (id: string) => Promise<void>;

  createYearlyCapex: (input: CreateYearlyCapexInput) => Promise<void>;
  updateYearlyCapex: (id: string, input: UpdateYearlyCapexInput) => Promise<void>;
  deleteYearlyCapex: (id: string) => Promise<void>;

  mutationState: MutationState;
}

export function useIncome(propertyId?: string): UseIncomeResult {
  const [mutationState, setMutationState] = useState<MutationState>({
    loading: false,
    error: null,
    success: false,
  });

  const fetchIncomeBundle = useCallback(async (): Promise<IncomeBundle> => {
    if (!propertyId) {
      return {
        propertyIncome: null,
        yearlyIncomeEntries: [],
        yearlyCapexEntries: [],
      };
    }

    const [propertyIncome, yearlyIncomeEntries, yearlyCapexEntries] =
      await Promise.all([
        propertyIncomeService.getByPropertyId(propertyId),
        yearlyIncomeService.getByPropertyId(propertyId),
        yearlyCapexService.getByPropertyId(propertyId),
      ]);

    return {
      propertyIncome: propertyIncome ?? null,
      yearlyIncomeEntries: sortByYearAsc(yearlyIncomeEntries ?? []),
      yearlyCapexEntries: sortByYearAsc(yearlyCapexEntries ?? []),
    };
  }, [propertyId]);

  const { data, loading, error, reload } = useAsyncResource(
    fetchIncomeBundle,
    [fetchIncomeBundle],
    {
      enabled: Boolean(propertyId),
      initialData: {
        propertyIncome: null,
        yearlyIncomeEntries: [],
        yearlyCapexEntries: [],
      },
    }
  );

  const propertyIncome = data?.propertyIncome ?? null;
  const yearlyIncomeEntries = useMemo(
    () => data?.yearlyIncomeEntries ?? [],
    [data]
  );
  const yearlyCapexEntries = useMemo(
    () => data?.yearlyCapexEntries ?? [],
    [data]
  );

  const runMutation = useCallback(async (action: () => Promise<void>) => {
    setMutationState({
      loading: true,
      error: null,
      success: false,
    });

    try {
      await action();

      setMutationState({
        loading: false,
        error: null,
        success: true,
      });

      await reload();
    } catch (error) {
      setMutationState({
        loading: false,
        error: getErrorMessage(error),
        success: false,
      });
      throw error;
    }
  }, [reload]);

  const updatePropertyIncome = useCallback(
    async (input: UpdatePropertyIncomeInput) => {
      if (!propertyId) throw new Error("Keine propertyId vorhanden.");

      await runMutation(async () => {
        await propertyIncomeService.upsert({
          ...input,
          propertyId,
        });
      });
    },
    [propertyId, runMutation]
  );

  const createYearlyIncome = useCallback(
    async (input: CreateYearlyIncomeInput) => {
      if (!propertyId) throw new Error("Keine propertyId vorhanden.");

      await runMutation(async () => {
        await yearlyIncomeService.create({
          ...input,
          propertyId,
        });
      });
    },
    [propertyId, runMutation]
  );

  const updateYearlyIncome = useCallback(
    async (id: string, input: UpdateYearlyIncomeInput) => {
      await runMutation(async () => {
        await yearlyIncomeService.update(id, input);
      });
    },
    [runMutation]
  );

  const deleteYearlyIncome = useCallback(
    async (id: string) => {
      await runMutation(async () => {
        await yearlyIncomeService.remove(id);
      });
    },
    [runMutation]
  );

  const createYearlyCapex = useCallback(
    async (input: CreateYearlyCapexInput) => {
      if (!propertyId) throw new Error("Keine propertyId vorhanden.");

      await runMutation(async () => {
        await yearlyCapexService.create({
          ...input,
          propertyId,
        });
      });
    },
    [propertyId, runMutation]
  );

  const updateYearlyCapex = useCallback(
    async (id: string, input: UpdateYearlyCapexInput) => {
      await runMutation(async () => {
        await yearlyCapexService.update(id, input);
      });
    },
    [runMutation]
  );

  const deleteYearlyCapex = useCallback(
    async (id: string) => {
      await runMutation(async () => {
        await yearlyCapexService.remove(id);
      });
    },
    [runMutation]
  );

  return {
    propertyIncome,
    yearlyIncomeEntries,
    yearlyCapexEntries,
    loading,
    error,
    reload,
    updatePropertyIncome,
    createYearlyIncome,
    updateYearlyIncome,
    deleteYearlyIncome,
    createYearlyCapex,
    updateYearlyCapex,
    deleteYearlyCapex,
    mutationState,
  };
}