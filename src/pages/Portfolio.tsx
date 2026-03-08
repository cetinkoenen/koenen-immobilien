import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type PortfolioRow = {
  property_id: string;
  portfolio_property_id: string | null;
  property_name: string | null;
  last_balance: number | string | null;
  principal_total: number | string | null;
  interest_total: number | string | null;
  repaid_percent: number | string | null;
  repayment_status: string | null;
  repayment_label: string | null;
};

type PortfolioRowNormalized = {
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

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function getBadgeStyle(status: string | null): CSSProperties {
  switch (status) {
    case "paid":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #bbf7d0",
      };
    case "in_progress":
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      };
    case "overdue":
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      };
    default:
      return {
        background: "#f1f5f9",
        color: "#334155",
        border: "1px solid #e2e8f0",
      };
  }
}

const styles = {
  page: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: 24,
  } satisfies CSSProperties,

  hero: {
    marginBottom: 24,
  } satisfies CSSProperties,

  heroTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#111827",
    lineHeight: 1.05,
  } satisfies CSSProperties,

  heroText: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 17,
    color: "#374151",
    lineHeight: 1.6,
  } satisfies CSSProperties,

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  } satisfies CSSProperties,

  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 28,
  } satisfies CSSProperties,

  metricCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    padding: 20,
  } satisfies CSSProperties,

  metricLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 700,
  } satisfies CSSProperties,

  metricValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 900,
    color: "#111827",
  } satisfies CSSProperties,

  sectionHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
  } satisfies CSSProperties,

  sectionTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "#111827",
  } satisfies CSSProperties,

  emptyState: {
    padding: 24,
    color: "#6b7280",
    fontSize: 15,
  } satisfies CSSProperties,

  loadingBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    padding: 24,
    fontSize: 16,
    color: "#374151",
  } satisfies CSSProperties,

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecaca",
    borderRadius: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    padding: 24,
    color: "#991b1b",
    fontWeight: 700,
  } satisfies CSSProperties,

  row: {
    padding: 24,
  } satisfies CSSProperties,

  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    flexWrap: "wrap",
  } satisfies CSSProperties,

  rowLeft: {
    flex: "1 1 680px",
    minWidth: 280,
  } satisfies CSSProperties,

  rowTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  } satisfies CSSProperties,

  rowTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "#111827",
  } satisfies CSSProperties,

  badge: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  } satisfies CSSProperties,

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,

  infoTile: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
  } satisfies CSSProperties,

  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
  } satisfies CSSProperties,

  infoValue: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: 800,
    color: "#111827",
  } satisfies CSSProperties,

  actionArea: {
    flex: "0 0 320px",
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-end",
  } satisfies CSSProperties,

  button: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  } satisfies CSSProperties,

  footerMeta: {
    marginTop: 14,
    fontSize: 13,
    color: "#6b7280",
    wordBreak: "break-word",
  } satisfies CSSProperties,
};

export default function Portfolio() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<PortfolioRowNormalized[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPortfolio() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("vw_property_loan_dashboard_portfolio_v2")
        .select(`
          property_id,
          portfolio_property_id,
          property_name,
          last_balance,
          principal_total,
          interest_total,
          repaid_percent,
          repayment_status,
          repayment_label
        `)
        .order("property_name", { ascending: true });

      if (!active) return;

      if (queryError) {
        console.error("Failed to load portfolio:", queryError);
        setRows([]);
        setError(queryError.message || "Portfolio konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      const normalized: PortfolioRowNormalized[] = ((data ?? []) as PortfolioRow[]).map((row) => ({
        property_id: row.property_id,
        portfolio_property_id: row.portfolio_property_id,
        property_name: row.property_name?.trim() || "Unbenanntes Objekt",
        last_balance: toNumber(row.last_balance),
        principal_total: toNumber(row.principal_total),
        interest_total: toNumber(row.interest_total),
        repaid_percent: toNumber(row.repaid_percent),
        repayment_status: row.repayment_status,
        repayment_label: row.repayment_label,
      }));

      setRows(normalized);
      setLoading(false);
    }

    void loadPortfolio();

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.lastBalance += row.last_balance;
        acc.principalTotal += row.principal_total;
        acc.interestTotal += row.interest_total;
        return acc;
      },
      {
        lastBalance: 0,
        principalTotal: 0,
        interestTotal: 0,
      }
    );
  }, [rows]);

  const averageRepaidPercent = useMemo(() => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, row) => acc + row.repaid_percent, 0);
    return sum / rows.length;
  }, [rows]);

  function openSection(row: PortfolioRowNormalized, section: string) {
    if (!row.portfolio_property_id) {
      console.error("Missing portfolio_property_id for row:", row);
      window.alert(`Für "${row.property_name}" fehlt die portfolio_property_id.`);
      return;
    }

    navigate(`/portfolio/${encodeURIComponent(row.portfolio_property_id)}/${section}`);
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Portfolio</h1>
          <p style={styles.heroText}>
            Übersicht über Darlehen, Tilgung, Zinsen und Objektzugriffe.
          </p>
        </div>

        <div style={styles.loadingBox}>Portfolio wird geladen…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Portfolio</h1>
          <p style={styles.heroText}>
            Übersicht über Darlehen, Tilgung, Zinsen und Objektzugriffe.
          </p>
        </div>

        <div style={styles.errorBox}>Fehler beim Laden des Portfolios: {error}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Portfolio</h1>
        <p style={styles.heroText}>
          Übersicht über Darlehen, Tilgung, Zinsen und Objektzugriffe.
        </p>
      </div>

      <div style={styles.metricGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Objekte</div>
          <div style={styles.metricValue}>{rows.length}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Restschuld gesamt</div>
          <div style={styles.metricValue}>{formatCurrency(totals.lastBalance)}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Tilgung gesamt</div>
          <div style={styles.metricValue}>{formatCurrency(totals.principalTotal)}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Zinsen gesamt</div>
          <div style={styles.metricValue}>{formatCurrency(totals.interestTotal)}</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Ø Rückzahlungsstand</div>
          <div style={styles.metricValue}>{formatPercent(averageRepaidPercent)}</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Objektübersicht</h2>
        </div>

        {rows.length === 0 ? (
          <div style={styles.emptyState}>Keine Portfolio-Objekte gefunden.</div>
        ) : (
          <div>
            {rows.map((row, index) => (
              <div
                key={row.property_id}
                style={{
                  ...styles.row,
                  borderTop: index === 0 ? "none" : "1px solid #e5e7eb",
                }}
              >
                <div style={styles.rowTop}>
                  <div style={styles.rowLeft}>
                    <div style={styles.rowTitleWrap}>
                      <h3 style={styles.rowTitle}>{row.property_name}</h3>

                      <span
                        style={{
                          ...styles.badge,
                          ...getBadgeStyle(row.repayment_status),
                        }}
                      >
                        {row.repayment_label ?? "Unbekannt"}
                      </span>
                    </div>

                    <div style={styles.infoGrid}>
                      <div style={styles.infoTile}>
                        <div style={styles.infoLabel}>Restschuld</div>
                        <div style={styles.infoValue}>{formatCurrency(row.last_balance)}</div>
                      </div>

                      <div style={styles.infoTile}>
                        <div style={styles.infoLabel}>Tilgung gesamt</div>
                        <div style={styles.infoValue}>{formatCurrency(row.principal_total)}</div>
                      </div>

                      <div style={styles.infoTile}>
                        <div style={styles.infoLabel}>Zinsen gesamt</div>
                        <div style={styles.infoValue}>{formatCurrency(row.interest_total)}</div>
                      </div>

                      <div style={styles.infoTile}>
                        <div style={styles.infoLabel}>Rückzahlungsstand</div>
                        <div style={styles.infoValue}>{formatPercent(row.repaid_percent)}</div>
                      </div>
                    </div>
                  </div>

                  <div style={styles.actionArea}>
                    <button
                      type="button"
                      onClick={() => openSection(row, "address")}
                      style={styles.button}
                    >
                      Adresse
                    </button>

                    <button
                      type="button"
                      onClick={() => openSection(row, "details")}
                      style={styles.button}
                    >
                      Details
                    </button>

                    <button
                      type="button"
                      onClick={() => openSection(row, "finanzen")}
                      style={styles.button}
                    >
                      Finanzen
                    </button>

                    <button
                      type="button"
                      onClick={() => openSection(row, "energie")}
                      style={styles.button}
                    >
                      Energie
                    </button>

                    <button
                      type="button"
                      onClick={() => openSection(row, "vermietung")}
                      style={styles.button}
                    >
                      Vermietung
                    </button>
                  </div>
                </div>

                <div style={styles.footerMeta}>
                  core_property_id: {row.property_id}
                  {" • "}
                  portfolio_property_id: {row.portfolio_property_id ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}