import { supabase } from "@/lib/supabase";

export type ResolvedPropertyContext = {
  routePropertyId: string;

  displayName: string;
  address?: string;

  incomePropertyId: string | null;
  capexPropertyId: string | null;
  ledgerPropertyId: string | null;

  objectCode: string | null;
  dropdownValue: string | null;

  portfolioPropertyId: string | null;
  corePropertyId: string | null;
};

type PropertyMapRow = {
  portfolio_property_id?: string | null;
  core_property_id?: string | null;
  name?: string | null;
  type?: string | null;
};

type DropdownRow = {
  value?: string | null;
  label?: string | null;
  objekt_code?: string | null;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)),
  );
}

function parseAddressFromLabel(label?: string | null): string | undefined {
  if (!label) return undefined;

  const parts = label
    .split("–")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts.slice(1).join(" – ");
  }

  return label;
}

async function hasRowsForProperty(table: string, propertyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("property_id", propertyId)
    .limit(1);

  if (error) {
    console.warn("[resolvePropertyContext] hasRowsForProperty failed", {
      table,
      propertyId,
      error,
    });
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function pickIncomePropertyId(candidates: string[], fallback: string): Promise<string> {
  for (const candidate of candidates) {
    const [hasPropertyIncome, hasYearlyIncome, hasCapex] = await Promise.all([
      hasRowsForProperty("property_income", candidate),
      hasRowsForProperty("yearly_property_income", candidate),
      hasRowsForProperty("yearly_capex_entries", candidate),
    ]);

    if (hasPropertyIncome || hasYearlyIncome || hasCapex) {
      return candidate;
    }
  }

  return fallback;
}

async function pickLedgerPropertyId(candidates: string[], fallback: string): Promise<string> {
  for (const candidate of candidates) {
    const hasLedger = await hasRowsForProperty("property_loan_ledger", candidate);
    if (hasLedger) {
      return candidate;
    }
  }

  return fallback;
}

export async function resolvePropertyContext(
  routePropertyId: string,
): Promise<ResolvedPropertyContext> {
  const { data: mapRowsRaw, error: mapError } = await supabase
    .from("v_property_id_map")
    .select("portfolio_property_id, core_property_id, name, type")
    .or(
      `portfolio_property_id.eq.${routePropertyId},core_property_id.eq.${routePropertyId}`,
    );

  if (mapError) {
    console.warn("[resolvePropertyContext] map query failed", {
      routePropertyId,
      mapError,
    });
  }

  const mapRows = (mapRowsRaw ?? []) as PropertyMapRow[];

  const exactPortfolioMatch =
    mapRows.find((row) => row.portfolio_property_id === routePropertyId) ?? null;

  const exactCoreMatch =
    mapRows.find((row) => row.core_property_id === routePropertyId) ?? null;

  const mapping = exactPortfolioMatch ?? exactCoreMatch ?? mapRows[0] ?? null;

  const portfolioPropertyId = mapping?.portfolio_property_id ?? null;
  const corePropertyId = mapping?.core_property_id ?? null;

  const { data: dropdownRowsRaw, error: dropdownError } = await supabase
    .from("v_object_dropdown")
    .select("value, label, objekt_code");

  if (dropdownError) {
    console.warn("[resolvePropertyContext] dropdown query failed", {
      routePropertyId,
      dropdownError,
    });
  }

  const dropdownRows = (dropdownRowsRaw ?? []) as DropdownRow[];

  const dropdownCandidateIds = uniqueStrings([
    routePropertyId,
    portfolioPropertyId,
    corePropertyId,
  ]);

  const dropdownMatch =
    dropdownRows.find(
      (row) => typeof row.value === "string" && dropdownCandidateIds.includes(row.value),
    ) ?? null;

  const incomeCandidates = uniqueStrings([
    routePropertyId,
    portfolioPropertyId,
    corePropertyId,
    dropdownMatch?.value,
  ]);

  const ledgerCandidates = uniqueStrings([
    portfolioPropertyId,
    routePropertyId,
    corePropertyId,
    dropdownMatch?.value,
  ]);

  const incomePropertyId = await pickIncomePropertyId(
    incomeCandidates,
    routePropertyId,
  );

  const ledgerPropertyId = await pickLedgerPropertyId(
    ledgerCandidates,
    portfolioPropertyId ?? routePropertyId,
  );

  const displayName =
    dropdownMatch?.label ??
    mapping?.name ??
    `Objekt ${routePropertyId}`;

  const address =
    parseAddressFromLabel(dropdownMatch?.label) ??
    mapping?.name ??
    undefined;

  const objectCode = dropdownMatch?.objekt_code ?? null;
  const dropdownValue = dropdownMatch?.value ?? null;

  console.log("[resolvePropertyContext] resolved", {
    routePropertyId,
    portfolioPropertyId,
    corePropertyId,
    dropdownValue,
    objectCode,
    incomePropertyId,
    ledgerPropertyId,
    displayName,
    address,
  });

  return {
    routePropertyId,
    displayName,
    address,
    incomePropertyId,
    capexPropertyId: incomePropertyId,
    ledgerPropertyId,
    objectCode,
    dropdownValue,
    portfolioPropertyId,
    corePropertyId,
  };
}