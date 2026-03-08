import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LoanChart from "../components/LoanChart";
import { supabase } from "../lib/supabase";

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

type LedgerRowRaw = {
  property_id: string;
  year: number | string | null;
  interest: number | string | null;
  principal: number | string | null;
  balance: number | string | null;
  source: string | null;
};

type LedgerRow = {
  property_id: string;
  year: number;
  interest: number | null;
  principal: number | null;
  balance: number | null;
  source: string | null;
};

type LoanChartPoint = {
  year: number;
  balance: number;
};

function parseNumber(value: unknown): number | null {
  if (value == null) return null;

  if (Array.isArray(value)) {
    return parseNumber(value[0]);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(
  value: number | null,
  displayValue?: string | null
): string {
  if (displayValue) return displayValue;
  if (value == null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatYearRange(
  startYear: number | null,
  endYear: number | null
): string {
  if (startYear != null && endYear != null) return `${startYear} – ${endYear}`;
  if (startYear != null) return `${startYear} – ?`;
  if (endYear != null) return `? – ${endYear}`;
  return "—";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusTone(
  status: string | null
): { background: string; color: string; border: string } {
  const normalized = (status ?? "").toLowerCase();

  if (
    normalized.includes("healthy") ||
    normalized.includes("ok") ||
    normalized.includes("gut")
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

function StatBox(props: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: 6,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "#111827",
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {props.value}
      </div>

      {props.subvalue ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "#6b7280",
            wordBreak: "break-word",
          }}
        >
          {props.subvalue}
        </div>
      ) : null}
    </div>
  );
}

export default function ObjektDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!propertyId) {
        setError("Keine Immobilien-ID in der URL gefunden.");
        setSummary(null);
        setLedger([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data: summaryData, error: summaryError } = await supabase
        .from("vw_property_loan_dashboard_dedup")
        .select(`
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
        `)
        .eq("property_id", propertyId)
        .maybeSingle();

      if (cancelled) return;

      if (summaryError) {
        setError(summaryError.message || "Fehler beim Laden der Objektdaten.");
        setSummary(null);
        setLedger([]);
        setLoading(false);
        return;
      }

      if (!summaryData) {
        setError("Für diese Immobilien-ID wurde kein Datensatz gefunden.");
        setSummary(null);
        setLedger([]);
        setLoading(false);
        return;
      }

      const mappedSummary: SummaryRow = {
        property_id: summaryData.property_id,
        property_name: summaryData.property_name ?? "Unbenannte Immobilie",
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
      };

      setSummary(mappedSummary);

      const { data: ledgerData, error: ledgerError } = await supabase
        .from("vw_property_loan_ledger_by_loan")
        .select("property_id, year, interest, principal, balance, source")
        .eq("property_id", propertyId)
        .order("year", { ascending: true });

      if (cancelled) return;

      if (ledgerError) {
        setError(ledgerError.message || "Fehler beim Laden der Ledger-Daten.");
        setLedger([]);
        setLoading(false);
        return;
      }

      const mappedLedger: LedgerRow[] = ((ledgerData ?? []) as LedgerRowRaw[])
        .map((row) => {
          const year = parseNumber(row.year);

          if (year == null) return null;

          return {
            property_id: row.property_id,
            year,
            interest: parseNumber(row.interest),
            principal: parseNumber(row.principal),
            balance: parseNumber(row.balance),
            source: row.source ?? null,
          };
        })
        .filter((row): row is LedgerRow => row !== null)
        .sort((a, b) => a.year - b.year);

      if (cancelled) return;

      setLedger(mappedLedger);
      setLoading(false);
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const chartData = useMemo<LoanChartPoint[]>(() => {
    return ledger
      .filter((row) => row.balance != null)
      .map((row) => ({
        year: row.year,
        balance: row.balance as number,
      }));
  }, [ledger]);

  const statusLabel =
    summary?.repayment_label ?? summary?.repayment_status ?? "—";

  const statusTone = getStatusTone(
    summary?.repayment_status ?? summary?.repayment_label ?? null
  );

  const hasLoanData =
    summary?.last_balance != null ||
    summary?.interest_total != null ||
    summary?.principal_total != null ||
    ledger.length > 0;

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
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
    );
  }

  if (error && !summary) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
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
          <div style={{ marginTop: 8, color: "#dc2626" }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
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
          <div style={{ minWidth: 0 }}>
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
              }}
            >
              Zeitraum:{" "}
              {formatYearRange(
                summary?.first_year ?? null,
                summary?.last_year ?? null
              )}
              {" · "}
              Stand Restschuld: {summary?.last_balance_year ?? "—"}
              {" · "}
              Letzte Aktualisierung:{" "}
              {formatDateTime(summary?.refreshed_at ?? null)}
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
            }}
          >
            {statusLabel}
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              borderRadius: 14,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Hinweis: {error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <StatBox
            label="Aktuelle Restschuld"
            value={formatCurrency(summary?.last_balance ?? null)}
            subvalue={`Stand: ${summary?.last_balance_year ?? "—"}`}
          />
          <StatBox
            label="Zinsen gesamt"
            value={formatCurrency(summary?.interest_total ?? null)}
          />
          <StatBox
            label="Tilgung gesamt"
            value={formatCurrency(summary?.principal_total ?? null)}
          />
          <StatBox
            label="Rückzahlungsgrad"
            value={formatPercent(
              summary?.repaid_percent ?? null,
              summary?.repaid_percent_display ?? null
            )}
          />
        </div>

        {!hasLoanData ? (
          <div
            style={{
              marginTop: 8,
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
              Für diese Immobilie wurden aktuell weder zusammengefasste
              Kennzahlen noch Ledger-Daten gefunden.
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 24 }}>
              <LoanChart data={chartData} />
            </div>

            <div
              style={{
                marginTop: 24,
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#ffffff",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                Darlehensverlauf (Ledger)
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 760,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        textAlign: "left",
                        color: "#6b7280",
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <th
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Jahr
                      </th>
                      <th
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Zinsen
                      </th>
                      <th
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Tilgung
                      </th>
                      <th
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Restschuld
                      </th>
                      <th
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Quelle
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {ledger.length > 0 ? (
                      ledger.map((row) => (
                        <tr key={`${row.property_id}-${row.year}`}>
                          <td
                            style={{
                              padding: "14px 16px",
                              borderBottom: "1px solid #f3f4f6",
                              fontWeight: 700,
                              color: "#111827",
                            }}
                          >
                            {row.year}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              borderBottom: "1px solid #f3f4f6",
                              color: "#111827",
                            }}
                          >
                            {formatCurrency(row.interest)}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              borderBottom: "1px solid #f3f4f6",
                              color: "#111827",
                            }}
                          >
                            {formatCurrency(row.principal)}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              borderBottom: "1px solid #f3f4f6",
                              fontWeight: 700,
                              color: "#111827",
                            }}
                          >
                            {formatCurrency(row.balance)}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              borderBottom: "1px solid #f3f4f6",
                              color: "#6b7280",
                              fontSize: 13,
                            }}
                          >
                            {row.source ?? "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: "18px 16px",
                            color: "#6b7280",
                          }}
                        >
                          Keine Ledger-Zeilen gefunden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}