import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

export type AppObject = {
  id: string;
  code: string | null;
  label: string;
};

export type FinanceEntry = {
  id?: string | number | null;
  object_id: string | null;
  objekt_code?: string | null;
  entry_type: "income" | "expense" | string | null;
  booking_date: string | null;
  amount: number;
  category: string | null;
  note: string | null;
};

export type PortfolioLoanRow = {
  property_id: string;
  portfolio_property_id: string | null;
  property_name: string;
  last_balance: number;
  principal_total: number;
  interest_total: number;
  repaid_percent: number;
  repayment_status: string | null;
  repayment_label: string | null;
};

export type LoanDashboardRow = {
  property_id: string;
  property_name: string;
  first_year: number | null;
  last_year: number | null;
  last_balance_year: number | null;
  last_balance: number | null;
  interest_total: number | null;
  principal_total: number | null;
  repaid_percent: number | null;
  repaid_percent_display: string | null;
  repayment_status: string | null;
  repayment_label: string | null;
  refreshed_at: string | null;
};

export type LoanChartPoint = {
  year: number;
  balance: number;
};

export type AppDataContextValue = {
  loading: boolean;
  error: string | null;
  objects: AppObject[];
  entries: FinanceEntry[];
  portfolioRows: PortfolioLoanRow[];
  loanRows: LoanDashboardRow[];
  loanChartByPropertyId: Record<string, LoanChartPoint[]>;
  refresh: () => Promise<void>;
  getPropertyName: (propertyId: string | null | undefined) => string;
  getEntriesForProperty: (propertyId: string | null | undefined) => FinanceEntry[];
  getRentEntriesForProperty: (propertyId: string | null | undefined, start?: string, end?: string) => FinanceEntry[];
  getExpenseEntriesForProperty: (propertyId: string | null | undefined, year?: number) => FinanceEntry[];
  getIncomeEntriesForProperty: (propertyId: string | null | undefined, year?: number) => FinanceEntry[];
  getNetCashflow: (propertyId: string | null | undefined, year?: number) => number;
  getNebenkostenExpenses: (propertyId: string | null | undefined, year?: number) => FinanceEntry[];
};

const AppDataContext = createContext<AppDataContextValue | null>(null);
const APP_DATA_CACHE_KEY = "koenen:app-data-cache:v1";

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMaybeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = toNumber(value);
  return Number.isFinite(num) ? num : null;
}

function isShadowName(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.includes("shadow") || normalized.includes("core-shadow");
}

function dateInRange(value: string | null, start?: string, end?: string) {
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
}

function dateInYear(value: string | null, year?: number) {
  if (!year) return true;
  return Boolean(value?.startsWith(`${year}-`));
}

function isRentEntry(entry: FinanceEntry): boolean {
  if (entry.entry_type !== "income") return false;
  const text = `${entry.category ?? ""} ${entry.note ?? ""}`.toLowerCase();
  return text.includes("miet") || text.includes("kaltmiete") || text.includes("warmmiete") || text.includes("pacht");
}

function isNebenkostenExpense(entry: FinanceEntry): boolean {
  if (entry.entry_type !== "expense") return false;
  const text = `${entry.category ?? ""} ${entry.note ?? ""}`.toLowerCase();
  return (
    text.includes("nebenkosten") ||
    text.includes("betriebskosten") ||
    text.includes("grundsteuer") ||
    text.includes("versicherung") ||
    text.includes("wasser") ||
    text.includes("heizung") ||
    text.includes("strom") ||
    text.includes("müll") ||
    text.includes("muell") ||
    text.includes("hausgeld") ||
    text.includes("wartung") ||
    text.includes("reinigung") ||
    text.includes("winterdienst") ||
    text.includes("garten")
  );
}

function normalizeMatchText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/strasse/g, "str")
    .replace(/straße/g, "str")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeMatchText(a);
  const right = normalizeMatchText(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function sameProperty(entry: FinanceEntry, propertyId: string | null | undefined, propertyNameById: Record<string, string>) {
  if (!propertyId) return false;
  const id = String(propertyId);
  const entryObjectId = String(entry.object_id ?? "");
  if (entryObjectId === id) return true;

  const targetName = propertyNameById[id];
  const entryObjectName = propertyNameById[entryObjectId];
  if (namesMatch(entryObjectName, targetName)) return true;

  const code = String(entry.objekt_code ?? "");
  if (code && namesMatch(targetName, code)) return true;
  if (code && namesMatch(entryObjectName, code)) return true;

  return false;
}

function groupLedgerRows(rows: Array<{ property_id: string | null; year: unknown; balance: unknown }>) {
  const grouped: Record<string, LoanChartPoint[]> = {};
  for (const row of rows) {
    if (!row.property_id) continue;
    const year = parseMaybeNumber(row.year);
    const balance = parseMaybeNumber(row.balance);
    if (year === null || balance === null) continue;
    const key = String(row.property_id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ year, balance });
  }
  for (const key of Object.keys(grouped)) grouped[key].sort((a, b) => a.year - b.year);
  return grouped;
}

function buildFallbackChart(row: LoanDashboardRow): LoanChartPoint[] {
  if (row.first_year === null || row.last_year === null || row.last_balance === null) return [];
  const principal = row.principal_total ?? 0;
  const startBalance = Math.max(row.last_balance, row.last_balance + principal);
  if (row.first_year === row.last_year) return [{ year: row.last_year, balance: row.last_balance }];
  return [
    { year: row.first_year, balance: startBalance },
    { year: row.last_year, balance: row.last_balance },
  ];
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [objects, setObjects] = useState<AppObject[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [portfolioRows, setPortfolioRows] = useState<PortfolioLoanRow[]>([]);
  const [loanRows, setLoanRows] = useState<LoanDashboardRow[]>([]);
  const [loanChartByPropertyId, setLoanChartByPropertyId] = useState<Record<string, LoanChartPoint[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [objectsRes, entriesRes, portfolioRes, loanRes] = await Promise.all([
        supabase.from("v_object_dropdown").select("value,objekt_code,label").order("label", { ascending: true }),
        supabase.from("finance_entry").select("id,object_id,objekt_code,entry_type,booking_date,amount,category,note").order("booking_date", { ascending: false }).limit(5000),
        supabase.from("vw_property_loan_dashboard_portfolio_v2").select("property_id,portfolio_property_id,property_name,last_balance,principal_total,interest_total,repaid_percent,repayment_status,repayment_label").order("property_name", { ascending: true }),
        supabase.from("vw_property_loan_dashboard_dedup").select("property_id,property_name,first_year,last_year,last_balance_year,last_balance,interest_total,principal_total,repaid_percent,repaid_percent_display,repayment_status,repayment_label,refreshed_at").order("property_name", { ascending: true }),
      ]);

      const firstError = objectsRes.error || entriesRes.error || portfolioRes.error || loanRes.error;
      if (firstError) throw firstError;

      const mappedObjects = ((objectsRes.data ?? []) as any[])
        .filter((row) => row.value)
        .map((row) => ({
          id: String(row.value),
          code: row.objekt_code ?? null,
          label: String(row.label ?? row.objekt_code ?? row.value),
        }));

      const mappedEntries = ((entriesRes.data ?? []) as any[]).map((row) => ({
        id: row.id ?? null,
        object_id: row.object_id == null ? null : String(row.object_id),
        objekt_code: row.objekt_code ?? null,
        entry_type: row.entry_type ?? null,
        booking_date: row.booking_date ?? null,
        amount: toNumber(row.amount),
        category: row.category ?? null,
        note: row.note ?? null,
      }));

      const mappedPortfolio = ((portfolioRes.data ?? []) as any[])
        .map((row) => ({
          property_id: String(row.property_id ?? ""),
          portfolio_property_id: row.portfolio_property_id == null ? null : String(row.portfolio_property_id),
          property_name: String(row.property_name ?? "Unbenanntes Objekt").trim() || "Unbenanntes Objekt",
          last_balance: toNumber(row.last_balance),
          principal_total: toNumber(row.principal_total),
          interest_total: toNumber(row.interest_total),
          repaid_percent: toNumber(row.repaid_percent),
          repayment_status: row.repayment_status ?? null,
          repayment_label: row.repayment_label ?? null,
        }))
        .filter((row) => row.property_id && !isShadowName(row.property_name));

      const mappedLoans = ((loanRes.data ?? []) as any[])
        .map((row) => ({
          property_id: String(row.property_id ?? ""),
          property_name: String(row.property_name ?? "Unbenannte Immobilie"),
          first_year: parseMaybeNumber(row.first_year),
          last_year: parseMaybeNumber(row.last_year),
          last_balance_year: parseMaybeNumber(row.last_balance_year),
          last_balance: parseMaybeNumber(row.last_balance),
          interest_total: parseMaybeNumber(row.interest_total),
          principal_total: parseMaybeNumber(row.principal_total),
          repaid_percent: parseMaybeNumber(row.repaid_percent),
          repaid_percent_display: row.repaid_percent_display ?? null,
          repayment_status: row.repayment_status ?? null,
          repayment_label: row.repayment_label ?? null,
          refreshed_at: row.refreshed_at ?? null,
        }))
        .filter((row) => row.property_id && !isShadowName(row.property_name));

      let charts: Record<string, LoanChartPoint[]> = {};
      const ids = mappedLoans.map((row) => row.property_id);
      if (ids.length) {
        const ledgerRes = await supabase
          .from("vw_property_loan_ledger_by_loan")
          .select("property_id,year,balance")
          .in("property_id", ids)
          .order("property_id", { ascending: true })
          .order("year", { ascending: true });
        if (!ledgerRes.error) charts = groupLedgerRows((ledgerRes.data ?? []) as any[]);
      }
      for (const row of mappedLoans) {
        if (!charts[row.property_id] || charts[row.property_id].length === 0) {
          const fallback = buildFallbackChart(row);
          if (fallback.length) charts[row.property_id] = fallback;
        }
      }

      setObjects(mappedObjects);
      setEntries(mappedEntries);
      setPortfolioRows(mappedPortfolio);
      setLoanRows(mappedLoans);
      setLoanChartByPropertyId(charts);
      window.localStorage.setItem(APP_DATA_CACHE_KEY, JSON.stringify({
        objects: mappedObjects,
        entries: mappedEntries,
        portfolioRows: mappedPortfolio,
        loanRows: mappedLoans,
        loanChartByPropertyId: charts,
        savedAt: new Date().toISOString(),
      }));
    } catch (err: any) {
      try {
        const raw = window.localStorage.getItem(APP_DATA_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          setObjects(cached.objects ?? []);
          setEntries(cached.entries ?? []);
          setPortfolioRows(cached.portfolioRows ?? []);
          setLoanRows(cached.loanRows ?? []);
          setLoanChartByPropertyId(cached.loanChartByPropertyId ?? {});
          setError(null);
        } else {
          setError(err?.message ?? "Daten konnten nicht geladen werden.");
        }
      } catch {
        setError(err?.message ?? "Daten konnten nicht geladen werden.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener("koenen:finance-entry-changed", handler);
    window.addEventListener("focus", handler);
    return () => {
      window.removeEventListener("koenen:finance-entry-changed", handler);
      window.removeEventListener("focus", handler);
    };
  }, [load]);

  const propertyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const object of objects) map[object.id] = object.label;
    for (const row of portfolioRows) map[row.property_id] = row.property_name;
    for (const row of loanRows) map[row.property_id] = row.property_name;
    return map;
  }, [objects, portfolioRows, loanRows]);

  const value = useMemo<AppDataContextValue>(() => {
    const getPropertyName = (propertyId: string | null | undefined) => (propertyId ? propertyNameById[String(propertyId)] ?? "Unbekanntes Objekt" : "Unbekanntes Objekt");
    const getEntriesForProperty = (propertyId: string | null | undefined) => entries.filter((entry) => sameProperty(entry, propertyId, propertyNameById));
    const getRentEntriesForProperty = (propertyId: string | null | undefined, start?: string, end?: string) => getEntriesForProperty(propertyId).filter((entry) => isRentEntry(entry) && (!start || !end || dateInRange(entry.booking_date, start, end)));
    const getExpenseEntriesForProperty = (propertyId: string | null | undefined, year?: number) => getEntriesForProperty(propertyId).filter((entry) => entry.entry_type === "expense" && dateInYear(entry.booking_date, year));
    const getIncomeEntriesForProperty = (propertyId: string | null | undefined, year?: number) => getEntriesForProperty(propertyId).filter((entry) => entry.entry_type === "income" && dateInYear(entry.booking_date, year));
    const getNetCashflow = (propertyId: string | null | undefined, year?: number) => {
      const income = getIncomeEntriesForProperty(propertyId, year).reduce((sum, entry) => sum + entry.amount, 0);
      const expense = getExpenseEntriesForProperty(propertyId, year).reduce((sum, entry) => sum + entry.amount, 0);
      return income - expense;
    };
    const getNebenkostenExpenses = (propertyId: string | null | undefined, year?: number) => getExpenseEntriesForProperty(propertyId, year).filter(isNebenkostenExpense);

    return {
      loading,
      error,
      objects,
      entries,
      portfolioRows,
      loanRows,
      loanChartByPropertyId,
      refresh: load,
      getPropertyName,
      getEntriesForProperty,
      getRentEntriesForProperty,
      getExpenseEntriesForProperty,
      getIncomeEntriesForProperty,
      getNetCashflow,
      getNebenkostenExpenses,
    };
  }, [loading, error, objects, entries, portfolioRows, loanRows, loanChartByPropertyId, load, propertyNameById]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData muss innerhalb von AppDataProvider genutzt werden.");
  return ctx;
}

export function emitFinanceEntryChanged() {
  window.dispatchEvent(new Event("koenen:finance-entry-changed"));
}
