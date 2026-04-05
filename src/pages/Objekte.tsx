import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoanChart from "../components/LoanChart";
import { supabase } from "../lib/supabase";

const DEBUG = import.meta.env.DEV;

type PropertyDashboardRow = {
  property_id: string;
  property_name: string | null;
  first_year: number | string | null;
  last_year: number | string | null;
  last_balance_year: number | string | null;
  last_balance: number | string | null;
  interest_total: number | string | null;
  principal_total: number | string | null;
  repaid_percent: number | string | null;
  repaid_percent_display: string | null;
  repayment_status: string | null;
  repayment_label: string | null;
  refreshed_at: string | null;
};

type PropertyCard = {
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

type LoanLedgerRow = {
  property_id: string;
  year: number | string | null;
  balance: number | string | null;
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
  displayValue: string | null
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

function isShadowName(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.includes("shadow") || normalized.includes("core-shadow");
}

function formatRefresh(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function groupLedgerRowsByProperty(
  rows: LoanLedgerRow[]
): Record<string, LoanChartPoint[]> {
  const grouped: Record<string, LoanChartPoint[]> = {};

  for (const row of rows) {
    if (!row.property_id) continue;

    const year = parseNumber(row.year);
    const balance = parseNumber(row.balance);

    if (year == null || balance == null) continue;

    if (!grouped[row.property_id]) {
      grouped[row.property_id] = [];
    }

    grouped[row.property_id].push({ year, balance });
  }

  for (const propertyId of Object.keys(grouped)) {
    grouped[propertyId].sort((a, b) => a.year - b.year);
  }

  return grouped;
}

function StatBox(props: { label: string; value: string; subvalue?: string }) {
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

export default function Objekte() {
  const navigate = useNavigate();

  const [properties, setProperties] = useState<PropertyCard[]>([]);
  const [chartDataByPropertyId, setChartDataByPropertyId] = useState<
    Record<string, LoanChartPoint[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [chartWarning, setChartWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      const { data, error } = await supabase
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
        .order("property_name", { ascending: true });

      if (error) {
        throw new Error(error.message || "Fehler beim Laden der Immobilien.");
      }

      const mapped: PropertyCard[] = ((data ?? []) as PropertyDashboardRow[])
        .map((row) => ({
          property_id: row.property_id,
          property_name: row.property_name ?? "Unbenannte Immobilie",
          first_year: parseNumber(row.first_year),
          last_year: parseNumber(row.last_year),
          last_balance_year: parseNumber(row.last_balance_year),
          last_balance: parseNumber(row.last_balance),
          interest_total: parseNumber(row.interest_total),
          principal_total: parseNumber(row.principal_total),
          repaid_percent: parseNumber(row.repaid_percent),
          repaid_percent_display: row.repaid_percent_display ?? null,
          repayment_status: row.repayment_status ?? null,
          repayment_label: row.repayment_label ?? null,
          refreshed_at: row.refreshed_at ?? null,
        }))
        .filter((row) => !isShadowName(row.property_name));

      return mapped;
    }

    async function loadCharts(propertyIds: string[]) {
      if (propertyIds.length === 0) return {};

      const { data, error } = await supabase
        .from("vw_property_loan_ledger_by_loan")
        .select("property_id, year, balance")
        .in("property_id", propertyIds)
        .order("property_id", { ascending: true })
        .order("year", { ascending: true });

      if (error) {
        throw new Error(error.message || "Fehler beim Laden der Chart-Daten.");
      }

      return groupLedgerRowsByProperty((data ?? []) as LoanLedgerRow[]);
    }

    async function loadData() {
      setLoading(true);
      setPageError(null);
      setChartWarning(null);

      try {
        const mappedProperties = await loadProperties();

        if (cancelled) return;

        setProperties(mappedProperties);

        const propertyIds = mappedProperties
          .map((property) => property.property_id)
          .filter(Boolean);

        try {
          const groupedCharts = await loadCharts(propertyIds);

          if (cancelled) return;

          setChartDataByPropertyId(groupedCharts);
        } catch (chartError) {
          if (cancelled) return;

          const message =
            chartError instanceof Error
              ? chartError.message
              : "Chart-Daten konnten nicht geladen werden.";

          setChartDataByPropertyId({});
          setChartWarning(message);

          if (DEBUG) {
            console.warn("Objekte: Chart-Daten konnten nicht geladen werden:", message);
          }
        }
      } catch (pageLoadError) {
        if (cancelled) return;

        const message =
          pageLoadError instanceof Error
            ? pageLoadError.message
            : "Fehler beim Laden der Objekte.";

        setPageError(message);
        setProperties([]);
        setChartDataByPropertyId({});

        if (DEBUG) {
          console.error("Objekte: Hauptdaten konnten nicht geladen werden:", message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle = useMemo(() => {
    if (!properties.length) {
      return "Übersicht über Immobilien und jährliche Restschuldverläufe.";
    }

    return `${properties.length} Immobilien geladen.`;
  }, [properties.length]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111827" }}>
          Objekte
        </h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 16 }}>
          Lade Immobilienübersicht…
        </p>

        <div
          style={{
            marginTop: 24,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ color: "#374151" }}>Objekte werden geladen…</div>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111827" }}>
          Objekte
        </h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 16 }}>
          Übersicht über Immobilien und jährliche Restschuldverläufe.
        </p>

        <div
          style={{
            marginTop: 24,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: "#b91c1c" }}>
            Fehler beim Laden der Objekte
          </div>
          <div style={{ marginTop: 8, color: "#dc2626" }}>{pageError}</div>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111827" }}>
          Objekte
        </h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 16 }}>
          Übersicht über Immobilien und jährliche Restschuldverläufe.
        </p>

        <div
          style={{
            marginTop: 24,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: "#92400e" }}>
            Keine Immobilien gefunden
          </div>
          <div style={{ marginTop: 8, color: "#b45309" }}>
            Die Dashboard-View hat keine Datensätze geliefert.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111827" }}>
          Objekte
        </h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 16 }}>{subtitle}</p>
      </div>

      {chartWarning ? (
        <div
          style={{
            marginBottom: 24,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 16,
            padding: 16,
            color: "#1d4ed8",
          }}
        >
          Die Immobilien wurden geladen, aber die Verlaufsgrafiken konnten nicht geladen
          werden. Die Detailseiten sollten trotzdem erreichbar sein.
          {DEBUG ? <div style={{ marginTop: 6 }}>{chartWarning}</div> : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 24 }}>
        {properties.map((property) => (
          <section
            key={property.property_id}
            onClick={() => navigate(`/objekte/${property.property_id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/objekte/${property.property_id}`);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Zur Detailseite von ${property.property_name}`}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              cursor: "pointer",
              transition:
                "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = "translateY(-2px)";
              event.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
              event.currentTarget.style.borderColor = "#cbd5e1";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
              event.currentTarget.style.borderColor = "#e5e7eb";
            }}
            onFocus={(event) => {
              event.currentTarget.style.transform = "translateY(-2px)";
              event.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
              event.currentTarget.style.borderColor = "#6366f1";
            }}
            onBlur={(event) => {
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
              event.currentTarget.style.borderColor = "#e5e7eb";
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1.15,
                  wordBreak: "break-word",
                }}
              >
                {property.property_name}
              </h2>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "#6366f1",
                  fontWeight: 700,
                }}
              >
                Zur Detailansicht →
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <StatBox
                label="Zeitraum"
                value={formatYearRange(property.first_year, property.last_year)}
              />
              <StatBox
                label="Aktuelle Restschuld"
                value={formatCurrency(property.last_balance)}
                subvalue={`Stand: ${property.last_balance_year ?? "—"}`}
              />
              <StatBox
                label="Zinsen gesamt"
                value={formatCurrency(property.interest_total)}
              />
              <StatBox
                label="Tilgung gesamt"
                value={formatCurrency(property.principal_total)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              <StatBox
                label="Rückzahlungsgrad"
                value={formatPercent(
                  property.repaid_percent,
                  property.repaid_percent_display
                )}
              />
              <StatBox
                label="Status"
                value={property.repayment_label ?? property.repayment_status ?? "—"}
              />
              <StatBox
                label="Letzte Aktualisierung"
                value={formatRefresh(property.refreshed_at)}
              />
            </div>

            <div style={{ marginTop: 24 }}>
              <LoanChart data={chartDataByPropertyId[property.property_id] ?? []} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}