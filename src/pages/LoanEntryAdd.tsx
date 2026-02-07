// src/pages/LoanEntryAdd.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { normalizeUuid } from "../lib/ids";

type SummaryRow = {
  property_id: string;
  property_name: string;
};

function parseNumberOrNull(input: string): number | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const s0 = raw.replace(/\s+/g, "");
  const hasDot = s0.includes(".");
  const hasComma = s0.includes(",");

  let normalized = s0;

  if (hasDot && hasComma) {
    const lastDot = s0.lastIndexOf(".");
    const lastComma = s0.lastIndexOf(",");
    if (lastComma > lastDot) {
      normalized = s0.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s0.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    normalized = s0.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: disabled ? "#f9fafb" : "white",
    fontWeight: 800,
    opacity: disabled ? 0.85 : 1,
    width: "100%",
  };
}

async function ensureLoanId(propertyId: string): Promise<string> {
  const { data: existing, error: e1 } = await supabase
    .from("property_loans")
    .select("id,created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (e1) throw e1;

  const current = (existing ?? [])[0]?.id as string | undefined;
  if (current) return current;

  const { data: created, error: e2 } = await supabase
    .from("property_loans")
    .insert({ property_id: propertyId })
    .select("id")
    .single();

  if (e2) throw e2;
  return (created as { id: string }).id;
}

export default function LoanEntryAdd() {
  const { id, loanId } = useParams();
  const ledgerRowId = useMemo(() => {
    const n = Number(loanId);
    return Number.isFinite(n) ? n : null;
  }, [loanId]);
  const isEdit = ledgerRowId !== null;
  const navigate = useNavigate();

  const rawUrlId = useMemo(() => String(id ?? "").trim(), [id]);
  const safePropertyId = useMemo(() => normalizeUuid(rawUrlId), [rawUrlId]);

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [loadingProp, setLoadingProp] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [interest, setInterest] = useState("");
  const [principal, setPrincipal] = useState("");
  const [balance, setBalance] = useState("");
  const [source, setSource] = useState<"manual" | "import">("manual");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(
    () => ({
      interest: parseNumberOrNull(interest),
      principal: parseNumberOrNull(principal),
      balance: parseNumberOrNull(balance),
    }),
    [interest, principal, balance]
  );

  const backHref = safePropertyId
    ? `/darlehensuebersicht/${encodeURIComponent(safePropertyId)}`
    : "/darlehensuebersicht";

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingProp(true);
      setError(null);
      setSummary(null);

      if (!safePropertyId) {
        setError("Ungültige Immobilien-ID in der URL (keine UUID).");
        setLoadingProp(false);
        return;
      }

      try {
        const { data, error: e } = await supabase
          .from("vw_property_loan_dashboard_display")
          .select("property_id, property_name")
          .eq("property_id", safePropertyId)
          .maybeSingle();

        if (!alive) return;
        if (e) throw e;

        if (!data) {
          setError(
            "Immobilie nicht gefunden in 'vw_property_loan_dashboard_display'.\n" +
              "Das heißt: Die URL-ID ist zwar eine UUID, aber es gibt keine Loan-Daten/Zuordnung für diese property_id.\n" +
              `ID: ${safePropertyId}`
          );
          return;
        }

        setSummary(data as SummaryRow);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? err?.details ?? String(err));
      } finally {
        if (!alive) return;
        setLoadingProp(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [safePropertyId]);

  

  // If edit route: load existing ledger row and prefill form
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!safePropertyId) return;
      if (!summary) return;
      if (ledgerRowId === null) return;

      try {
        setError(null);

        const { data, error: e } = await supabase
          .from("property_loan_ledger")
          .select("id, property_id, year, interest, principal, balance, source")
          .eq("id", ledgerRowId)
          .single();

        if (!alive) return;
        if (e) throw e;
        if (!data) throw new Error("Ledger-Zeile nicht gefunden.");

        // Safety: ensure row belongs to this property
        if (String(data.property_id) !== String(safePropertyId)) {
          throw new Error(
            `Ledger-Zeile gehört nicht zu dieser Immobilie. row.property_id=${data.property_id}, url.property_id=${safePropertyId}`
          );
        }

        setYear(Number(data.year ?? new Date().getFullYear()));
        setInterest(String(data.interest ?? 0));
        setPrincipal(String(data.principal ?? 0));
        setBalance(String(data.balance ?? 0));
        const src = String(data.source ?? "manual").toLowerCase();
        setSource(src === "import" ? "import" : "manual");
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? err?.details ?? String(err));
      }
    })();

    return () => {
      alive = false;
    };
  }, [safePropertyId, summary, ledgerRowId]);
function validate(): string | null {
    if (!safePropertyId) return "Ungültige Immobilien-ID in der URL (keine UUID).";
    if (!summary) return "Immobilie ist noch nicht geladen.";
    if (!year || !Number.isFinite(year)) return "Jahr ist ungültig.";

    const fields: Array<[string, string]> = [
      ["Zinsen", interest],
      ["Tilgung", principal],
      ["Saldo", balance],
    ];

    for (const [label, raw] of fields) {
      if (raw.trim() && parseNumberOrNull(raw) === null) {
        return `${label} muss eine Zahl sein (z.B. 1.234,56 oder 1,234.56).`;
      }
    }
    return null;
  }

  async function save() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!summary) {
      setError("Immobilie ist noch nicht geladen.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const pid = summary.property_id;
      const loanId = await ensureLoanId(pid);

      const payload = {
        loan_id: loanId,
        property_id: pid,
        year,
        interest: parsed.interest ?? 0,
        principal: parsed.principal ?? 0,
        balance: parsed.balance ?? 0,
        source,
      };

            if (isEdit && ledgerRowId !== null) {
        const { error: updErr } = await supabase
          .from("property_loan_ledger")
          .update(payload)
          .eq("id", ledgerRowId);

        if (updErr) throw updErr;
      } else {
        const { error: upsertErr } = await supabase
          .from("property_loan_ledger")
          .upsert(payload, { onConflict: "property_id,year" });

        if (upsertErr) throw upsertErr;
      }
navigate(backHref);
    } catch (err: any) {
      console.error("LoanEntryAdd save failed:", err);
      setError(err?.message ?? err?.details ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || loadingProp || !safePropertyId || !summary;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Link to={backHref} style={{ fontWeight: 900, textDecoration: "none" }}>
          ← Zurück
        </Link>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{isEdit ? "Darlehen: Eintrag bearbeiten" : "Darlehen: Eintrag hinzufügen"}</div>
      </div>

      {loadingProp ? (
        <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>Lade Immobilie…</div>
      ) : summary ? (
        <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 900 }}>Immobilie</div>
          <div style={{ opacity: 0.9 }}>{summary.property_name}</div>
          <div style={{ opacity: 0.6, fontSize: 12 }}>property_id: {summary.property_id}</div>
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            marginBottom: 14,
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Jahr</div>
          <input
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            style={inputStyle(disabled)}
            disabled={disabled}
            inputMode="numeric"
          />
        </div>

        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Quelle</div>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            style={inputStyle(disabled)}
            disabled={disabled}
          >
            <option value="manual">manual</option>
            <option value="import">import</option>
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Zinsen</div>
          <input
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            style={inputStyle(disabled)}
            disabled={disabled}
            placeholder="z.B. 1.234,56"
          />
        </div>

        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Tilgung</div>
          <input
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            style={inputStyle(disabled)}
            disabled={disabled}
            placeholder="z.B. 1.234,56"
          />
        </div>

        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Saldo</div>
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            style={inputStyle(disabled)}
            disabled={disabled}
            placeholder="z.B. 123.456,78"
          />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button
          onClick={save}
          disabled={disabled}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: disabled ? "#e5e7eb" : "#111827",
            color: disabled ? "#6b7280" : "white",
            fontWeight: 900,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Speichere…" : "Speichern"}
        </button>

        <Link
          to={backHref}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            textDecoration: "none",
            fontWeight: 900,
            color: "#111827",
          }}
        >
          Abbrechen
        </Link>
      </div>
    </div>
  );
}
