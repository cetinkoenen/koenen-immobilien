import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getPropertyById } from "@/services/propertyService";
import {
  ledgerService,
  type YearlyLedgerEntry,
  type CreateYearlyLedgerEntryInput,
  type UpdateYearlyLedgerEntryInput,
} from "@/services/ledgerService";
import {
  calculateBaseFinanceMetrics,
  simulateFinanceScenario,
  type SimulationInput,
  type RiskLevel,
} from "@/services/financeService";

type Property = {
  id: string;
  name?: string | null;
  title?: string | null;
  address?: string | null;
  city?: string | null;
  created_at?: string | null;
};

type LedgerFormState = {
  year: string;
  interest: string;
  principal: string;
  balance: string;
  source: string;
};

const EMPTY_LEDGER_FORM: LedgerFormState = {
  year: "",
  interest: "",
  principal: "",
  balance: "",
  source: "",
};

const EMPTY_SIMULATION_INPUT: SimulationInput = {
  rentDeltaPct: 0,
  interestDeltaPct: 0,
  principalDeltaPct: 0,
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function parseNumberInput(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseYearInput(value: string): number {
  const parsed = parseNumberInput(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function getRiskLabel(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "green":
      return "Stabil";
    case "yellow":
      return "Beobachten";
    case "red":
      return "Kritisch";
    default:
      return "Unklar";
  }
}

function getRiskBadgeClass(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "green":
      return "border-green-200 bg-green-50 text-green-800";
    case "yellow":
      return "border-yellow-200 bg-yellow-50 text-yellow-800";
    case "red":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function getRiskDotClass(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "green":
      return "bg-green-500";
    case "yellow":
      return "bg-yellow-500";
    case "red":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

export default function ObjektDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const [property, setProperty] = useState<Property | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<YearlyLedgerEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingLedger, setSavingLedger] = useState(false);
  const [deletingLedgerId, setDeletingLedgerId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [annualRent, setAnnualRent] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);

  const [simulationInput, setSimulationInput] =
    useState<SimulationInput>(EMPTY_SIMULATION_INPUT);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [ledgerForm, setLedgerForm] = useState<LedgerFormState>({
    ...EMPTY_LEDGER_FORM,
    year: String(new Date().getFullYear()),
  });

  useEffect(() => {
    async function loadPageData() {
      if (!propertyId) {
        setError("Keine propertyId gefunden.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [propertyData, ledgerData] = await Promise.all([
          getPropertyById(propertyId),
          ledgerService.getByPropertyId(propertyId),
        ]);

        setProperty((propertyData as Property | null) ?? null);
        setLedgerEntries(Array.isArray(ledgerData) ? ledgerData : []);
      } catch (err) {
        console.error("ObjektDetail.loadPageData error:", err);

        if (err instanceof Error) {
          setError(`Die Daten konnten nicht geladen werden: ${err.message}`);
        } else {
          setError("Die Daten konnten nicht geladen werden.");
        }
      } finally {
        setLoading(false);
      }
    }

    void loadPageData();
  }, [propertyId]);

  const income = useMemo(() => {
    return {
      id: "local-income",
      property_id: propertyId ?? "",
      annual_rent: annualRent,
      other_income: otherIncome,
    };
  }, [annualRent, otherIncome, propertyId]);

  const baseMetrics = useMemo(() => {
    return calculateBaseFinanceMetrics(ledgerEntries, income);
  }, [ledgerEntries, income]);

  const simulationResult = useMemo(() => {
    return simulateFinanceScenario(baseMetrics, simulationInput);
  }, [baseMetrics, simulationInput]);

  const propertyTitle =
    property?.name?.trim() ||
    property?.title?.trim() ||
    property?.address?.trim() ||
    "Objekt";

  const latestLedgerEntry = useMemo(() => {
    if (ledgerEntries.length === 0) return null;
    return [...ledgerEntries].sort((a, b) => b.year - a.year)[0];
  }, [ledgerEntries]);

  function resetLedgerEditor() {
    setEditingEntryId(null);
    setLedgerForm({
      ...EMPTY_LEDGER_FORM,
      year: String(new Date().getFullYear()),
    });
  }

  function handleLedgerFormChange(field: keyof LedgerFormState, value: string) {
    setLedgerForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function startCreateLedgerEntry() {
    resetLedgerEditor();
  }

  function startEditLedgerEntry(entry: YearlyLedgerEntry) {
    setEditingEntryId(entry.id);
    setLedgerForm({
      year: String(entry.year),
      interest: String(entry.interest ?? ""),
      principal: String(entry.principal ?? ""),
      balance: String(entry.balance ?? ""),
      source: entry.source ?? "",
    });
  }

  async function handleSubmitLedger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!propertyId) {
      setError("Keine propertyId gefunden.");
      return;
    }

    const year = parseYearInput(ledgerForm.year);

    if (!year || year < 1900 || year > 3000) {
      setError("Bitte ein gültiges Jahr eingeben.");
      return;
    }

    const yearAlreadyExists = ledgerEntries.some(
      (entry) => entry.year === year && entry.id !== editingEntryId
    );

    if (yearAlreadyExists) {
      setError("Für dieses Jahr existiert bereits ein Eintrag.");
      return;
    }

    try {
      setSavingLedger(true);
      setError(null);

      if (editingEntryId) {
        const payload: UpdateYearlyLedgerEntryInput = {
          year,
          interest: parseNumberInput(ledgerForm.interest),
          principal: parseNumberInput(ledgerForm.principal),
          balance: parseNumberInput(ledgerForm.balance),
          source: ledgerForm.source.trim() || null,
        };

        const updated = await ledgerService.update(editingEntryId, payload);

        setLedgerEntries((prev) =>
          prev
            .map((entry) => (entry.id === editingEntryId ? updated : entry))
            .sort((a, b) => b.year - a.year)
        );
      } else {
        const payload: CreateYearlyLedgerEntryInput = {
          propertyId,
          year,
          interest: parseNumberInput(ledgerForm.interest),
          principal: parseNumberInput(ledgerForm.principal),
          balance: parseNumberInput(ledgerForm.balance),
          source: ledgerForm.source.trim() || null,
        };

        const created = await ledgerService.create(payload);

        setLedgerEntries((prev) => [...prev, created].sort((a, b) => b.year - a.year));
      }

      resetLedgerEditor();
    } catch (err) {
      console.error("ObjektDetail.handleSubmitLedger error:", err);

      if (err instanceof Error) {
        setError(`Jahreseintrag konnte nicht gespeichert werden: ${err.message}`);
      } else {
        setError("Jahreseintrag konnte nicht gespeichert werden.");
      }
    } finally {
      setSavingLedger(false);
    }
  }

  async function handleDeleteLedgerEntry(entryId: string) {
    const confirmed = window.confirm("Diesen Jahreseintrag wirklich löschen?");
    if (!confirmed) return;

    try {
      setDeletingLedgerId(entryId);
      setError(null);

      await ledgerService.remove(entryId);

      setLedgerEntries((prev) => prev.filter((entry) => entry.id !== entryId));

      if (editingEntryId === entryId) {
        resetLedgerEditor();
      }
    } catch (err) {
      console.error("ObjektDetail.handleDeleteLedgerEntry error:", err);

      if (err instanceof Error) {
        setError(`Jahreseintrag konnte nicht gelöscht werden: ${err.message}`);
      } else {
        setError("Jahreseintrag konnte nicht gelöscht werden.");
      }
    } finally {
      setDeletingLedgerId(null);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <Panel>
          <p className="text-sm text-gray-500">Lade Objektdaten…</p>
        </Panel>
      </PageShell>
    );
  }

  if (error && !property) {
    return (
      <PageShell>
        <div className="mb-4">
          <BackLink />
        </div>

        <Panel className="border-red-200 bg-red-50">
          <h1 className="mb-2 text-lg font-semibold text-red-800">Fehler</h1>
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-8">
        <Panel className="rounded-3xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <BackLink />

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {propertyTitle}
              </h1>

              <div className="mt-4 grid gap-2 text-sm text-gray-500">
                {property?.address && <p>{property.address}</p>}
                {property?.city && <p>{property.city}</p>}
                {property?.id && <p>Objekt-ID: {property.id}</p>}
              </div>
            </div>

            <div className="shrink-0">
              <RiskBadge riskLevel={baseMetrics.riskLevel} />
            </div>
          </div>
        </Panel>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Kennzahlen</h2>
            <p className="text-sm text-gray-500">
              Überblick über Einnahmen, Schuldendienst und Darlehensentwicklung.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Jährliche Einnahmen"
              value={formatCurrency(baseMetrics.annualIncome)}
            />
            <MetricCard
              title="Jährlicher Schuldendienst"
              value={formatCurrency(baseMetrics.debtService)}
            />
            <MetricCard title="Cashflow" value={formatCurrency(baseMetrics.cashflow)} />
            <MetricCard title="DSCR" value={formatNumber(baseMetrics.dscr)} />
            <MetricCard
              title="Gesamtzinsen"
              value={formatCurrency(baseMetrics.totalInterest)}
            />
            <MetricCard
              title="Gesamttilgung"
              value={formatCurrency(baseMetrics.totalPrincipal)}
            />
            <MetricCard
              title="Ø Zinsen pro Jahr"
              value={formatCurrency(baseMetrics.avgInterestPerYear)}
            />
            <MetricCard
              title="Ø Tilgung pro Jahr"
              value={formatCurrency(baseMetrics.avgPrincipalPerYear)}
            />
            <MetricCard
              title="Aktuelle Restschuld"
              value={formatCurrency(
                latestLedgerEntry?.balance ?? baseMetrics.currentRemainingBalance
              )}
            />
            <MetricCard
              title="Letztes Ledger-Jahr"
              value={latestLedgerEntry ? String(latestLedgerEntry.year) : "—"}
            />
            <MetricCard
              title="Geschätzte Restlaufzeit"
              value={
                baseMetrics.estimatedRemainingYears !== null
                  ? `${formatNumber(baseMetrics.estimatedRemainingYears, 1)} Jahre`
                  : "—"
              }
            />
            <MetricCard
              title="Schuldenfrei voraussichtlich"
              value={
                baseMetrics.estimatedDebtFreeYear !== null
                  ? String(baseMetrics.estimatedDebtFreeYear)
                  : "—"
              }
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="rounded-3xl">
            <h2 className="text-xl font-semibold text-gray-900">Einnahmen</h2>
            <p className="mt-1 text-sm text-gray-500">
              Aktuell noch im lokalen State. Später wird das in{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-700">
                property_income
              </code>{" "}
              persistiert.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Jahresmiete">
                <input
                  type="number"
                  value={annualRent}
                  onChange={(e) => setAnnualRent(parseNumberInput(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="z. B. 18000"
                />
              </Field>

              <Field label="Sonstige Einnahmen">
                <input
                  type="number"
                  value={otherIncome}
                  onChange={(e) => setOtherIncome(parseNumberInput(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="z. B. 1200"
                />
              </Field>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Gesamte jährliche Einnahmen</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">
                  {formatCurrency(baseMetrics.annualIncome)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="rounded-3xl xl:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900">Szenario-Simulation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Vereinfachte Szenarioanalyse auf Basis historischer Durchschnittswerte.
              Keine bankmathematisch exakte Tilgungsprognose.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Miete Veränderung (%)">
                <input
                  type="number"
                  value={simulationInput.rentDeltaPct}
                  onChange={(e) =>
                    setSimulationInput((prev) => ({
                      ...prev,
                      rentDeltaPct: parseNumberInput(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </Field>

              <Field label="Zinsen Veränderung (%)">
                <input
                  type="number"
                  value={simulationInput.interestDeltaPct}
                  onChange={(e) =>
                    setSimulationInput((prev) => ({
                      ...prev,
                      interestDeltaPct: parseNumberInput(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </Field>

              <Field label="Tilgung Veränderung (%)">
                <input
                  type="number"
                  value={simulationInput.principalDeltaPct}
                  onChange={(e) =>
                    setSimulationInput((prev) => ({
                      ...prev,
                      principalDeltaPct: parseNumberInput(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </Field>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Simulierter Cashflow"
                value={formatCurrency(simulationResult.cashflow)}
              />
              <MetricCard
                title="Simulierter DSCR"
                value={formatNumber(simulationResult.dscr)}
              />
              <MetricCard
                title="Simulierte Restlaufzeit"
                value={
                  simulationResult.estimatedRemainingYears !== null
                    ? `${formatNumber(simulationResult.estimatedRemainingYears, 1)} Jahre`
                    : "—"
                }
              />
              <MetricCard
                title="Simuliertes Risiko"
                value={getRiskLabel(simulationResult.riskLevel)}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Delta zur Basis</h3>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <DeltaItem
                  label="Cashflow"
                  value={simulationResult.deltaCashflow}
                  formatter={formatCurrency}
                />
                <DeltaItem
                  label="DSCR"
                  value={simulationResult.deltaDscr}
                  formatter={(value) => formatNumber(value, 2)}
                />
                <DeltaItem
                  label="Restlaufzeit"
                  value={simulationResult.deltaRemainingYears}
                  formatter={(value) =>
                    value === null ? "—" : `${formatNumber(value, 1)} Jahre`
                  }
                />
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="rounded-3xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Darlehenshistorie</h2>
              <p className="mt-1 text-sm text-gray-500">
                Jährliche Zins-, Tilgungs- und Restschuldentwicklung.
              </p>
            </div>

            <button
              type="button"
              onClick={startCreateLedgerEntry}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Neuer Jahreseintrag
            </button>
          </div>

          <form
            onSubmit={handleSubmitLedger}
            className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4"
          >
            <h3 className="text-sm font-semibold text-gray-800">
              {editingEntryId ? "Jahreseintrag bearbeiten" : "Neuen Jahreseintrag anlegen"}
            </h3>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Jahr">
                <input
                  type="number"
                  value={ledgerForm.year}
                  onChange={(e) => handleLedgerFormChange("year", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="z. B. 2025"
                  required
                />
              </Field>

              <Field label="Zinsen">
                <input
                  type="number"
                  step="0.01"
                  value={ledgerForm.interest}
                  onChange={(e) => handleLedgerFormChange("interest", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="0.00"
                />
              </Field>

              <Field label="Tilgung">
                <input
                  type="number"
                  step="0.01"
                  value={ledgerForm.principal}
                  onChange={(e) => handleLedgerFormChange("principal", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="0.00"
                />
              </Field>

              <Field label="Restschuld">
                <input
                  type="number"
                  step="0.01"
                  value={ledgerForm.balance}
                  onChange={(e) => handleLedgerFormChange("balance", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="0.00"
                />
              </Field>

              <Field label="Quelle">
                <input
                  type="text"
                  value={ledgerForm.source}
                  onChange={(e) => handleLedgerFormChange("source", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="optional"
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingLedger}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingLedger
                  ? "Speichert…"
                  : editingEntryId
                  ? "Änderungen speichern"
                  : "Eintrag speichern"}
              </button>

              <button
                type="button"
                onClick={resetLedgerEditor}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Zurücksetzen
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                  <th className="px-4 py-3 font-medium">Jahr</th>
                  <th className="px-4 py-3 font-medium">Zinsen</th>
                  <th className="px-4 py-3 font-medium">Tilgung</th>
                  <th className="px-4 py-3 font-medium">Restschuld</th>
                  <th className="px-4 py-3 font-medium">Quelle</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>

              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-0 py-4">
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                        Noch keine Jahreseinträge vorhanden.
                      </div>
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-100 text-sm text-gray-800 last:border-0"
                    >
                      <td className="px-4 py-4">{entry.year}</td>
                      <td className="px-4 py-4">{formatCurrency(entry.interest)}</td>
                      <td className="px-4 py-4">{formatCurrency(entry.principal)}</td>
                      <td className="px-4 py-4">{formatCurrency(entry.balance)}</td>
                      <td className="px-4 py-4">{entry.source || "—"}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditLedgerEntry(entry)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            Bearbeiten
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLedgerEntry(entry.id)}
                            disabled={deletingLedgerId === entry.id}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingLedgerId === entry.id ? "Löscht…" : "Löschen"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>;
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function BackLink() {
  return (
    <Link
      to="/objekte"
      className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline"
    >
      ← Zurück zur Objektliste
    </Link>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
    </div>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${getRiskBadgeClass(
        riskLevel
      )}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${getRiskDotClass(riskLevel)}`} />
      <span>{getRiskLabel(riskLevel)}</span>
    </div>
  );
}

function DeltaItem({
  label,
  value,
  formatter,
}: {
  label: string;
  value: number | null;
  formatter: (value: number | null) => string;
}) {
  const isPositive = value !== null && value > 0;
  const isNegative = value !== null && value < 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`mt-2 text-base font-semibold ${
          isPositive ? "text-green-700" : isNegative ? "text-red-700" : "text-gray-900"
        }`}
      >
        {value !== null && value > 0 ? "+" : ""}
        {formatter(value)}
      </p>
    </div>
  );
}