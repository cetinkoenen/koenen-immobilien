// src/pages/portfolio/PortfolioEnergy.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { normalizeUuid } from "../../lib/ids";

type PortfolioOutletContext = {
  corePropertyId?: string | null;
};

type Props = {
  /**
   * Optional: wenn PortfolioEnergy direkt gerendert wird (z.B. in Tabs),
   * kann propertyId übergeben werden.
   * Wenn nicht gesetzt, wird corePropertyId aus dem OutletContext genutzt.
   */
  propertyId?: string;
};

type EnergyRow = {
  property_id: string;
  efficiency_class: string | null; // A+, A, B, C, D, E, H
  energy_consumption: number | null; // kWh/m2*a
  updated_at: string; // timestamptz
};

type EnergyFormState = {
  efficiency_class: string;
  energy_consumption: string; // keep as string for input
};

const ENERGY_TABLE = "portfolio_property_energy";
const EFFICIENCY_OPTIONS = ["A+", "A", "B", "C", "D", "E", "H"] as const;

function toNullableNumber(value: string): number | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const normalized = v.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatNullableNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(n);
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

function CoreLinkMissingBox() {
  return (
    <div
      style={{
        border: "1px solid #fecaca",
        background: "#fff1f2",
        color: "#7f1d1d",
        padding: 12,
        borderRadius: 12,
        whiteSpace: "pre-wrap",
        fontSize: 13,
        fontWeight: 800,
        maxWidth: 560,
      }}
    >
      Dieses Portfolio-Objekt hat keine Verknüpfung zu properties (core_property_id ist leer).
      {"\n"}
      Lösung: In portfolio_properties eine Spalte core_property_id pflegen, die auf properties.id zeigt.
    </div>
  );
}

export default function PortfolioEnergy({ propertyId }: Props) {
  // ✅ comes from PortfolioPropertyLayout <Outlet context={{ corePropertyId }} />
  const { corePropertyId } = useOutletContext<PortfolioOutletContext>();

  // Use explicit prop when provided, otherwise fallback to outlet context.
  const resolvedId = propertyId ?? corePropertyId ?? "";

  // Normalize/guard
  const safeCorePropertyId = useMemo(() => {
    return normalizeUuid(String(resolvedId ?? "").trim());
  }, [resolvedId]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [dbRow, setDbRow] = useState<EnergyRow | null>(null);

  const [form, setForm] = useState<EnergyFormState>({
    efficiency_class: "",
    energy_consumption: "",
  });

  // Prevent late responses from overwriting state when corePropertyId changes quickly
  const requestSeq = useRef(0);

  const isDirty = useMemo(() => {
    const baselineClass = dbRow?.efficiency_class ?? "";
    const baselineConsumption = formatNullableNumber(dbRow?.energy_consumption);
    return (
      form.efficiency_class !== baselineClass ||
      form.energy_consumption !== baselineConsumption
    );
  }, [dbRow, form]);

  const canSave = useMemo(() => {
    if (!safeCorePropertyId) return false;
    if (saving || loading) return false;
    if (!isDirty) return false;

    const hasConsumptionInput = form.energy_consumption.trim().length > 0;
    if (hasConsumptionInput && toNullableNumber(form.energy_consumption) === null) return false;

    const cls = form.efficiency_class.trim();
    if (cls && !EFFICIENCY_OPTIONS.includes(cls as any)) return false;

    return true;
  }, [safeCorePropertyId, saving, loading, isDirty, form.energy_consumption, form.efficiency_class]);

  async function loadEnergy() {
    // ✅ Guard: never query Supabase if missing/invalid
    if (!safeCorePropertyId) return;

    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from(ENERGY_TABLE)
        .select("*")
        .eq("property_id", safeCorePropertyId) // ✅ always resolved property id
        .maybeSingle();

      if (seq !== requestSeq.current) return;

      if (error) throw error;

      const row = (data as EnergyRow | null) ?? null;
      setDbRow(row);
      setForm({
        efficiency_class: row?.efficiency_class ?? "",
        energy_consumption: formatNullableNumber(row?.energy_consumption),
      });
    } catch (e: unknown) {
      if (seq !== requestSeq.current) return;
      console.error("PortfolioEnergy load failed:", e);
      setError(e instanceof Error ? e.message : String(e));
      setDbRow(null);
      setForm({ efficiency_class: "", energy_consumption: "" });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    // Reset between properties
    setDbRow(null);
    setForm({ efficiency_class: "", energy_consumption: "" });
    setError(null);
    setLoading(false);
    setSaving(false);

    // ✅ Guard
    if (!safeCorePropertyId) return;

    void loadEnergy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCorePropertyId]);

  function validate(): string | null {
    if (!safeCorePropertyId) {
      return "Dieses Portfolio-Objekt hat keine Verknüpfung zu properties (core_property_id ist leer).";
    }

    const cls = form.efficiency_class.trim();
    if (cls && !EFFICIENCY_OPTIONS.includes(cls as any)) {
      return "Ungültige Energieeffizienzklasse.";
    }

    const consumptionRaw = form.energy_consumption.trim();
    if (consumptionRaw && toNullableNumber(consumptionRaw) === null) {
      return "Energieverbrauch muss eine Zahl sein (z.B. 85 oder 85.5).";
    }

    return null;
  }

  async function onSave() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    // ✅ additional hard guard
    if (!safeCorePropertyId) return;

    setSaving(true);
    setError(null);

    const payload = {
      property_id: safeCorePropertyId,
      efficiency_class: form.efficiency_class.trim() || null,
      energy_consumption: toNullableNumber(form.energy_consumption),
    };

    try {
      /**
       * WICHTIGER FIX:
       * - In deinem alten Code stand:
       *    .eq("property_id", propertyId)  // propertyId kann undefined sein!
       *    if (error) { ... }             // '...' ist ungültig
       *
       * - Lösung:
       *    Upsert auf property_id (oder update + fallback insert).
       *    Upsert ist robust, wenn es die Zeile noch nicht gibt.
       */
      const { data, error } = await supabase
        .from(ENERGY_TABLE)
        .upsert(payload, { onConflict: "property_id" })
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError("Speichern hat keine Zeile zurückgegeben (evtl. RLS blockiert).");
        return;
      }

      const row = data as EnergyRow;
      setDbRow(row);
      setForm({
        efficiency_class: row.efficiency_class ?? "",
        energy_consumption: formatNullableNumber(row.energy_consumption),
      });
    } catch (e: unknown) {
      console.error("PortfolioEnergy save failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ✅ If missing corePropertyId => stop UI + no queries
  if (!safeCorePropertyId) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Energie</div>
        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#7f1d1d",
              padding: 12,
              borderRadius: 12,
              whiteSpace: "pre-wrap",
              fontSize: 13,
              fontWeight: 800,
              maxWidth: 560,
            }}
          >
            {error}
          </div>
        ) : (
          <CoreLinkMissingBox />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>Energie</div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
          display: "grid",
          gap: 14,
          maxWidth: 560,
        }}
      >
        <p style={{ margin: 0, opacity: 0.75 }}>
          Energieeffizienzklasse (A+, A, B, C, D, E, H) &amp; Energieverbrauch (kWh/m²*a).
        </p>

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,0,0,0.35)",
              background: "rgba(255,0,0,0.06)",
            }}
          >
            <strong>Fehler:</strong> {error}
          </div>
        )}

        <label style={{ display: "grid", gap: 6 }}>
          <span>Energieeffizienzklasse</span>
          <select
            value={form.efficiency_class}
            onChange={(e) => setForm((s) => ({ ...s, efficiency_class: e.target.value }))}
            disabled={loading || saving}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            <option value="">Bitte wählen…</option>
            {EFFICIENCY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Energieverbrauch (kWh/m²*a)</span>
          <input
            value={form.energy_consumption}
            onChange={(e) => setForm((s) => ({ ...s, energy_consumption: e.target.value }))}
            inputMode="decimal"
            placeholder="z.B. 85.5"
            disabled={loading || saving}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
            }}
          />
          {form.energy_consumption.trim() && toNullableNumber(form.energy_consumption) === null && (
            <small style={{ color: "rgba(220,38,38,0.9)" }}>
              Bitte eine gültige Zahl eingeben (z.B. 85 oder 85.5).
            </small>
          )}
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={onSave}
            disabled={!canSave}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#111827",
              color: "white",
              fontWeight: 600,
              cursor: !canSave ? "not-allowed" : "pointer",
              opacity: !canSave ? 0.6 : 1,
            }}
          >
            {saving ? "Speichere…" : "Speichern"}
          </button>

          <button
            onClick={loadEnergy}
            disabled={saving || loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 600,
              cursor: saving || loading ? "not-allowed" : "pointer",
              opacity: saving || loading ? 0.6 : 1,
            }}
          >
            Neu laden
          </button>

          {loading && <span style={{ fontSize: 12, opacity: 0.65 }}>Lade…</span>}

          {dbRow?.updated_at && (
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              Zuletzt aktualisiert: {formatTimestamp(dbRow.updated_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
