// src/pages/portfolio/usePortfolioId.ts
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

export function usePortfolioId() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  /**
   * ✅ Single source of truth:
   * Your route uses: /portfolio/:propertyId
   * So we read params.propertyId first.
   *
   * We still support fallback query params for emergency/debug,
   * but the normal flow should always use the path param.
   */
  const fromParam = normalizeStr((params as any).propertyId);

  const fromQuery =
    normalizeStr(searchParams.get("propertyId")) ??
    normalizeStr(searchParams.get("portfolioId")) ??
    normalizeStr(searchParams.get("id"));

  const portfolioId = useMemo(() => fromParam ?? fromQuery, [fromParam, fromQuery]);

  const isValidUuid = useMemo(() => {
    if (!portfolioId) return false;
    return UUID_RE.test(portfolioId);
  }, [portfolioId]);

  return {
    portfolioId,
    isValidUuid,
    source: fromParam ? "params" : fromQuery ? "query" : "none",
  } as const;
}
