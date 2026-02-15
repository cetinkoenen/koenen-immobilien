import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RentHistory24mRow } from "@/types/rentHistory";

type ScopeType = "user" | "property";

interface UseRentHistoryParams {
  scopeType: ScopeType;
  propertyId?: string;
}

export function useRentHistory24m({
  scopeType,
  propertyId,
}: UseRentHistoryParams) {
  const [data, setData] = useState<RentHistory24mRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("v_rent_history_chart_unified_my_24m")
        .select("*")
        .eq("scope_type", scopeType)
        .order("month", { ascending: true });

      if (scopeType === "property" && propertyId) {
        query = query.eq("scope_id", propertyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Rent history fetch error:", error);
        setError(error.message);
        setData([]);
      } else {
        setData(data ?? []);
      }

      setLoading(false);
    }

    fetchData();
  }, [scopeType, propertyId]);

  return { data, loading, error };
}
