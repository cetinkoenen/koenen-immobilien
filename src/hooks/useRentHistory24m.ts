import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RentHistory24mRow } from "@/types/rentHistory";

type ScopeType = "user" | "property";

interface UseRentHistoryParams {
  scopeType: ScopeType;
  propertyId?: string;
}

type UseRentHistoryResult = {
  data: RentHistory24mRow[];
  loading: boolean;
  error: string | null;
  requiresAuth: boolean;
  refetch: () => void;
};

function normalizeError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err && "message" in err) return String((err as any).message);
  return String(err);
}

export function useRentHistory24m({ scopeType, propertyId }: UseRentHistoryParams): UseRentHistoryResult {
  const DEBUG = import.meta.env.VITE_DEBUG_CHARTS === "1";

  const [data, setData] = useState<RentHistory24mRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState<boolean>(false);

  // manual refetch trigger (and used by auth change)
  const [bump, setBump] = useState(0);
  const refetch = useCallback(() => setBump((x) => x + 1), []);

  // stable request sequencing guard
  const reqSeq = useRef(0);

  const key = useMemo(() => {
    // keep it stable + explicit
    return `${scopeType}:${propertyId ?? ""}`;
  }, [scopeType, propertyId]);

  // Subscribe to auth changes ONCE
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // trigger a refetch (login/logout/token refresh)
      setBump((x) => x + 1);
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const propertyIdMissing = scopeType === "property" && !propertyId;

    // each run corresponds to one “request”
    const mySeq = ++reqSeq.current;

    // helper to ignore stale completions
    const isStale = () => mySeq !== reqSeq.current;

    async function run() {
      setLoading(true);
      setError(null);
      setRequiresAuth(false);

      // property scope needs id
      if (propertyIdMissing) {
        if (isStale()) return;
        setData([]);
        setLoading(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = sessionData?.session ?? null;

        if (DEBUG) {
          console.log("[useRentHistory24m] session", {
            hasSession: !!session,
            userId: session?.user?.id ?? null,
            tokenPrefix: session?.access_token?.slice(0, 12) ?? null,
            scopeType,
            propertyId: propertyId ?? null,
            key,
            bump,
          });
        }

        // No session => not an error
        if (!session) {
          if (isStale()) return;
          setData([]);
          setRequiresAuth(true);
          setLoading(false);
          return;
        }

        let q = supabase
          .from("v_rent_history_chart_unified_my_24m")
          .select("*")
          .eq("scope_type", scopeType)
          .order("month", { ascending: true });

        if (scopeType === "property" && propertyId) {
          q = q.eq("scope_id", propertyId);
        }

        const { data: rows, error: qErr } = await q;
        if (qErr) throw qErr;

        if (isStale()) return;

        const safeRows = (rows ?? []) as RentHistory24mRow[];
        setData(safeRows);
        setLoading(false);

        if (DEBUG) {
          console.log("[useRentHistory24m] result", {
            rows: safeRows.length,
            sample: safeRows[0],
          });
        }
      } catch (e) {
        const msg = normalizeError(e);
        console.error("[useRentHistory24m] fetch error:", e);

        if (isStale()) return;
        setData([]);
        setError(msg);
        setLoading(false);
      }
    }

    run();
  }, [key, scopeType, propertyId, bump, DEBUG]);

  return { data, loading, error, requiresAuth, refetch };
}
