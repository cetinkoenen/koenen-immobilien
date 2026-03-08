import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  }).format(value);
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

function cardStyle(): CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  };
}

function metricCardStyle(): CSSProperties {
  return {
    ...cardStyle(),
    padding: 20,
  };
}

function infoTileStyle(): CSSProperties {
  return {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
  };
}

function actionButtonStyle(): CSSProperties {
  return {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default function Portfolio() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<PortfolioRowNormalized[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPortfolio() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
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

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load portfolio:", error);
        setError(error.message ?? "Portfolio konnte nicht geladen werden.");
        setRows([]);
        setLoading(false);
        return;
      }

      const normalized: PortfolioRowNormalized[] = ((data ?? []) as PortfolioRow[]).map(
        (row) => ({
          property_id: row.property_id,
          portfolio_property_id: row.portfolio_property_id,
          property_name: row.property_name?.trim() || "Unbenanntes Objekt",
          last_balance: toNumber(row.last_balance),
          principal_total: toNumber(row.principal_total),
          interest_total: toNumber(row.interest_total),
          repaid_percent: toNumber(row.repaid_percent),
          repayment_status: row.repayment_status,
          repayment_label: row.repayment_label,
        })
      );

      setRows(normalized);
      setLoading(false);
    }

    void loadPortfolio();

    return () => {
      isMounted = false;
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
    const total = rows.reduce((sum, row) => sum + row.repaid_percent, 0);
    return total / rows.length;
  }, [rows]);

  function openSection(row: PortfolioRowNormalized, section: string) {
    if (!row.portfolio_property_id) {
      console.error("Missing portfolio_property_id for row:", row);
      alert(`Für "${row.property_name}" fehlt die portfolio_property_id.`);
      return;
    }

    navigate(`/portfolio/${encodeURIComponent(row.portfolio_property_id)}/${section}`);
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 48,
            fontWeight: 900,
            color: "#111827",
            lineHeight: 1.05,
          }}
        >
          Portfolio
        </h1>

        <p
          style={{
            marginTop: 14,
            marginBottom: 0,
            fontSize: 18,
            color: "#374151",
            lineHeight: 1.6,
          }}
        >
          Übersicht über Darlehen, Tilgung, Zinsen und Objektzugriffe.
        </p>
      </div>

      {loading ? (
        <div
          style={{
            ...cardStyle(),
            padding: 24,
            fontSize: 16,
            color: "#374151",
          }}
        >
          Portfolio wird geladen…
        </div>
      ) : error ? (
        <div
          style={{
            ...cardStyle(),
            padding: 24,
            background: "#fff1f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          Fehler beim Laden des Portfolios: {error}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 28,
            }}
          >
            <div style={metricCardStyle()}>
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>Objekte</div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, color: "#111827" }}>
                {rows.length}
              </div>
            </div>

            <div style={metricCardStyle()}>
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                Restschuld gesamt
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, color: "#111827" }}>
                {formatCurrency(totals.lastBalance)}
              </div>
            </div>

            <div style={metricCardStyle()}>
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                Tilgung gesamt
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, color: "#111827" }}>
                {formatCurrency(totals.principalTotal)}
              </div>
            </div>

            <div style={metricCardStyle()}>
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                Ø Rückzahlungsstand
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, color: "#111827" }}>
                {formatPercent(averageRepaidPercent)}
              </div>
            </div>
          </div>

          <div style={cardStyle()}>
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
                Objektübersicht
              </h2>
            </div>

            {rows.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  color: "#6b7280",
                  fontSize: 15,
                }}
              >
                Keine Portfolio-Objekte gefunden.
              </div>
            ) : (
              <div>
                {rows.map((row, index) => (
                  <div
                    key={row.property_id}
                    style={{
                      padding: 24,
                      borderTop: index === 0 ? "none" : "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 20,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "1 1 680px", minWidth: 280 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 18,
                          }}
                        >
                          <h3
                            style={{
                              margin: 0,
                              fontSize: 22,
                              fontWeight: 900,
                              color: "#111827",
                            }}
                          >
                            {row.property_name}
                          </h3>

                          <span
                            style={{
                              ...getBadgeStyle(row.repayment_status),
                              borderRadius: 999,
                              padding: "6px 10px",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {row.repayment_label ?? "Unbekannt"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 12,
                          }}
                        >
                          <div style={infoTileStyle()}>
                            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                              Restschuld
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 20,
                                fontWeight: 800,
                                color: "#111827",
                              }}
                            >
                              {formatCurrency(row.last_balance)}
                            </div>
                          </div>

                          <div style={infoTileStyle()}>
                            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                              Tilgung gesamt
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 20,
                                fontWeight: 800,
                                color: "#111827",
                              }}
                            >
                              {formatCurrency(row.principal_total)}
                            </div>
                          </div>

                          <div style={infoTileStyle()}>
                            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                              Zinsen gesamt
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 20,
                                fontWeight: 800,
                                color: "#111827",
                              }}
                            >
                              {formatCurrency(row.interest_total)}
                            </div>
                          </div>

                          <div style={infoTileStyle()}>
                            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                              Rückzahlungsstand
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 20,
                                fontWeight: 800,
                                color: "#111827",
                              }}
                            >
                              {formatPercent(row.repaid_percent)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          flex: "0 0 320px",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openSection(row, "address")}
                          style={actionButtonStyle()}
                        >
                          Adresse
                        </button>

                        <button
                          type="button"
                          onClick={() => openSection(row, "details")}
                          style={actionButtonStyle()}
                        >
                          Details
                        </button>

                        <button
                          type="button"
                          onClick={() => openSection(row, "finanzen")}
                          style={actionButtonStyle()}
                        >
                          Finanzen
                        </button>

                        <button
                          type="button"
                          onClick={() => openSection(row, "energie")}
                          style={actionButtonStyle()}
                        >
                          Energie
                        </button>

                        <button
                          type="button"
                          onClick={() => openSection(row, "vermietung")}
                          style={actionButtonStyle()}
                        >
                          Vermietung
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        fontSize: 13,
                        color: "#6b7280",
                        wordBreak: "break-word",
                      }}
                    >
                      core_property_id: {row.property_id}
                      {" • "}
                      portfolio_property_id: {row.portfolio_property_id ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}