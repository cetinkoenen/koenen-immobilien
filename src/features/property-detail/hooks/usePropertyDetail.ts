import { useCallback, useEffect, useState } from "react";
import * as propertyServiceModule from "../../../services/propertyService";

type ServiceResponse<T> = T | { data?: T };

export interface UsePropertyDetailResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

function resolveGetPropertyById() {
  const mod = propertyServiceModule as any;

  if (typeof mod.getPropertyById === "function") {
    return mod.getPropertyById.bind(mod);
  }

  if (mod.default && typeof mod.default.getPropertyById === "function") {
    return mod.default.getPropertyById.bind(mod.default);
  }

  throw new Error(
    "propertyService.getPropertyById wurde nicht gefunden. Prüfe den Export in src/services/propertyService.ts"
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function usePropertyDetail<T = unknown>(
  propertyId: string | null
): UsePropertyDetailResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!propertyId) {
      setData(null);
      setError(new Error("Keine propertyId vorhanden."));
      setIsLoading(false);
      return;
    }

    if (!isUuid(propertyId)) {
      setData(null);
      setError(
        new Error(
          `Ungültige Objekt-ID "${propertyId}". Erwartet wird eine UUID, keine numerische ID.`
        )
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const getPropertyById = resolveGetPropertyById();
      const response: ServiceResponse<T> = await getPropertyById(propertyId);

      if (!response) {
        setData(null);
        setError(new Error("Kein Objekt gefunden."));
        return;
      }

      const normalized =
        typeof response === "object" && response !== null && "data" in response
          ? (response.data ?? null)
          : response;

      setData((normalized as T | null) ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler beim Laden des Objekts.";

      setData(null);
      setError(new Error(`Objekt konnte nicht geladen werden: ${message}`));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    isLoading,
    error,
    reload: load,
  };
}
