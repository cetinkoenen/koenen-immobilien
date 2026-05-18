import PropertyDetailPage from "../../features/property-detail/PropertyDetailPage";

type FinanceModule = "all" | "darlehen" | "finance" | "income" | "capex";

const INTRO: Record<FinanceModule, string> = {
  all: "Gesamte Objektakte: Darlehensübersicht/Edit, Finance pro Jahr, Income, Capex und Diagramme.",
  darlehen: "Darlehensübersicht/Edit: jährliche Zinsen, Tilgung, Debt Service und Restschuld direkt je Immobilie bearbeiten.",
  finance: "Finance pro Jahr: jährliche Finanzkennzahlen aus Income, Capex und Darlehensdaten.",
  income: "Income: jährliche Einnahmen und weitere Erträge dieser Immobilie.",
  capex: "Capex: jährliche Instandhaltungs-, Sanierungs- und Reparaturwerte dieser Immobilie.",
};

export default function PortfolioFinanceModules({ focus = "all" }: { focus?: FinanceModule }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          border: "1px solid #dbeafe",
          background: "#f8fbff",
          color: "#1e3a8a",
          padding: 14,
          borderRadius: 16,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.55,
        }}
      >
        {INTRO[focus]}
      </div>
      <PropertyDetailPage mode="detail" focus={focus} />
    </div>
  );
}
