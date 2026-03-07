import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

type PortfolioRow = {
  property_id: string;
  property_name: string | null;
  last_balance: number | string | null;
  principal_total: number | string | null;
  interest_total: number | string | null;
  repaid_percent: number | string | null;
  repayment_status: string | null;
  repayment_label: string | null;
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEUR(value: number): string {
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

function formatPercentFromRatio(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    return `${new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(safeValue * 100)} %`;
  } catch {
    return `${(safeValue * 100).toFixed(1)} %`;
  }
}

function formatErrorMessage(error: unknown): string {
  if (!error) return "Unbekannter Fehler";
  if (typeof error === "string") return error;

  const err = error as SupabaseLikeError;
  const parts = [err.message, err.details, err.hint, err.code].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Unbekannter Fehler";
}

function cardStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  };
}

function badgeStyle(label: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
    border: "1px solid #e5e7eb",
  };

  if (label === "Läuft") {
    return {
      ...base,
      background: "#ecfdf3",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (label === "Neu") {
    return {
      ...base,
      background: "#eef2ff",
      color: "#3730a3",
      border: "1px solid #c7d2fe",
    };
  }

  if (label === "Abbezahlt") {
    return {
      ...base,
      background: "#f3f4f6",
      color: "#111827",
      border: "1px solid #d1d5db",
    };
  }

  return {
    ...base,
    background: "#f9fafb",
    color: "#111827",
  };
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "none",
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "none",
  };
}

function subtleButtonStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "none",
  };
}

export default function Portfolio() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPortfolio = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const { data, error } = await supabase
        .from("vw_property_loan_dashboard_portfolio")
        .select(`
          property_id,
          property_name,
          last_balance,
          principal_total,
          interest_total,
          repaid_percent,
          repayment_status,
          repayment_label
        `)
        .order("last_balance", { ascending: false });

      if (error) {
        if (mountedRef.current) {
          setRows([]);
          setError(formatErrorMessage(error));
        }
        return;
      }

      if (mountedRef.current) {
        setRows(Array.isArray(data) ? (data as PortfolioRow[]) : []);
      }
    } catch (err) {
      if (mountedRef.current) {
        setRows([]);
        setError(formatErrorMessage(err));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const text = [
        row.property_name ?? "",
        row.repayment_label ?? "",
        row.repayment_status ?? "",
        row.property_id ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    let debt = 0;
    let principal = 0;
    let interest = 0;
    let inProgress = 0;
    let isNew = 0;
    let repaid = 0;

    for (const row of filteredRows) {
      debt += toNumber(row.last_balance);
      principal += toNumber(row.principal_total);
      interest += toNumber(row.interest_total);

      if (row.repayment_status === "in_progress") inProgress += 1;
      else if (row.repayment_status === "new") isNew += 1;
      else if (row.repayment_status === "repaid") repaid += 1;
    }

    const repaidRatio = principal + debt > 0 ? principal / (principal + debt) : 0;

    return {
      count: filteredRows.length,
      debt,
      principal,
      interest,
      repaidRatio,
      inProgress,
      isNew,
      repaid,
    };
  }, [filteredRows]);

  const chartData = useMemo(() => {
    return [...filteredRows]
      .sort((a, b) => toNumber(b.last_balance) - toNumber(a.last_balance))
      .map((row) => ({
        name: row.property_name ?? "Unbenanntes Objekt",
        debt: toNumber(row.last_balance),
      }))
      .filter((row) => Number.isFinite(row.debt) && row.debt >= 0);
  }, [filteredRows]);

  const chartHeight = Math.max(320, chartData.length * 56);

  const openProperty = useCallback(
    (propertyId: string) => {
      navigate(`/objekte/${encodeURIComponent(propertyId)}`);
    },
    [navigate]
  );

  const openExpose = useCallback(
    (propertyId: string) => {
      navigate(`/objekte/${encodeURIComponent(propertyId)}/expose`);
    },
    [navigate]
  );

  const uploadExpose = useCallback(
    (propertyId: string) => {
      navigate(`/objekte/${encodeURIComponent(propertyId)}/expose/upload`);
    },
    [navigate]
  );

  return (
    <div style={{ display: "grid", gap: 18, padding: 24, maxWidth: 1440, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 950,
              letterSpacing: "-0.03em",
              color: "#111827",
            }}
          >
            Portfolio
          </h1>
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 15 }}>
            Finanzübersicht, Status und Dokumenten-Aktionen für alle produktiven Immobilien
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadPortfolio()}
          disabled={loading}
          style={{
            ...secondaryButtonStyle(),
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Lädt…" : "Aktualisieren"}
        </button>
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Suchen (Name / Status / ID)"
          style={{
            width: 360,
            maxWidth: "100%",
            padding: "11px 14px",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            fontWeight: 700,
            fontSize: 14,
            background: "#ffffff",
          }}
        />

        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.65, fontWeight: 700 }}>
          {loading ? "…" : `${filteredRows.length} von ${rows.length} Objekten`}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard title="Immobilien" value={String(stats.count)} hint="Produktive Objekte" />
        <KpiCard
          title="Gesamtrestschuld"
          value={formatEUR(stats.debt)}
          hint="Aktuelle offene Darlehen"
        />
        <KpiCard
          title="Gesamttilgung"
          value={formatEUR(stats.principal)}
          hint="Bisher zurückgezahlt"
        />
        <KpiCard
          title="Gesamtzinsen"
          value={formatEUR(stats.interest)}
          hint="Kumulierte Zinslast"
        />
        <KpiCard
          title="Rückzahlungsgrad"
          value={formatPercentFromRatio(stats.repaidRatio)}
          hint="Tilgung im Verhältnis zu Tilgung + Restschuld"
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div style={{ ...cardStyle(), overflow: "hidden" }}>
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900 }}>Restschuld-Verteilung</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              Sortiert nach aktueller Restschuld
            </div>
          </div>

          <div style={{ padding: 14 }}>
            {loading ? (
              <div style={{ opacity: 0.7 }}>Chart lädt…</div>
            ) : chartData.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Keine Chart-Daten vorhanden.</div>
            ) : (
              <div style={{ overflowX: "auto", overflowY: "hidden" }}>
                <BarChart
                  width={820}
                  height={chartHeight}
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={200}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number | string) => formatEUR(toNumber(value))}
                  />
                  <Bar dataKey="debt" radius={[4, 4, 4, 4]} />
                </BarChart>
              </div>
            )}
          </div>
        </div>

        <div style={{ ...cardStyle(), overflow: "hidden" }}>
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 900,
            }}
          >
            Statusverteilung
          </div>

          <div style={{ display: "grid", gap: 10, padding: 14 }}>
            <MiniStat label="Läuft" value={String(stats.inProgress)} />
            <MiniStat label="Neu" value={String(stats.isNew)} />
            <MiniStat label="Abbezahlt" value={String(stats.repaid)} />
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle(), overflow: "hidden" }}>
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900 }}>Objekte</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Öffnen, Exposé ansehen oder Exposé hochladen
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 14, opacity: 0.7 }}>Lädt Objekte…</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>Keine Objekte gefunden.</div>
        ) : (
          <div style={{ display: "grid", gap: 12, padding: 14 }}>
            {filteredRows.map((row) => (
              <PortfolioPropertyCard
                key={row.property_id}
                row={row}
                onOpen={() => openProperty(row.property_id)}
                onOpenExpose={() => openExpose(row.property_id)}
                onUploadExpose={() => uploadExpose(row.property_id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PortfolioPropertyCard({
  row,
  onOpen,
  onOpenExpose,
  onUploadExpose,
}: {
  row: PortfolioRow;
  onOpen: () => void;
  onOpenExpose: () => void;
  onUploadExpose: () => void;
}) {
  const debt = toNumber(row.last_balance);
  const principal = toNumber(row.principal_total);
  const interest = toNumber(row.interest_total);
  const repaidPercent = toNumber(row.repaid_percent);
  const statusLabel = row.repayment_label ?? "Unbekannt";

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        background: "#ffffff",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <div
              style={{
                fontWeight: 950,
                fontSize: 17,
                color: "#111827",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.property_name ?? ""}
            >
              {row.property_name ?? "Unbenanntes Objekt"}
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                opacity: 0.65,
                wordBreak: "break-all",
              }}
            >
              ID:{" "}
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {row.property_id}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              justifyItems: "end",
              alignItems: "start",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 15 }}>
              {formatPercentFromRatio(repaidPercent)}
            </div>
            <span style={badgeStyle(statusLabel)}>{statusLabel}</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <MetricCard label="Restschuld" value={formatEUR(debt)} />
          <MetricCard label="Tilgung" value={formatEUR(principal)} />
          <MetricCard label="Zinsen" value={formatEUR(interest)} />
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid #f1f5f9",
          background: "#fbfdff",
          padding: 14,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={onOpen} style={primaryButtonStyle()}>
          Objekt öffnen
        </button>

        <button type="button" onClick={onOpenExpose} style={secondaryButtonStyle()}>
          Exposé
        </button>

        <button type="button" onClick={onUploadExpose} style={subtleButtonStyle()}>
          Exposé hochladen
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #eef2f7",
        borderRadius: 14,
        background: "#f9fafb",
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 900, color: "#111827" }}>{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 12,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
      }}
    >
      <span style={{ fontWeight: 700 }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        background: "#ffffff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>{title}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 950,
          letterSpacing: "-0.02em",
          color: "#111827",
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>{hint}</div>
    </div>
  );
}