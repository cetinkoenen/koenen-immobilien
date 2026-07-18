import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Download, FileText, Printer, RefreshCw, Search } from "lucide-react";

import { supabase } from "../lib/supabase";
import { canonicalizeFinanceCategory } from "../lib/financeCategories";
import { isHohenloherMietbestandteilNk, MIETBESTANDTEIL_NK_CATEGORY } from "../lib/financeEntryLabels";
import { isVacancyInRange, listVacancies, type UnitVacancy } from "../services/vacancyService";
import { parseLocaleNumber } from "../utils/numberParser";

type EntryType = "income" | "expense";
type RelevanceFilter = "all" | "tax" | "check" | "private";

type ObjectOption = {
  objekt_code: string;
  label: string;
};

type EntryRow = {
  id: number;
  objekt_code: string | null;
  booking_date: string;
  amount: number;
  category: string | null;
  note: string | null;
  entry_type: EntryType;
  tax_relevant: boolean | null;
};

type LoanTaxRow = {
  property_id: string;
  property_label: string;
  year: number;
  interest: number;
  principal: number;
  balance: number;
  source: string | null;
  has_year_value: boolean;
};

type TaxVacancyRow = UnitVacancy & {
  tax_period: string;
  tax_hint: string;
};

type ClassifiedEntry = EntryRow & {
  object_label: string;
  tax_group: string;
  tax_hint: string;
  relevance: "tax" | "check" | "private";
};

function getLoadErrorMessage(error: unknown, fallback = "Daten konnten nicht geladen werden."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [candidate.message, candidate.details, candidate.hint, candidate.code]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

type SummaryRow = {
  group: string;
  income: number;
  expense: number;
  count: number;
};

type TaxTotals = {
  income: number;
  expense: number;
  net: number;
  taxIncome: number;
  taxExpense: number;
  taxNetIncludingLoans: number;
  loanInterest: number;
  loanPrincipal: number;
  taxRows: number;
  checkRows: number;
  count: number;
};

const currentYear = new Date().getFullYear();

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1500,
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  hero: {
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    background: "#ffffff",
    padding: 24,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  },
  heroTop: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #dbeafe",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "14px 0 0",
    fontSize: 31,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "#0f172a",
  },
  text: {
    margin: "10px 0 0",
    maxWidth: 850,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.65,
  },
  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    background: "#ffffff",
    padding: 18,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    alignItems: "end",
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "#475569",
  },
  input: {
    height: 42,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
  },
  button: {
    height: 42,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 13px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButton: {
    height: 42,
    border: "1px solid #0f172a",
    borderRadius: 12,
    background: "#0f172a",
    color: "#ffffff",
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  advisorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  advisorTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  advisorMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  metaBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#f8fafc",
    padding: 12,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 950,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  metaValue: {
    marginTop: 5,
    fontSize: 17,
    fontWeight: 950,
    color: "#0f172a",
  },
  checklist: {
    display: "grid",
    gap: 8,
    marginTop: 12,
  },
  checkItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#ffffff",
    fontSize: 13,
    fontWeight: 850,
    color: "#334155",
  },
  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
  },
  table: {
    width: "100%",
    minWidth: 980,
    borderCollapse: "collapse",
  },
  th: {
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    padding: "11px 10px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 950,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: {
    borderBottom: "1px solid #eef2f7",
    padding: "10px",
    fontSize: 13,
    color: "#0f172a",
    verticalAlign: "top",
  },
};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function yearRange(year: number) {
  return {
    from: isoDate(new Date(year, 0, 1)),
    to: isoDate(new Date(year + 1, 0, 1)),
  };
}

function yearEnd(year: number): string {
  return isoDate(new Date(year, 11, 31));
}

function eur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateDE(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function nullableDateDE(value: string | null): string {
  return value ? dateDE(value) : "offen";
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function classifyEntryByRules(entry: EntryRow, objectLabel: string): ClassifiedEntry {
  const canonicalCategory = isHohenloherMietbestandteilNk(entry, objectLabel)
    ? MIETBESTANDTEIL_NK_CATEGORY
    : canonicalizeFinanceCategory(entry.category, entry.entry_type);
  const text = normalize(`${canonicalCategory} ${entry.category ?? ""} ${entry.note ?? ""}`);
  const confirmedTax = entry.tax_relevant === true;
  const relevance: ClassifiedEntry["relevance"] = confirmedTax ? "tax" : "check";
  const confirmationHint = confirmedTax
    ? "Automatisch aus Buchung mit St-Kennzeichen in Anlage V einsortiert."
    : "Noch nicht als St steuerrelevant bestätigt.";

  const build = (taxGroup: string, taxHint: string): ClassifiedEntry => ({
    ...entry,
    category: canonicalCategory || entry.category,
    object_label: objectLabel,
    tax_group: taxGroup,
    tax_hint: confirmedTax ? `${taxHint} · ${confirmationHint}` : confirmationHint,
    relevance,
  });

  if (entry.entry_type === "income") {
    if (canonicalCategory === "Miete Garage" || text.includes("garage") || text.includes("stellplatz")) {
      return build("Miete Garage (Einnahme)", "Anlage V: Einnahmen aus Garagen-/Stellplatzvermietung");
    }

    return build("Miete (Einnahme)", "Anlage V: Einnahmen aus Vermietung");
  }

  const expenseGroups: Record<string, string> = {
    Kreditrate: "Kreditrate (Werbungskosten)",
    Reparatur: "Reparatur (Werbungskosten)",
    "Abfallgebühr": "Abfallgebühr (Werbungskosten)",
    Schonsteinfeger: "Schonsteinfeger (Werbungskosten)",
    Versicherung: "Versicherung (Werbungskosten)",
    Wartung: "Wartung (Werbungskosten)",
    Kontoführungsgebühr: "Kontoführungskosten (Werbungskosten)",
    Verwaltungskosten: "Verwaltungskosten (Werbungskosten)",
    Allgemein: "Allgemein / Sonstige Kosten (Werbungskosten)",
    Fahrtkosten: "Fahrtkosten (Werbungskosten)",
    Software: "Software (Werbungskosten)",
  };

  const group = expenseGroups[canonicalCategory] ?? "Allgemein / Sonstige Kosten (Werbungskosten)";
  return build(group, "Anlage V: Werbungskosten aus steuerrelevant markierter Buchung");
}

function classifyEntry(entry: EntryRow, objectLabel: string): ClassifiedEntry {
  if (entry.tax_relevant === false) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Nicht steuerrelevant",
      tax_hint: "Manuell als nicht steuerrelevant markiert",
      relevance: "private",
    };
  }

  const classified = classifyEntryByRules(entry, objectLabel);
  if (entry.tax_relevant === true) {
    return classified;
  }

  return classified;
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes(";") || text.includes("\"") || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: ClassifiedEntry[]) {
  const headers = [
    "Datum",
    "Objekt",
    "Typ",
    "Steuerrelevant",
    "Steuergruppe",
    "Kategorie",
    "Notiz",
    "Betrag",
    "Hinweis",
  ];

  const lines = rows.map((row) => [
    row.booking_date,
    row.object_label,
    row.entry_type === "income" ? "Einnahme" : "Ausgabe",
    row.tax_relevant ? "Ja" : "Nein",
    row.tax_group,
    row.category ?? "",
    row.note ?? "",
    row.amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    row.tax_hint,
  ]);

  const csv = [headers, ...lines].map((line) => line.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadAdvisorCsv(
  filename: string,
  payload: {
    year: number;
    objectLabel: string;
    totals: TaxTotals;
    summary: SummaryRow[];
    loanRows: LoanTaxRow[];
    vacancyRows: TaxVacancyRow[];
    rows: ClassifiedEntry[];
  },
) {
  const amount = (value: number) => value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const exportedAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const lines: unknown[][] = [
    ["Steuerberater-Jahresauszug"],
    ["Jahr", payload.year],
    ["Objekt", payload.objectLabel],
    ["Erstellt am", exportedAt],
    [],
    ["Kennzahlen"],
    ["Steuer-Einnahmen", amount(payload.totals.taxIncome)],
    ["Steuer-Ausgaben aus Buchungen", amount(payload.totals.taxExpense)],
    ["Darlehenszinsen aus Seite Darlehen", amount(payload.totals.loanInterest)],
    ["Steuerlicher Ueberschuss inkl. Darlehen", amount(payload.totals.taxNetIncludingLoans)],
    ["Tilgung dokumentiert, nicht steuerrelevant", amount(payload.totals.loanPrincipal)],
    ["Buchhaltungs-Netto", amount(payload.totals.net)],
    ["Steuerrelevante Buchungen", payload.totals.taxRows],
    ["Offene Prueffaelle", payload.totals.checkRows],
    ["Exportierte Buchungen", payload.totals.count],
    [],
    ["Summen nach Steuergruppe"],
    ["Steuergruppe", "Einnahmen", "Ausgaben", "Saldo", "Buchungen"],
    ...payload.summary.map((row) => [row.group, amount(row.income), amount(row.expense), amount(row.income - row.expense), row.count]),
    [],
    ["Darlehenswerte"],
    ["Objekt", "Jahr", "Zinsen steuerrelevant", "Tilgung nicht steuerrelevant", "Restschuld", "Quelle"],
    ...payload.loanRows.map((row) => [row.property_label, row.year, amount(row.interest), amount(row.principal), amount(row.balance), row.source || "Darlehens-Ledger"]),
    [],
    ["Leerstands-Nachweise"],
    ["Objekt", "Einheit", "Zeitraum", "Grund", "Notiz", "Steuerhinweis"],
    ...payload.vacancyRows.map((row) => [
      row.object_label || row.object_code || row.property_id,
      row.unit_label || "Gesamte Immobilie",
      row.tax_period,
      row.reason || "",
      row.notes || "",
      row.tax_hint,
    ]),
    [],
    ["Buchungen"],
    ["Datum", "Objekt", "Typ", "Steuerstatus", "Steuergruppe", "Kategorie", "Notiz", "Betrag", "Hinweis"],
    ...payload.rows.map((row) => [
      row.booking_date,
      row.object_label,
      row.entry_type === "income" ? "Einnahme" : "Ausgabe",
      row.relevance === "tax" ? "Steuerrelevant" : row.relevance === "check" ? "Pruefen" : "Nicht abziehbar",
      row.tax_group,
      row.category ?? "",
      row.note ?? "",
      amount(row.amount),
      row.tax_hint,
    ]),
  ];

  const csv = lines.map((line) => line.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SteuerCenter() {
  const [year, setYear] = useState(currentYear);
  const [objectCode, setObjectCode] = useState("ALL");
  const [relevance, setRelevance] = useState<RelevanceFilter>("tax");
  const [search, setSearch] = useState("");
  const [objects, setObjects] = useState<ObjectOption[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loanTaxRows, setLoanTaxRows] = useState<LoanTaxRow[]>([]);
  const [vacancies, setVacancies] = useState<UnitVacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectLabelByCode = useMemo(() => {
    return new Map(objects.map((object) => [object.objekt_code, object.label]));
  }, [objects]);

  async function loadObjects(): Promise<ObjectOption[]> {
    const { data, error: loadError } = await supabase
      .from("v_object_dropdown")
      .select("objekt_code,label")
      .order("label", { ascending: true });

    if (loadError) throw loadError;

    const rows = (data ?? [])
      .map((row: unknown) => {
        const item = row as Partial<ObjectOption>;
        return {
          objekt_code: String(item.objekt_code ?? ""),
          label: String(item.label ?? ""),
        };
      })
      .filter((row) => row.objekt_code && row.label);

    setObjects(rows);
    return rows;
  }

  async function loadEntries() {
    setLoading(true);
    setError(null);

    const range = yearRange(year);

    try {
      let objectOptions = objects;
      if (objectOptions.length === 0) {
        objectOptions = await loadObjects();
      }

      let query = supabase
        .from("finance_entry")
        .select("id,objekt_code,booking_date,amount,category,note,entry_type,tax_relevant,is_deleted")
        .eq("is_deleted", false)
        .gte("booking_date", range.from)
        .lt("booking_date", range.to)
        .in("entry_type", ["income", "expense"])
        .order("booking_date", { ascending: false });

      if (objectCode !== "ALL") {
        query = query.eq("objekt_code", objectCode);
      }

      const result = await query;
      if (result.error) throw result.error;

      const rows: EntryRow[] = (result.data ?? []).map((row: unknown) => {
        const item = row as Partial<EntryRow>;
        return {
          id: Number(item.id ?? 0),
          objekt_code: item.objekt_code ?? null,
          booking_date: String(item.booking_date ?? ""),
          amount: parseLocaleNumber(item.amount, 0),
          category: item.category ?? null,
          note: item.note ?? null,
          entry_type: item.entry_type === "expense" ? "expense" : "income",
          tax_relevant: typeof item.tax_relevant === "boolean" ? item.tax_relevant : null,
        };
      });

      setEntries(rows.sort((a, b) => b.booking_date.localeCompare(a.booking_date)));

      const { data: loanDashboard, error: loanDashboardError } = await supabase
        .from("vw_property_loan_dashboard_display")
        .select("property_id, property_name");

      if (loanDashboardError) throw loanDashboardError;

      const loanNameById = new Map(
        ((loanDashboard ?? []) as Array<{ property_id: string | null; property_name: string | null }>)
          .filter((row) => row.property_id)
          .map((row) => [String(row.property_id), String(row.property_name ?? row.property_id)]),
      );

      const loanQuery = supabase
        .from("property_loan_ledger")
        .select("property_id,year,interest,principal,balance,source")
        .eq("year", year)
        .order("property_id", { ascending: true });

      const selectedLabel = objectCode === "ALL" ? "" : objectLabelByCode.get(objectCode) ?? objectCode;
      const loanResult = await loanQuery;
      if (loanResult.error) throw loanResult.error;

      const loanRows = ((loanResult.data ?? []) as Array<{
        property_id: string | null;
        year: number | string | null;
        interest: number | string | null;
        principal: number | string | null;
        balance: number | string | null;
        source: string | null;
      }>)
        .map((row) => {
          const propertyId = String(row.property_id ?? "");
          const propertyLabel = loanNameById.get(propertyId) ?? propertyId;
          return {
            property_id: propertyId,
            property_label: propertyLabel,
            year: Number(row.year ?? year),
            interest: parseLocaleNumber(row.interest, 0),
            principal: parseLocaleNumber(row.principal, 0),
            balance: parseLocaleNumber(row.balance, 0),
            source: row.source ?? null,
            has_year_value: true,
          };
        })
        .filter((row) => row.property_id && row.year === year)
        .sort((a, b) => a.property_label.localeCompare(b.property_label, "de"));

      const matchLoanToObject = (object: ObjectOption) => {
        const objectLabel = normalize(object.label);
        const objectCodeNormalized = normalize(object.objekt_code);
        return loanRows.find((row) => {
          const loanLabel = normalize(row.property_label);
          const loanId = normalize(row.property_id);
          return (
            loanId === objectCodeNormalized ||
            loanLabel === objectLabel ||
            loanLabel.includes(objectLabel) ||
            objectLabel.includes(loanLabel)
          );
        });
      };

      const loanRowsByObject = objectOptions.map<LoanTaxRow>((object) => {
        const matchedLoan = matchLoanToObject(object);
        if (matchedLoan) return matchedLoan;
        return {
          property_id: object.objekt_code,
          property_label: object.label,
          year,
          interest: 0,
          principal: 0,
          balance: 0,
          source: "Kein Darlehens-Jahreswert erfasst",
          has_year_value: false,
        };
      });

      const unmatchedLoanRows = loanRows.filter((loan) => {
        return !objectOptions.some((object) => matchLoanToObject(object)?.property_id === loan.property_id);
      });

      const completeLoanRows = [...loanRowsByObject, ...unmatchedLoanRows]
        .filter((row) => {
          if (objectCode === "ALL") return true;
          return normalize(row.property_label).includes(normalize(selectedLabel)) || normalize(selectedLabel).includes(normalize(row.property_label)) || normalize(row.property_id) === normalize(objectCode);
        })
        .sort((a, b) => a.property_label.localeCompare(b.property_label, "de"));

      setLoanTaxRows(completeLoanRows);
      const vacancyRows = await listVacancies({ from: range.from, to: yearEnd(year) });
      setVacancies(vacancyRows);
    } catch (loadError) {
      const message = getLoadErrorMessage(loadError);
      setError(message);
      setEntries([]);
      setLoanTaxRows([]);
      setVacancies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function initialLoad() {
      try {
        const { data, error: loadError } = await supabase
          .from("v_object_dropdown")
          .select("objekt_code,label")
          .order("label", { ascending: true });

        if (!alive) return;
        if (loadError) throw loadError;

        const rows = (data ?? [])
          .map((row: unknown) => {
            const item = row as Partial<ObjectOption>;
            return {
              objekt_code: String(item.objekt_code ?? ""),
              label: String(item.label ?? ""),
            };
          })
          .filter((row) => row.objekt_code && row.label);

        setObjects(rows);
      } catch (loadError) {
        if (!alive) return;
        const message = getLoadErrorMessage(loadError);
        setError(message);
      }
    }

    void initialLoad();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Initialer und filterbasierter Supabase-Ladevorgang fuer die Steueruebersicht.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, objectCode]);

  const classifiedRows = useMemo<ClassifiedEntry[]>(() => {
    return entries.map((entry) => {
      const objectLabel = entry.objekt_code
        ? objectLabelByCode.get(entry.objekt_code) ?? entry.objekt_code
        : "Ohne Objekt";
      return classifyEntry(entry, objectLabel);
    });
  }, [entries, objectLabelByCode]);

  const filteredRows = useMemo(() => {
    const query = normalize(search);
    return classifiedRows.filter((row) => {
      if (relevance !== "all" && row.relevance !== relevance) return false;
      if (!query) return true;
      return normalize(`${row.object_label} ${row.tax_group} ${row.category ?? ""} ${row.note ?? ""}`).includes(query);
    });
  }, [classifiedRows, relevance, search]);

  const summary = useMemo(() => {
    const map = new Map<string, SummaryRow>();

    for (const row of filteredRows.filter((entry) => entry.relevance === "tax")) {
      const current = map.get(row.tax_group) ?? {
        group: row.tax_group,
        income: 0,
        expense: 0,
        count: 0,
      };

      current.count += 1;
      if (row.entry_type === "income") current.income += row.amount;
      else current.expense += row.amount;
      map.set(row.tax_group, current);
    }

    return Array.from(map.values()).sort((a, b) => Math.abs(b.income - b.expense) - Math.abs(a.income - a.expense));
  }, [filteredRows]);

  const totals = useMemo<TaxTotals>(() => {
    const income = filteredRows.filter((row) => row.entry_type === "income").reduce((sum, row) => sum + row.amount, 0);
    const expense = filteredRows.filter((row) => row.entry_type === "expense").reduce((sum, row) => sum + row.amount, 0);
    const taxIncome = filteredRows.filter((row) => row.relevance === "tax" && row.entry_type === "income").reduce((sum, row) => sum + row.amount, 0);
    const taxExpense = filteredRows.filter((row) => row.relevance === "tax" && row.entry_type === "expense").reduce((sum, row) => sum + row.amount, 0);
    const loanInterest = loanTaxRows.reduce((sum, row) => sum + row.interest, 0);
    const loanPrincipal = loanTaxRows.reduce((sum, row) => sum + row.principal, 0);
    const taxRows = filteredRows.filter((row) => row.relevance === "tax").length;
    const checkRows = filteredRows.filter((row) => row.relevance === "check").length;
    return {
      income,
      expense,
      net: income - expense,
      taxIncome,
      taxExpense,
      taxNetIncludingLoans: taxIncome - taxExpense - loanInterest,
      loanInterest,
      loanPrincipal,
      taxRows,
      checkRows,
      count: filteredRows.length,
    };
  }, [filteredRows, loanTaxRows]);

  const taxVacancyRows = useMemo<TaxVacancyRow[]>(() => {
    const from = `${year}-01-01`;
    const to = yearEnd(year);
    const selectedLabel = objectCode === "ALL" ? "" : objectLabelByCode.get(objectCode) ?? objectCode;

    return vacancies
      .filter((row) => isVacancyInRange(row, from, to))
      .filter((row) => {
        if (objectCode === "ALL") return true;
        const selectedCode = normalize(objectCode);
        const selectedName = normalize(selectedLabel);
        const rowCode = normalize(row.object_code);
        const rowName = normalize(row.object_label);
        const rowPropertyId = normalize(row.property_id);
        return (
          rowCode === selectedCode ||
          rowPropertyId === selectedCode ||
          (rowName && selectedName && (rowName.includes(selectedName) || selectedName.includes(rowName)))
        );
      })
      .map((row) => {
        const periodStart = row.start_date < from ? from : row.start_date;
        const periodEnd = !row.end_date || row.end_date > to ? to : row.end_date;
        return {
          ...row,
          tax_period: `${dateDE(periodStart)} bis ${nullableDateDE(periodEnd)}`,
          tax_hint: "Leerstand steuerlich als Nachweis dokumentiert; Einnahmeausfall wird nicht als Buchung erzeugt.",
        };
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [objectCode, objectLabelByCode, vacancies, year]);

  const filenameObject = objectCode === "ALL" ? "alle_objekte" : objectCode.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const selectedObjectLabel = objectCode === "ALL" ? "Alle Objekte" : objectLabelByCode.get(objectCode) ?? objectCode;
  const advisorStatus = totals.count === 0
    ? "Keine Buchungen"
    : totals.checkRows === 0
      ? "Exportbereit"
      : `${totals.checkRows} Buchungen pruefen`;
  const advisorStatusTone: "green" | "amber" | "slate" = totals.count === 0 ? "slate" : totals.checkRows === 0 ? "green" : "amber";
  const loanRowsWithYearValue = loanTaxRows.filter((row) => row.has_year_value);
  const loanRowsMissingYearValue = loanTaxRows.filter((row) => !row.has_year_value);
  const advisorChecks = [
    {
      label: "Buchungen aus Hauptquelle finance_entry",
      value: `${totals.count} Zeilen`,
      relevance: totals.count > 0 ? "tax" : "private",
    },
    {
      label: "Offene steuerliche Prueffaelle",
      value: totals.checkRows === 0 ? "0 offen" : `${totals.checkRows} offen`,
      relevance: totals.checkRows === 0 ? "tax" : "check",
    },
    {
      label: "Darlehenszinsen aus Seite Darlehen",
      value: loanRowsMissingYearValue.length
        ? `${loanRowsWithYearValue.length} erfasst · ${loanRowsMissingYearValue.length} prüfen`
        : `${loanRowsWithYearValue.length} erfasst`,
      relevance: loanRowsMissingYearValue.length ? "check" : "tax",
    },
    {
      label: "Leerstands-Nachweise aus Seite Leerstand",
      value: taxVacancyRows.length ? `${taxVacancyRows.length} Zeitraum(e)` : "Keine Leerstände",
      relevance: taxVacancyRows.length ? "tax" : "private",
    },
    {
      label: "Objekt- und Jahresfilter",
      value: `${selectedObjectLabel} · ${year}`,
      relevance: "tax",
    },
  ] satisfies Array<{ label: string; value: string; relevance: ClassifiedEntry["relevance"] }>;

  return (
    <div className="tax-print-root" style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <div>
            <div style={styles.eyebrow}>
              <FileText size={16} />
              Steuer-Vorbereitung
            </div>
            <h1 style={styles.title}>Steuer-Center</h1>
            <p style={styles.text}>
              Jahresakte fuer steuerrelevante Einnahmen, Ausgaben und Darlehenszinsen. Buchungen bleiben
              die Hauptquelle fuer Zahlungsdaten; Darlehenszinsen kommen aus der Seite Darlehen.
            </p>
          </div>

          <div className="tax-no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void loadEntries()} style={styles.button}>
              <RefreshCw size={16} />
              Aktualisieren
            </button>
            <button type="button" onClick={() => window.print()} style={styles.button}>
              <Printer size={16} />
              Drucken
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(`steuer_buchungen_${filenameObject}_${year}.csv`, filteredRows)}
              style={styles.primaryButton}
            >
              <Download size={16} />
              Buchungs-CSV
            </button>
          </div>
        </div>
      </section>

      <section className="tax-no-print" style={styles.panel}>
        <div style={styles.controls}>
          <label style={styles.label}>
            Jahr
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} style={styles.input}>
              {Array.from({ length: 12 }, (_, index) => currentYear - index).map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Objekt
            <select value={objectCode} onChange={(event) => setObjectCode(event.target.value)} style={styles.input}>
              <option value="ALL">Alle Objekte</option>
              {objects.map((object) => (
                <option key={object.objekt_code} value={object.objekt_code}>{object.label}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Steuerstatus
            <select value={relevance} onChange={(event) => setRelevance(event.target.value as RelevanceFilter)} style={styles.input}>
              <option value="all">Alle Buchungen</option>
              <option value="tax">Steuerrelevant</option>
              <option value="check">Pruefen</option>
              <option value="private">Nicht abziehbar</option>
            </select>
          </label>

          <label style={styles.label}>
            Suche
            <span style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#64748b" }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Kategorie, Notiz, Objekt"
                style={{ ...styles.input, paddingLeft: 36 }}
              />
            </span>
          </label>
        </div>
      </section>

      {error ? (
        <section style={{ ...styles.panel, borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 800 }}>
          Fehler beim Laden: {error}
        </section>
      ) : null}

      <section style={styles.panel}>
        <div style={styles.advisorGrid}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={styles.advisorTitle}>Steuerberater-Jahresakte</h2>
              <TonePill label={advisorStatus} tone={advisorStatusTone} />
            </div>
            <p style={styles.text}>
              Dieser Extrakt buendelt Jahreskennzahlen, Steuergruppen, Darlehenszinsen und die gefilterten
              Buchungen fuer die Weitergabe an den Steuerberater.
            </p>

            <div style={styles.advisorMeta}>
              <div style={styles.metaBox}>
                <div style={styles.metaLabel}>Jahr</div>
                <div style={styles.metaValue}>{year}</div>
              </div>
              <div style={styles.metaBox}>
                <div style={styles.metaLabel}>Objekt</div>
                <div style={styles.metaValue}>{selectedObjectLabel}</div>
              </div>
              <div style={styles.metaBox}>
                <div style={styles.metaLabel}>Ueberschuss</div>
                <div style={styles.metaValue}>{loading ? "..." : eur(totals.taxNetIncludingLoans)}</div>
              </div>
            </div>

            <div className="tax-no-print" style={styles.actionRow}>
              <button
                type="button"
                onClick={() => downloadAdvisorCsv(`steuerberater_jahresakte_${filenameObject}_${year}.csv`, {
                  year,
                  objectLabel: selectedObjectLabel,
                  totals,
                  summary,
                  loanRows: loanTaxRows,
                  vacancyRows: taxVacancyRows,
                  rows: filteredRows,
                })}
                style={styles.primaryButton}
              >
                <Download size={16} />
                Steuerberater-CSV
              </button>
              <button type="button" onClick={() => window.print()} style={styles.button}>
                <Printer size={16} />
                Jahresakte drucken
              </button>
            </div>
          </div>

          <div>
            <div style={{ ...styles.metaLabel, marginBottom: 10 }}>Bereitstellungs-Check</div>
            <div style={styles.checklist}>
              {advisorChecks.map((check) => (
                <div key={check.label} style={styles.checkItem}>
                  <span>{check.label}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <StatusPill relevance={check.relevance} />
                    <strong>{check.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={styles.grid3}>
        <MetricCard label="Steuer-Einnahmen" value={loading ? "..." : eur(totals.taxIncome)} tone="green" />
        <MetricCard label="Steuer-Ausgaben Buchungen" value={loading ? "..." : eur(totals.taxExpense)} tone="red" />
        <MetricCard label="Darlehenszinsen" value={loading ? "..." : eur(totals.loanInterest)} tone="red" />
        <MetricCard label="Steuerlicher Ueberschuss inkl. Darlehen" value={loading ? "..." : eur(totals.taxNetIncludingLoans)} tone={totals.taxNetIncludingLoans >= 0 ? "blue" : "red"} />
        <MetricCard label="Tilgung nicht steuerrelevant" value={loading ? "..." : eur(totals.loanPrincipal)} tone="slate" />
        <MetricCard label="Buchhaltungs-Netto" value={loading ? "..." : eur(totals.net)} tone={totals.net >= 0 ? "blue" : "red"} />
        <MetricCard label="Steuerrelevant" value={loading ? "..." : String(totals.taxRows)} tone="green" />
        <MetricCard label="Zu pruefen" value={loading ? "..." : String(totals.checkRows)} tone="amber" />
        <MetricCard label="Buchungen" value={loading ? "..." : String(totals.count)} tone="slate" />
      </section>

      <section style={styles.panel}>
        <SectionHeading
          title="Darlehenswerte aus der Seite Darlehen"
          subtitle="Diese Tabelle ist die steuerliche Hauptquelle fuer Schuldzinsen. Tilgung wird nur dokumentiert und nicht als Steuer-Ausgabe gewertet."
        />
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Objekt</th>
                <th style={styles.th}>Jahr</th>
                <th style={styles.th}>Zinsen steuerrelevant</th>
                <th style={styles.th}>Tilgung nicht steuerrelevant</th>
                <th style={styles.th}>Restschuld</th>
                <th style={styles.th}>Quelle</th>
              </tr>
            </thead>
            <tbody>
              {loanTaxRows.map((row) => (
                <tr key={`${row.property_id}-${row.year}`}>
                  <td style={styles.td}><strong>{row.property_label}</strong></td>
                  <td style={styles.td}>{row.year}</td>
                  <td style={styles.td}>{eur(row.interest)}</td>
                  <td style={styles.td}>{eur(row.principal)}</td>
                  <td style={styles.td}>{eur(row.balance)}</td>
                  <td style={styles.td}>
                    {row.has_year_value ? row.source || "Darlehens-Ledger" : (
                      <span style={{ color: "#b45309", fontWeight: 900 }}>Kein Jahreswert erfasst</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loanTaxRows.length ? (
                <tr><td colSpan={6} style={styles.td}>Keine Darlehenswerte fuer diese Auswahl gefunden. Bitte Seite Darlehen pruefen und Jahreswerte erfassen.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <SectionHeading
          title="Leerstands-Nachweise fuer Steuererklaerung"
          subtitle="Kommt aus der Seite Leerstand. Zeitraum, Grund und Notiz dienen als Nachweis fuer Vermietungsabsicht und Einnahmeausfall."
        />
        <div className="tax-no-print" style={{ ...styles.actionRow, marginTop: 0, marginBottom: 14 }}>
          <a href="/mieter/leerstand" style={{ ...styles.button, textDecoration: "none" }}>
            Leerstand bearbeiten
          </a>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Objekt</th>
                <th style={styles.th}>Einheit</th>
                <th style={styles.th}>Zeitraum</th>
                <th style={styles.th}>Grund</th>
                <th style={styles.th}>Notiz</th>
                <th style={styles.th}>Steuerhinweis</th>
              </tr>
            </thead>
            <tbody>
              {taxVacancyRows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}><strong>{row.object_label || row.object_code || row.property_id}</strong></td>
                  <td style={styles.td}>{row.unit_label || "Gesamte Immobilie"}</td>
                  <td style={styles.td}>{row.tax_period}</td>
                  <td style={styles.td}>{row.reason || "Ohne Grund"}</td>
                  <td style={styles.td}>{row.notes || "Keine Notiz"}</td>
                  <td style={styles.td}>{row.tax_hint}</td>
                </tr>
              ))}
              {!taxVacancyRows.length ? (
                <tr><td colSpan={6} style={styles.td}>Keine Leerstandszeiträume fuer diese Steuer-Auswahl dokumentiert.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <SectionHeading title="Summen nach Steuergruppe" subtitle="Automatische Vor-Klassifizierung aus Kategorie und Notiz. Bitte vor Abgabe fachlich pruefen." />
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Steuergruppe</th>
                <th style={styles.th}>Einnahmen</th>
                <th style={styles.th}>Ausgaben</th>
                <th style={styles.th}>Saldo</th>
                <th style={styles.th}>Buchungen</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.group}>
                  <td style={styles.td}><strong>{row.group}</strong></td>
                  <td style={styles.td}>{eur(row.income)}</td>
                  <td style={styles.td}>{eur(row.expense)}</td>
                  <td style={styles.td}><strong>{eur(row.income - row.expense)}</strong></td>
                  <td style={styles.td}>{row.count}</td>
                </tr>
              ))}
              {!summary.length ? (
                <tr><td colSpan={5} style={styles.td}>Keine Buchungen fuer die aktuelle Auswahl.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <SectionHeading title="Buchungen fuer Steuerpruefung" subtitle="Exportiert werden genau die aktuell gefilterten Zeilen." />
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Datum</th>
                <th style={styles.th}>Objekt</th>
                <th style={styles.th}>Typ</th>
                <th style={styles.th}>Steuer</th>
                <th style={styles.th}>Steuergruppe</th>
                <th style={styles.th}>Kategorie / Notiz</th>
                <th style={styles.th}>Betrag</th>
                <th style={styles.th}>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.entry_type}-${row.id}`}>
                  <td style={styles.td}>{dateDE(row.booking_date)}</td>
                  <td style={styles.td}>{row.object_label}</td>
                  <td style={styles.td}>{row.entry_type === "income" ? "Einnahme" : "Ausgabe"}</td>
                  <td style={styles.td}>{row.tax_relevant ? "Ja" : "Nein"}</td>
                  <td style={styles.td}>
                    <strong>{row.tax_group}</strong>
                    <div style={{ marginTop: 4 }}>
                      <StatusPill relevance={row.relevance} />
                    </div>
                  </td>
                  <td style={styles.td}>
                    <strong>{row.category || "Ohne Kategorie"}</strong>
                    <div style={{ marginTop: 4, color: "#64748b" }}>{row.note || "Keine Notiz"}</div>
                  </td>
                  <td style={styles.td}><strong>{eur(row.amount)}</strong></td>
                  <td style={styles.td}>{row.tax_hint}</td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr><td colSpan={8} style={styles.td}>Keine Buchungen fuer die aktuelle Auswahl.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "blue" | "amber" | "slate" }) {
  const colors = {
    green: ["#ecfdf5", "#047857"],
    red: ["#fff1f2", "#be123c"],
    blue: ["#eff6ff", "#1d4ed8"],
    amber: ["#fffbeb", "#b45309"],
    slate: ["#f8fafc", "#334155"],
  } satisfies Record<typeof tone, [string, string]>;

  const [bg, color] = colors[tone];

  return (
    <div style={{ ...styles.panel, background: bg }}>
      <div style={{ fontSize: 12, fontWeight: 950, color, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 23, fontWeight: 950, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 950, color: "#0f172a" }}>{title}</h2>
      <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "#64748b" }}>{subtitle}</p>
    </div>
  );
}

function TonePill({ label, tone }: { label: string; tone: "green" | "amber" | "slate" }) {
  const config = {
    green: ["#ecfdf5", "#047857", "#bbf7d0"],
    amber: ["#fffbeb", "#b45309", "#fde68a"],
    slate: ["#f8fafc", "#475569", "#e2e8f0"],
  } satisfies Record<typeof tone, [string, string, string]>;

  const [bg, color, border] = config[tone];

  return (
    <span style={{ display: "inline-flex", border: `1px solid ${border}`, borderRadius: 999, background: bg, color, padding: "6px 10px", fontSize: 12, fontWeight: 950 }}>
      {label}
    </span>
  );
}

function StatusPill({ relevance }: { relevance: ClassifiedEntry["relevance"] }) {
  const config = {
    tax: ["Steuerrelevant", "#ecfdf5", "#047857"],
    check: ["Pruefen", "#fffbeb", "#b45309"],
    private: ["Nicht abziehbar", "#f1f5f9", "#475569"],
  } satisfies Record<typeof relevance, [string, string, string]>;

  const [label, bg, color] = config[relevance];

  return (
    <span style={{ display: "inline-flex", borderRadius: 999, background: bg, color, padding: "4px 8px", fontSize: 11, fontWeight: 950 }}>
      {label}
    </span>
  );
}
