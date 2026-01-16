// src/pages/portfolio/PortfolioAddress.tsx
console.log("🚀 PortfolioAddress UPDATE-ONLY VERSION ACTIVE");

import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import type { PortfolioOutletContext } from "./PortfolioPropertyLayout";

const ADDRESS_TABLE = "portfolio_property_address";

type AddressRow = {
  property_id: string; // FK/PK == portfolio_properties.id
  user_id: string;     // NOT NULL
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  map_image_url: string | null;
  updated_at: string | null;
};

type FormState = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

function toNullTrim(v: string): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function toCountry(v: string): string {
  const t = (v ?? "").trim();
  return t.length ? t : "Deutschland";
}

function defaultForm(): FormState {
  return {
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    country: "Deutschland",
  };
}

function rowToForm(row: AddressRow): FormState {
  return {
    street: (row.street ?? "").trim(),
    houseNumber: (row.house_number ?? "").trim(),
    postalCode: (row.postal_code ?? "").trim(),
    city: (row.city ?? "").trim(),
    country: ((row.country ?? "Deutschland") as string).trim() || "Deutschland",
  };
}

export default function PortfolioAddress() {
  const { portfolioId, corePropertyId, mapErr, mapLoading } =
    useOutletContext<PortfolioOutletContext>();

  // ✅ SINGLE SOURCE OF TRUTH
  const propertyId = portfolioId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(defaultForm());
  const [initial, setInitial] = useState<FormState>(defaultForm());

  const requestSeq = useRef(0);

  const effectiveDisabled = useMemo(() => {
    if (mapLoading) return true;
    if (mapErr) return true;
    if (!propertyId) return true;
    return false;
  }, [mapLoading, mapErr, propertyId]);

  const isDirty = useMemo(() => {
    return (
      form.street !== initial.street ||
      form.houseNumber !== initial.houseNumber ||
      form.postalCode !== initial.postalCode ||
      form.city !== initial.city ||
      form.country !== initial.country
    );
  }, [form, initial]);

  function setField<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function load() {
    const seq = ++requestSeq.current;
    setErr(null);
    setOkMsg(null);

    if (!propertyId) {
      const df = defaultForm();
      setForm(df);
      setInitial(df);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from(ADDRESS_TABLE)
        .select("property_id,user_id,street,house_number,postal_code,city,country,map_image_url,updated_at")
        .eq("property_id", propertyId)
        .single(); // ✅ row MUST exist now (8/8)

      if (seq !== requestSeq.current) return;
      if (error) throw error;

      const row = data as AddressRow;
      const next = rowToForm(row);
      setForm(next);
      setInitial(next);
    } catch (e: any) {
      if (seq !== requestSeq.current) return;
      console.error("PortfolioAddress load failed:", e);
      setErr(e?.message ?? e?.details ?? String(e));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    setErr(null);
    setOkMsg(null);
    setSaving(false);

    const df = defaultForm();
    setForm(df);
    setInitial(df);

    if (mapLoading) {
      setLoading(true);
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, mapLoading, mapErr]);

  async function save() {
    if (!propertyId) {
      setErr("Fehlende Portfolio-ID (portfolio_properties.id).");
      return;
    }

    setSaving(true);
    setErr(null);
    setOkMsg(null);

    try {
      // Auth check (helps debug)
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not authenticated");

      // ✅ UPDATE-ONLY (keine FK/Insert-Konflikte mehr)
      const updatePayload = {
        street: toNullTrim(form.street),
        house_number: toNullTrim(form.houseNumber),
        postal_code: toNullTrim(form.postalCode),
        city: toNullTrim(form.city),
        country: toCountry(form.country),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(ADDRESS_TABLE)
        .update(updatePayload)
        .eq("property_id", propertyId)
        .select("property_id,user_id,street,house_number,postal_code,city,country,map_image_url,updated_at")
        .single();

      if (error) throw error;

      const row = data as AddressRow;

      // Optional safety: ensure row belongs to current user (debug)
      if (row.user_id && row.user_id !== userId) {
        console.warn("Address row user_id differs from auth.uid(). Check ownership/RLS.");
      }

      const next = rowToForm(row);
      setForm(next);
      setInitial(next);
      setOkMsg("Adresse aktualisiert.");
    } catch (e: any) {
      console.error("PortfolioAddress save failed:", e);
      const msg = e?.message ?? e?.details ?? String(e);

      if (/row-level security/i.test(msg)) {
        setErr(
          "RLS blockiert den Zugriff. Prüfe Policies: " +
            "portfolio_property_address.user_id = auth.uid() und portfolio_properties.user_id = auth.uid()."
        );
      } else if (/23503|foreign key/i.test(msg)) {
        setErr("FK-Fehler: property_id muss portfolio_properties.id sein (Portfolio-ID).");
      } else {
        setErr(msg);
      }
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
            disabled={saving || loading || effectiveDisabled || !isDirty}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: saving ? "#f3f4f6" : "white",
              fontWeight: 900,
              cursor: saving || loading || effectiveDisabled || !isDirty ? "not-allowed" : "pointer",
              opacity: saving || loading || effectiveDisabled || !isDirty ? 0.6 : 1,
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

      {okMsg && !err && (
        <div
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#14532d",
            padding: 12,
            borderRadius: 12,
            whiteSpace: "pre-wrap",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {okMsg}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Straße</span>
          <input
            value={form.street}
            onChange={(e) => setField("street", e.target.value)}
            placeholder="z.B. Lilienthaler Str."
            disabled={saving || loading || effectiveDisabled}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Hausnummer</span>
            <input
              value={form.houseNumber}
              onChange={(e) => setField("houseNumber", e.target.value)}
              placeholder="z.B. 12A"
              disabled={saving || loading || effectiveDisabled}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>PLZ</span>
            <input
              value={form.postalCode}
              onChange={(e) => setField("postalCode", e.target.value)}
              placeholder="z.B. 28195"
              disabled={saving || loading || effectiveDisabled}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Ort</span>
            <input
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="z.B. Bremen"
              disabled={saving || loading || effectiveDisabled}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Land</span>
            <input
              value={form.country}
              onChange={(e) => setField("country", e.target.value)}
              placeholder="Deutschland"
              disabled={saving || loading || effectiveDisabled}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none" }}
            />
          </label>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.6 }}>
        Portfolio-ID (FK): <b>{propertyId || "—"}</b>
        {" · "}
        Core-ID (Info): <b>{corePropertyId || "—"}</b>
        <br />
        Tabelle: <b>{ADDRESS_TABLE}</b> (Save via <b>update</b> by <b>property_id</b>)
      </div>
    </div>
  );
}
