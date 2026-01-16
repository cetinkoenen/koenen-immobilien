// src/pages/portfolio/PortfolioDetails.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { normalizeUuid } from "../../lib/ids";
import type { PortfolioOutletContext } from "./PortfolioPropertyLayout";

/**
 * HINWEIS:
 * - Diese Datei ist so geschrieben, dass sie sicher kompiliert (keine fehlenden Klammern / try-catch Probleme).
 * - Spaltennamen im Update-Payload musst du ggf. an deine Tabelle anpassen.
 * - Standardmäßig wird aus "portfolio_properties" geladen/gespeichert (id = property_id).
 */

const PROPERTY_TABLE = "portfolio_properties";

type PropertyRow = {
  id: string;
  user_id?: string | null;

  // Häufige Felder (passe an deine DB an)
  name?: string | null;
  property_type?: string | null;
  description?: string | null;

  // Zahlen
  year_built?: number | null;
  living_area_m2?: number | null;
  plot_area_m2?: number | null;

  // Meta
  updated_at?: string | null;
};

function inputStyle(loading: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    outline: "none",
    opacity: loading ? 0.7 : 1,
    background: loading ? "rgba(0,0,0,0.03)" : "white",
  };
}

function labelStyle(): React.CSSProperties {
  return { display: "block", fontWeight: 600, marginBottom: 6 };
}

function sectionStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    background: "white",
  };
}

function toNumberOrNull(v: string): number | null {
  const trimmed = (v ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: string): number | null {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  const i = Math.trunc(n);
  return Number.isFinite(i) ? i : null;
}

export default function PortfolioDetails() {
  const outlet = useOutletContext<PortfolioOutletContext>();

  // In deinen anderen Seiten scheint portfolioId/ corePropertyId etc. zu existieren.
  // Wir verwenden hier primär die property-id (portfolio property id).
  const safePropertyId = useMemo(() => {
    // je nach deinem Routing kann es sein, dass portfolioId eigentlich die propertyId ist
    // oder corePropertyId die richtige id ist. Wir nehmen: corePropertyId > portfolioId.
    const candidate = String(outlet?.corePropertyId ?? outlet?.portfolioId ?? "").trim();
    return normalizeUuid(candidate);
  }, [outlet?.corePropertyId, outlet?.portfolioId]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Form state (Strings für Inputs, damit es nicht ständig NaN gibt)
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [description, setDescription] = useState("");

  const [yearBuilt, setYearBuilt] = useState("");
  const [livingArea, setLivingArea] = useState("");
  const [plotArea, setPlotArea] = useState("");

  const canUseId = Boolean(safePropertyId);

  const load = useCallback(async () => {
    setErrorMsg(null);
    setOkMsg(null);

    if (!canUseId) {
      setErrorMsg("Keine gültige Property-ID gefunden (UUID).");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(PROPERTY_TABLE)
        .select("id, name, property_type, description, year_built, living_area_m2, plot_area_m2, updated_at")
        .eq("id", safePropertyId)
        .maybeSingle();

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (!data) {
        // Wenn noch kein Datensatz existiert, kannst du hier optional einen anlegen.
        // Wir lassen das neutral und zeigen eine Info.
        setOkMsg("Kein Datensatz gefunden. Du kannst Werte eingeben und speichern.");
        return;
      }

      const row = data as PropertyRow;

      setName(row.name ?? "");
      setPropertyType(row.property_type ?? "");
      setDescription(row.description ?? "");

      setYearBuilt(row.year_built != null ? String(row.year_built) : "");
      setLivingArea(row.living_area_m2 != null ? String(row.living_area_m2) : "");
      setPlotArea(row.plot_area_m2 != null ? String(row.plot_area_m2) : "");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Unbekannter Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [canUseId, safePropertyId]);

  async function save() {
    setErrorMsg(null);
    setOkMsg(null);

    if (!canUseId) {
      setErrorMsg("Speichern nicht möglich: ungültige Property-ID (UUID).");
      return;
    }

    setSaving(true);
    try {
      // Passe dieses Payload an deine echten Spalten an:
      const payload: Partial<PropertyRow> = {
        id: safePropertyId, // falls du upsert machst
        name: name.trim() || null,
        property_type: propertyType.trim() || null,
        description: description.trim() || null,
        year_built: toIntOrNull(yearBuilt),
        living_area_m2: toNumberOrNull(livingArea),
        plot_area_m2: toNumberOrNull(plotArea),
      };

      // Variante A: Update (wenn Datensatz existiert)
      // Variante B: Upsert (wenn Datensatz ggf. neu ist)
      // -> Upsert ist oft bequemer (aber RLS/Constraints müssen passen).
      const { error } = await supabase
        .from(PROPERTY_TABLE)
        .upsert(payload, { onConflict: "id" })
        .eq("id", safePropertyId);

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setOkMsg("Gespeichert ✅");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Unbekannter Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2 style={{ margin: "8px 0 14px" }}>Portfolio – Details</h2>

      {!canUseId && (
        <div style={{ ...sectionStyle(), borderColor: "rgba(255,0,0,0.25)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Fehler</div>
          <div>Keine gültige UUID für die Property gefunden.</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
            Tipp: Prüfe, ob dein Routing/OutletContext die richtige ID liefert (corePropertyId vs. portfolioId).
          </div>
        </div>
      )}

      {(errorMsg || okMsg) && (
        <div
          style={{
            ...sectionStyle(),
            borderColor: errorMsg ? "rgba(255,0,0,0.25)" : "rgba(0,128,0,0.25)",
            background: errorMsg ? "rgba(255,0,0,0.04)" : "rgba(0,128,0,0.04)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{errorMsg ? "Fehler" : "Info"}</div>
          <div>{errorMsg ?? okMsg}</div>
        </div>
      )}

      <div style={sectionStyle()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Objekt-Details</div>

          <button
            onClick={() => void save()}
            disabled={loading || saving || !canUseId}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: saving ? "rgba(0,0,0,0.06)" : "white",
              cursor: loading || saving || !canUseId ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle()}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || saving}
              style={inputStyle(loading || saving)}
              placeholder="z.B. Wohnung Bremen"
            />
          </div>

          <div>
            <label style={labelStyle()}>Objektart</label>
            <input
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              disabled={loading || saving}
              style={inputStyle(loading || saving)}
              placeholder="z.B. Wohnung / Haus / Gewerbe"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle()}>Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || saving}
              style={{ ...inputStyle(loading || saving), minHeight: 110, resize: "vertical" }}
              placeholder="Kurzbeschreibung…"
            />
          </div>
        </div>
      </div>

      <div style={sectionStyle()}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Flächen & Baujahr</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle()}>Baujahr</label>
            <input
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              disabled={loading || saving}
              style={inputStyle(loading || saving)}
              placeholder="z.B. 1998"
              inputMode="numeric"
            />
          </div>

          <div>
            <label style={labelStyle()}>Wohnfläche (m²)</label>
            <input
              value={livingArea}
              onChange={(e) => setLivingArea(e.target.value)}
              disabled={loading || saving}
              style={inputStyle(loading || saving)}
              placeholder="z.B. 82.5"
              inputMode="decimal"
            />
          </div>

          <div>
            <label style={labelStyle()}>Grundstück (m²)</label>
            <input
              value={plotArea}
              onChange={(e) => setPlotArea(e.target.value)}
              disabled={loading || saving}
              style={inputStyle(loading || saving)}
              placeholder="z.B. 240"
              inputMode="decimal"
            />
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
          Property-ID: <code>{safePropertyId || "—"}</code>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => void load()}
          disabled={loading || saving || !canUseId}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: loading ? "rgba(0,0,0,0.06)" : "white",
            cursor: loading || saving || !canUseId ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Lädt…" : "Neu laden"}
        </button>
      </div>
    </div>
  );
}
