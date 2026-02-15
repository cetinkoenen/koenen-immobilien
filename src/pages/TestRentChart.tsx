import RentDevelopmentChart from "../components/RentDevelopmentChart";

export default function TestRentChart() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
        Test: Mietkosten Entwicklung
      </h1>

      <RentDevelopmentChart portfolioUnitId="3449c045-ed63-4b73-8268-0865d784d77e" />
    </div>
  );
}
