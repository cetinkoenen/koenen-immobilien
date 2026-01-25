// src/pages/portfolio/PortfolioPropertyLayout.tsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { normalizeUuid } from "../../lib/ids";

export type PortfolioOutletContext = {
  portfolioId: string; // portfolio_properties.id
  corePropertyId: string | null; // portfolio_properties.core_property_id (properties.id)
  mapErr: string | null;
  mapLoading: boolean;
};

const TABS = [
  { to: "address", label: "Adresse" },
  { to: "details", label: "Details" },
  { to: "finance", label: "Finanzen" },
  { to: "energy", label: "Energie" },
  { to: "renting", label: "Vermietung Wohnung" },
] as const;

type MapState =
  | { status: "loading"; portfolioId: string; corePropertyId: null; err: null }
  | { status: "error"; portfolioId: string; corePropertyId: null; err: string }
  | { status: "ok"; portfolioId: string; corePropertyId: string | null; err: null };

export default function PortfolioPropertyLayout() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Canonical: /portfolio/:portfolioId/*
  // Legacy: if you still have /portfolio/:id/*
  const raw = (params.portfolioId ?? (params as any).id ?? "").trim();

  const safeId = useMemo(() => normalizeUuid(String(raw)), [raw]);

  const [state, setState] = useState<MapState>(() => ({
    status: "loading",
    portfolioId: safeId,
    corePropertyId: null,
    err: null,
  }));

  useEffect(() => {
    let alive = true;

    (async () => {
      // invalid uuid
      if (!safeId) {
        if (!alive) return;
        setState({
          status: "error",
          portfolioId: "",
          corePropertyId: null,
          err: "Ungültige Portfolio-ID in der URL (keine UUID).",
        });
        return;
      }

      if (!alive) return;
      setState({ status: "loading", portfolioId: safeId, corePropertyId: null, err: null });

      try {
        // hard verify: must exist in portfolio_properties
        const { data, error } = await supabase
          .from("portfolio_properties")
          .select("id, core_property_id")
          .eq("id", safeId)
          .maybeSingle();

        if (!alive) return;
        if (error) throw error;

        if (!data) {
          setState({
            status: "error",
            portfolioId: safeId,
            corePropertyId: null,
            err:
              "Diese ID existiert nicht als Portfolio-Property (portfolio_properties.id). " +
              "Vermutlich wurde eine Core-ID (properties.id) in die URL navigiert oder ein alter Bookmark benutzt.",
          });
          return;
        }

        const cid = (data as any).core_property_id as string | null;
        setState({
          status: "ok",
          portfolioId: safeId,
          corePropertyId: cid ? normalizeUuid(String(cid).trim()) : null,
          err: null,
        });
      } catch (e: any) {
        if (!alive) return;
        setState({
          status: "error",
          portfolioId: safeId,
          corePropertyId: null,
          err: e?.message ?? e?.details ?? String(e),
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [safeId]);

  const navBase = useMemo(() => {
    return state.portfolioId ? `/portfolio/${encodeURIComponent(state.portfolioId)}` : "/portfolio";
  }, [state.portfolioId]);

  const tabStyle = ({ isActive }: { isActive: boolean }) =>
    ({
      padding: "9px 12px",
      borderRadius: 12,
      border: `1px solid ${isActive ? "#111827" : "#e5e7eb"}`,
      background: isActive ? "#111827" : "white",
      color: isActive ? "white" : "#111827",
      textDecoration: "none",
      fontWeight: 900,
      fontSize: 12,
      whiteSpace: "nowrap",
    }) as const;

  // Context for children (only meaningful in OK state)
  const ctx: PortfolioOutletContext = {
    portfolioId: state.status === "ok" ? state.portfolioId : "",
    corePropertyId: state.status === "ok" ? state.corePropertyId : null,
    mapErr: state.status === "error" ? state.err : null,
    mapLoading: state.status === "loading",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Header + Tabs */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          borderRadius: 16,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Objekt</div>

          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Portfolio-ID:{" "}
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {state.portfolioId || "—"}
            </span>
          </div>

          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Core-ID:{" "}
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {state.status === "ok" ? state.corePropertyId || "—" : "—"}
            </span>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.65 }}>
            {state.status === "loading" ? "Mapping lädt…" : state.status === "error" ? "Ungültig" : "OK"}
          </div>
        </div>

        {/* Tabs only if OK */}
        {state.status === "ok" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={`${navBase}/${t.to}`}
                style={tabStyle}
                state={location.state}
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Error UI */}
        {state.status === "error" && (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#7f1d1d",
              padding: 12,
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: "pre-wrap",
              display: "grid",
              gap: 10,
            }}
          >
            <div>{state.err}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => navigate("/portfolio", { replace: true, state: location.state })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Zurück zur Portfolio-Liste
              </button>

              {/* Optional: wenn jemand nur /portfolio/:id ohne subroute aufruft, hier direkt auf address */}
              {state.portfolioId && (
                <button
                  onClick={() => navigate(`/portfolio/${encodeURIComponent(state.portfolioId)}/address`, { replace: true })}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Trotzdem öffnen (falls ID stimmt)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Child route only if OK.
          This prevents children from running with empty/invalid portfolioId. */}
      {state.status === "ok" ? <Outlet context={ctx} /> : null}
    </div>
  );
}
