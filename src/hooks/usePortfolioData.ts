import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type PropertyType = "HOUSE" | "APARTMENT" | "GARAGE";

export type PortfolioProperty = {
  id: string;
  name: string;
  type: PropertyType;
  sort_index: number;
  created_at: string;
  is_test?: boolean | null;
};

export type FinanceRow = {
  property_id: string;
  purchase_price: number | null;
};

type AsyncState<T> = {
  loading: boolean;
  data: T;
  error: string | null;
  lastUpdatedAt?: number;
};

function toErrMsg(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as any;
  return anyE?.message ?? anyE?.details ?? anyE?.error_description ?? JSON.stringify(anyE);
}

export function usePortfolioData() {
  const [properties, setProperties] = useState<AsyncState<PortfolioProperty[]>>({
    loading: true,
    data: [],
    error: null,
  });

  const [financeRows, setFinanceRows] = useState<AsyncState<FinanceRow[]>>({
    loading: true,
    data: [],
    error: null,
  });

  // Used to re-trigger loading on demand
  const [tick, setTick] = useState(0);

  // Guard against stale requests
  const seqRef = useRef(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const mySeq = ++seqRef.current;
    const isStale = () => mySeq !== seqRef.current;

    let alive = true;

    (async () => {
      try {
        setProperties((p) => ({ ...p, loading: true, error: null }));
        setFinanceRows((f) => ({ ...f, loading: true, error: null }));

        // 1) Properties
        const { data: pData, error: pErr } = await supabase
          .from("portfolio_properties")
          .select("id,name,type,sort_index,created_at,is_test")
          .or("is_test.is.null,is_test.eq.false")
          .order("sort_index", { ascending: true })
          .order("created_at", { ascending: true });

        if (!alive || isStale()) return;
        if (pErr) throw pErr;

        const props = (pData ?? []) as PortfolioProperty[];
        setProperties({
          loading: false,
          data: props,
          error: null,
          lastUpdatedAt: Date.now(),
        });

        // 2) Finance (only if we have properties)
        if (props.length === 0) {
          setFinanceRows({
            loading: false,
            data: [],
            error: null,
            lastUpdatedAt: Date.now(),
          });
          return;
        }

        const ids = props.map((p) => p.id);

        const { data: fData, error: fErr } = await supabase
          .from("portfolio_property_finance")
          .select("property_id,purchase_price")
          .in("property_id", ids);

        if (!alive || isStale()) return;
        if (fErr) throw fErr;

        setFinanceRows({
          loading: false,
          data: (fData ?? []) as FinanceRow[],
          error: null,
          lastUpdatedAt: Date.now(),
        });
      } catch (e) {
        if (!alive || isStale()) return;
        const msg = toErrMsg(e);
        setProperties({ loading: false, data: [], error: msg, lastUpdatedAt: Date.now() });
        setFinanceRows({ loading: false, data: [], error: msg, lastUpdatedAt: Date.now() });
      }
    })();

    return () => {
      alive = false;
      // invalidate pending async commits
      seqRef.current += 1;
    };
  }, [tick]);

  // Map finance rows by property_id (memoized)
  const financeByPropertyId = useMemo(() => {
    const map: Record<string, FinanceRow> = {};
    for (const r of financeRows.data) map[r.property_id] = r;
    return map;
  }, [financeRows.data]);

  const loading = properties.loading || financeRows.loading;
  const error = properties.error || financeRows.error;

  const combined = useMemo(() => {
    return {
      rows: properties.data,
      financeByPropertyId,
    };
  }, [properties.data, financeByPropertyId]);

  return { properties, financeRows, financeByPropertyId, combined, loading, error, reload };
}
