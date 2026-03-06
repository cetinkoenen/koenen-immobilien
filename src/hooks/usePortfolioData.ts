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
  expose_path?: string | null;
};

export type FinanceRow = {
  property_id: string;
  purchase_price: number | null;
};

type AsyncState<T> = {
  loading: boolean;
  data: T;
  error: string | null;
  lastUpdatedAt: number | null;
};

function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;

  const maybeError = error as {
    message?: string;
    details?: string;
    error_description?: string;
  };

  return (
    maybeError.message ??
    maybeError.details ??
    maybeError.error_description ??
    JSON.stringify(error)
  );
}

const initialPropertiesState: AsyncState<PortfolioProperty[]> = {
  loading: true,
  data: [],
  error: null,
  lastUpdatedAt: null,
};

const initialFinanceState: AsyncState<FinanceRow[]> = {
  loading: true,
  data: [],
  error: null,
  lastUpdatedAt: null,
};

export function usePortfolioData() {
  const [properties, setProperties] =
    useState<AsyncState<PortfolioProperty[]>>(initialPropertiesState);

  const [financeRows, setFinanceRows] =
    useState<AsyncState<FinanceRow[]>>(initialFinanceState);

  const requestIdRef = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const requestId = ++requestIdRef.current;

    const isOutdated = () => {
      return !isMounted || requestId !== requestIdRef.current;
    };

    async function loadPortfolioData() {
      try {
        setProperties((prev) => ({
          ...prev,
          loading: true,
          error: null,
        }));

        setFinanceRows((prev) => ({
          ...prev,
          loading: true,
          error: null,
        }));

        const { data: propertyData, error: propertyError } = await supabase
          .from("portfolio_properties")
          .select("id, name, type, sort_index, created_at, is_test, expose_path")
          .or("is_test.is.null,is_test.eq.false")
          .order("sort_index", { ascending: true })
          .order("created_at", { ascending: true });

        if (isOutdated()) return;

        if (propertyError) {
          throw propertyError;
        }

        const safeProperties = (propertyData ?? []) as PortfolioProperty[];

        setProperties({
          loading: false,
          data: safeProperties,
          error: null,
          lastUpdatedAt: Date.now(),
        });

        if (safeProperties.length === 0) {
          setFinanceRows({
            loading: false,
            data: [],
            error: null,
            lastUpdatedAt: Date.now(),
          });
          return;
        }

        const propertyIds = safeProperties.map((property) => property.id);

        const { data: financeData, error: financeError } = await supabase
          .from("portfolio_property_finance")
          .select("property_id, purchase_price")
          .in("property_id", propertyIds);

        if (isOutdated()) return;

        if (financeError) {
          throw financeError;
        }

        setFinanceRows({
          loading: false,
          data: (financeData ?? []) as FinanceRow[],
          error: null,
          lastUpdatedAt: Date.now(),
        });
      } catch (error) {
        if (isOutdated()) return;

        const message = getErrorMessage(error);

        setProperties({
          loading: false,
          data: [],
          error: message,
          lastUpdatedAt: Date.now(),
        });

        setFinanceRows({
          loading: false,
          data: [],
          error: message,
          lastUpdatedAt: Date.now(),
        });

        console.error("[usePortfolioData] load error", error);
      }
    }

    void loadPortfolioData();

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  const financeByPropertyId = useMemo(() => {
    const map: Record<string, FinanceRow> = {};

    for (const row of financeRows.data) {
      map[row.property_id] = row;
    }

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

  return {
    properties,
    financeRows,
    financeByPropertyId,
    combined,
    loading,
    error,
    reload,
  };
}