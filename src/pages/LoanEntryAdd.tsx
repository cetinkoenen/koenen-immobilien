// src/pages/LoanEntryAdd.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { normalizeUuid } from "../lib/ids";

type PropertyRow = { id: string; name: string };

function toNumberOrNull(v: string): number | null {
  // Accept: "1.234,56" or "1234,56" or "1234.56"
  const s = (v ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
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
  };
}

export default function LoanEntryAdd() {
  const { id } = useParams(); // property_id in route
  const rawPropertyId = (id ?? "").trim();
  const safePropertyId = useMemo(() => normalizeUuid(rawPropertyId), [rawPropertyId]);

  const navigate = useNavigate();

  const [prop, setProp] = useState<PropertyRow | null>(null);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());

  const [interest, setInterest] = useState("");
  const [principal, setPrincipal] = useState("");
  const [balance, setBalance] = useState("");
  const [source, setSource] = useState("manual");

  const [saving, setSaving] = useState(false);
  const [loadingProp, setLoadingProp] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse numbers once
  const parsed = useMemo(() => {
    return {
      interest: toNumberOrNull(interest),
      principal: toNumberOrNull(principal),
      balance: toNumberOrNull(balance),
    };
  }, [interest, principal, balance]);

  // canonical back link
  const backHref = safePropertyId
    ? `/darlehensuebersicht/${safePropertyId}`
    : "/darlehensuebersicht";

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingProp(true);
      setError(null);
      setProp(null);

      if (!safePropertyId) {
        setError("Ungültige Immobilien-ID in der URL (keine UUID).");
        setLoadingProp(false);
        return;
      }

      try {
        // ✅ IMPORTANT: only query the single property that matches the route param
        const { data, error } = await supabase
          .from("properties")
          .select("id,name")
          .eq("id", safePropertyId)
          .maybeSingle();

        if (!alive) return;

        if (error) throw error;

        const found = (data as PropertyRow | null) ?? null;

        // ✅ Important: show clear error if ID is from the wrong "world"
        if (!found) {
          setError(
            "Immobilie nicht gefunden. Diese ID existiert nicht in 'properties'. " +
              "Wenn du aus dem Portfolio kommst: Portfolio-IDs (portfolio_properties.id) dürfen hier nicht verwendet werden."
          );
          setProp(null);
        } else {
          setProp(found);
        }
      } catch (e: unknown) {
        if (!alive) return;
        console.error("LoanEntryAdd load property failed:", e);
        setError(e instanceof Error ? e.message : String(e));
        setProp(null);
      } finally {
        if (alive) setLoadingProp(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [safePropertyId]);

  async function ensureLoanId(pid: string): Promise<string> {
    // 1) newest loan for property
    const { data: existing, error: e1 } = await supabase
      .from("property_loans")
      .select("id,created_at")
      .eq("property_id", pid)
      .order("created_at", { ascending: false })
      .limit(1);

    if (e1) throw e1;

    const current = (existing ?? [])[0]?.id as string | undefined;
    if (current) return current;

    // 2) create loan
    const { data: created, error: e2 } = await supabase
      .from("property_loans")
      .insert({ property_id: pid })
      .select("id")
      .limit(1);

    if (e2) throw e2;

    const newId = (created ?? [])[0]?.id as string | undefined;
    if (!newId) throw new Error("Konnte loan_id nicht erzeugen.");
    return newId;
  }

  function validate(): string | null {
    if (!safePropertyId) return "Ungültige property_id (keine UUID).";
    if (!prop?.id) {
      return (
        "Kann nicht speichern: Immobilie existiert nicht in 'properties' " +
        "(falsche ID oder falscher Entry-Pfad)."
      );
    }
    if (!year || !Number.isFinite(year)) return "Bitte Jahr prüfen.";

    const nums: Array<[string, string]> = [
      ["Zinsen", interest],
      ["Tilgung", principal],
      ["Saldo", balance],
    ];
    for (const [label, raw] of nums) {
      if (raw.trim() && toNumberOrNull(raw) === null) {
        return `${label} muss eine Zahl sein (z.B. 1.234,56).`;
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

    setSaving(true);
    setError(null);

    try {
      const pid = safePropertyId; // safe because validate() checked it

      const loanId = await ensureLoanId(pid);

      // Upsert in property_loan_ledger über UNIQUE(property_id, year)
      const payload = {
        loan_id: loanId,
        property_id: pid,
        year,
        interest: parsed.interest ?? 0,
        principal: parsed.principal ?? 0,
        balance: parsed.balance ?? 0,
        source,
      };

      /**
       * FIX (wie von dir gewünscht):
       * Statt upsert(payload, { onConflict: "property_id,year" })
       * machen wir: SELECT -> UPDATE oder INSERT.
       */
      const { data: existing, error: selErr } = await supabase
        .from("property_loan_ledger")
        .select("id") // oder PK-Spalte, falls anders
        .eq("property_id", pid)
        .eq("year", year)
        .maybeSingle();

      if (selErr) throw selErr;

      if (existing) {
        const { error: updErr } = await supabase
          .from("property_loan_ledger")
          .update(payload)
          .eq("property_id", pid)
          .eq("year", year);

        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("property_loan_ledger")
          .insert(payload);

        if (insErr) throw insErr;
      }

      // optional: zurück zur Übersicht oder einfach Meldung
      navigate(backHref);
    } catch (e: unknown) {
      console.error("LoanEntryAdd save failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || !safePropertyId || !prop;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          to={backHref}
          style={{
            textDecoration: "none",
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            color: "inherit",
          }}
        >
          ← Zurück
        </Link>
      </div>

      <div
        style={{
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>Darlehenszeile hinzufügen</div>

        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
          Objekt:{" "}
          <span style={{ fontWeight: 900 }}>
            {prop ? prop.name : loadingProp ? "Lädt…" : "—"}
          </span>
        </div>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
            Fehler: {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 14, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Jahr</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={disabled}
              style={inputStyle(disabled)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Zinsen</span>
            <input
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="z.B. 1.234,56"
              disabled={disabled}
              style={inputStyle(disabled)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Tilgung</span>
            <input
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="z.B. 3.000,00"
              disabled={disabled}
              style={inputStyle(disabled)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Saldo</span>
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="z.B. 95.000,00"
              disabled={disabled}
              style={inputStyle(disabled)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>Quelle</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={disabled}
              style={inputStyle(disabled)}
            >
              <option value="manual">manual</option>
              <option value="import">import</option>
              <option value="seed">seed</option>
            </select>
          </label>

          <button
            onClick={save}
            disabled={disabled}
            style={{
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#111827",
              color: "white",
              fontWeight: 900,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
