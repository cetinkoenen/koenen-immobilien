import { NavLink, Outlet, useParams, Navigate } from "react-router-dom";

export type PortfolioOutletContext = {
  /** raw param from URL (uuid expected) */
  propertyId: string;
  /** legacy name used by existing tab pages */
  corePropertyId: string;
  /** legacy mapping flags used by existing tab pages */
  mapLoading: boolean;
  mapErr: string | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={false}
      style={({ isActive }) => ({
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        textDecoration: "none",
        fontWeight: 900,
        background: isActive ? "#111827" : "white",
        color: isActive ? "white" : "#111827",
      })}
    >
      {label}
    </NavLink>
  );
}

export default function PortfolioPropertyLayout() {
  const { propertyId } = useParams<{ propertyId: string }>();

  if (!propertyId) return <Navigate to="/portfolio" replace />;

  // Minimal business-safe validation: route param must be UUID
  if (!isUuid(propertyId)) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          Ungültige Portfolio-Objekt-ID in URL (keine UUID).
        </div>
      </div>
    );
  }

  /**
   * Compatibility layer:
   * Existing pages expect `corePropertyId`, `mapLoading`, `mapErr`.
   * Right now, `propertyId` IS the core id (UUID). If later you have slug->uuid mapping,
   * reintroduce it here and keep the same context shape.
   */
  const ctx: PortfolioOutletContext = {
    propertyId,
    corePropertyId: propertyId,
    mapLoading: false,
    mapErr: null,
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <TabLink to="address" label="Adresse" />
        <TabLink to="details" label="Details" />
        <TabLink to="finanzen" label="Finanzen" />
        <TabLink to="energie" label="Energie" />
        <TabLink to="vermietung" label="Vermietung" />
      </div>

      <Outlet context={ctx} />
    </div>
  );
}
