// src/pages/LoanImport.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { normalizeUuid } from "../lib/ids";

/* ----------------------------- Types ----------------------------- */

type PropertyMini = {
  id: string;
  name: string;
};

type Parsed = {
  year: number;
  interest: number;
  principal: number;
  balance: number;
};

/* ----------------------------- Helpers ----------------------------- */

function parseNumber(v: string): number {
  const s = v.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function simpleCsvParse(csv: string): Parsed[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const out: Parsed[] = [];

  for (let i = 1; i < lines.length; i++) {
    const [year, interest, principal, balance] = lines[i].split(";");

    out.push({
      year: Number(year),
      interest: parseNumber(interest),
      principal: parseNumber(principal),
      balance: parseNumber(balance),
    });
  }

  return out.filter((r) => Number.isFinite(r.year));
}

/* ----------------------------- Component ----------------------------- */

export default function LoanImport() {
  const nav = useNavigate();
  const loc = useLocation();

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const rawPreselectId = qs.get("property_id") ?? "";
  const safePreselectId = useMemo(() => normalizeUuid(rawPreselectId), [rawPreselectId]);

  const [properties, setProperties] = useState<PropertyMini[]>([]);
  const [selectedId, setSelectedId] = useState<string>(safePreselectId);

  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<Parsed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ----------------------------- Load properties ----------------------------- */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("properties")
          .select("id,name")
          .eq("is_test", false)
          .order("name");

        if (!alive) return;
        if (error) throw error;

        setProperties((data ?? []) as PropertyMini[]);
      } catch (e: any) {
        if (!alive) return;
        console.error("LoanImport load properties failed:", e);
        setProperties([]);
        setError(e?.message ?? String(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ----------------------------- Parse CSV ----------------------------- */

  function doParse() {
    try {
      setError(null);
      setOk(null);
      const rows = simpleCsvParse(csvText);
      if (!rows.length) throw new Error("CSV enthält keine gültigen Daten.");
      setParsed(rows);
    } catch (e: any) {
      setParsed([]);
      setError(e?.message ?? String(e));
    }
  }

  /* ----------------------------- Save ----------------------------- */

  async function doSave() {
    if (!selectedId) {
      setError("Bitte eine Immobilie auswählen.");
      return;
    }
    if (!parsed.length) {
      setError("Keine Daten zum Importieren.");
      return;
    }

    setBusy(true);
    setError(null);
    setOk(null);

    try {
      // 1) Loan sicherstellen
      const { data: loans, error: e1 } = await supabase
        .from("property_loans")
        .select("id,created_at")
        .eq("property_id", selectedId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (e1) throw e1;

      let loanId = loans?.[0]?.id as string | undefined;

      if (!loanId) {
        const { data: created, error: e2 } = await supabase
          .from("property_loans")
          .insert({ property_id: selectedId })
          .select("id")
          .single();

        if (e2) throw e2;
        loanId = (created as any).id;
      }

      // 2) Ledger upsert
      for (const r of parsed) {
        const payload = {
          loan_id: loanId,
          property_id: selectedId,
          year: r.year,
          interest: r.interest,
          principal: r.principal,
          balance: r.balance,
          source: "import",
        };

        const { error: upErr } = await supabase
          .from("property_loan_ledger")
          .upsert(payload, { onConflict: "property_id,year" });

        if (upErr) throw upErr;
      }

      setOk(`Import erfolgreich (${parsed.length} Zeilen).`);
      setParsed([]);
      setCsvText("");
    } catch (e: any) {
      console.error("LoanImport save failed:", e);
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  /* ----------------------------- Render ----------------------------- */

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h2>Darlehen – CSV Import</h2>

      {error && (
        <div style={{ padding: 12, background: "#fee2e2", borderRadius: 10, fontWeight: 800 }}>
          {error}
        </div>
      )}
      {ok && (
        <div style={{ padding: 12, background: "#dcfce7", borderRadius: 10, fontWeight: 800 }}>
          {ok}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Immobilie</div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ padding: 10, width: "100%" }}
        >
          <option value="">— bitte wählen —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>CSV (Jahr;Zinsen;Tilgung;Saldo)</div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          style={{ width: "100%", padding: 10, fontFamily: "monospace" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={doParse} disabled={busy}>
          CSV prüfen
        </button>
        <button onClick={doSave} disabled={busy || !parsed.length}>
          Importieren
        </button>
        <button onClick={() => nav(-1)}>Zurück</button>
      </div>
    </div>
  );
}
