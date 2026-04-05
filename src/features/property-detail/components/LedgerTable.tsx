import type { YearlyLedgerEntry } from "@/services/ledgerService";

type Props = {
  data: YearlyLedgerEntry[];
};

function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        —
      </span>
    );
  }

  const normalized = source.trim().toLowerCase();

  const badgeClass =
    normalized === "manual"
      ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
      : normalized === "import"
      ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
      : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}
    >
      {source}
    </span>
  );
}

export function LedgerTable({ data }: Props) {
  const rows = Array.isArray(data)
    ? [...data].sort((a, b) => Number(a.year) - Number(b.year))
    : [];

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
        Keine Ledger-Daten vorhanden.
      </div>
    );
  }

  const latestYear = Math.max(...rows.map((row) => Number(row.year)));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Jahr
              </th>
              <th className="border-b border-slate-200 px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Zinsen
              </th>
              <th className="border-b border-slate-200 px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tilgung
              </th>
              <th className="border-b border-slate-200 px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Restschuld
              </th>
              <th className="border-b border-slate-200 px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Quelle
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isLatest = Number(row.year) === latestYear;

              return (
                <tr
                  key={String(row.id ?? `${row.year}-${row.source ?? "unknown"}`)}
                  className={isLatest ? "bg-slate-50/70" : "bg-white"}
                >
                  <td className="border-b border-slate-100 px-6 py-4 text-sm font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{row.year}</span>
                      {isLatest ? (
                        <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Aktuell
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="border-b border-slate-100 px-6 py-4 text-right text-sm tabular-nums text-slate-900">
                    {formatCurrency(row.interest)}
                  </td>

                  <td className="border-b border-slate-100 px-6 py-4 text-right text-sm tabular-nums text-slate-900">
                    {formatCurrency(row.principal)}
                  </td>

                  <td className="border-b border-slate-100 px-6 py-4 text-right text-sm font-medium tabular-nums text-slate-950">
                    {formatCurrency(row.balance)}
                  </td>

                  <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-700">
                    <SourceBadge source={row.source} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}