import { useEffect, useState } from "react";
import { resolvePropertyContext, type ResolvedPropertyContext } from "@/services/property/resolvePropertyContext";

type UseResolvedPropertyContextResult = {
  data: ResolvedPropertyContext | null;
  loading: boolean;
  error: string | null;
};

export function useResolvedPropertyContext(
  propertyId: string,
): UseResolvedPropertyContextResult {
  const [data, setData] = useState<ResolvedPropertyContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!propertyId) {
        setData(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const resolved = await resolvePropertyContext(propertyId);
        if (cancelled) return;
        setData(resolved);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return { data, loading, error };
}
