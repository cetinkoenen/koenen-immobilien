import type { YearlyCapexEntry } from "@/types/finance";

type Props = {
  data: YearlyCapexEntry[];
};

function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        —
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
      {category}
    </span>
  );
}

export function YearlyCapexTable({ data }: Props) {
  const rows = Array.isArray(data)
    ? [...data].sort((a, b) => Number(a.year) - Number(b.year))
    : [];

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Keine Capex-Daten vorhanden.
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
                Betrag
              </th>
              <th className="border-b border-slate-200 px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Kategorie
              </th>
              <th className="border-b border-slate-200 px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notiz
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isLatest = Number(row.year) === latestYear;

              return (
                <tr
                  key={String(
                    row.id ??
                      `${row.year}-${row.category ?? "unknown"}-${row.amount ?? "0"}`
                  )}
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

                  <td className="border-b border-slate-100 px-6 py-4 text-right text-sm font-medium tabular-nums text-slate-950">
                    {formatCurrency(row.amount)}
                  </td>

                  <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-700">
                    <CategoryBadge category={row.category} />
                  </td>

                  <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-700">
                    {row.note || "—"}
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