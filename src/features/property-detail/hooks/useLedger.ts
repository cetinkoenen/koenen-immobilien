import { useCallback, useEffect, useState } from "react";
import { ledgerService, type CreateYearlyLedgerEntryInput, type UpdateYearlyLedgerEntryInput, type YearlyLedgerEntry } from "@/services/ledgerService";

export interface UseLedgerResult {
  entries: YearlyLedgerEntry[];
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  createEntry: (input: Omit<CreateYearlyLedgerEntryInput, "propertyId">) => Promise<YearlyLedgerEntry>;
  updateEntry: (id: string, input: UpdateYearlyLedgerEntryInput) => Promise<YearlyLedgerEntry>;
  deleteEntry: (id: string) => Promise<void>;
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string" && error.trim()) {
    return new Error(error);
  }

  return new Error(fallback);
}

export function useLedger(propertyId: string | null): UseLedgerResult {
  const [entries, setEntries] = useState<YearlyLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!propertyId) {
      setEntries([]);
      setError(new Error("Keine propertyId vorhanden."));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await ledgerService.getByPropertyId(propertyId);
      setEntries(result);
    } catch (err) {
      setEntries([]);
      setError(normalizeError(err, "Ledger konnte nicht geladen werden."));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createEntry = useCallback(
    async (
      input: Omit<CreateYearlyLedgerEntryInput, "propertyId">
    ): Promise<YearlyLedgerEntry> => {
      if (!propertyId) {
        throw new Error("Keine propertyId vorhanden.");
      }

      setError(null);

      try {
        const created = await ledgerService.create({
          propertyId,
          ...input,
        });

        setEntries((prev) =>
          [...prev, created].sort((a, b) => a.year - b.year)
        );

        return created;
      } catch (err) {
        const normalized = normalizeError(err, "Ledger-Eintrag konnte nicht erstellt werden.");
        setError(normalized);
        throw normalized;
      }
    },
    [propertyId]
  );

  const updateEntry = useCallback(
    async (
      id: string,
      input: UpdateYearlyLedgerEntryInput
    ): Promise<YearlyLedgerEntry> => {
      setError(null);

      try {
        const updated = await ledgerService.update(id, input);

        setEntries((prev) =>
          prev
            .map((entry) => (entry.id === id ? updated : entry))
            .sort((a, b) => a.year - b.year)
        );

        return updated;
      } catch (err) {
        const normalized = normalizeError(err, "Ledger-Eintrag konnte nicht aktualisiert werden.");
        setError(normalized);
        throw normalized;
      }
    },
    []
  );

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    setError(null);

    try {
      await ledgerService.remove(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      const normalized = normalizeError(err, "Ledger-Eintrag konnte nicht gelöscht werden.");
      setError(normalized);
      throw normalized;
    }
  }, []);

  return {
    entries,
    isLoading,
    error,
    reload,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
