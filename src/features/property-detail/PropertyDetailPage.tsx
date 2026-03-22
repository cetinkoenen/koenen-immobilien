import { useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { usePropertyDetail } from "./hooks/usePropertyDetail";
import { useLedger } from "./hooks/useLedger";
import { useIncome } from "./hooks/useIncome";
import { MetricsGrid } from "./components/MetricsGrid";
import { YearlyIncomeTable } from "./components/YearlyIncomeTable";
import { YearlyCapexTable } from "./components/YearlyCapexTable";
import { LedgerTable } from "./components/LedgerTable";
import type { Property } from "@/services/propertyService";

function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(date);
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm text-slate-900">
        {value ?? "—"}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function SoftEmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const normalizedPropertyId = useMemo(() => {
    if (!propertyId) return null;
    const trimmed = propertyId.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [propertyId]);

  const {
    data: property,
    isLoading,
    error,
    reload,
  } = usePropertyDetail<Property>(normalizedPropertyId);

  const {
    entries,
    isLoading: ledgerLoading,
    error: ledgerError,
    reload: reloadLedger,
  } = useLedger(normalizedPropertyId);

  const {
    data: incomeData,
    isLoading: incomeLoading,
    error: incomeError,
    reload: reloadIncome,
  } = useIncome(normalizedPropertyId);

  const latestLedgerEntry = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return [...entries].sort((a, b) => Number(b.year) - Number(a.year))[0] ?? null;
  }, [entries]);

  const annualRent = Number(incomeData?.propertyIncome?.annualRent ?? 0);
  const otherIncome = Number(incomeData?.propertyIncome?.otherIncome ?? 0);
  const totalIncome = annualRent + otherIncome;
  const remainingDebt = latestLedgerEntry?.balance ?? null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Objekt wird geladen ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            Fehler beim Laden des Objekts.
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            Erneut laden
          </button>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Kein Objekt gefunden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {property.title || property.name || "Unbenanntes Objekt"}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{property.address || "Keine Adresse hinterlegt"}</span>
                <span className="text-slate-300">•</span>
                <span>{property.city || "Kein Ort hinterlegt"}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  Objekt-ID: {property.id}
                </span>
                {property.source_table ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    Quelle: {property.source_table}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void reloadIncome();
                  void reloadLedger();
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Aktualisieren
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Jahresmiete" value={formatCurrency(annualRent)} />
          <StatCard
            label="Sonstige Einnahmen"
            value={formatCurrency(otherIncome)}
          />
          <StatCard
            label="Gesamteinnahmen"
            value={formatCurrency(totalIncome)}
          />
          <StatCard label="Restschuld" value={formatCurrency(remainingDebt)} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeader
                title="Basisdaten"
                subtitle="Stammdaten und Herkunft des Objekts."
              />

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4">
                <InfoRow label="Name" value={property.name || "—"} />
                <InfoRow label="Titel" value={property.title || "—"} />
                <InfoRow label="Adresse" value={property.address || "—"} />
                <InfoRow label="Stadt" value={property.city || "—"} />
                <InfoRow
                  label="Erstellt am"
                  value={formatDate(property.created_at)}
                />
                <InfoRow label="Quelle" value={property.source_table || "—"} />
              </div>
            </div>
          </div>

          <div className="xl:col-span-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeader
                title="Income"
                subtitle="Mieteinnahmen, Nebeneinnahmen und jährliche Ergänzungsdaten."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      void reloadIncome();
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Neu laden
                  </button>
                }
              />

              {incomeLoading ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Income-Daten werden geladen ...
                </div>
              ) : incomeError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  Income-Daten konnten nicht geladen werden.
                </div>
              ) : (
                <div className="space-y-8">
                  <MetricsGrid income={incomeData?.propertyIncome ?? null} />

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Yearly Income
                      </h3>
                    </div>

                    {incomeData?.yearlyIncome && incomeData.yearlyIncome.length > 0 ? (
                      <YearlyIncomeTable data={incomeData.yearlyIncome} />
                    ) : (
                      <SoftEmptyState
                        title="Keine jährlichen Income-Daten"
                        text="Für dieses Objekt sind derzeit keine jährlichen Income-Einträge hinterlegt."
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Capex
                      </h3>
                    </div>

                    {incomeData?.yearlyCapex && incomeData.yearlyCapex.length > 0 ? (
                      <YearlyCapexTable data={incomeData.yearlyCapex} />
                    ) : (
                      <SoftEmptyState
                        title="Keine Capex-Daten"
                        text="Für dieses Objekt sind derzeit keine Capex-Einträge hinterlegt."
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Darlehensverlauf"
            subtitle="Historie von Zinsen, Tilgung und Restschuld."
            action={
              <div className="flex items-center gap-3">
                {entries?.length ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {entries.length} Einträge
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    void reloadLedger();
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Neu laden
                </button>
              </div>
            }
          />

          {ledgerLoading ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Ledger-Daten werden geladen ...
            </div>
          ) : ledgerError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              Ledger-Daten konnten nicht geladen werden.
            </div>
          ) : entries && entries.length > 0 ? (
            <LedgerTable data={entries} />
          ) : (
            <SoftEmptyState
              title="Keine Ledger-Daten"
              text="Für dieses Objekt sind derzeit keine Darlehensdaten hinterlegt."
            />
          )}
        </section>
      </div>
    </div>
  );
}