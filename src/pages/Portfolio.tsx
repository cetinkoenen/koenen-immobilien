import React from "react";
import { useNavigate } from "react-router-dom";
import ExposeButton from "@/components/ExposeButton";
import ExposeUploadButton from "@/components/ExposeUploadButton";
import {
  usePortfolioData,
  type PortfolioProperty,
  type PropertyType,
} from "../hooks/usePortfolioData";
import { devCount, devLog } from "../lib/devLog";

function formatEUR(value: number) {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} €`;
  }
}

function getTypeLabel(type: PropertyType) {
  if (type === "HOUSE") return "Haus";
  if (type === "APARTMENT") return "Wohnung";
  return "Garage";
}

function typeBadgeStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#111827",
    whiteSpace: "nowrap",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    padding: 14,
    cursor: "pointer",
    transition: "all 120ms ease",
    textAlign: "left",
  };
}

function panelStyle(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#ffffff",
    overflow: "hidden",
  };
}

export default function Portfolio() {
  const navigate = useNavigate();

  const showDebug =
    import.meta.env.DEV && import.meta.env.VITE_DEBUG_UI === "1";

  if (showDebug) {
    devCount("[Portfolio] render");
    devLog("[Portfolio] mounted");
  }

  const { combined, loading, error, reload, properties } = usePortfolioData();

  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] =
    React.useState<PropertyType | "ALL">("ALL");

  const rows = combined.rows;
  const financeByPropertyId = combined.financeByPropertyId;

  const filteredRows = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((property) => {
      if (typeFilter !== "ALL" && property.type !== typeFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchText =
        `${property.name} ${getTypeLabel(property.type)} ${property.id}`.toLowerCase();

      return searchText.includes(normalizedQuery);
    });
  }, [rows, query, typeFilter]);

  const stats = React.useMemo(() => {
    let houses = 0;
    let apartments = 0;
    let garages = 0;
    let totalValue = 0;

    for (const property of filteredRows) {
      if (property.type === "HOUSE") houses += 1;
      else if (property.type === "APARTMENT") apartments += 1;
      else garages += 1;

      const purchasePrice = Number(
        financeByPropertyId[property.id]?.purchase_price ?? 0
      );

      if (!Number.isNaN(purchasePrice)) {
        totalValue += purchasePrice;
      }
    }

    return {
      houses,
      apartments,
      garages,
      totalValue,
    };
  }, [filteredRows, financeByPropertyId]);

  const handleReload = React.useCallback(async () => {
    await reload();
  }, [reload]);

  const goToProperty = React.useCallback(
    (property: PortfolioProperty) => {
      navigate(`/portfolio/${encodeURIComponent(property.id)}`);
    },
    [navigate]
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {showDebug && (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            background: "gold",
            fontWeight: 900,
          }}
        >
          PORTFOLIO DEBUG ENABLED ✅
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 280px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              letterSpacing: "-0.02em",
            }}
          >
            Portfolio
          </h1>

          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Übersicht über alle Objekte inklusive Kennzahlen und Exposés.
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleReload()}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Lädt…" : "Aktualisieren"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Suchen (Name / Typ / ID)"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontWeight: 800,
            width: 320,
            maxWidth: "100%",
          }}
        />

        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as PropertyType | "ALL")
          }
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontWeight: 800,
            background: "#ffffff",
          }}
        >
          <option value="ALL">Alle Typen</option>
          <option value="HOUSE">Haus</option>
          <option value="APARTMENT">Wohnung</option>
          <option value="GARAGE">Garage</option>
        </select>

        <div style={{ fontSize: 12, opacity: 0.65, marginLeft: "auto" }}>
          {loading ? "…" : `${filteredRows.length} von ${rows.length} Objekten`}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          title="Gesamtwert Portfolio"
          value={formatEUR(stats.totalValue)}
          hint="Summe der Kaufpreise"
        />
        <KpiCard
          title="Häuser"
          value={`${stats.houses}`}
          hint="Gefilterte Ansicht"
        />
        <KpiCard
          title="Wohnungen"
          value={`${stats.apartments}`}
          hint="Gefilterte Ansicht"
        />
        <KpiCard
          title="Garagen"
          value={`${stats.garages}`}
          hint="Gefilterte Ansicht"
        />
      </div>

      <div style={panelStyle()}>
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900 }}>Objekte</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Klick auf ein Objekt öffnet die Detailseite
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 14, opacity: 0.7 }}>Lädt Objekte…</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>
            Keine Objekte gefunden.
            {showDebug && (
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Debug ist aktiv. Geladene Properties:{" "}
                <b>{properties.data.length}</b>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, padding: 14 }}>
            {filteredRows.map((property) => {
              const purchasePrice = Number(
                financeByPropertyId[property.id]?.purchase_price ?? 0
              );

              const priceLabel =
                purchasePrice > 0 ? formatEUR(purchasePrice) : "—";

              return (
                <PortfolioRow
                  key={property.id}
                  property={property}
                  priceLabel={priceLabel}
                  onOpen={() => goToProperty(property)}
                  onUploadSuccess={handleReload}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioRow({
  property,
  priceLabel,
  onOpen,
  onUploadSuccess,
}: {
  property: PortfolioProperty;
  priceLabel: string;
  onOpen: () => void;
  onUploadSuccess: () => void | Promise<void>;
}) {
  const exposePath = property.expose_path ?? null;

  return (
    <div
      onClick={onOpen}
      style={cardStyle()}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow =
          "0 10px 24px rgba(17,24,39,0.08)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 16 }}>{property.name}</div>

            <span style={typeBadgeStyle()}>{getTypeLabel(property.type)}</span>
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              opacity: 0.65,
            }}
          >
            ID:{" "}
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {property.id}
            </span>
          </div>
        </div>

        <div onClick={(event) => event.stopPropagation()}>
          <ExposeUploadButton
            propertyId={property.id}
            onUploadSuccess={onUploadSuccess}
          />
        </div>

        <div onClick={(event) => event.stopPropagation()}>
          <ExposeButton exposePath={exposePath} />
        </div>

        <div
          style={{
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {priceLabel}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#ffffff",
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
        {title}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 950,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>{hint}</div>
    </div>
  );
}