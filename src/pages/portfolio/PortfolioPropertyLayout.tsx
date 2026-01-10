// src/pages/portfolio/PortfolioPropertyLayout.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { normalizeUuid } from "../../lib/ids";

const TABS = [
  { to: "address", label: "Adresse" },
  { to: "details", label: "Details" },
  { to: "finance", label: "Finanzen" },
  { to: "energy", label: "Energie" },
  { to: "renting", label: "Vermietung" },
];

type PortfolioPropertyCoreMap = {
  id: string;
  core_property_id: string | null;
};

export type PortfolioOutletContext = {
  portfolioId: string; // portfolio_properties.id (normalized UUID or "")
  corePropertyId: string; // properties.id (normalized UUID or "")
  mapLoading: boolean;
  mapErr: string | null;
};

export default function PortfolioPropertyLayout() {
  const { id } = useParams();
  const navigate = useNavigate();

  const rawPortfolioId = (id ?? "").trim();
  const safePortfolioId = useMemo(() => normalizeUuid(rawPortfolioId), [rawPortfolioId]);

  const [corePropertyId, setCorePropertyId] = useState<string>("");
  const [mapErr, setMapErr] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  // Prevent late responses from overwriting state
  const reqSeq = useRef(0);

  useEffect(() => {
    const seq = ++reqSeq.current;

    // reset for this id
    setMapErr(null);
    setCorePropertyId("");
    setMapLoading(false);

    if (!safePortfolioId) {
      setMapErr("Ungültige Portfolio-Objekt-ID in URL (keine UUID).");
      return;
    }

    setMapLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("portfolio_properties")
        .select("id, core_property_id")
        .eq("id", safePortfolioId)
        .maybeSingle();

      // ignore outdated responses
      if (seq !== reqSeq.current) return;

      if (error) {
        console.error("PortfolioPropertyLayout map load failed:", error);
        setMapErr(error.message);
        setMapLoading(false);
        return;
      }

      const row = (data as PortfolioPropertyCoreMap | null) ?? null;

      // If row doesn't exist, that's a different problem than "core_property_id null"
      if (!row) {
        setMapErr("Portfolio-Objekt nicht gefunden (portfolio_properties.id existiert nicht).");
        setMapLoading(false);
        return;
      }

      const safeCore = normalizeUuid(row.core_property_id ?? "");
      setCorePropertyId(safeCore);
      setMapLoading(false);
    })();
  }, [safePortfolioId]);

  const loanDisabled = mapLoading || !corePropertyId;

  const outletCtx: PortfolioOutletContext = useMemo(
    () => ({
      portfolioId: safePortfolioId, // "" if invalid
      corePropertyId,               // "" if missing
      mapLoading,
      mapErr,
    }),
    [safePortfolioId, corePropertyId, mapLoading, mapErr]
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Top actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => navigate("/portfolio")}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          ← Zurück zum Portfolio
        </button>

        <button
          onClick={() => {
            if (!loanDisabled) navigate(`/darlehensuebersicht/${corePropertyId}`);
          }}
          disabled={loanDisabled}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: loanDisabled ? "not-allowed" : "pointer",
            opacity: loanDisabled ? 0.6 : 1,
          }}
          title={
            loanDisabled
              ? "Dieses Portfolio-Objekt ist keiner Immobilien-ID (properties.id) zugeordnet."
              : "Zur Darlehensübersicht dieses Objekts"
          }
        >
          Darlehen anzeigen
        </button>

        <button
          onClick={() => {
            if (!loanDisabled) navigate(`/darlehensuebersicht/${corePropertyId}/loan/new`);
          }}
          disabled={loanDisabled}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: loanDisabled ? "not-allowed" : "pointer",
            opacity: loanDisabled ? 0.6 : 1,
          }}
          title={
            loanDisabled
              ? "Dieses Portfolio-Objekt ist keiner Immobilien-ID (properties.id) zugeordnet."
              : "Neue Darlehenszeile hinzufügen"
          }
        >
          + Darlehenszeile hinzufügen
        </button>

        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.65 }}>
          Portfolio-ID:{" "}
          <span
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {safePortfolioId || "—"}
          </span>
          {" · "}
          Core-ID:{" "}
          <span
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {corePropertyId || "—"}
          </span>
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

      {!mapErr && safePortfolioId && mapLoading && (
        <div style={{ fontSize: 12, opacity: 0.7 }}>Lade Verknüpfung (core_property_id)…</div>
      )}

      {!mapErr && safePortfolioId && !mapLoading && !corePropertyId && (
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
          Fix: Beim Erstellen des properties-Datensatzes die <b>properties.id</b> hier eintragen:
          <br />
          <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
            portfolio_properties.core_property_id
          </code>
        </div>
      )}

      {/* Tabs */}
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            style={({ isActive }) => ({
              padding: "8px 12px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 900,
              border: "1px solid #e5e7eb",
              background: isActive ? "#111827" : "white",
              color: isActive ? "white" : "#111827",
              opacity: mapLoading ? 0.75 : 1,
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {/* Tab Content */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
        }}
      >
        <Outlet context={outletCtx} />
      </div>
    </div>
  );
}
