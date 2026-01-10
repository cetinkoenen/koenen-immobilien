// src/pages/portfolio/PortfolioDetails.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { normalizeUuid } from "../../lib/ids";
import type { PortfolioOutletContext } from "./PortfolioPropertyLayout";

const DETAILS_TABLE = "portfolio_property_details";

type DetailsRow = {
  property_id: string;

  building_type?: string | null;
  living_area_m2?: number | null;
  land_area_m2?: number | null;
  year_built?: number | null;
  rooms?: number | null;
  floor?: number | null;
  condition?: string | null;
  fit_out_quality?: string | null;
  last_modernization_year?: number | null;

  has_cellar?: boolean | null;
  has_garage?: boolean | null;
  has_underground_parking?: boolean | null;
  has_parking_space?: boolean | null;
  has_elevator?: boolean | null;
  has_balcony_or_terrace?: boolean | null;
};

function toNumberOrNull(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: string): number | null {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export default function PortfolioDetails() {
  const navigate = useNavigate();
  const { corePropertyId, mapErr, mapLoading } = useOutletContext<PortfolioOutletContext>();

  // ✅ sanitize
  const safeCorePropertyId = useMemo(
    () => normalizeUuid(String(corePropertyId ?? "").trim()),
    [corePropertyId]
  );
  const hasCore = Boolean(safeCorePropertyId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form (strings)
  const [buildingType, setBuildingType] = useState("");
  const [livingArea, setLivingArea] = useState("");
  const [landArea, setLandArea] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [rooms, setRooms] = useState("");
  const [floor, setFloor] = useState("");
  const [condition, setCondition] = useState("");
  const [fitOutQuality, setFitOutQuality] = useState("");
  const [lastModernizationYear, setLastModernizationYear] = useState("");

  const [hasCellar, setHasCellar] = useState(false);
  const [hasGarage, setHasGarage] = useState(false);
  const [hasUndergroundParking, setHasUndergroundParking] = useState(false);
  const [hasParkingSpace, setHasParkingSpace] = useState(false);
  const [hasElevator, setHasElevator] = useState(false);
  const [hasBalconyOrTerrace, setHasBalconyOrTerrace] = useState(false);

  const requestSeq = useRef(0);

  const effectiveDisabled = useMemo(() => {
    if (mapLoading) return true;
    if (mapErr) return true;
    if (!hasCore) return true;
    return false;
  }, [mapLoading, mapErr, hasCore]);

  function resetForm() {
    setBuildingType("");
    setLivingArea("");
    setLandArea("");
    setYearBuilt("");
    setRooms("");
    setFloor("");
    setCondition("");
    setFitOutQuality("");
    setLastModernizationYear("");

    setHasCellar(false);
    setHasGarage(false);
    setHasUndergroundParking(false);
    setHasParkingSpace(false);
    setHasElevator(false);
    setHasBalconyOrTerrace(false);
  }

  async function load() {
    const seq = ++requestSeq.current;
    setErr(null);

    // ✅ Guard: no DB call without safe UUID
    if (!hasCore) {
      resetForm();
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: dData, error: dErr } = await supabase
        .from(DETAILS_TABLE)
        .select(
          [
            "property_id",
            "building_type",
            "living_area_m2",
            "land_area_m2",
            "year_built",
            "rooms",
            "floor",
            "condition",
            "fit_out_quality",
            "last_modernization_year",
            "has_cellar",
            "has_garage",
            "has_underground_parking",
            "has_parking_space",
            "has_elevator",
            "has_balcony_or_terrace",
          ].join(",")
        )
        .eq("property_id", safeCorePropertyId)
        .maybeSingle();

      if (seq !== requestSeq.current) return;
      if (dErr) throw dErr;

      const d = (dData as DetailsRow | null) ?? null;

      setBuildingType((d?.building_type ?? "").trim());
      setLivingArea(d?.living_area_m2 != null ? String(d.living_area_m2) : "");
      setLandArea(d?.land_area_m2 != null ? String(d.land_area_m2) : "");
      setYearBuilt(d?.year_built != null ? String(d.year_built) : "");
      setRooms(d?.rooms != null ? String(d.rooms) : "");
      setFloor(d?.floor != null ? String(d.floor) : "");
      setCondition((d?.condition ?? "").trim());
      setFitOutQuality((d?.fit_out_quality ?? "").trim());
      setLastModernizationYear(d?.last_modernization_year != null ? String(d.last_modernization_year) : "");

      setHasCellar(Boolean(d?.has_cellar));
      setHasGarage(Boolean(d?.has_garage));
      setHasUndergroundParking(Boolean(d?.has_underground_parking));
      setHasParkingSpace(Boolean(d?.has_parking_space));
      setHasElevator(Boolean(d?.has_elevator));
      setHasBalconyOrTerrace(Boolean(d?.has_balcony_or_terrace));
    } catch (e: any) {
      if (seq !== requestSeq.current) return;
      console.error("PortfolioDetails load failed:", e);
      setErr(e?.message ?? String(e));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    setErr(null);
    setSaving(false);
    resetForm();

    if (mapLoading) {
      setLoading(true);
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCorePropertyId, mapLoading, mapErr]);

  function validate(): string | null {
    if (!hasCore) {
      return "Dieses Portfolio-Objekt hat keine Verknüpfung zu properties (core_property_id ist leer).";
    }

    // lightweight validations
    if (yearBuilt.trim() && toIntOrNull(yearBuilt) === null) return "Baujahr muss eine Zahl sein.";
    if (floor.trim() && toIntOrNull(floor) === null) return "Etage muss eine Zahl sein.";
    if (livingArea.trim() && toNumberOrNull(livingArea) === null) return "Wohnfläche muss eine Zahl sein.";
    if (landArea.trim() && toNumberOrNull(landArea) === null) return "Grundstücksfläche muss eine Zahl sein.";
    if (rooms.trim() && toNumberOrNull(rooms) === null) return "Zimmer muss eine Zahl sein.";
    if (lastModernizationYear.trim() && toIntOrNull(lastModernizationYear) === null)
      return "Letzte Modernisierung muss eine Zahl sein.";

    return null;
  }

  async function save() {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const payload: DetailsRow = {
        property_id: safeCorePropertyId,

        building_type: buildingType.trim() || null,
        living_area_m2: toNumberOrNull(livingArea),
        land_area_m2: toNumberOrNull(landArea),
        year_built: toIntOrNull(yearBuilt),
        rooms: toNumberOrNull(rooms),
        floor: toIntOrNull(floor),
        condition: condition.trim() || null,
        fit_out_quality: fitOutQuality.trim() || null,
        last_modernization_year: toIntOrNull(lastModernizationYear),

        has_cellar: hasCellar,
        has_garage: hasGarage,
        has_underground_parking: hasUndergroundParking,
        has_parking_space: hasParkingSpace,
        has_elevator: hasElevator,
        has_balcony_or_terrace: hasBalconyOrTerrace,
      };

      const { error } = await supabase.from(DETAILS_TABLE).upsert(payload, { onConflict: "property_id" });
      if (error) throw error;

      await load();
    } catch (e: any) {
      console.error("PortfolioDetails save failed:", e);
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Objektdetails</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Core-ID: <b>{safeCorePropertyId || "—"}</b>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/portfolio")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ← Zurück
          </button>

          <button
            onClick={() => void save()}
            disabled={saving || loading || effectiveDisabled}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: saving ? "#f3f4f6" : "white",
              fontWeight: 900,
              cursor: saving || loading || effectiveDisabled ? "not-allowed" : "pointer",
              opacity: saving || loading || effectiveDisabled ? 0.6 : 1,
            }}
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>

      {mapErr && (
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
          }}
        >
          {mapErr}
        </div>
      )}

      {!mapErr && !mapLoading && !hasCore && (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#7c2d12",
            padding: 12,
            borderRadius: 12,
            whiteSpace: "pre-wrap",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Dieses Portfolio-Objekt hat keine Verknüpfung zu <b>properties</b> (core_property_id ist leer).
          <br />
          Lösung: In <b>portfolio_properties</b> die Spalte <b>core_property_id</b> pflegen (→ <b>properties.id</b>).
        </div>
      )}

      {err && (
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
          }}
        >
          {err}
        </div>
      )}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
          display: "grid",
          gap: 12,
          opacity: effectiveDisabled ? 0.95 : 1,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Gebäudetyp
            <input
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value)}
              disabled={loading || effectiveDisabled}
              placeholder="z.B. Einfamilienhaus"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Zustand
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              disabled={loading || effectiveDisabled}
              placeholder="z.B. saniert"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Wohnfläche (m²)
            <input
              value={livingArea}
              onChange={(e) => setLivingArea(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 120"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Grundstück (m²)
            <input
              value={landArea}
              onChange={(e) => setLandArea(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 450"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Baujahr
            <input
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="numeric"
              placeholder="z.B. 1998"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Zimmer
            <input
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 4.5"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Etage
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="numeric"
              placeholder="z.B. 2"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Ausstattungsqualität
            <input
              value={fitOutQuality}
              onChange={(e) => setFitOutQuality(e.target.value)}
              disabled={loading || effectiveDisabled}
              placeholder="z.B. gehoben"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Letzte Modernisierung (Jahr)
            <input
              value={lastModernizationYear}
              onChange={(e) => setLastModernizationYear(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="numeric"
              placeholder="z.B. 2018"
              style={inputStyle(loading)}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <Toggle label="Keller" checked={hasCellar} onChange={setHasCellar} disabled={loading || effectiveDisabled} />
          <Toggle label="Garage" checked={hasGarage} onChange={setHasGarage} disabled={loading || effectiveDisabled} />
          <Toggle
            label="Tiefgarage"
            checked={hasUndergroundParking}
            onChange={setHasUndergroundParking}
            disabled={loading || effectiveDisabled}
          />
          <Toggle
            label="Stellplatz"
            checked={hasParkingSpace}
            onChange={setHasParkingSpace}
            disabled={loading || effectiveDisabled}
          />
          <Toggle
            label="Aufzug"
            checked={hasElevator}
            onChange={setHasElevator}
            disabled={loading || effectiveDisabled}
          />
          <Toggle
            label="Balkon/Terrasse"
            checked={hasBalconyOrTerrace}
            onChange={setHasBalconyOrTerrace}
            disabled={loading || effectiveDisabled}
          />
        </div>

        {(loading || mapLoading) && <div style={{ fontSize: 12, opacity: 0.7 }}>Lädt…</div>}
      </div>
    </div>
  );
}

function inputStyle(loading: boolean): React.CSSProperties {
  return {
    marginTop: 6,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    fontWeight: 800,
    background: loading ? "#f9fafb" : "white",
  };
}

function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: props.disabled ? "#f9fafb" : "white",
        opacity: props.disabled ? 0.75 : 1,
        cursor: props.disabled ? "not-allowed" : "pointer",
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        disabled={props.disabled}
      />
      <span style={{ fontWeight: 900, fontSize: 12 }}>{props.label}</span>
    </label>
  );
}
