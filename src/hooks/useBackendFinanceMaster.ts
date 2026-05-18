import { useEffect, useMemo, useState } from "react";
import { loadBackendDataQualityChecks, loadBackendFinanceConsistency, loadBackendFinanceMaster, type BackendDataQualityCheckRow, type BackendFinanceConsistencyRow, type BackendFinanceMasterRow } from "@/services/backendFinanceMasterService";
import { buildMasterFinanceSnapshotsFromBackend, buildMasterTotals, type MasterFinanceSnapshot } from "@/services/masterDataService";

export type BackendFinanceMasterState = {
  rows: BackendFinanceMasterRow[];
  snapshots: MasterFinanceSnapshot[];
  consistency: BackendFinanceConsistencyRow[];
  dataQualityChecks: BackendDataQualityCheckRow[];
  loading: boolean;
  error: string | null;
  sourceLabel: "Backend-Finanzmaster" | "Frontend-Fallback";
  refreshedAt: string | null;
};

export function useBackendFinanceMaster(year: number): BackendFinanceMasterState {
  const [rows, setRows] = useState<BackendFinanceMasterRow[]>([]);
  const [consistency, setConsistency] = useState<BackendFinanceConsistencyRow[]>([]);
  const [dataQualityChecks, setDataQualityChecks] = useState<BackendDataQualityCheckRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([loadBackendFinanceMaster(year), loadBackendFinanceConsistency(year), loadBackendDataQualityChecks(year)])
      .then(([masterRows, consistencyRows, qualityRows]) => {
        if (cancelled) return;
        setRows(masterRows);
        setConsistency(consistencyRows);
        setDataQualityChecks(qualityRows);
      })
      .catch((unknownError) => {
        if (cancelled) return;
        setRows([]);
        setConsistency([]);
        setDataQualityChecks([]);
        setError(unknownError instanceof Error ? unknownError.message : "Backend-Finanzmaster konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const snapshots = useMemo(() => buildMasterFinanceSnapshotsFromBackend(rows), [rows]);
  const refreshedAt = useMemo(() => rows.find((row) => row.refreshed_at)?.refreshed_at ?? null, [rows]);

  return {
    rows,
    snapshots,
    consistency,
    dataQualityChecks,
    loading,
    error,
    sourceLabel: rows.length ? "Backend-Finanzmaster" : "Frontend-Fallback",
    refreshedAt,
  };
}

export function useBackendFinanceTotals(year: number) {
  const state = useBackendFinanceMaster(year);
  return { ...state, totals: buildMasterTotals(state.snapshots) };
}
