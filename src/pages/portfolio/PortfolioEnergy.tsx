import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { normalizeUuid } from "../../lib/ids";
import type { PortfolioOutletContext } from "./PortfolioPropertyLayout";

type Props = {
  propertyId?: string;
};

type EnergyRow = {
  property_id: string;
  efficiency_class: string | null;
  energy_consumption: number | null;
  updated_at?: string | null;
};

type EnergyFormState = {
  efficiency_class: string;
  energy_consumption: string;
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const ENERGY_TABLE = "portfolio_property_energy";
const EFFICIENCY_OPTIONS = ["A+", "A", "B", "C", "D", "E", "H"] as const;

function toNullableNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNullableNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatErrorMessage(error: unknown): string {
  if (!error) return "Unbekannter Fehler";
  if (typeof error === "string") return error;

  const err = error as SupabaseLikeError;
  const parts = [err.message, err.details, err.hint, err.code].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Unbekannter Fehler";
}

function MissingCoreBox() {
  return (
    <div
      style={{
        border: "1px solid #fde68a",
        background: "#fffbeb",
        color: "#92400e",
        padding: 14,
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.5,
      }}
    >
      Dieses Portfolio-Objekt hat keine gültige Verknüpfung zu den Energiedaten.
      <br />
      Es konnte keine belastbare <b>corePropertyId</b> aufgelöst werden.
    </div>
  );
}

function EmptyStateCard() {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        background: "#f9fafb",
        color: "#374151",
        padding: 16,
        borderRadius: 14,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      Für diese Immobilie sind aktuell noch keine Energiedaten gepflegt.
    </div>
  );
}

export default function PortfolioEnergy(props: Props) {
  const outlet = useOutletContext<PortfolioOutletContext>();

  const resolvedCoreId = useMemo(() => {
    const candidate = props.propertyId ?? outlet.corePropertyId ?? "";
    return normalizeUuid(String(candidate).trim());
  }, [props.propertyId, outlet.corePropertyId]);

  const hasCore = Boolean(resolvedCoreId);
  const isBlockedByMapping = Boolean(outlet.mapLoading || outlet.mapErr);
  const requestSeq = useRef(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbRow, setDbRow] = useState<EnergyRow | null>(null);

  const [form, setForm] = useState<EnergyFormState>({
    efficiency_class: "",
    energy_consumption: "",
  });

  const isDisabled = loading || saving || !hasCore || isBlockedByMapping;

  const isDirty = useMemo(() => {
    const baseClass = dbRow?.efficiency_class ?? "";
    const baseConsumption = formatNullableNumber(dbRow?.energy_consumption);

    return (
      form.efficiency_class !== baseClass ||
      form.energy_consumption !== baseConsumption
    );
  }, [dbRow, form]);

  const canSave = useMemo(() => {
    if (!hasCore) return false;
    if (isBlockedByMapping) return false;
    if (loading || saving) return false;
    if (!isDirty) return false;

    const cls = form.efficiency_class.trim();
    if (cls && !EFFICIENCY_OPTIONS.includes(cls as (typeof EFFICIENCY_OPTIONS)[number])) {
      return false;
    }

    const rawConsumption = form.energy_consumption.trim();
    if (rawConsumption && toNullableNumber(rawConsumption) === null) {
      return false;
    }

    return true;
  }, [hasCore, isBlockedByMapping, loading, saving, isDirty, form]);

  async function loadEnergy() {
    const seq = ++requestSeq.current;
    setError(null);

    if (!hasCore || isBlockedByMapping) {
      setDbRow(null);
      setForm({
        efficiency_class: "",
        energy_consumption: "",
      });
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from(ENERGY_TABLE)
        .select("property_id, efficiency_class, energy_consumption, updated_at")
        .eq("property_id", resolvedCoreId)
        .maybeSingle();

      if (seq !== requestSeq.current) return;
      if (error) throw error;

      const row = (data as EnergyRow | null) ?? null;

      setDbRow(row);
      setForm({
        efficiency_class: row?.efficiency_class ?? "",
        energy_consumption: formatNullableNumber(row?.energy_consumption),
      });
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error("PortfolioEnergy load failed:", err);
      setError(formatErrorMessage(err));
      setDbRow(null);
      setForm({
        efficiency_class: "",
        energy_consumption: "",
      });
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setDbRow(null);
    setError(null);
    setSaving(false);
    setForm({
      efficiency_class: "",
      energy_consumption: "",
    });

    if (outlet.mapLoading) {
      setLoading(true);
      return;
    }

    void loadEnergy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCoreId, outlet.mapLoading, outlet.mapErr]);

  function validate(): string | null {
    if (outlet.mapErr) return outlet.mapErr;

    if (!hasCore) {
      return "Dieses Portfolio-Objekt hat keine gültige corePropertyId.";
    }

    const cls = form.efficiency_class.trim();
    if (cls && !EFFICIENCY_OPTIONS.includes(cls as (typeof EFFICIENCY_OPTIONS)[number])) {
      return "Ungültige Energieeffizienzklasse.";
    }

    const rawConsumption = form.energy_consumption.trim();
    if (rawConsumption && toNullableNumber(rawConsumption) === null) {
      return "Der Energieverbrauch muss eine gültige Zahl sein.";
    }

    return null;
  }

  async function onSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        property_id: resolvedCoreId,
        efficiency_class: form.efficiency_class.trim() || null,
        energy_consumption: toNullableNumber(form.energy_consumption),
      };

      const { data, error } = await supabase
        .from(ENERGY_TABLE)
        .upsert(payload, { onConflict: "property_id" })
        .select("property_id, efficiency_class, energy_consumption, updated_at")
        .single();

      if (error) throw error;

      const row = data as EnergyRow;

      setDbRow(row);
      setForm({
        efficiency_class: row.efficiency_class ?? "",
        energy_consumption: formatNullableNumber(row.energy_consumption),
      });
    } catch (err) {
      console.error("PortfolioEnergy save failed:", err);
      setError(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const isEmpty =
    !loading &&
    !error &&
    !outlet.mapErr &&
    hasCore &&
    !dbRow &&
    !form.efficiency_class &&
    !form.energy_consumption;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>
            Energie
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
            Energieeffizienzklasse und Verbrauch für die ausgewählte Immobilie.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void loadEnergy()}
            disabled={isDisabled}
            style={secondaryButtonStyle(isDisabled)}
          >
            Neu laden
          </button>

          <button
            type="button"
            onClick={() => void onSave()}
            disabled={!canSave}
            style={primaryButtonStyle(!canSave)}
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>

      {outlet.mapErr ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {outlet.mapErr}
        </div>
      ) : null}

      {!outlet.mapErr && !outlet.mapLoading && !hasCore ? <MissingCoreBox /> : null}

      {error ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      ) : null}

      {isEmpty ? <EmptyStateCard /> : null}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 18,
          display: "grid",
          gap: 16,
          opacity: !hasCore || isBlockedByMapping ? 0.92 : 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          <label style={labelStyle}>
            Energieeffizienzklasse
            <select
              value={form.efficiency_class}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  efficiency_class: event.target.value,
                }))
              }
              disabled={isDisabled}
              style={inputStyle(isDisabled)}
            >
              <option value="">Bitte wählen…</option>
              {EFFICIENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Energieverbrauch (kWh/m²*a)
            <input
              value={form.energy_consumption}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  energy_consumption: event.target.value,
                }))
              }
              disabled={isDisabled}
              inputMode="decimal"
              placeholder="z. B. 85,5"
              style={inputStyle(isDisabled)}
            />
          </label>
        </div>

        {form.energy_consumption.trim() &&
        toNullableNumber(form.energy_consumption) === null ? (
          <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>
            Bitte eine gültige Zahl für den Energieverbrauch eingeben.
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <InfoCard label="Effizienzklasse" value={dbRow?.efficiency_class || "—"} />
          <InfoCard
            label="Verbrauch"
            value={
              dbRow?.energy_consumption != null
                ? `${dbRow.energy_consumption} kWh/m²*a`
                : "—"
            }
          />
          <InfoCard label="Zuletzt aktualisiert" value={formatDateTime(dbRow?.updated_at)} />
        </div>

        {(loading || outlet.mapLoading) && (
          <div style={{ fontSize: 12, color: "#6b7280" }}>Lädt…</div>
        )}
      </div>
    </div>
  );
}

function InfoCard(props: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        background: "#f8fafc",
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: "#111827",
          wordBreak: "break-word",
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  display: "grid",
};

function inputStyle(disabled: boolean): CSSProperties {
  return {
    marginTop: 6,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: disabled ? "#f9fafb" : "#ffffff",
    color: "#111827",
    fontWeight: 700,
  };
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}