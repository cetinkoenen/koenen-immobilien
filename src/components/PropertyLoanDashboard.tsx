export type Row = Record<string, any>;

type PropertyLoanDashboardProps = {
  rows: Row[];
  error: string | null;
};

export default function PropertyLoanDashboard({
  rows,
  error
}: PropertyLoanDashboardProps) {
  if (error) {
    return <div>Fehler: {error}</div>;
  }

  if (!rows.length) {
    return <div>Keine Daten vorhanden</div>;
  }

  return (
    <div>
      <h2>Property Loan Dashboard</h2>
      <pre>{JSON.stringify(rows, null, 2)}</pre>
    </div>
  );
}
