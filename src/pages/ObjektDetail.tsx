// src/pages/ObjektDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type SummaryRow = {
  property_id: string;
  property_name: string;
  first_year: number | null;
  last_year: number | null;
  last_balance_year: number | null;
  last_balance: number | null;
  interest_total: number | null;
  principal_total: number | null;
};

type LedgerRow = {
  id: number;
  property_id: string;
  property_name: string;
  year: number;
  interest: number | null;principal: number | null;balance: number | null;
  source?: string | null;
};

type ProgressRow = {
  property_id: string;
  initial_balance: number | null;
  current_balance: number | null;
  repaid_percent: number | null; // 0..100
};

/** ---------- Helpers ---------- */

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normalizeUuid(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  return isUuid(v) ? v : "";
}

function euro(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

function yearOrDash(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (!s || s === "—" || s.toLowerCase() === "null") return "—";
  return s;
}

function pill(text: string, tone: "gray" | "green" | "yellow" | "red") {
  const bg =
    tone === "green"
      ? "#dcfce7"
      : tone === "yellow"
      ? "#fef9c3"
      : tone === "red"
      ? "#fee2e2"
      : "#f3f4f6";
  const fg =
    tone === "green"
      ? "#166534"
      : tone === "yellow"
      ? "#854d0e"
      : tone === "red"
      ? "#991b1b"
      : "#374151";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function computeStatus(progress?: ProgressRow | null) {
  const rp = progress?.repaid_percent;
  const cb = progress?.current_balance;
  const ib = progress?.initial_balance;

  if (rp == null && cb == null && ib == null) return { label: "no_data", tone: "gray" as const };
  if ((cb != null && cb <= 0) || (rp != null && rp >= 99.5)) return { label: "healthy", tone: "green" as const };

  if (rp != null) {
    if (rp < 10) return { label: "critical", tone: "red" as const };
    if (rp < 40) return { label: "warning", tone: "yellow" as const };
    return { label: "healthy", tone: "green" as const };
  }

  return { label: "healthy", tone: "green" as const };
}

/** ---------- Component ---------- */

export default function ObjektDetail() {
const { id } = useParams();
  const navigate = useNavigate();

  // raw id from URL (might be "undefined")
  const rawPropertyId = (id ?? "").trim();

  // safe UUID only
  const safePropertyId = useMemo(() => normalizeUuid(rawPropertyId), [rawPropertyId]);

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      // ✅ Critical change: never query with invalid uuid
      if (!safePropertyId) {
        setError("Ungültige Immobilien-ID in der URL (keine UUID).");
        setSummary(null);
        setLedger([]);
        setProgress(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Summary (V2 View)
      const { data: sData, error: sErr } = await supabase
        .from("vw_property_loan_dashboard_display_v2")
        .select(
          "property_id, property_name, first_year, last_year, last_balance_year, last_balance, interest_total, principal_total"
        )
        .eq("property_id", safePropertyId)
        .maybeSingle();

      if (!alive) return;

      if (sErr) {
        console.error(sErr);
        setError(sErr.message);
        setSummary(null);
        setLedger([]);
        setProgress(null);
        setLoading(false);
        return;
      }

      setSummary((sData as SummaryRow) ?? null);

      // Ledger
      const { data: lData, error: lErr } = await supabase
        .from("property_loan_ledger")
        .select("id, property_id, year, interest, principal, balance, source")
        .eq("property_id", safePropertyId)
        .order("year", { ascending: true });

      if (!alive) return;

      if (lErr) {
        console.error(lErr);
        setError((prev) => prev ?? lErr.message);
        setLedger([]);
      } else {
        setLedger((lData ?? []) as LedgerRow[]);
      }

      // Progress
      const { data: pData, error: pErr } = await supabase
        .from("vw_property_loan_progress")
        .select("property_id, initial_balance, current_balance, repaid_percent")
        .eq("property_id", safePropertyId)
        .maybeSingle();

      if (!alive) return;

      if (pErr) {
        console.warn(pErr);
        setProgress(null);
      } else {
        setProgress((pData as ProgressRow) ?? null);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [safePropertyId]);

  const status = useMemo(() => computeStatus(progress), [progress]);

  const repaidDisplay = useMemo(() => {
    const rp = progress?.repaid_percent;
    if (rp == null || Number.isNaN(rp)) return "—";
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rp) + " %";
  }, [progress]);
  const ledgerTotals = useMemo(() => {
    if (!ledger.length) {
      return {
        last_balance: summary?.last_balance ?? null,
        interest_total: summary?.interest_total ?? null,
        principal_total: summary?.principal_total ?? null,
      };
    }

    const interest_total = ledger.reduce((acc, r) => acc + (Number(r.interest ?? 0) || 0), 0);
    const principal_total = ledger.reduce((acc, r) => acc + (Number(r.principal ?? 0) || 0), 0);

    // last balance = row with max(year), tie-break by max(id)
    const last = [...ledger].sort((a, b) => {
      const ya = Number(a.year ?? 0), yb = Number(b.year ?? 0);
      if (yb !== ya) return yb - ya;
      return (Number(b.id ?? 0) || 0) - (Number(a.id ?? 0) || 0);
    })[0];

    return {
      last_balance: last?.balance ?? null,
      interest_total,
      principal_total,
    };
  }, [ledger, summary]);


  const kpis = useMemo(() => {
    return [
      { label: "Letzter Saldo", value: euro(ledgerTotals.last_balance) },
      { label: "Zinsen gesamt", value: euro(ledgerTotals.interest_total) },
      { label: "Tilgung gesamt", value: euro(ledgerTotals.principal_total) },
    ];
  }, [summary]);

  const hasAnyLoanData =
    (summary?.last_balance ?? null) !== null ||
    (summary?.interest_total ?? null) !== null ||
    (summary?.principal_total ?? null) !== null ||
    (summary?.first_year ?? null) !== null ||
    ledger.length > 0;

  const showSeedHint = useMemo(() => {
    if (!hasAnyLoanData) return false;
    if (ledger.length !== 1) return false;

    const r = ledger[0];
    const isSeed = (r.source ?? "").toLowerCase() === "seed";
    if (!isSeed) return false;

    const i = r.interest ?? 0;
    const p = r.principal ?? 0;
    const b = r.balance ?? 0;

    return i === 0 && p === 0 && b === 0;
  }, [hasAnyLoanData, ledger]);

  if (loading) return <div style={{ padding: 16 }}>Lädt…</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Link
          to="/darlehensuebersicht"
          style={{
            display: "inline-block",
            textDecoration: "none",
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            color: "inherit",
          }}
        >
          ← Zurück zur Darlehensübersicht
        </Link>

        <button
          onClick={() => navigate(`/darlehensuebersicht/${safePropertyId}/loan/new`)}
          disabled={!safePropertyId}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: !safePropertyId ? "not-allowed" : "pointer",
            opacity: !safePropertyId ? 0.6 : 1,
          }}
        >
          + Darlehenszeile hinzufügen
        </button>

        <button
          onClick={() => navigate(`/loan-import?property_id=${encodeURIComponent(safePropertyId)}`)}
          disabled={!safePropertyId}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: !safePropertyId ? "not-allowed" : "pointer",
            opacity: !safePropertyId ? 0.6 : 1,
          }}
        >
          Import (CSV)
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {pill(status.label, status.tone)}
          {pill(`Getilgt: ${repaidDisplay}`, "gray")}
        </div>
      </div>

      {/* Header */}
      <div
        style={{
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          background: "white",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{summary?.property_name ?? "Immobilie"}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Zeitraum: {yearOrDash(summary?.first_year)}–{yearOrDash(summary?.last_year)} · Stand:{" "}
            {yearOrDash(summary?.last_balance_year)}
          </div>
          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
              Fehler: {error}
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, opacity: 0.6, textAlign: "right" }}>
          <div>property_id</div>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
            {safePropertyId || "—"}
          </div>
          {/* Optional: helps debug if you ever land on /objekte/undefined */}
          {rawPropertyId && rawPropertyId !== safePropertyId && (
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.65 }}>
              raw: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{rawPropertyId}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {kpis.map((k) => (
          <div
            key={k.label}
            style={{
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              background: "white",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.6 }}>{k.label}</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* No data hint */}
      {!hasAnyLoanData && (
        <div
          style={{
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "white",
            fontSize: 14,
            opacity: 0.85,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Keine Darlehensdaten vorhanden</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Für diese Immobilie sind noch keine Darlehenswerte hinterlegt. Nutze „+ Darlehenszeile hinzufügen“ oder „Import
            (CSV)“.
          </div>
        </div>
      )}

      {/* Seed hint */}
      {showSeedHint && (
        <div
          style={{
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "#fffbeb",
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Platzhalter-Daten erkannt</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Diese Immobilie hat aktuell eine Seed-Zeile mit 0-Werten. Trage echte Werte ein oder importiere CSV, dann wird
            der Verlauf korrekt.
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div
        style={{
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          background: "white",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>Darlehensverlauf (Ledger)</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Zeilen: <span style={{ fontWeight: 900 }}>{ledger.length}</span>
          </div>
        </div>

        <div style={{ marginTop: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Jahr</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Zinsen</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Tilgung</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Saldo</th>
                <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Quelle</th>
              <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", whiteSpace: "nowrap" }}>Aktion</th>
</tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={`${e.property_id}-${e.year}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 900 }}>{e.year}</td>
                  <td style={{ padding: "10px 8px" }}>{euro(e.interest)}</td>
                  <td style={{ padding: "10px 8px" }}>{euro(e.principal)}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 900 }}>{euro(e.balance)}</td>
                  <td style={{ padding: "10px 8px", fontSize: 12, opacity: 0.75 }}>{e.source ?? "—"}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
  <button
    onClick={(ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      navigate(`/darlehensuebersicht/${encodeURIComponent(safePropertyId)}/loan/${encodeURIComponent(String(e.id))}/edit`);
    }}
    style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white" }}
  >
    Bearbeiten
  </button>
</td>
</tr>
              ))}

              {!ledger.length && (
                <tr>
                  <td colSpan={6} style={{ padding: "14px 8px", fontSize: 14, opacity: 0.75 }}>
                    Keine Ledger-Zeilen gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
