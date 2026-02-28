import { devLog } from "@/lib/devLog";
// src/pages/Objekte.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Row = {
  property_id: string;
  property_name: string;
  first_year: number | null;
  last_year: number | null;
  last_balance_year: number | null;
  last_balance: number | null;
  interest_total: number | null;
  principal_total: number | null;
};

function euro(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

function yearOrDash(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

/**
 * Sehr robuste Normalisierung:
 * - Unicode vereinheitlichen (NFKC)
 * - unsichtbare Whitespaces entfernen
 * - ß/ä/ö/ü
 * - alle Dash-Varianten, Interpunktion -> Space
 * - "..." und "…" entfernen
 * - straße/strasse/str. -> str
 * - zusammengesetztes "...strasse" -> "... str" (wichtig für rosensteinstrasse)
 * - entfernt PLZ+Rest am Ende (z.B. "28211 Bremen", "70174 Stuttgart", "D-28211 Bremen")
 */
function normalizeKey(input: string) {
  let s = String(input ?? "").normalize("NFKC").toLowerCase();

  // Unsichtbare Whitespaces (NBSP, Zero-Width, etc.)
  s = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ");

  // Ellipsis Varianten
  s = s.replace(/…/g, " ");
  s = s.replace(/\.{3,}/g, " "); // "..." -> Space

  // Deutsche Sonderzeichen
  s = s.replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");

  // Zusammengesetzte "...strasse" trennen
  s = s.replace(/strasse/g, " str");

  // Dashes / Minus / Gedankenstriche
  s = s.replace(/[‐-‒–—−]/g, " ");

  // Interpunktion + Quotes
  s = s.replace(/[.,;:()_\/"'’“”]/g, " ");

  // Straße vereinheitlichen
  s = s
    .replace(/\bstraße\b/g, "str")
    .replace(/\bstrasse\b/g, "str")
    .replace(/\bstr\.\b/g, "str")
    .replace(/\bstr\b/g, "str");

  // PLZ + Rest am Ende entfernen (4/5-stellig, optional D-)
  s = s.replace(/\s+(?:d-?)?\d{4,5}\s+.*$/g, "");

  // Whitespace normalisieren
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/** Heuristik: hat Hausnummer? */
function hasHouseNumber(name: string) {
  return /\b\d{1,4}\s*[a-z]?\b/i.test(String(name ?? ""));
}

/** Heuristik: wirkt unvollständig? (… oder ...) */
function looksIncomplete(name: string) {
  return /\.{3,}|…/.test(String(name ?? ""));
}

/**
 * City am Ende extrahieren (ohne hartes Bremen!)
 * - erkennt "70174 Stuttgart" und "Stuttgart"
 * - wenn nix sicher: "" (unknown)
 */
function extractCity(raw: string) {
  const s = String(raw ?? "").normalize("NFKC").trim();

  // Fall: "70174 Stuttgart" oder "28211 Bremen"
  let m = s.match(/\b\d{4,5}\s+([A-Za-zÄÖÜäöüß\- ]+)\s*$/);
  if (m?.[1]) return m[1].trim().toLowerCase();

  // Fall: "... Stuttgart" (ohne PLZ)
  m = s.match(/\s([A-Za-zÄÖÜäöüß\- ]+)\s*$/);
  if (m?.[1]) {
    const city = m[1].trim().toLowerCase();
    if (city.length >= 3) return city;
  }

  return "";
}

/**
 * Base-Key für Merge:
 * - normalizeKey
 * - Hausnummer am Ende entfernen
 * => so matchen "Hohenloher Str. 78" und "Hohenloher Str. ... Stuttgart" über base
 */
function baseStreetKey(name: string) {
  // 1) normalisieren
  let s = normalizeKey(name);

  // 2) wenn City erkannt wird, City am Ende abschneiden
  //    (wichtig: macht "rosenstein str bremen" -> "rosenstein str")
  const city = extractCity(name);
  if (city) {
    // normalizeKey auf city anwenden, damit "Stuttgart" exakt gleich behandelt wird
    const cityNorm = normalizeKey(city);
    s = s.replace(new RegExp(`\\s+${cityNorm}$`), "").trim();
  }

  // 3) Hausnummer am Ende entfernen (macht "str 78" -> "str")
  s = s.replace(/\s+\d{1,4}\s*[a-z]?\b$/i, "").trim();

  return s;
}

/** Bevorzuge Zeile mit mehr echten Daten */
function score(r: Row) {
  return (
    (r.last_balance != null ? 10 : 0) +
    (r.last_balance_year != null ? 5 : 0) +
    (r.last_year != null ? 2 : 0) +
    (r.interest_total != null ? 1 : 0) +
    (r.principal_total != null ? 1 : 0)
  );
}

/** "Besser"-Score fürs Merge/Drop */
function betterScore(r: Row) {
  const name = r.property_name ?? "";
  return (hasHouseNumber(name) ? 100 : 0) + (looksIncomplete(name) ? -50 : 0) + score(r);
}

/** Testdaten filtern (Frontend) */
function isTestPropertyName(name: string) {
  const n = String(name ?? "").trim().toLowerCase();
  if (!n) return true;

  // Sehr gezielt (du kannst hier später anpassen)
  if (n.startsWith("rls test")) return true;
  if (n.startsWith("trigger test")) return true;
  if (n.includes(" rls ")) return true;
  if (n.includes(" trigger ")) return true;

  return false;
}

export default function Objekte() {
  const [rowsRaw, setRowsRaw] = useState<Row[]>([]);
  const [rowsUnique, setRowsUnique] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [hideZeroBalance, setHideZeroBalance] = useState(false);
  const [showIds, setShowIds] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("vw_property_loan_dashboard_display_v4")
        .select(
          "property_id, property_name, first_year, last_year, last_balance_year, last_balance, interest_total, principal_total"
        )
        .order("property_name", { ascending: true });

      if (error) throw error;

      const incoming = (data ?? []) as Row[];
      setRowsRaw(incoming);

      // 1) Testdaten raus
      const cleaned = incoming.filter((r) => !isTestPropertyName(r.property_name));

      // 2) Erstes Dedupe über normalizeKey (streng)
      const byKey = new Map<string, Row>();
      for (const r of cleaned) {
        const k = normalizeKey(r.property_name || "");
        const prev = byKey.get(k);
        if (!prev || betterScore(r) > betterScore(prev)) byKey.set(k, r);
      }
      let unique = Array.from(byKey.values());

      // 3) Zweites Dedupe/Drop: unvollständige Zeilen droppen,
      //    wenn es eine bessere Zeile mit gleicher BASE gibt (city-aware!)
      //
      // City-Regel:
      // - Wenn beide City bekannt: nur matchen wenn gleich
      // - Wenn eine City unknown: darf matchen (unknown passt zu allem)
      const bestByBaseCityBucket = new Map<string, Row>();

      for (const r of unique) {
        const base = baseStreetKey(r.property_name || "");
        const city = extractCity(r.property_name || ""); // "" möglich
        const bucket = `${base}__${city}`;

        const prev = bestByBaseCityBucket.get(bucket);
        if (!prev || betterScore(r) > betterScore(prev)) bestByBaseCityBucket.set(bucket, r);
      }

      unique = unique.filter((r) => {
        const name = r.property_name || "";
        const base = baseStreetKey(name);
        const city = extractCity(name); // "" möglich

        const rIsIncomplete = !hasHouseNumber(name) || looksIncomplete(name);
        if (!rIsIncomplete) return true;

        // finde "best" Kandidaten für gleiche base, city-kompatibel
        const candidates: Row[] = [];
        for (const [bucket, best] of bestByBaseCityBucket.entries()) {
          const [b, c] = bucket.split("__");
          if (b !== base) continue;

          // city kompatibel?
          // - r.city bekannt: candidate.city muss gleich sein ODER candidate.city unknown
          // - r.city unknown: candidate darf jede city haben
          if (city) {
            if (c === city || c === "") candidates.push(best);
          } else {
            candidates.push(best);
          }
        }

        if (candidates.length === 0) return true;

        // best candidate wählen
        const best = candidates.reduce((acc, cur) => (betterScore(cur) > betterScore(acc) ? cur : acc));

        // wenn es einen anderen besseren Datensatz gibt -> droppen
        if (best.property_id !== r.property_id) return false;

        return true;
      });

      unique.sort((a, b) => (a.property_name ?? "").localeCompare(b.property_name ?? "", "de"));
      setRowsUnique(unique);

      devLog("Objekte loaded — raw:", incoming.length, "cleaned:", cleaned.length, "shown:", unique.length);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Unbekannter Fehler beim Laden.");
      setRowsRaw([]);
      setRowsUnique([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rowsUnique.filter((r) => {
      if (hideZeroBalance) {
        const b = Number(r.last_balance ?? 0);
        if (!Number.isFinite(b) || b <= 0) return false;
      }
      if (!q) return true;
      return `${r.property_name} ${r.property_id}`.toLowerCase().includes(q);
    });
  }, [rowsUnique, query, hideZeroBalance]);

  const total = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.last_balance ?? 0) || 0), 0),
    [filtered]
  );

  if (loading) return <div style={{ padding: 16 }}>Lädt…</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
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
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Darlehensübersicht</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Letzter gespeicherter Stand je Immobilie
          </div>

          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
            raw={rowsRaw.length} · unique={rowsUnique.length} · shown={filtered.length}
          </div>

          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
              Fehler: {error}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.6 }}>Gesamtdarlehen (gefiltert)</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{euro(total)}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
            Zeilen: <b>{filtered.length}</b>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen (Name / ID)"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontWeight: 800,
            width: 360,
            maxWidth: "100%",
          }}
        />

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}>
          <input type="checkbox" checked={hideZeroBalance} onChange={(e) => setHideZeroBalance(e.target.checked)} />
          Nur mit Saldo &gt; 0
        </label>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}>
          <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} />
          IDs anzeigen
        </label>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}>
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          Debug
        </label>

        <button
          onClick={() => void load()}
          style={{
            marginLeft: "auto",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Aktualisieren
        </button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "white",
            fontSize: 14,
            opacity: 0.8,
          }}
        >
          Keine Ergebnisse.
        </div>
      ) : (
        filtered.map((r) => {
          const base = baseStreetKey(r.property_name || "");
          const city = extractCity(r.property_name || "");
          const key = normalizeKey(r.property_name || "");

          return (
            <Link
              key={r.property_id}
              to={`/darlehensuebersicht/${r.property_id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 16,
                background: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900 }}>{r.property_name}</div>

                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  Zeitraum: {yearOrDash(r.first_year)}–{yearOrDash(r.last_year)} (Stand:{" "}
                  {yearOrDash(r.last_balance_year)})
                </div>

                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  Zinsen gesamt: {euro(r.interest_total)} · Tilgung gesamt: {euro(r.principal_total)}
                </div>

                {showIds && (
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, fontFamily: "monospace" }}>
                    ID: {r.property_id}
                  </div>
                )}

                {showDebug && (
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, fontFamily: "monospace" }}>
                    key: {key}
                    <br />
                    base: {base}
                    <br />
                    city: {city || "—"}
                    <br />
                    raw: {JSON.stringify(r.property_name)}
                  </div>
                )}
              </div>

              <div style={{ fontWeight: 900, whiteSpace: "nowrap" }}>{euro(r.last_balance)}</div>
            </Link>
          );
        })
      )}
    </div>
  );
}
