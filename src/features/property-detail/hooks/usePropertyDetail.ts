import { useCallback } from "react";
import { useAsyncResource } from "./useAsyncResource";

// Diese Typen/Services musst du an dein Projekt anpassen
import { getPropertyById } from "@/services/propertyService";
import type { Property } from "@/types/property";

interface UsePropertyDetailResult {
  property: Property | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  status: "idle" | "loading" | "success" | "error";
}

export function usePropertyDetail(propertyId?: string): UsePropertyDetailResult {
  const fetchProperty = useCallback(async () => {
    if (!propertyId) {
      throw new Error("Keine propertyId übergeben.");
    }

    const result = await getPropertyById(propertyId);
    return result;
  }, [propertyId]);

  const { data, loading, error, reload, status } = useAsyncResource(
    fetchProperty,
    [fetchProperty],
    { enabled: Boolean(propertyId) }
  );

  return {
    property: data,
    loading,
    error,
    reload,
    status,
  };
}