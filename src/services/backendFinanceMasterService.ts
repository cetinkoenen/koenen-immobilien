import { supabase } from "@/lib/supabase";
import { cleanMasterDisplayName } from "@/services/masterDataService";

export type BackendFinanceMasterRow = {
  property_id: string;
  portfolio_property_id: string | null;
  objekt_code: string | null;
  property_name: string;
  normalized_name: string;
  year: number;
  income: number;
  expenses: number;
  capex: number;
  operating_expenses: number;
  net_cashflow: number;
  rent_income: number;
  interest_total: number;
  principal_total: number;
  debt_service: number;
  dscr: number | null;
  balance_at_year: number | null;
  latest_balance: number | null;
  latest_balance_year: number | null;
  refreshed_at: string | null;
};

export type BackendFinanceConsistencyRow = {
  severity: "ok" | "warning" | "critical" | string;
  area: string;
  property_id: string | null;
  property_name: string | null;
  detail: string;
  expected_value: number | null;
  actual_value: number | null;
  delta: number | null;
};

export type RefreshMaterializedViewResult = {
  view_name: string;
  status: string;
};

export type BackendDataQualityCheckRow = {
  severity: "ok" | "warning" | "critical" | string;
  area: string;
  property_id: string | null;
  property_name: string | null;
  issue_code: string;
  detail: string;
  repair_hint: string;
  expected_value: number | null;
  actual_value: number | null;
  delta: number | null;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapMasterRow(row: Record<string, unknown>): BackendFinanceMasterRow {
  return {
    property_id: String(row.property_id ?? ""),
    portfolio_property_id: row.portfolio_property_id == null ? null : String(row.portfolio_property_id),
    objekt_code: row.objekt_code == null ? null : String(row.objekt_code),
    property_name: cleanMasterDisplayName(row.property_name ?? "Unbenannte Immobilie"),
    normalized_name: String(row.normalized_name ?? ""),
    year: toNumber(row.year),
    income: toNumber(row.income),
    expenses: toNumber(row.expenses),
    capex: toNumber(row.capex),
    operating_expenses: toNumber(row.operating_expenses),
    net_cashflow: toNumber(row.net_cashflow),
    rent_income: toNumber(row.rent_income),
    interest_total: toNumber(row.interest_total),
    principal_total: toNumber(row.principal_total),
    debt_service: toNumber(row.debt_service),
    dscr: toNullableNumber(row.dscr),
    balance_at_year: toNullableNumber(row.balance_at_year),
    latest_balance: toNullableNumber(row.latest_balance),
    latest_balance_year: toNullableNumber(row.latest_balance_year),
    refreshed_at: row.refreshed_at == null ? null : String(row.refreshed_at),
  };
}

function mapConsistencyRow(row: Record<string, unknown>): BackendFinanceConsistencyRow {
  return {
    severity: String(row.severity ?? "warning"),
    area: String(row.area ?? "Datenprüfung"),
    property_id: row.property_id == null ? null : String(row.property_id),
    property_name: row.property_name == null ? null : cleanMasterDisplayName(row.property_name),
    detail: String(row.detail ?? ""),
    expected_value: toNullableNumber(row.expected_value),
    actual_value: toNullableNumber(row.actual_value),
    delta: toNullableNumber(row.delta),
  };
}

function mapDataQualityRow(row: Record<string, unknown>): BackendDataQualityCheckRow {
  return {
    severity: String(row.severity ?? "warning"),
    area: String(row.area ?? "Datenprüfung"),
    property_id: row.property_id == null ? null : String(row.property_id),
    property_name: row.property_name == null ? null : cleanMasterDisplayName(row.property_name),
    issue_code: String(row.issue_code ?? "quality_check"),
    detail: String(row.detail ?? ""),
    repair_hint: String(row.repair_hint ?? "Datenquelle prüfen und danach neu prüfen."),
    expected_value: toNullableNumber(row.expected_value),
    actual_value: toNullableNumber(row.actual_value),
    delta: toNullableNumber(row.delta),
  };
}

/**
 * Phase 5C: serverseitige Single Source of Truth für Finanzkennzahlen.
 * Fällt bewusst nicht auf Frontend-Schätzungen zurück; die aufrufende UI kann bei Fehlern
 * weiterhin die bestehenden AppDataContext-Daten verwenden.
 */
export async function loadBackendFinanceMaster(year = new Date().getFullYear()): Promise<BackendFinanceMasterRow[]> {
  const { data, error } = await supabase.rpc("get_property_finance_master", { p_year: year });
  if (error) throw new Error(`Backend-Finanzmaster konnte nicht geladen werden: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(mapMasterRow).filter((row) => row.property_id);
}

export async function loadBackendFinanceConsistency(year = new Date().getFullYear()): Promise<BackendFinanceConsistencyRow[]> {
  const { data, error } = await supabase.rpc("get_property_finance_consistency", { p_year: year });
  if (error) throw new Error(`Backend-Datenprüfung konnte nicht geladen werden: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(mapConsistencyRow);
}

export async function loadBackendDataQualityChecks(year = new Date().getFullYear()): Promise<BackendDataQualityCheckRow[]> {
  const { data, error } = await supabase.rpc("get_koenen_data_quality_checks", { p_year: year });
  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("Could not find the function") || message.includes("schema cache")) {
      return [];
    }
    throw new Error(`Backend-Datenqualitätsprüfung konnte nicht geladen werden: ${error.message}`);
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapDataQualityRow);
}

export async function refreshBackendFinanceMaterializedViews(): Promise<RefreshMaterializedViewResult[]> {
  const { data, error } = await supabase.rpc("refresh_koenen_finance_materialized_views");
  if (error) {
    const message = String(error.message ?? "");
    const code = String((error as { code?: unknown }).code ?? "");
    const normalized = message.toLowerCase();

    if (
      code === "42501" ||
      normalized.includes("permission denied") ||
      normalized.includes("not allowed") ||
      normalized.includes("could not find the function") ||
      normalized.includes("schema cache")
    ) {
      return [
        {
          view_name: "refresh_koenen_finance_materialized_views",
          status: "service_role_only",
        },
      ];
    }

    throw new Error(`Materialized Views konnten nicht aktualisiert werden: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    view_name: String(row.view_name ?? ""),
    status: String(row.status ?? "unknown"),
  }));
}
