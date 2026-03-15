import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  deletePropertyLoanLedgerRow,
  insertPropertyLoanLedgerRow,
  loadPropertyLoanLedger,
  mapLedgerError,
  parseLoanLedgerFormValues,
  rowToFormValues,
  updatePropertyLoanLedgerRow,
  validateLedgerRow,
} from "../services/propertyLoanLedgerService";
import type { LoanLedgerFormValues, LoanLedgerRow } from "../types/loanLedger";

const DEBUG = import.meta.env.DEV;

type SummaryRow = {
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

type ChartPoint = {
  year: number;
  balance: number;
};

const EMPTY_FORM_VALUES: LoanLedgerFormValues = {
  year: "",
  interest: "",
  principal: "",
  balance: "",
  source: "",
};

function parseNumber(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return fallback;
}

function formatCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} €`;
  }
}

function formatPercent(value: number | null, displayValue?: string | null): string {
  if (displayValue) return displayValue;
  if (value == null || !Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat("de-DE", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${(value * 100).toFixed(1)} %`;
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

function formatYearRange(startYear: number | null, endYear: number | null): string {
  if (startYear != null && endYear != null) return `${startYear} – ${endYear}`;
  if (startYear != null) return `${startYear} – ?`;
  if (endYear != null) return `? – ${endYear}`;
  return "—";
}

function getStatusTone(status: string | null): {
  background: string;
  color: string;
  border: string;
} {
  const normalized = (status ?? "").toLowerCase();

  if (
    normalized.includes("healthy") ||
    normalized.includes("ok") ||
    normalized.includes("gut") ||
    normalized.includes("läuft") ||
    normalized.includes("in_progress")
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "#bbf7d0",
    };
  }

  if (
    normalized.includes("warning") ||
    normalized.includes("warn") ||
    normalized.includes("kritisch")
  ) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "#fde68a",
    };
  }

  if (
    normalized.includes("red") ||
    normalized.includes("error") ||
    normalized.includes("critical")
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fecaca",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
    border: "#e5e7eb",
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        marginTop: 28,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 20,
        minWidth: 0,
      }}
    >
      <h2
        style={{
          margin: "0 0 16px 0",
          fontSize: 18,
          fontWeight: 800,
          color: "#111827",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        padding: 16,
        borderRadius: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: "#111827",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

      {subvalue ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "#6b7280",
            wordBreak: "break-word",
          }}
        >
          {subvalue}
        </div>
      ) : null}
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  inputMode,
}: {
  label: string;
  name: keyof LoanLedgerFormValues;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label
        htmlFor={name}
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        style={{
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 12,
          border: `1px solid ${error ? "#fca5a5" : "#d1d5db"}`,
          padding: "12px 14px",
          fontSize: 14,
          outline: "none",
          background: "#ffffff",
          color: "#111827",
        }}
      />

      {error ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "#b91c1c",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default function ObjektDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [ledger, setLedger] = useState<LoanLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<LoanLedgerFormValues>(EMPTY_FORM_VALUES);
  const [formFieldErrors, setFormFieldErrors] = useState<
    Partial<Record<keyof LoanLedgerFormValues, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPage = useCallback(async () => {
    if (!propertyId) {
      setSummary(null);
      setLedger([]);
      setError("Keine property_id vorhanden.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [summaryResult, ledgerRows] = await Promise.all([
        supabase
          .from("vw_property_loan_dashboard_dedup")
          .select(
            `
              property_id,
              property_name,
              first_year,
              last_year,
              last_balance_year,
              last_balance,
              interest_total,
              principal_total,
              repaid_percent,
              repaid_percent_display,
              repayment_status,
              repayment_label,
              refreshed_at
            `
          )
          .eq("property_id", propertyId)
          .maybeSingle(),
        loadPropertyLoanLedger(propertyId),
      ]);

      const { data: summaryData, error: summaryError } = summaryResult;

      if (summaryError) {
        throw summaryError;
      }

      const normalizedSummary: SummaryRow | null = summaryData
        ? {
            property_id: summaryData.property_id,
            property_name: summaryData.property_name ?? "Immobilie",
            first_year: parseNumber(summaryData.first_year),
            last_year: parseNumber(summaryData.last_year),
            last_balance_year: parseNumber(summaryData.last_balance_year),
            last_balance: parseNumber(summaryData.last_balance),
            interest_total: parseNumber(summaryData.interest_total),
            principal_total: parseNumber(summaryData.principal_total),
            repaid_percent: parseNumber(summaryData.repaid_percent),
            repaid_percent_display: summaryData.repaid_percent_display ?? null,
            repayment_status: summaryData.repayment_status ?? null,
            repayment_label: summaryData.repayment_label ?? null,
            refreshed_at: summaryData.refreshed_at ?? null,
          }
        : null;

      const normalizedLedger = Array.isArray(ledgerRows) ? ledgerRows : [];

      setSummary(normalizedSummary);
      setLedger(normalizedLedger);

      if (DEBUG) {
        console.log("ObjektDetail loaded", {
          propertyId,
          summaryExists: !!normalizedSummary,
          ledgerRows: normalizedLedger.length,
        });
      }
    } catch (err) {
      setSummary(null);
      setLedger([]);
      setError(getErrorMessage(err, "Fehler beim Laden der Objektseite."));

      if (DEBUG) {
        console.error("ObjektDetail load error", {
          propertyId,
          error: err,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const reloadLedgerOnly = useCallback(async () => {
    if (!propertyId) return;

    const ledgerRows = await loadPropertyLoanLedger(propertyId);
    setLedger(Array.isArray(ledgerRows) ? ledgerRows : []);
  }, [propertyId]);

  const resetEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingRowId(null);
    setFormValues(EMPTY_FORM_VALUES);
    setFormFieldErrors({});
    setFormError(null);
  }, []);

  const startCreate = useCallback(() => {
    setIsEditorOpen(true);
    setEditingRowId(null);
    setFormValues(EMPTY_FORM_VALUES);
    setFormFieldErrors({});
    setFormError(null);
  }, []);

  const startEdit = useCallback((row: LoanLedgerRow) => {
    setIsEditorOpen(true);
    setEditingRowId(row.id);
    setFormValues(rowToFormValues(row));
    setFormFieldErrors({});
    setFormError(null);
  }, []);

  const handleFieldChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      const fieldName = name as keyof LoanLedgerFormValues;

      setFormValues((prev) => ({
        ...prev,
        [fieldName]: value,
      }));

      setFormFieldErrors((prev) => ({
        ...prev,
        [fieldName]: undefined,
      }));

      setFormError(null);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!propertyId) {
      setFormError("Keine property_id vorhanden.");
      return;
    }

    const validation = validateLedgerRow(formValues);

    if (!validation.valid) {
      setFormFieldErrors(validation.errors);
      setFormError("Bitte korrigiere die markierten Felder.");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      setFormFieldErrors({});

      const payload = parseLoanLedgerFormValues(formValues);

      if (editingRowId == null) {
        await insertPropertyLoanLedgerRow(propertyId, payload);
      } else {
        await updatePropertyLoanLedgerRow(editingRowId, payload);
      }

      await reloadLedgerOnly();
      resetEditor();
    } catch (err) {
      setFormError(mapLedgerError(err));

      if (DEBUG) {
        console.error("ObjektDetail save ledger error", {
          propertyId,
          editingRowId,
          error: err,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [editingRowId, formValues, propertyId, reloadLedgerOnly, resetEditor]);

  const handleDelete = useCallback(
    async (rowId: number) => {
      const confirmed = window.confirm("Diese Ledger-Zeile wirklich löschen?");
      if (!confirmed) return;

      try {
        setSaving(true);
        setFormError(null);

        await deletePropertyLoanLedgerRow(rowId);
        await reloadLedgerOnly();

        if (editingRowId === rowId) {
          resetEditor();
        }
      } catch (err) {
        setFormError(mapLedgerError(err));

        if (DEBUG) {
          console.error("ObjektDetail delete ledger error", {
            propertyId,
            rowId,
            error: err,
          });
        }
      } finally {
        setSaving(false);
      }
    },
    [editingRowId, propertyId, reloadLedgerOnly, resetEditor]
  );

  const sortedLedger = useMemo(() => {
    return [...ledger].sort((a, b) => {
      const yearA = typeof a.year === "number" ? a.year : parseNumber(a.year) ?? 0;
      const yearB = typeof b.year === "number" ? b.year : parseNumber(b.year) ?? 0;
      return yearA - yearB;
    });
  }, [ledger]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return sortedLedger
      .map((row) => {
        const year = typeof row.year === "number" ? row.year : parseNumber(row.year);
        const balance =
          typeof row.balance === "number" ? row.balance : parseNumber(row.balance);

        if (year == null || balance == null) return null;

        return { year, balance };
      })
      .filter((point): point is ChartPoint => point !== null);
  }, [sortedLedger]);

  const hasLedgerData = sortedLedger.length > 0;

  const derivedStats = useMemo(() => {
    if (!hasLedgerData) {
      return {
        firstYear: null as number | null,
        lastYear: null as number | null,
        lastBalanceYear: null as number | null,
        lastBalance: null as number | null,
        interestTotal: null as number | null,
        principalTotal: null as number | null,
        repaidPercent: null as number | null,
      };
    }

    const firstRow = sortedLedger[0];
    const lastRow = sortedLedger[sortedLedger.length - 1];

    const firstYear =
      typeof firstRow.year === "number" ? firstRow.year : parseNumber(firstRow.year);
    const lastYear =
      typeof lastRow.year === "number" ? lastRow.year : parseNumber(lastRow.year);
    const lastBalance =
      typeof lastRow.balance === "number"
        ? lastRow.balance
        : parseNumber(lastRow.balance);

    const interestTotal = sortedLedger.reduce((sum, row) => {
      const interest =
        typeof row.interest === "number" ? row.interest : parseNumber(row.interest);
      return sum + (interest ?? 0);
    }, 0);

    const principalTotal = sortedLedger.reduce((sum, row) => {
      const principal =
        typeof row.principal === "number" ? row.principal : parseNumber(row.principal);
      return sum + (principal ?? 0);
    }, 0);

    const startingBalance =
      lastBalance != null && principalTotal != null ? lastBalance + principalTotal : null;

    const repaidPercent =
      startingBalance != null && startingBalance > 0
        ? principalTotal / startingBalance
        : null;

    return {
      firstYear: firstYear ?? null,
      lastYear: lastYear ?? null,
      lastBalanceYear: lastYear ?? null,
      lastBalance: lastBalance ?? null,
      interestTotal,
      principalTotal,
      repaidPercent,
    };
  }, [hasLedgerData, sortedLedger]);

  const effectiveFirstYear = derivedStats.firstYear ?? summary?.first_year ?? null;
  const effectiveLastYear = derivedStats.lastYear ?? summary?.last_year ?? null;
  const effectiveLastBalanceYear =
    derivedStats.lastBalanceYear ?? summary?.last_balance_year ?? null;
  const effectiveLastBalance = derivedStats.lastBalance ?? summary?.last_balance ?? null;
  const effectiveInterestTotal =
    derivedStats.interestTotal ?? summary?.interest_total ?? null;
  const effectivePrincipalTotal =
    derivedStats.principalTotal ?? summary?.principal_total ?? null;
  const effectiveRepaidPercent =
    derivedStats.repaidPercent ?? summary?.repaid_percent ?? null;

  const hasLoanData =
    effectiveLastBalance != null ||
    effectiveInterestTotal != null ||
    effectivePrincipalTotal != null ||
    hasLedgerData;

  const statusLabel = summary?.repayment_label ?? summary?.repayment_status ?? "—";
  const statusTone = getStatusTone(summary?.repayment_status ?? summary?.repayment_label ?? null);

  if (loading) {
    return (
      <div style={{ width: "100%", padding: 24, background: "#f3f4f6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              padding: 24,
            }}
          >
            <div style={{ color: "#374151" }}>Objektdetails werden geladen…</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: "100%", padding: 24, background: "#f3f4f6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              to="/objekte"
              style={{
                textDecoration: "none",
                color: "#4f46e5",
                fontWeight: 700,
              }}
            >
              ← Zurück zu Objekte
            </Link>
          </div>

          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 24,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: "#b91c1c" }}>
              Fehler beim Laden der Objektseite
            </div>
            <div style={{ marginTop: 8, color: "#dc2626", whiteSpace: "pre-wrap" }}>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: 24, background: "#f3f4f6" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            to="/objekte"
            style={{
              textDecoration: "none",
              color: "#4f46e5",
              fontWeight: 700,
            }}
          >
            ← Zurück zu Objekte
          </Link>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1.1,
                  wordBreak: "break-word",
                }}
              >
                {summary?.property_name ?? "Immobilie"}
              </h1>

              <div
                style={{
                  marginTop: 10,
                  color: "#6b7280",
                  fontSize: 15,
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}
              >
                Zeitraum: {formatYearRange(effectiveFirstYear, effectiveLastYear)}
                {" · "}
                Stand Restschuld: {effectiveLastBalanceYear ?? "—"}
                {" · "}
                Letzte Aktualisierung: {formatDateTime(summary?.refreshed_at ?? null)}
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 999,
                background: statusTone.background,
                color: statusTone.color,
                border: `1px solid ${statusTone.border}`,
                fontSize: 13,
                fontWeight: 800,
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {statusLabel}
            </div>
          </div>

          {!hasLoanData ? (
            <div
              style={{
                padding: 18,
                borderRadius: 16,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                Keine Darlehensdaten vorhanden
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#b45309" }}>
                Für diese Immobilie wurden aktuell weder zusammengefasste Kennzahlen noch
                Ledger-Daten gefunden.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                <Stat
                  label="Aktuelle Restschuld"
                  value={formatCurrency(effectiveLastBalance)}
                  subvalue={`Stand: ${effectiveLastBalanceYear ?? "—"}`}
                />
                <Stat
                  label="Zinsen gesamt"
                  value={formatCurrency(effectiveInterestTotal)}
                />
                <Stat
                  label="Tilgung gesamt"
                  value={formatCurrency(effectivePrincipalTotal)}
                />
                <Stat
                  label="Rückzahlungsgrad"
                  value={formatPercent(
                    effectiveRepaidPercent,
                    !hasLedgerData ? summary?.repaid_percent_display ?? null : null
                  )}
                />
              </div>

              {chartData.length > 0 ? (
                <Section title="Darlehensverlauf">
                  <div style={{ display: "grid", gap: 10 }}>
                    {chartData.map((point) => (
                      <div
                        key={point.year}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 16,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "#eff6ff",
                          border: "1px solid #dbeafe",
                          color: "#1e3a8a",
                          fontWeight: 700,
                        }}
                      >
                        <span>{point.year}</span>
                        <span>{formatCurrency(point.balance)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title="Darlehens-Ledger">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ color: "#374151", fontWeight: 600 }}>
                    Jahresweise Bearbeitung der Darlehensdaten
                  </div>

                  <button
                    type="button"
                    onClick={startCreate}
                    disabled={saving}
                    style={buttonPrimaryStyle}
                  >
                    + Neue Zeile
                  </button>
                </div>

                {isEditorOpen ? (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: 16,
                      border: "1px solid #d1d5db",
                      borderRadius: 16,
                      background: "#f9fafb",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        marginBottom: 16,
                        color: "#111827",
                      }}
                    >
                      {editingRowId == null
                        ? "Neue Ledger-Zeile anlegen"
                        : "Ledger-Zeile bearbeiten"}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <FormField
                        label="Jahr"
                        name="year"
                        value={formValues.year}
                        onChange={handleFieldChange}
                        error={formFieldErrors.year}
                        placeholder="z. B. 2026"
                        inputMode="numeric"
                      />
                      <FormField
                        label="Zinsen"
                        name="interest"
                        value={formValues.interest}
                        onChange={handleFieldChange}
                        error={formFieldErrors.interest}
                        placeholder="z. B. 3500"
                        inputMode="decimal"
                      />
                      <FormField
                        label="Tilgung"
                        name="principal"
                        value={formValues.principal}
                        onChange={handleFieldChange}
                        error={formFieldErrors.principal}
                        placeholder="z. B. 4200"
                        inputMode="decimal"
                      />
                      <FormField
                        label="Restschuld"
                        name="balance"
                        value={formValues.balance}
                        onChange={handleFieldChange}
                        error={formFieldErrors.balance}
                        placeholder="z. B. 105615,68"
                        inputMode="decimal"
                      />
                      <FormField
                        label="Quelle"
                        name="source"
                        value={formValues.source}
                        onChange={handleFieldChange}
                        error={formFieldErrors.source}
                        placeholder="z. B. Bank / Excel"
                      />
                    </div>

                    {formError ? (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        {formError}
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 16,
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        style={buttonPrimaryStyle}
                      >
                        {saving ? "Speichert..." : "Speichern"}
                      </button>

                      <button
                        type="button"
                        onClick={resetEditor}
                        disabled={saving}
                        style={buttonSecondaryStyle}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : null}

                {formError && !isEditorOpen ? (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      fontWeight: 600,
                    }}
                  >
                    {formError}
                  </div>
                ) : null}

                {hasLedgerData ? (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        minWidth: 820,
                        borderCollapse: "collapse",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={thStyle}>Jahr</th>
                          <th style={thStyle}>Zinsen</th>
                          <th style={thStyle}>Tilgung</th>
                          <th style={thStyle}>Restschuld</th>
                          <th style={thStyle}>Quelle</th>
                          <th style={thStyle}>Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLedger.map((row) => (
                          <tr key={row.id}>
                            <td style={tdStyle}>{row.year ?? "—"}</td>
                            <td style={tdStyle}>{formatCurrency(parseNumber(row.interest))}</td>
                            <td style={tdStyle}>{formatCurrency(parseNumber(row.principal))}</td>
                            <td style={tdStyle}>{formatCurrency(parseNumber(row.balance))}</td>
                            <td style={tdStyle}>{row.source ?? "—"}</td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  disabled={saving}
                                  style={buttonSecondaryStyle}
                                >
                                  Bearbeiten
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(row.id)}
                                  disabled={saving}
                                  style={buttonDangerStyle}
                                >
                                  Löschen
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      color: "#92400e",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 800 }}>
                      Noch keine Ledger-Zeilen vorhanden
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14, color: "#b45309" }}>
                      Du kannst jetzt die erste Darlehenszeile für diese Immobilie anlegen.
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #f3f4f6",
  color: "#111827",
  verticalAlign: "top",
};

const buttonPrimaryStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid #4f46e5",
  background: "#4f46e5",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const buttonSecondaryStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const buttonDangerStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid #ef4444",
  background: "#ffffff",
  color: "#b91c1c",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};