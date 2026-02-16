// src/pages/Portfolio.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type PropertyType = "HOUSE" | "APARTMENT" | "GARAGE";

type PortfolioProperty = {
  id: string;
  name: string;
  type: PropertyType;
  sort_index: number;
  created_at: string;
  is_test?: boolean | null;
};

type FinanceRow = {
  property_id: string;
  purchase_price: number | null;
};

function fmtEUR(v: number) {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${Math.round(v)} €`;
  }
}

function typeLabel(t: PropertyType) {
  if (t === "HOUSE") return "Haus";
  if (t === "APARTMENT") return "Wohnung";
  return "Garage";
}

function typeBadgeStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#111827",
  };
}

function normalizeError(e: any): string {
  return e?.message ?? e?.details ?? e?.error_description ?? String(e);
}

export default function Portfolio() {
  // ✅ Hard proof: component is actually mounted
  console.log("✅ PORTFOLIO COMPONENT MOUNTED");

  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");

  const [rows, setRows] = React.useState<PortfolioProperty[]>([]);
  const [finance, setFinance] = React.useState<Record<string, FinanceRow>>({});

  // UI state
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<PropertyType | "ALL">("ALL");

  // Guard against stale requests
  const seqRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const mySeq = ++seqRef.current;
    const isStale = () => mySeq !== seqRef.current;

    setLoading(true);
    setError("");

    try {
      // 0) Session debug (RLS/auth sanity)
      const { data: sData, error: sErr } = await supabase.auth.getSession();
      console.log("[Portfolio] session", {
        hasSession: !!sData?.session,
        userId: sData?.session?.user?.id ?? null,
        sessionError: sErr ?? null,
      });

      // 1) Properties
      // ✅ IMPORTANT: is_test might be NULL for normal rows
      // => "NOT test" means: is_test IS NULL OR is_test = false
      const { data: pData, error: pErr } = await supabase
        .from("portfolio_properties")
        .select("id,name,type,sort_index,created_at,is_test")
        .or("is_test.is.null,is_test.eq.false")
        .order("sort_index", { ascending: true })
        .order("created_at", { ascending: true });

      console.log("[Portfolio] properties query result", {
        count: pData?.length ?? 0,
        sample: pData?.[0] ?? null,
        pErr: pErr ?? null,
      });

      if (pErr) throw pErr;
      if (isStale()) return;

      const props = (pData ?? []) as PortfolioProperty[];
      setRows(props);

      // 2) Finance
      if (props.length === 0) {
        setFinance({});
        setLoading(false);
        return;
      }

      const ids = props.map((p) => p.id);

      const { data: fData, error: fErr } = await supabase
        .from("portfolio_property_finance")
        .select("property_id,purchase_price")
        .in("property_id", ids);

      console.log("[Portfolio] finance query result", {
        count: fData?.length ?? 0,
        sample: fData?.[0] ?? null,
        fErr: fErr ?? null,
      });

      if (fErr) throw fErr;
      if (isStale()) return;

      const map: Record<string, FinanceRow> = {};
      for (const r of (fData ?? []) as FinanceRow[]) {
        map[r.property_id] = r;
      }
      setFinance(map);
      setLoading(false);
    } catch (e) {
      console.error("[Portfolio] load failed:", e);
      if (isStale()) return;

      setError(normalizeError(e));
      setRows([]);
      setFinance({});
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    return () => {
      // invalidate pending requests
      seqRef.current += 1;
    };
  }, [load]);

  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((p) => {
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (!q) return true;

      const blob = `${p.name} ${typeLabel(p.type)} ${p.id}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, query, typeFilter]);

  const stats = React.useMemo(() => {
    let houses = 0;
    let apartments = 0;
    let garages = 0;
    let totalValue = 0;

    for (const p of filteredRows) {
      if (p.type === "HOUSE") houses += 1;
      else if (p.type === "APARTMENT") apartments += 1;
      else garages += 1;

      const price = Number(finance[p.id]?.purchase_price ?? 0);
      if (!Number.isNaN(price)) totalValue += price;
    }

    return { houses, apartments, garages, totalValue };
  }, [filteredRows, finance]);

  const goToProperty = React.useCallback(
    (p: PortfolioProperty) => {
      // Your router will redirect index -> address automatically
      navigate(`/portfolio/${encodeURIComponent(p.id)}`);
    },
    [navigate]
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Visible mount marker (helps when "it doesn't load") */}
      <div style={{ padding: 10, borderRadius: 12, background: "gold", fontWeight: 900 }}>
        PORTFOLIO MOUNTED ✅
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}>
          <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em" }}>Portfolio</h1>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Übersicht über alle Objekte (Haus / Wohnungen / Garagen) inkl. Kennzahlen.
          </div>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Lädt…" : "Aktualisieren"}
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen (Name / Typ / ID)"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontWeight: 800,
            width: 320,
            maxWidth: "100%",
          }}
        />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontWeight: 800,
            background: "white",
          }}
        >
          <option value="ALL">Alle Typen</option>
          <option value="HOUSE">Haus</option>
          <option value="APARTMENT">Wohnung</option>
          <option value="GARAGE">Garage</option>
        </select>

        <div style={{ fontSize: 12, opacity: 0.65, marginLeft: "auto" }}>
          {loading ? "…" : `${filteredRows.length} von ${rows.length} Objekten`}
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div
          style={{
            padding: 12,
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

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <KpiCard title="Gesamtwert Portfolio" value={fmtEUR(stats.totalValue)} hint="Summe Kaufpreise (Finance)" />
        <KpiCard title="Häuser" value={`${stats.houses}`} hint="Gefilterte Ansicht" />
        <KpiCard title="Wohnungen" value={`${stats.apartments}`} hint="Gefilterte Ansicht" />
        <KpiCard title="Garagen" value={`${stats.garages}`} hint="Gefilterte Ansicht" />
      </div>

      {/* List */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "white", overflow: "hidden" }}>
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900 }}>Objekte</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>Klick auf ein Objekt → Detailseiten</div>
        </div>

        {loading ? (
          <div style={{ padding: 14, opacity: 0.7 }}>Lädt Objekte…</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>
            Keine Objekte gefunden.  
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Öffne die Console und suche nach: <b>[Portfolio] properties query result</b>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, padding: 14 }}>
            {filteredRows.map((p) => {
              const price = Number(finance[p.id]?.purchase_price ?? 0);
              const priceLabel = price > 0 ? fmtEUR(price) : "—";

              return (
                <button
                  key={p.id}
                  onClick={() => goToProperty(p)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    padding: 14,
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 10px 24px rgba(17,24,39,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{p.name}</div>
                    <span style={typeBadgeStyle()}>{typeLabel(p.type)}</span>

                    <div style={{ marginLeft: "auto", fontWeight: 950 }}>{priceLabel}</div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                    ID:{" "}
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{p.id}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "white", padding: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 950, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>{hint}</div>
    </div>
  );
}
