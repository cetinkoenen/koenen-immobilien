// src/portfolio/usePortfolioId.ts
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

function normalizeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s;
}

export function usePortfolioId() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  // 🔴 WICHTIG:
  // Passe den Param-Namen hier an DEINE Route an
  // z.B. :portfolioId ODER :id
  const fromParam =
    normalizeId((params as any).portfolioId) ??
    normalizeId((params as any).id);

  const fromQuery =
    normalizeId(searchParams.get("portfolioId")) ??
    normalizeId(searchParams.get("id"));

  const portfolioId = useMemo(
    () => fromParam ?? fromQuery,
    [fromParam, fromQuery]
  );

  return {
    portfolioId,
    source: fromParam ? "params" : fromQuery ? "query" : "none",
  } as const;
}
