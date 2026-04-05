// src/pages/portfolio/PortfolioAddress.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { normalizeUuid } from "../../lib/ids";
import type { PortfolioOutletContext } from "./PortfolioPropertyLayout";

const ADDRESS_TABLE = "portfolio_property_address";

type AddressRow = {
  property_id: string;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  map_image_url?: string | null;
};

export default function PortfolioAddress() {
  const { corePropertyId, mapErr, mapLoading } = useOutletContext<PortfolioOutletContext>();

  // ✅ Always sanitize the id we send to DB
  const safeCorePropertyId = useMemo(
    () => normalizeUuid(String(corePropertyId ?? "").trim()),
    [corePropertyId]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Deutschland");

  const requestSeq = useRef(0);

  const hasCore = Boolean(safeCorePropertyId);

  const effectiveDisabled = useMemo(() => {
    if (mapLoading) return true;
    if (mapErr) return true;
    if (!hasCore) return true;
    return false;
  }, [mapLoading, mapErr, hasCore]);

  async function load() {
    const seq = ++requestSeq.current;
    setErr(null);

    // ✅ Guard: never call DB without a safe UUID
    if (!hasCore) {
      setStreet("");
      setHouseNumber("");
      setPostalCode("");
      setCity("");
      setCountry("Deutschland");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from(ADDRESS_TABLE)
        .select("property_id,street,house_number,postal_code,city,country,map_image_url")
        .eq("property_id", safeCorePropertyId) // ✅ always safeCorePropertyId
        .maybeSingle();

      if (seq !== requestSeq.current) return;
      if (error) throw error;

      const a = (data as AddressRow | null) ?? null;

      setStreet((a?.street ?? "").trim());
      setHouseNumber((a?.house_number ?? "").trim());
      setPostalCode((a?.postal_code ?? "").trim());
      setCity((a?.city ?? "").trim());
      setCountry((a?.country ?? "Deutschland").trim() || "Deutschland");
    } catch (e: any) {
      if (seq !== requestSeq.current) return;
      console.error("PortfolioAddress load failed:", e);
      setErr(e?.message ?? String(e));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    // reset when mapping/id changes
    setStreet("");
    setHouseNumber("");
    setPostalCode("");
    setCity("");
    setCountry("Deutschland");
    setErr(null);
    setSaving(false);

    if (mapLoading) {
      setLoading(true);
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCorePropertyId, mapLoading, mapErr]);

  async function save() {
    // ✅ Guard: never upsert without a safe UUID
    if (!hasCore) {
      setErr("Dieses Portfolio-Objekt hat keine Verknüpfung zu properties (core_property_id ist leer).");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const payload: AddressRow = {
        property_id: safeCorePropertyId, // ✅ safe
        street: street.trim() || null,
        house_number: houseNumber.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        country: (country.trim() || "Deutschland") as string,
      };

      const { error } = await supabase
        .from(ADDRESS_TABLE)
        .upsert(payload, { onConflict: "property_id" });

      if (error) throw error;

      await load();
    } catch (e: any) {
      console.error("PortfolioAddress save failed:", e);
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Adresse</div>

        <div style={{ marginLeft: "auto" }}>
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
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "2fr minmax(120px, 180px)", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Straße
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              disabled={loading || effectiveDisabled}
              placeholder="z.B. Musterstraße"
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
                background: loading ? "#f9fafb" : "white",
              }}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Hausnr.
            <input
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              disabled={loading || effectiveDisabled}
              placeholder="z.B. 12A"
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
                background: loading ? "#f9fafb" : "white",
              }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            PLZ
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              disabled={loading || effectiveDisabled}
              placeholder="z.B. 28195"
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
                background: loading ? "#f9fafb" : "white",
              }}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Ort
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={loading || effectiveDisabled}
              placeholder="z.B. Bremen"
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
                background: loading ? "#f9fafb" : "white",
              }}
            />
          </label>
        </div>

        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Land
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={loading || effectiveDisabled}
            placeholder="Deutschland"
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontWeight: 800,
              background: loading ? "#f9fafb" : "white",
            }}
          />
        </label>

        {(loading || mapLoading) && <div style={{ fontSize: 12, opacity: 0.7 }}>Lädt…</div>}
      </div>

      <div style={{ fontSize: 12, opacity: 0.6 }}>
        Gespeichert in <b>{ADDRESS_TABLE}</b> (Upsert auf <code>property_id</code>).
      </div>
    </div>
  );
}
