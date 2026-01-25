// src/pages/Objekte.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

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
 * EXTREM robust: erkennt "core-shadow" in allen realistischen Schreibweisen
 * (auch Unicode-Dash, underscores, Klammerzusätze, etc.)
 */
function isCoreShadowName(name: string) {
  const s = String(name ?? "");
  // "core" + beliebige Trennzeichen/Whitespace/Underscore/Dash/Unicode-Dash + "shadow"
  return /core[\s\W_]*shadow/i.test(s);
}

/**
 * Entfernt core-shadow Marker in allen Varianten:
 * - "(...core—shadow...)" komplette Klammer raus
 * - standalone "core-shadow"/"core shadow"/"core_shadow" raus
 * - Whitespace clean
 */
function stripCoreShadow(name: string) {
  let s = String(name ?? "");

  // Entferne Klammerzusätze, die core-shadow enthalten
  s = s.replace(/\s*\([^)]*core[\s\W_]*shadow[^)]*\)\s*/gi, " ");

  // Entferne standalone Tokens
  s = s.replace(/\bcore[\s\W_]*shadow\b/gi, " ");

  // Whitespace säubern
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Sehr robuste Normalisierung:
 * - Unicode vereinheitlichen (NFKC)
 * - unsichtbare Whitespaces entfernen
 * - ß/ä/ö/ü
 * - alle Dash-Varianten, Interpunktion -> Space
 * - "..." und "…" entfernen
 * - straße/strasse/str. -> str
 * - zusammengesetztes "...strasse" -> "... str"
 * - entfernt PLZ+Rest am Ende (z.B. "28211 Bremen", "70174 Stuttgart", "D-28211 Bremen")
 */
function normalizeKey(input: string) {
  let s = String(input ?? "").normalize("NFKC").toLowerCase();

  // Unsichtbare Whitespaces (NBSP, Zero-Width, etc.)
  s = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ");

  // Ellipsis Varianten
  s = s.replace(/…/g, " ");
  s = s.replace(/\.{3,}/g, " ");

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
 * City am Ende extrahieren
 */
function extractCity(raw: string) {
  const s = String(raw ?? "").normalize("NFKC").trim();

  // "70174 Stuttgart" oder "28211 Bremen"
  let m = s.match(/\b\d{4,5}\s+([A-Za-zÄÖÜäöüß\- ]+)\s*$/);
  if (m?.[1]) return m[1].trim().toLowerCase();

  // "... Stuttgart" (ohne PLZ)
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
 * - City am Ende entfernen
 * - Hausnummer am Ende entfernen
 */
function baseStreetKey(name: string) {
  let s = normalizeKey(name);

  const city = extractCity(name);
  if (city) {
    const cityNorm = normalizeKey(city);
    s = s.replace(new RegExp(`\\s+${cityNorm}$`), "").trim();
  }

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
  const rawName = String(r.property_name ?? "");
  const cleanName = stripCoreShadow(rawName);

  // Shadow soll NIE gewinnen, wenn ein echter Datensatz existiert
  const shadowPenalty = isCoreShadowName(rawName) ? -1000 : 0;

  return (hasHouseNumber(cleanName) ? 100 : 0) + (looksIncomplete(cleanName) ? -50 : 0) + score(r) + shadowPenalty;
}

/** Testdaten filtern (Frontend) */
function isTestPropertyName(name: string) {
  const n = String(name ?? "").trim().toLowerCase();
  if (!n) return true;

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
        .from("vw_property_loan_dashboard_display")
        .select(
          "property_id, property_name, first_year, last_year, last_balance_year, last_balance, interest_total, principal_total"
        )
        .order("property_name", { ascending: true });

      if (error) throw error;

      const incoming = (data ?? []) as Row[];
      setRowsRaw(incoming);

      // 1) Testdaten raus
      const cleaned = incoming.filter((r) => !isTestPropertyName(r.property_name));

      // 2) Dedupe über normalizeKey (streng) – auf BEREINIGTEM Namen
      const byKey = new Map<string, Row>();
      for (const r of cleaned) {
        const cleanName = stripCoreShadow(r.property_name || "");
        const k = normalizeKey(cleanName);
        const prev = byKey.get(k);
        if (!prev || betterScore(r) > betterScore(prev)) byKey.set(k, r);
      }
      let unique = Array.from(byKey.values());

      // 3) Zweites Dedupe/Drop: unvollständige Zeilen droppen (city-aware)
      const bestByBaseCityBucket = new Map<string, Row>();

      for (const r of unique) {
        const cleanName = stripCoreShadow(r.property_name || "");
        const base = baseStreetKey(cleanName);
        const city = extractCity(cleanName);
        const bucket = `${base}__${city}`;

        const prev = bestByBaseCityBucket.get(bucket);
        if (!prev || betterScore(r) > betterScore(prev)) bestByBaseCityBucket.set(bucket, r);
      }

      unique = unique.filter((r) => {
        const cleanName = stripCoreShadow(r.property_name || "");

        const base = baseStreetKey(cleanName);
        const city = extractCity(cleanName);

        const rIsIncomplete = !hasHouseNumber(cleanName) || looksIncomplete(cleanName);
        if (!rIsIncomplete) return true;

        const candidates: Row[] = [];
        for (const [bucket, best] of bestByBaseCityBucket.entries()) {
          const [b, c] = bucket.split("__");
          if (b !== base) continue;

          if (city) {
            if (c === city || c === "") candidates.push(best);
          } else {
            candidates.push(best);
          }
        }

        if (candidates.length === 0) return true;

        const best = candidates.reduce((acc, cur) => (betterScore(cur) > betterScore(acc) ? cur : acc));

        return best.property_id === r.property_id;
      });

      unique.sort((a, b) => {
        const an = stripCoreShadow(a.property_name ?? "");
        const bn = stripCoreShadow(b.property_name ?? "");
        return an.localeCompare(bn, "de");
      });

      setRowsUnique(unique);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rowsUnique.filter((r) => {
      const rawName = String(r.property_name ?? "");

      // ✅ HARDFILTER: core-shadow IMMER raus
      if (isCoreShadowName(rawName)) return false;

      if (hideZeroBalance) {
        const b = Number(r.last_balance ?? 0);
        if (!Number.isFinite(b) || b <= 0) return false;
      }

      if (!q) return true;
      return `${stripCoreShadow(rawName)} ${r.property_id}`.toLowerCase().includes(q);
    });
  }, [rowsUnique, query, hideZeroBalance]);

  const total = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.last_balance ?? 0) || 0), 0),
    [filtered]
  );

  if (loading) return <div style={{ padding: 16 }}>Lädt…</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
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
          <div style={{ fontSize: 12, opacity: 0.6 }}>Letzter gespeicherter Stand je Immobilie</div>

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
          const rawName = String(r.property_name ?? "");
          const displayName = stripCoreShadow(rawName);

          const base = baseStreetKey(displayName);
          const city = extractCity(displayName);
          const key = normalizeKey(displayName);

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
                <div style={{ fontWeight: 900 }}>{displayName}</div>

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
                    raw: {JSON.stringify(rawName)}
                    <br />
                    isShadow: {String(isCoreShadowName(rawName))}
                    <br />
                    key: {key}
                    <br />
                    base: {base}
                    <br />
                    city: {city || "—"}
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
