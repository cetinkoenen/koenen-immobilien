import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import PortfolioEnergy from "@/pages/portfolio/PortfolioEnergy";
import PortfolioRenting from "@/pages/portfolio/PortfolioRenting";

type PortfolioPropertyType = "APARTMENT" | "HOUSE" | "GARAGE" | string;

type PropertyRow = {
  id: string; // uuid
  type: PortfolioPropertyType;
  name: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

type TabKey = "energy" | "renting";

/** ---------- URL Helpers ---------- */

function getQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function setQueryParam(name: string, value: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!value) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState({}, "", url.toString());
}

/** ---------- ID Validation / Normalization ---------- */

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normalizePropertyId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  if (!isUuid(v)) return "";
  return v;
}

/** ---------- Labels ---------- */

function typeLabel(t: PortfolioPropertyType): string {
  switch (t) {
    case "APARTMENT":
      return "Wohnung";
    case "HOUSE":
      return "Haus";
    case "GARAGE":
      return "Garage";
    default:
      return String(t);
  }
}

function propertyOptionLabel(p: PropertyRow): string {
  return `${p.name} — ${typeLabel(p.type)}`;
}

/** ---------- UI Bits ---------- */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: active ? "#111827" : "white",
        color: active ? "white" : "#111827",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid rgba(245, 158, 11, 0.35)",
        background: "rgba(245, 158, 11, 0.08)",
      }}
    >
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: "1px solid rgba(255,0,0,0.35)",
        background: "rgba(255,0,0,0.06)",
      }}
    >
      <strong>Fehler:</strong> {message}
    </div>
  );
}

export default function PortfolioPropertyTabs() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);
  const [errorProps, setErrorProps] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("energy");

  // store raw, but always use safeSelectedId for rendering/queries
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

  const safeSelectedId = useMemo(
    () => normalizePropertyId(selectedPropertyId),
    [selectedPropertyId]
  );

  const reqSeq = useRef(0);

  /** Init from URL (sanitize + auto-clean poison params) */
  useEffect(() => {
    const raw = getQueryParam("propertyId");
    const fromUrl = normalizePropertyId(raw);

    if (fromUrl) {
      setSelectedPropertyId(fromUrl);
    } else {
      // If URL had e.g. propertyId=undefined -> remove it
      if (raw && normalizePropertyId(raw) === "") setQueryParam("propertyId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProperties() {
    const seq = ++reqSeq.current;
    setLoadingProps(true);
    setErrorProps(null);

    const { data, error } = await supabase
      .from("portfolio_properties")
      .select("id, type, name, sort_index, created_at, updated_at")
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: false });

    if (seq !== reqSeq.current) return;

    if (error) {
      setErrorProps(error.message);
      setProperties([]);
      setLoadingProps(false);
      return;
    }

    const list = (data ?? []) as PropertyRow[];
    setProperties(list);
    setLoadingProps(false);

    // If invalid or empty selection, select first
    if (!safeSelectedId && list.length > 0) {
      const firstId = normalizePropertyId(list[0].id);
      if (firstId) {
        setSelectedPropertyId(firstId);
        setQueryParam("propertyId", firstId);
      }
      return;
    }

    // If selection valid but doesn't exist anymore, clear
    if (safeSelectedId && list.length > 0) {
      const stillExists = list.some((p) => p.id === safeSelectedId);
      if (!stillExists) {
        setSelectedPropertyId("");
        setQueryParam("propertyId", null);
      }
    }
  }

  useEffect(() => {
    void loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProperty = useMemo(() => {
    if (!safeSelectedId) return null;
    return properties.find((p) => p.id === safeSelectedId) ?? null;
  }, [properties, safeSelectedId]);

  function onSelectProperty(value: string) {
    const normalized = normalizePropertyId(value);
    setSelectedPropertyId(normalized); // store clean only
    setQueryParam("propertyId", normalized || null);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>
            {selectedProperty ? selectedProperty.name : "Portfolio"}
          </div>
          <div style={{ opacity: 0.75 }}>
            {selectedProperty
              ? `${typeLabel(selectedProperty.type)} · sort_index: ${selectedProperty.sort_index}`
              : "Bitte eine Immobilie auswählen."}
          </div>
        </div>

        <button
          onClick={loadProperties}
          disabled={loadingProps}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 800,
            cursor: loadingProps ? "not-allowed" : "pointer",
            opacity: loadingProps ? 0.6 : 1,
          }}
        >
          {loadingProps ? "Lade…" : "Immobilien neu laden"}
        </button>
      </div>

      {/* Picker */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 900 }}>Immobilie auswählen</div>

        {errorProps && <ErrorBox message={errorProps} />}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={safeSelectedId || ""}
            onChange={(e) => onSelectProperty(e.target.value)}
            disabled={loadingProps || properties.length === 0}
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              minWidth: 420,
              background: "white",
            }}
          >
            {properties.length === 0 ? (
              <option value="">
                {loadingProps ? "Lade Immobilien…" : "Keine Immobilien gefunden"}
              </option>
            ) : (
              <>
                <option value="" disabled>
                  Bitte wählen…
                </option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {propertyOptionLabel(p)}
                  </option>
                ))}
              </>
            )}
          </select>

          <span style={{ fontSize: 12, opacity: 0.6 }}>
            propertyId: {safeSelectedId || "—"}
          </span>
        </div>

        {properties.length > 0 && !safeSelectedId && (
          <Notice>Wähle eine Immobilie aus, um Energie- und Vermietungsdaten zu sehen.</Notice>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <TabButton active={activeTab === "energy"} onClick={() => setActiveTab("energy")}>
            Energie
          </TabButton>
          <TabButton active={activeTab === "renting"} onClick={() => setActiveTab("renting")}>
  Vermietung Wohnung
</TabButton>

        </div>

        {!safeSelectedId ? (
          <Notice>Bitte zuerst eine gültige Immobilie auswählen.</Notice>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {activeTab === "energy" && (
              <PortfolioEnergy key={`energy-${safeSelectedId}`} propertyId={safeSelectedId} />
            )}
            {activeTab === "renting" && (
              <PortfolioRenting key={`renting-${safeSelectedId}`} propertyId={safeSelectedId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
