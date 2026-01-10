// src/pages/portfolio/PortfolioFinance.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { normalizeUuid } from "../../lib/ids";
import type { PortfolioOutletContext } from "./PortfolioPropertyLayout";

const FINANCE_TABLE = "portfolio_property_finance";

type FinanceRow = {
  property_id: string;
  ownership?: string | null;

  purchase_price?: number | null;
  purchase_date?: string | null;
  purchase_costs?: number | null;
  other_investment_costs?: number | null;

  current_net_rent_monthly?: number | null;

  sold_price?: number | null;
  sold_date?: string | null;

  land_value_per_m2?: number | null;
  land_value_reference_date?: string | null;
};

function toNumberOrNull(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function PortfolioFinance() {
  const { corePropertyId, mapErr, mapLoading } = useOutletContext<PortfolioOutletContext>();

  const safeCorePropertyId = useMemo(
    () => normalizeUuid(String(corePropertyId ?? "").trim()),
    [corePropertyId]
  );
  const hasCore = Boolean(safeCorePropertyId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [ownership, setOwnership] = useState("");

  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCosts, setPurchaseCosts] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  const [otherInvestmentCosts, setOtherInvestmentCosts] = useState("");

  const [currentNetRentMonthly, setCurrentNetRentMonthly] = useState("");

  const [landValuePerM2, setLandValuePerM2] = useState("");
  const [landValueReferenceDate, setLandValueReferenceDate] = useState("");

  const [soldPrice, setSoldPrice] = useState("");
  const [soldDate, setSoldDate] = useState("");

  const requestSeq = useRef(0);

  const effectiveDisabled = useMemo(() => {
    if (mapLoading) return true;
    if (mapErr) return true;
    if (!hasCore) return true;
    return false;
  }, [mapLoading, mapErr, hasCore]);

  function resetForm() {
    setOwnership("");
    setPurchasePrice("");
    setPurchaseCosts("");
    setPurchaseDate("");
    setOtherInvestmentCosts("");
    setCurrentNetRentMonthly("");
    setLandValuePerM2("");
    setLandValueReferenceDate("");
    setSoldPrice("");
    setSoldDate("");
  }

  async function load() {
    const seq = ++requestSeq.current;
    setErr(null);

    if (!hasCore) {
      resetForm();
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from(FINANCE_TABLE)
        .select(
          [
            "property_id",
            "ownership",
            "purchase_price",
            "purchase_date",
            "purchase_costs",
            "other_investment_costs",
            "current_net_rent_monthly",
            "sold_price",
            "sold_date",
            "land_value_per_m2",
            "land_value_reference_date",
          ].join(",")
        )
        .eq("property_id", safeCorePropertyId)
        .maybeSingle();

      if (seq !== requestSeq.current) return;
      if (error) throw error;

      const f = (data as FinanceRow | null) ?? null;

      setOwnership((f?.ownership ?? "").trim());

      setPurchasePrice(f?.purchase_price != null ? String(f.purchase_price) : "");
      setPurchaseCosts(f?.purchase_costs != null ? String(f.purchase_costs) : "");
      setPurchaseDate(f?.purchase_date ?? "");

      setOtherInvestmentCosts(f?.other_investment_costs != null ? String(f.other_investment_costs) : "");
      setCurrentNetRentMonthly(f?.current_net_rent_monthly != null ? String(f.current_net_rent_monthly) : "");

      setLandValuePerM2(f?.land_value_per_m2 != null ? String(f.land_value_per_m2) : "");
      setLandValueReferenceDate(f?.land_value_reference_date ?? "");

      setSoldPrice(f?.sold_price != null ? String(f.sold_price) : "");
      setSoldDate(f?.sold_date ?? "");
    } catch (e: any) {
      if (seq !== requestSeq.current) return;
      console.error("PortfolioFinance load failed:", e);
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

    const nums: Array<[string, string]> = [
      ["Kaufpreis", purchasePrice],
      ["Kaufnebenkosten", purchaseCosts],
      ["Sonstige Investitionskosten", otherInvestmentCosts],
      ["Aktuelle Nettomiete (monatlich)", currentNetRentMonthly],
      ["Bodenwert (€/m²)", landValuePerM2],
      ["Verkaufspreis", soldPrice],
    ];

    for (const [label, raw] of nums) {
      if (raw.trim() && toNumberOrNull(raw) === null) return `${label} muss eine Zahl sein.`;
    }

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
      const payload: FinanceRow = {
        property_id: safeCorePropertyId,
        ownership: ownership.trim() || null,

        purchase_price: toNumberOrNull(purchasePrice),
        purchase_costs: toNumberOrNull(purchaseCosts),
        purchase_date: purchaseDate.trim() || null,

        other_investment_costs: toNumberOrNull(otherInvestmentCosts),
        current_net_rent_monthly: toNumberOrNull(currentNetRentMonthly),

        land_value_per_m2: toNumberOrNull(landValuePerM2),
        land_value_reference_date: landValueReferenceDate.trim() || null,

        sold_price: toNumberOrNull(soldPrice),
        sold_date: soldDate.trim() || null,
      };

      const { error } = await supabase.from(FINANCE_TABLE).upsert(payload, { onConflict: "property_id" });
      if (error) throw error;

      await load();
    } catch (e: any) {
      console.error("PortfolioFinance save failed:", e);
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Finanzen</div>

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
          opacity: effectiveDisabled ? 0.95 : 1,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Eigentum / Anteil
          <input
            value={ownership}
            onChange={(e) => setOwnership(e.target.value)}
            disabled={loading || effectiveDisabled}
            placeholder="z.B. 100% / 50%"
            style={inputStyle(loading)}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Kaufpreis
            <input
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 350000"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Kaufdatum
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={loading || effectiveDisabled}
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Kaufnebenkosten
            <input
              value={purchaseCosts}
              onChange={(e) => setPurchaseCosts(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 25000"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Sonstige Investitionskosten
            <input
              value={otherInvestmentCosts}
              onChange={(e) => setOtherInvestmentCosts(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 10000"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Aktuelle Nettomiete (monatlich)
            <input
              value={currentNetRentMonthly}
              onChange={(e) => setCurrentNetRentMonthly(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 1200"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Bodenwert (€/m²)
            <input
              value={landValuePerM2}
              onChange={(e) => setLandValuePerM2(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 450"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Bodenwert Stichtag
            <input
              type="date"
              value={landValueReferenceDate}
              onChange={(e) => setLandValueReferenceDate(e.target.value)}
              disabled={loading || effectiveDisabled}
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Verkaufspreis
            <input
              value={soldPrice}
              onChange={(e) => setSoldPrice(e.target.value)}
              disabled={loading || effectiveDisabled}
              inputMode="decimal"
              placeholder="z.B. 420000"
              style={inputStyle(loading)}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Verkaufsdatum
            <input
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              disabled={loading || effectiveDisabled}
              style={inputStyle(loading)}
            />
          </label>
        </div>

        {(loading || mapLoading) && <div style={{ fontSize: 12, opacity: 0.7 }}>Lädt…</div>}
      </div>

      <div style={{ fontSize: 12, opacity: 0.6 }}>
        Gespeichert in <b>{FINANCE_TABLE}</b> (Upsert auf <code>property_id</code>).
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
