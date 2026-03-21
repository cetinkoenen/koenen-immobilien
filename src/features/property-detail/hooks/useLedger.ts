import { useCallback, useMemo, useState } from "react";
import { useAsyncResource } from "./useAsyncResource";
import type { MutationState } from "./types";

// An Projekt anpassen
import { ledgerService } from "@/services/ledgerService";
import type { LedgerEntry, CreateLedgerEntryInput, UpdateLedgerEntryInput } from "@/types/ledger";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Ein unbekannter Fehler ist aufgetreten.";
}

function sortLedgerEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => {
    const dateA = new Date(a.bookingDate ?? a.date).getTime();
    const dateB = new Date(b.bookingDate ?? b.date).getTime();
    return dateB - dateA;
  });
}

interface UseLedgerResult {
  entries: LedgerEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  createEntry: (input: CreateLedgerEntryInput) => Promise<void>;
  updateEntry: (entryId: string, input: UpdateLedgerEntryInput) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;

  createState: MutationState;
  updateState: MutationState;
  deleteState: MutationState;
}

export function useLedger(propertyId?: string): UseLedgerResult {
  const [createState, setCreateState] = useState<MutationState>({
    loading: false,
    error: null,
    success: false,
  });

  const [updateState, setUpdateState] = useState<MutationState>({
    loading: false,
    error: null,
    success: false,
  });

  const [deleteState, setDeleteState] = useState<MutationState>({
    loading: false,
    error: null,
    success: false,
  });

  const fetchLedgerEntries = useCallback(async (): Promise<LedgerEntry[]> => {
    if (!propertyId) return [];
    const result = await ledgerService.getByPropertyId(propertyId);
    return sortLedgerEntries(result);
  }, [propertyId]);

  const {
    data,
    loading,
    error,
    reload,
  } = useAsyncResource(fetchLedgerEntries, [fetchLedgerEntries], {
    enabled: Boolean(propertyId),
    initialData: [],
  });

  const entries = useMemo(() => data ?? [], [data]);

  const createEntry = useCallback(
    async (input: CreateLedgerEntryInput) => {
      if (!propertyId) {
        throw new Error("Keine propertyId vorhanden.");
      }

      setCreateState({
        loading: true,
        error: null,
        success: false,
      });

      try {
        await ledgerService.create({
          ...input,
          propertyId,
        });

        setCreateState({
          loading: false,
          error: null,
          success: true,
        });

        await reload();
      } catch (error) {
        setCreateState({
          loading: false,
          error: getErrorMessage(error),
          success: false,
        });
        throw error;
      }
    },
    [propertyId, reload]
  );

  const updateEntry = useCallback(
    async (entryId: string, input: UpdateLedgerEntryInput) => {
      setUpdateState({
        loading: true,
        error: null,
        success: false,
      });

      try {
        await ledgerService.update(entryId, input);

        setUpdateState({
          loading: false,
          error: null,
          success: true,
        });

        await reload();
      } catch (error) {
        setUpdateState({
          loading: false,
          error: getErrorMessage(error),
          success: false,
        });
        throw error;
      }
    },
    [reload]
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      setDeleteState({
        loading: true,
        error: null,
        success: false,
      });

      try {
        await ledgerService.remove(entryId);

        setDeleteState({
          loading: false,
          error: null,
          success: true,
        });

        await reload();
      } catch (error) {
        setDeleteState({
          loading: false,
          error: getErrorMessage(error),
          success: false,
        });
        throw error;
      }
    },
    [reload]
  );

  return {
    entries,
    loading,
    error,
    reload,
    createEntry,
    updateEntry,
    deleteEntry,
    createState,
    updateState,
    deleteState,
  };
}