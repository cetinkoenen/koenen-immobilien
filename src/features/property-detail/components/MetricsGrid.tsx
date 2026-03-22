import type { PropertyIncome } from "@/types/propertyIncome";

type Props = {
  income: PropertyIncome | null;
};

function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function MetricsGrid({ income }: Props) {
  if (!income) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Keine Income-Daten vorhanden.
      </div>
    );
  }

  const annualRent = Number(income.annualRent ?? 0);
  const otherIncome = Number(income.otherIncome ?? 0);
  const totalIncome = annualRent + otherIncome;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Jahresmiete"
        value={formatCurrency(annualRent)}
        hint="Regelmäßige Mieteinnahmen pro Jahr"
      />

      <MetricCard
        label="Sonstige Einnahmen"
        value={formatCurrency(otherIncome)}
        hint="Zusätzliche objektbezogene Einnahmen"
      />

      <MetricCard
        label="Gesamteinnahmen"
        value={formatCurrency(totalIncome)}
        hint="Summe aus Miete und Nebeneinnahmen"
      />
    </div>
  );
}