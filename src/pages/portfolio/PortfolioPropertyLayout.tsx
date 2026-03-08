import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { NavLink, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { normalizeUuid } from "../../lib/ids";

export type PortfolioPropertyRow = {
  id: string;
  name: string | null;
  core_property_id: string | null;
};

export type PortfolioOutletContext = {
  propertyId: string;
  portfolioPropertyId: string | null;
  corePropertyId: string | null;
  propertyName: string | null;
  mapLoading: boolean;
  mapErr: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function formatErrorMessage(error: unknown): string {
  if (!error) return "Unbekannter Fehler";
  if (typeof error === "string") return error;

  const e = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  const parts = [e.message, e.details, e.hint, e.code].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : "Unbekannter Fehler";
}

function sectionLabel(section: string): string {
  switch (section) {
    case "address":
      return "Adresse";
    case "details":
      return "Details";
    case "finanzen":
      return "Finanzen";
    case "energie":
      return "Energie";
    case "vermietung":
      return "Vermietung";
    default:
      return section;
  }
}

function tabStyle(isActive: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    border: isActive ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    background: isActive ? "#eef2ff" : "#ffffff",
    color: isActive ? "#3730a3" : "#111827",
    transition: "all 120ms ease",
    whiteSpace: "nowrap",
  };
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} end={false} style={({ isActive }) => tabStyle(isActive)}>
      {label}
    </NavLink>
  );
}

async function fetchPortfolioPropertyById(id: string): Promise<PortfolioPropertyRow | null> {
  const safeId = normalizeUuid(id);
  if (!safeId) return null;

  const { data, error } = await supabase
    .from("portfolio_properties")
    .select("id, name, core_property_id")
    .eq("id", safeId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: normalizeUuid(data.id) ?? data.id,
    name: data.name ?? null,
    core_property_id: normalizeUuid(data.core_property_id ?? "") ?? null,
  };
}

function StatusBadge({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          color: "#1d4ed8",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        Mapping wird geladen…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          background: "#fff1f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          fontWeight: 700,
          fontSize: 13,
          maxWidth: 460,
        }}
      >
        Mapping-Problem
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        background: "#ecfdf3",
        border: "1px solid #bbf7d0",
        color: "#166534",
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      Mapping ok
    </div>
  );
}

function DiagnosticToggleButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        border: "1px solid #d1d5db",
        background: "#ffffff",
        color: "#374151",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {open ? "Diagnose ausblenden" : "Diagnose anzeigen"}
    </button>
  );
}

function DiagnosticsPanel({
  propertyId,
  portfolioPropertyId,
  corePropertyId,
  mapLoading,
  mapErr,
}: {
  propertyId: string;
  portfolioPropertyId: string | null;
  corePropertyId: string | null;
  mapLoading: boolean;
  mapErr: string | null;
}) {
  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        background: "#f8fbff",
        color: "#1e3a8a",
        padding: 16,
        borderRadius: 16,
        fontSize: 13,
        lineHeight: 1.6,
        wordBreak: "break-word",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Diagnose</div>
      <div>
        Route-ID: {propertyId}
        <br />
        Portfolio-ID: {portfolioPropertyId ?? "—"}
        <br />
        Core-ID: {corePropertyId ?? "—"}
        <br />
        Mapping-Status: {mapLoading ? "lädt" : mapErr ? "Fehler" : "ok"}
        <br />
        Mapping-Fehler: {mapErr ?? "—"}
      </div>
    </div>
  );
}

export default function PortfolioPropertyLayout() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const location = useLocation();

  const [mapLoading, setMapLoading] = useState(true);
  const [mapErr, setMapErr] = useState<string | null>(null);

  const [portfolioPropertyId, setPortfolioPropertyId] = useState<string | null>(null);
  const [corePropertyId, setCorePropertyId] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string | null>(null);

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const currentSection = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const lastSegment = parts[parts.length - 1];
    return lastSegment ?? "address";
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function resolveMapping() {
      if (!propertyId) {
        if (!cancelled) {
          setMapErr("Fehlende Portfolio-Objekt-ID in der URL.");
          setMapLoading(false);
        }
        return;
      }

      setMapLoading(true);
      setMapErr(null);
      setPortfolioPropertyId(null);
      setCorePropertyId(null);
      setPropertyName(null);

      try {
        const safeRouteId = normalizeUuid(propertyId);

        if (!safeRouteId || !isUuid(safeRouteId)) {
          if (!cancelled) {
            setMapErr("Ungültige Portfolio-Objekt-ID in der URL.");
            setMapLoading(false);
          }
          return;
        }

        const portfolioProperty = await fetchPortfolioPropertyById(safeRouteId);

        if (!cancelled) {
          if (!portfolioProperty) {
            setMapErr("Die URL enthält keine gültige kanonische portfolio_properties.id.");
            setMapLoading(false);
            return;
          }

          setPortfolioPropertyId(portfolioProperty.id);
          setCorePropertyId(portfolioProperty.core_property_id ?? null);
          setPropertyName(portfolioProperty.name ?? null);
          setMapLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("PortfolioPropertyLayout mapping failed:", error);
          setMapErr(formatErrorMessage(error));
          setMapLoading(false);
        }
      }
    }

    void resolveMapping();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (!propertyId) {
    return <Navigate to="/portfolio" replace />;
  }

  if (!isUuid(propertyId)) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 800,
          }}
        >
          Ungültige Portfolio-Objekt-ID in der URL.
        </div>
      </div>
    );
  }

  const ctx: PortfolioOutletContext = {
    propertyId,
    portfolioPropertyId,
    corePropertyId,
    propertyName,
    mapLoading,
    mapErr,
  };

  const isReadonly = !mapLoading && (!portfolioPropertyId || !!mapErr);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          display: "grid",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 8,
              }}
            >
              Portfolio-Immobilie
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 900,
                color: "#111827",
                lineHeight: 1.1,
              }}
            >
              {propertyName ?? "Objektakte"}
            </h1>

            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              Übersicht zur ausgewählten Immobilie.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              justifyItems: "end",
              alignItems: "start",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                color: "#374151",
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Bereich: {sectionLabel(currentSection)}
            </div>

            <StatusBadge loading={mapLoading} error={mapErr} />

            <DiagnosticToggleButton
              open={showDiagnostics}
              onClick={() => setShowDiagnostics((prev) => !prev)}
            />
          </div>
        </div>

        {showDiagnostics ? (
          <DiagnosticsPanel
            propertyId={propertyId}
            portfolioPropertyId={portfolioPropertyId}
            corePropertyId={corePropertyId}
            mapLoading={mapLoading}
            mapErr={mapErr}
          />
        ) : null}

        {isReadonly ? (
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
            Diese Objektseite wurde nicht mit einer gültigen kanonischen{" "}
            <code>portfolio_properties.id</code> geöffnet. Schreiben ist deaktiviert.
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            paddingBottom: 4,
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <TabLink to="address" label="Adresse" />
          <TabLink to="details" label="Details" />
          <TabLink to="finanzen" label="Finanzen" />
          <TabLink to="energie" label="Energie" />
          <TabLink to="vermietung" label="Vermietung" />
        </div>

        <Outlet context={ctx} />
      </div>
    </div>
  );
}