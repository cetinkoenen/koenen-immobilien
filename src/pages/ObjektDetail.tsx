import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getPropertyById } from "@/services/propertyService";
import {
  ledgerService,
  type CreateYearlyLedgerEntryInput,
  type UpdateYearlyLedgerEntryInput,
  type YearlyLedgerEntry,
} from "@/services/ledgerService";
import { propertyIncomeService } from "@/services/propertyIncomeService";
import { yearlyIncomeService } from "@/services/yearlyIncomeService";
import { yearlyCapexService } from "@/services/yearlyCapexService";
import {
  buildFinanceChartData,
  calculateBaseFinanceMetrics,
  calculateYearlyFinanceMetrics,
  simulateFinanceScenario,
} from "@/services/financeService";
import type {
  FinanceChartDataPoint,
  PropertyIncome,
  RiskLevel,
  SimulationInput,
  YearlyCapexEntry,
  YearlyIncomeEntry,
} from "@/types/finance";
import BalanceChart from "@/components/charts/BalanceChart";
import CashflowChart from "@/components/charts/CashflowChart";
import DscrChart from "@/components/charts/DscrChart";

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

type PropertyIncomeRecord = {
  id: string;
  propertyId: string;
  annualRent: number;
  otherIncome: number;
  createdAt?: string;
  updatedAt?: string;
};

type EditableYearlyIncomeRow = {
  id?: string;
  year: string;
  annual_rent: string;
  other_income: string;
  isNew?: boolean;
  isDirty?: boolean;
};

type EditableYearlyCapexRow = {
  id?: string;
  year: string;
  amount: string;
  category: string;
  note: string;
  isNew?: boolean;
  isDirty?: boolean;
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
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function parseNumberInput(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseYearInput(value: string): number {
  return Math.trunc(parseNumberInput(value));
}

function validateIncomeValues(annualRent: number, otherIncome: number): string | null {
  if (annualRent < 0) {
    return "Jahresmiete darf nicht negativ sein.";
  }

  if (otherIncome < 0) {
    return "Sonstige Einnahmen dürfen nicht negativ sein.";
  }

  return null;
}

function validateYearlyIncomeValues(
  year: number,
  annualRent: number,
  otherIncome: number
): string | null {
  if (!year || year < 1900 || year > 3000) {
    return "Bitte ein gültiges Jahr eingeben.";
  }

  if (annualRent < 0) {
    return "Jahresmiete darf nicht negativ sein.";
  }

  if (otherIncome < 0) {
    return "Sonstige Einnahmen dürfen nicht negativ sein.";
  }

  return null;
}

function validateYearlyCapexValues(year: number, amount: number): string | null {
  if (!year || year < 1900 || year > 3000) {
    return "Bitte ein gültiges Jahr eingeben.";
  }

  if (amount < 0) {
    return "CapEx darf nicht negativ sein.";
  }

  return null;
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

function getRiskDescription(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "green":
      return "Die Kennzahlen wirken aktuell stabil und tragfähig.";
    case "yellow":
      return "Die Finanzierung sollte beobachtet und regelmäßig geprüft werden.";
    case "red":
      return "Die Finanzierung ist aktuell kritisch und sollte überprüft werden.";
    default:
      return "Zur Einordnung sind weitere Daten nötig.";
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

function toFinancePropertyIncome(input: {
  id?: string;
  propertyId: string;
  annualRent: number;
  otherIncome: number;
}): PropertyIncome {
  return {
    id: input.id ?? "property-income-local",
    property_id: input.propertyId,
    annual_rent: input.annualRent,
    other_income: input.otherIncome,
  };
}

function normalizePropertyIncomeRecord(input: unknown): PropertyIncomeRecord | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;

  const id = typeof record.id === "string" ? record.id : "property-income-local";
  const propertyId =
    typeof record.propertyId === "string"
      ? record.propertyId
      : typeof record.property_id === "string"
        ? record.property_id
        : "";

  const annualRent =
    typeof record.annualRent === "number"
      ? record.annualRent
      : typeof record.annual_rent === "number"
        ? record.annual_rent
        : 0;

  const otherIncome =
    typeof record.otherIncome === "number"
      ? record.otherIncome
      : typeof record.other_income === "number"
        ? record.other_income
        : 0;

  const createdAt =
    typeof record.createdAt === "string"
      ? record.createdAt
      : typeof record.created_at === "string"
        ? record.created_at
        : undefined;

  const updatedAt =
    typeof record.updatedAt === "string"
      ? record.updatedAt
      : typeof record.updated_at === "string"
        ? record.updated_at
        : undefined;

  return {
    id,
    propertyId,
    annualRent,
    otherIncome,
    createdAt,
    updatedAt,
  };
}

function toEditableYearlyIncomeRow(entry: YearlyIncomeEntry): EditableYearlyIncomeRow {
  return {
    id: entry.id,
    year: String(entry.year),
    annual_rent: String(entry.annual_rent ?? 0),
    other_income: String(entry.other_income ?? 0),
    isNew: false,
    isDirty: false,
  };
}

function toEditableYearlyCapexRow(entry: YearlyCapexEntry): EditableYearlyCapexRow {
  return {
    id: entry.id,
    year: String(entry.year),
    amount: String(entry.amount ?? 0),
    category: entry.category ?? "",
    note: entry.note ?? "",
    isNew: false,
    isDirty: false,
  };
}

function sortYearlyIncomeEntries(entries: YearlyIncomeEntry[]): YearlyIncomeEntry[] {
  return [...entries].sort((a, b) => a.year - b.year);
}

function sortEditableYearlyIncomeRows(
  rows: EditableYearlyIncomeRow[]
): EditableYearlyIncomeRow[] {
  return [...rows].sort((a, b) => Number(a.year) - Number(b.year));
}

function sortYearlyCapexEntries(entries: YearlyCapexEntry[]): YearlyCapexEntry[] {
  return [...entries].sort((a, b) => a.year - b.year);
}

function sortEditableYearlyCapexRows(
  rows: EditableYearlyCapexRow[]
): EditableYearlyCapexRow[] {
  return [...rows].sort((a, b) => Number(a.year) - Number(b.year));
}

export default function ObjektDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const [property, setProperty] = useState<Property | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<YearlyLedgerEntry[]>([]);
  const [incomeRecord, setIncomeRecord] = useState<PropertyIncomeRecord | null>(null);
  const [yearlyIncomeEntries, setYearlyIncomeEntries] = useState<YearlyIncomeEntry[]>([]);
  const [yearlyCapexEntries, setYearlyCapexEntries] = useState<YearlyCapexEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingLedger, setSavingLedger] = useState(false);
  const [deletingLedgerId, setDeletingLedgerId] = useState<string | null>(null);

  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeSaving, setIncomeSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);

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
        setIncomeLoading(true);
        setError(null);
        setIncomeError(null);

        const [
          propertyData,
          ledgerData,
          propertyIncomeData,
          yearlyIncomeData,
          yearlyCapexData,
        ] = await Promise.all([
          getPropertyById(propertyId),
          ledgerService.getByPropertyId(propertyId),
          propertyIncomeService.getByPropertyId(propertyId),
          yearlyIncomeService.getByPropertyId(propertyId),
          yearlyCapexService.getByPropertyId(propertyId),
        ]);

        setProperty((propertyData as Property | null) ?? null);

        setLedgerEntries(
          Array.isArray(ledgerData) ? [...ledgerData].sort((a, b) => b.year - a.year) : []
        );

        setYearlyIncomeEntries(
          Array.isArray(yearlyIncomeData) ? sortYearlyIncomeEntries(yearlyIncomeData) : []
        );

        setYearlyCapexEntries(
          Array.isArray(yearlyCapexData) ? sortYearlyCapexEntries(yearlyCapexData) : []
        );

        const normalizedIncomeRecord = normalizePropertyIncomeRecord(propertyIncomeData);
        setIncomeRecord(normalizedIncomeRecord);
        setAnnualRent(normalizedIncomeRecord?.annualRent ?? 0);
        setOtherIncome(normalizedIncomeRecord?.otherIncome ?? 0);
      } catch (err) {
        console.error("ObjektDetail.loadPageData error:", err);

        if (err instanceof Error) {
          setError(`Die Daten konnten nicht geladen werden: ${err.message}`);
        } else {
          setError("Die Daten konnten nicht geladen werden.");
        }
      } finally {
        setLoading(false);
        setIncomeLoading(false);
      }
    }

    void loadPageData();
  }, [propertyId]);

  const propertyTitle =
    property?.name?.trim() ||
    property?.title?.trim() ||
    property?.address?.trim() ||
    "Objekt";

  const hasIncomeChanges = useMemo(() => {
    return (
      annualRent !== (incomeRecord?.annualRent ?? 0) ||
      otherIncome !== (incomeRecord?.otherIncome ?? 0)
    );
  }, [annualRent, otherIncome, incomeRecord]);

  const fallbackIncome = useMemo(() => {
    if (!propertyId) {
      return null;
    }

    return toFinancePropertyIncome({
      id: incomeRecord?.id,
      propertyId,
      annualRent,
      otherIncome,
    });
  }, [incomeRecord?.id, propertyId, annualRent, otherIncome]);

  const yearlyMetrics = useMemo(() => {
    return calculateYearlyFinanceMetrics(
      ledgerEntries,
      yearlyIncomeEntries,
      yearlyCapexEntries,
      fallbackIncome
    );
  }, [ledgerEntries, yearlyIncomeEntries, yearlyCapexEntries, fallbackIncome]);

  const baseMetrics = useMemo(() => {
    return calculateBaseFinanceMetrics(
      ledgerEntries,
      fallbackIncome,
      yearlyIncomeEntries,
      yearlyCapexEntries
    );
  }, [ledgerEntries, fallbackIncome, yearlyIncomeEntries, yearlyCapexEntries]);

  const simulationResult = useMemo(() => {
    return simulateFinanceScenario(baseMetrics, simulationInput);
  }, [baseMetrics, simulationInput]);

  const latestLedgerEntry = useMemo(() => {
    if (ledgerEntries.length === 0) {
      return null;
    }

    return [...ledgerEntries].sort((a, b) => b.year - a.year)[0];
  }, [ledgerEntries]);

  const latestYearlyMetric = useMemo(() => {
    if (yearlyMetrics.length === 0) {
      return null;
    }

    return [...yearlyMetrics].sort((a, b) => b.year - a.year)[0];
  }, [yearlyMetrics]);

  const chartData: FinanceChartDataPoint[] = useMemo(() => {
    return buildFinanceChartData(yearlyMetrics);
  }, [yearlyMetrics]);

  const dscrChartData = useMemo(() => {
    return chartData.flatMap((entry) =>
      entry.dscr === null
        ? []
        : [
            {
              year: entry.year,
              dscr: entry.dscr,
            },
          ]
    );
  }, [chartData]);

  const ledgerYears = useMemo(() => {
    return [...new Set(ledgerEntries.map((entry) => entry.year))].sort((a, b) => a - b);
  }, [ledgerEntries]);

  const usesYearlyIncomeData = yearlyIncomeEntries.length > 0;
  const usesYearlyCapexData = yearlyCapexEntries.length > 0;

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

  async function handleSaveIncome() {
    if (!propertyId) {
      setIncomeError("Keine propertyId gefunden.");
      return;
    }

    const validationError = validateIncomeValues(annualRent, otherIncome);
    if (validationError) {
      setIncomeError(validationError);
      return;
    }

    try {
      setIncomeSaving(true);
      setIncomeError(null);

      const saved = await propertyIncomeService.upsertByPropertyId(propertyId, {
        annualRent,
        otherIncome,
      });

      const normalized = normalizePropertyIncomeRecord(saved);
      setIncomeRecord(normalized);
    } catch (err) {
      console.error("ObjektDetail.handleSaveIncome error:", err);

      if (err instanceof Error) {
        setIncomeError(`Einnahmen konnten nicht gespeichert werden: ${err.message}`);
      } else {
        setIncomeError("Einnahmen konnten nicht gespeichert werden.");
      }
    } finally {
      setIncomeSaving(false);
    }
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
    if (!confirmed) {
      return;
    }

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
        <Panel>
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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Kennzahlen</h2>
            <p className="text-sm text-gray-500">
              Überblick über Einnahmen, Schuldendienst, CapEx und Darlehensentwicklung auf
              Basis echter Jahreswerte.
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
            <MetricCard title="Gesamtzinsen" value={formatCurrency(baseMetrics.totalInterest)} />
            <MetricCard
              title="Gesamttilgung"
              value={formatCurrency(baseMetrics.totalPrincipal)}
            />
            <MetricCard title="Gesamt-CapEx" value={formatCurrency(baseMetrics.totalCapex)} />
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
          <Panel className="xl:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900">Basis-Einnahmen</h2>
            <p className="mt-1 text-sm text-gray-500">
              Persistente Einnahmenbasis pro Objekt. Sie dient als Fallback, solange noch
              nicht für jedes Jahr eigene Income-Daten gepflegt sind.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Jahresmiete">
                <input
                  type="number"
                  min={0}
                  value={annualRent}
                  onChange={(e) => setAnnualRent(parseNumberInput(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="z. B. 18000"
                />
              </Field>

              <Field label="Sonstige Einnahmen">
                <input
                  type="number"
                  min={0}
                  value={otherIncome}
                  onChange={(e) => setOtherIncome(parseNumberInput(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="z. B. 1200"
                />
              </Field>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Aktive Einnahmenbasis</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">
                  {formatCurrency(baseMetrics.annualIncome)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  {usesYearlyIncomeData
                    ? "Für die Berechnung werden vorhandene Jahresdaten bevorzugt verwendet."
                    : "Aktuell wird ausschließlich die statische Objekt-Einnahmenbasis verwendet."}
                </p>
              </div>

              {incomeLoading && (
                <div className="rounded-2xl border border-gray-200 bg-blue-50 p-3 text-sm text-blue-700">
                  Einnahmen werden geladen…
                </div>
              )}

              {incomeError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {incomeError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveIncome}
                  disabled={incomeSaving || incomeLoading || !hasIncomeChanges}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {incomeSaving ? "Speichert…" : "Einnahmen speichern"}
                </button>

                <span className="text-sm text-gray-500">
                  {incomeRecord ? "Persistiert" : "Noch kein Datensatz vorhanden"}
                </span>
              </div>
            </div>
          </Panel>

          <Panel className="xl:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900">Szenario-Simulation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Vereinfachte Szenarioanalyse auf Basis der aktuell aggregierten Kennzahlen.
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

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Simulierter Cashflow"
                value={formatCurrency(simulationResult.cashflow)}
              />
              <MetricCard
                title="Simulierter DSCR"
                value={formatNumber(simulationResult.dscr)}
              />
              <MetricCard
                title="CapEx in Simulation"
                value={formatCurrency(simulationResult.capex)}
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

        <YearlyIncomePanel
          propertyId={propertyId ?? ""}
          baseIncome={fallbackIncome}
          yearlyIncomeEntries={yearlyIncomeEntries}
          ledgerYears={ledgerYears}
          onEntriesChange={(entries) => setYearlyIncomeEntries(sortYearlyIncomeEntries(entries))}
        />

        <YearlyCapexPanel
          propertyId={propertyId ?? ""}
          yearlyCapexEntries={yearlyCapexEntries}
          ledgerYears={ledgerYears}
          onEntriesChange={(entries) => setYearlyCapexEntries(sortYearlyCapexEntries(entries))}
        />

        <Panel>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Schuldenverlauf</h2>
              <p className="mt-1 text-sm text-gray-500">
                Visualisierung der Restschuld über die vorhandenen Jahresdaten.
              </p>
            </div>

            {latestLedgerEntry && (
              <div className="text-sm text-gray-500">
                Letzter Datenpunkt:{" "}
                <span className="font-medium text-gray-800">{latestLedgerEntry.year}</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            {chartData.length > 0 ? (
              <BalanceChart
                data={chartData.map((entry) => ({
                  year: entry.year,
                  balance: entry.balance,
                }))}
              />
            ) : (
              <EmptyChartState />
            )}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Cashflow-Verlauf</h2>
              <p className="mt-1 text-sm text-gray-500">
                Echte Jahresreihe auf Basis von Ledger-Daten, Income und CapEx.
              </p>
            </div>

            <div className="mt-6">
              {chartData.length > 0 ? (
                <CashflowChart
                  data={chartData.map((entry) => ({
                    year: entry.year,
                    cashflow: entry.cashflow,
                  }))}
                />
              ) : (
                <EmptyChartState />
              )}
            </div>
          </Panel>

          <Panel>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">DSCR-Verlauf</h2>
              <p className="mt-1 text-sm text-gray-500">
                Echte Jahresreihe statt konstanter MVP-Darstellung.
              </p>
            </div>

            <div className="mt-6">
              {dscrChartData.length > 0 ? (
                <DscrChart data={dscrChartData} />
              ) : (
                <EmptyChartState />
              )}
            </div>
          </Panel>
        </div>

        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Risiko-Einordnung</h2>
              <p className="mt-1 text-sm text-gray-500">
                Vereinfachte qualitative Bewertung auf Basis der aktuellen Kennzahlen.
              </p>
            </div>

            <RiskBadge riskLevel={baseMetrics.riskLevel} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
            <InfoCard
              title="Status"
              value={getRiskLabel(baseMetrics.riskLevel)}
              description={getRiskDescription(baseMetrics.riskLevel)}
            />

            <InfoCard
              title="DSCR-Einordnung"
              value={formatNumber(baseMetrics.dscr)}
              description={
                baseMetrics.dscr !== null && baseMetrics.dscr < 1
                  ? "Der Schuldendienst wird durch die Einnahmen aktuell nicht vollständig gedeckt."
                  : "Die Einnahmen decken den Schuldendienst aktuell rechnerisch ab."
              }
            />

            <InfoCard
              title="Cashflow-Einordnung"
              value={formatCurrency(baseMetrics.cashflow)}
              description={
                baseMetrics.cashflow < 0
                  ? "Der laufende Cashflow nach CapEx ist aktuell negativ."
                  : "Der laufende Cashflow nach CapEx ist aktuell positiv."
              }
            />

            <InfoCard
              title="CapEx-Einordnung"
              value={formatCurrency(baseMetrics.totalCapex)}
              description={
                baseMetrics.totalCapex > 0
                  ? "CapEx wird bereits in den Cashflow einbezogen."
                  : "Aktuell sind keine CapEx-Daten in der Zeitreihe hinterlegt."
              }
            />
          </div>
        </Panel>

        <Panel>
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

        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Zeitreihen-Status</h2>
              <p className="mt-1 text-sm text-gray-500">
                Überblick darüber, ob bereits echte yearly-income- und yearly-capex-Daten
                vorliegen.
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
              {usesYearlyIncomeData ? "Yearly income aktiv" : "Fallback auf property income"}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <InfoCard
              title="Yearly Income Einträge"
              value={String(yearlyIncomeEntries.length)}
              description="Anzahl vorhandener jahresbezogener Income-Datensätze."
            />
            <InfoCard
              title="Yearly CapEx Einträge"
              value={String(yearlyCapexEntries.length)}
              description="Anzahl vorhandener jahresbezogener CapEx-Datensätze."
            />
            <InfoCard
              title="Yearly Metrics"
              value={String(yearlyMetrics.length)}
              description="Anzahl berechneter Jahresmetriken aus Ledger, Income und CapEx."
            />
            <InfoCard
              title="Letzte Finanzreihe"
              value={latestYearlyMetric ? String(latestYearlyMetric.year) : "—"}
              description="Jüngstes Jahr in der aktuell berechneten Finanzzeitreihe."
            />
          </div>

          {usesYearlyCapexData && latestYearlyMetric && (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Letzter berechneter CapEx-Wert ({latestYearlyMetric.year}):{" "}
              <span className="font-semibold text-gray-900">
                {formatCurrency(latestYearlyMetric.capex)}
              </span>
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}

function YearlyIncomePanel({
  propertyId,
  baseIncome,
  yearlyIncomeEntries,
  ledgerYears,
  onEntriesChange,
}: {
  propertyId: string;
  baseIncome: PropertyIncome | null;
  yearlyIncomeEntries: YearlyIncomeEntry[];
  ledgerYears: number[];
  onEntriesChange: (entries: YearlyIncomeEntry[]) => void;
}) {
  const [rows, setRows] = useState<EditableYearlyIncomeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isApplyingBase, setIsApplyingBase] = useState(false);
  const [showAddYearBox, setShowAddYearBox] = useState(false);

  useEffect(() => {
    setRows(sortEditableYearlyIncomeRows(yearlyIncomeEntries.map(toEditableYearlyIncomeRow)));
  }, [yearlyIncomeEntries]);

  const existingYears = useMemo(() => {
    return new Set(rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year)));
  }, [rows]);

  const suggestedYears = useMemo(() => {
    return ledgerYears.filter((year) => !existingYears.has(year)).sort((a, b) => a - b);
  }, [ledgerYears, existingYears]);

  const baseIncomeTotal = (baseIncome?.annual_rent ?? 0) + (baseIncome?.other_income ?? 0);

  function updateRow(index: number, field: keyof EditableYearlyIncomeRow, value: string) {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
              isDirty: true,
            }
          : row
      )
    );
  }

  function addNewRow(prefilledYear?: number) {
    setError(null);

    const defaultYear =
      prefilledYear ??
      (() => {
        if (suggestedYears.length > 0) {
          return suggestedYears[0];
        }

        if (rows.length > 0) {
          return Math.max(...rows.map((row) => Number(row.year) || 0)) + 1;
        }

        if (ledgerYears.length > 0) {
          return ledgerYears[0];
        }

        return new Date().getFullYear();
      })();

    if (existingYears.has(defaultYear)) {
      setError(`Für das Jahr ${defaultYear} existiert bereits ein Eintrag.`);
      return;
    }

    const newRow: EditableYearlyIncomeRow = {
      year: String(defaultYear),
      annual_rent: String(baseIncome?.annual_rent ?? 0),
      other_income: String(baseIncome?.other_income ?? 0),
      isNew: true,
      isDirty: true,
    };

    setRows((prev) => sortEditableYearlyIncomeRows([...prev, newRow]));
  }

  function resetRow(index: number) {
    const row = rows[index];
    if (!row) return;

    if (!row.id) {
      setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
      return;
    }

    const original = yearlyIncomeEntries.find((entry) => entry.id === row.id);
    if (!original) return;

    setRows((prev) =>
      prev.map((currentRow, rowIndex) =>
        rowIndex === index ? toEditableYearlyIncomeRow(original) : currentRow
      )
    );
  }

  async function handleSaveRow(index: number) {
    const row = rows[index];
    if (!row || !propertyId) {
      return;
    }

    const year = parseYearInput(row.year);
    const annualRent = parseNumberInput(row.annual_rent);
    const otherIncome = parseNumberInput(row.other_income);

    const validationError = validateYearlyIncomeValues(year, annualRent, otherIncome);
    if (validationError) {
      setError(validationError);
      return;
    }

    const duplicateCount = rows.filter((entry) => parseYearInput(entry.year) === year).length;
    if (duplicateCount > 1) {
      setError(`Das Jahr ${year} ist mehrfach vorhanden.`);
      return;
    }

    try {
      setError(null);
      const saveKey = row.id ?? `new-${index}`;
      setSavingRowKey(saveKey);

      let saved: YearlyIncomeEntry;

      if (row.id) {
        saved = await yearlyIncomeService.update(row.id, {
          year,
          annual_rent: annualRent,
          other_income: otherIncome,
        });
      } else {
        saved = await yearlyIncomeService.create({
          property_id: propertyId,
          year,
          annual_rent: annualRent,
          other_income: otherIncome,
        });
      }

      const nextEntries = row.id
        ? yearlyIncomeEntries.map((entry) => (entry.id === saved.id ? saved : entry))
        : [...yearlyIncomeEntries, saved];

      onEntriesChange(sortYearlyIncomeEntries(nextEntries));
    } catch (err) {
      console.error("YearlyIncomePanel.handleSaveRow error:", err);

      if (err instanceof Error) {
        setError(`Yearly income konnte nicht gespeichert werden: ${err.message}`);
      } else {
        setError("Yearly income konnte nicht gespeichert werden.");
      }
    } finally {
      setSavingRowKey(null);
    }
  }

  async function handleDeleteRow(index: number) {
    const row = rows[index];
    if (!row) {
      return;
    }

    if (!row.id) {
      setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
      return;
    }

    const confirmed = window.confirm("Diesen yearly-income-Eintrag wirklich löschen?");
    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setDeletingRowId(row.id);

      await yearlyIncomeService.remove(row.id);

      onEntriesChange(yearlyIncomeEntries.filter((entry) => entry.id !== row.id));
    } catch (err) {
      console.error("YearlyIncomePanel.handleDeleteRow error:", err);

      if (err instanceof Error) {
        setError(`Yearly income konnte nicht gelöscht werden: ${err.message}`);
      } else {
        setError("Yearly income konnte nicht gelöscht werden.");
      }
    } finally {
      setDeletingRowId(null);
    }
  }

  async function handleApplyBaseToAllYears() {
    if (!propertyId) {
      setError("Keine propertyId gefunden.");
      return;
    }

    if (!baseIncome) {
      setError("Keine Basis-Einnahmen vorhanden.");
      return;
    }

    const yearsToApply =
      ledgerYears.length > 0
        ? [...new Set(ledgerYears)].sort((a, b) => a - b)
        : rows
            .map((row) => parseYearInput(row.year))
            .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 3000);

    if (yearsToApply.length === 0) {
      setError("Es sind keine Jahre vorhanden, auf die Basis-Einnahmen angewendet werden können.");
      return;
    }

    try {
      setError(null);
      setIsApplyingBase(true);

      const results = await Promise.all(
        yearsToApply.map((year) =>
          yearlyIncomeService.upsertByPropertyIdAndYear(propertyId, year, {
            annual_rent: baseIncome.annual_rent ?? 0,
            other_income: baseIncome.other_income ?? 0,
          })
        )
      );

      onEntriesChange(sortYearlyIncomeEntries(results));
    } catch (err) {
      console.error("YearlyIncomePanel.handleApplyBaseToAllYears error:", err);

      if (err instanceof Error) {
        setError(`Autofill fehlgeschlagen: ${err.message}`);
      } else {
        setError("Autofill fehlgeschlagen.");
      }
    } finally {
      setIsApplyingBase(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Yearly Income</h2>
          <p className="mt-1 text-sm text-gray-500">
            Pflege jahresbezogene Einnahmen direkt pro Jahr. Wenn für ein Jahr kein
            Eintrag existiert, wird weiterhin auf die Basis-Einnahmen des Objekts
            zurückgegriffen.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowAddYearBox((prev) => !prev)}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Jahr hinzufügen
          </button>

          <button
            type="button"
            onClick={handleApplyBaseToAllYears}
            disabled={!baseIncome || isApplyingBase}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplyingBase
              ? "Wird angewendet…"
              : "Basis-Einnahmen auf alle Jahre anwenden"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Aktuelle Basis für Autofill</p>
        <p className="mt-2 text-xl font-semibold text-gray-900">
          {formatCurrency(baseIncomeTotal)}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Miete: {formatCurrency(baseIncome?.annual_rent ?? 0)} · Sonstige:{" "}
          {formatCurrency(baseIncome?.other_income ?? 0)}
        </p>
      </div>

      {showAddYearBox && (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Schnelles Hinzufügen</h3>
              <p className="mt-1 text-sm text-gray-500">
                Neue Jahre können aus vorhandenen Ledger-Jahren vorgeschlagen werden.
              </p>
            </div>

            <button
              type="button"
              onClick={() => addNewRow()}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Leere Zeile hinzufügen
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestedYears.length > 0 ? (
              suggestedYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => addNewRow(year)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  {year}
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                Keine zusätzlichen Ledger-Jahre ohne Income-Eintrag gefunden.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
              <th className="px-4 py-3 font-medium">Jahr</th>
              <th className="px-4 py-3 font-medium">Miete</th>
              <th className="px-4 py-3 font-medium">Sonstige</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-0 py-4">
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    Noch keine yearly-income-Einträge vorhanden.
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const total =
                  parseNumberInput(row.annual_rent) + parseNumberInput(row.other_income);
                const saveKey = row.id ?? `new-${index}`;
                const isSaving = savingRowKey === saveKey;
                const isDeleting = deletingRowId === row.id;

                return (
                  <tr
                    key={row.id ?? `temp-${index}`}
                    className="border-b border-gray-100 text-sm text-gray-800 last:border-0"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        value={row.year}
                        onChange={(e) => updateRow(index, "year", e.target.value)}
                        className="w-28 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.annual_rent}
                        onChange={(e) => updateRow(index, "annual_rent", e.target.value)}
                        className="w-40 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.other_income}
                        onChange={(e) => updateRow(index, "other_income", e.target.value)}
                        className="w-40 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </td>

                    <td className="px-4 py-4 font-medium text-gray-900">
                      {formatCurrency(total)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveRow(index)}
                          disabled={!row.isDirty || isSaving}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving ? "Speichert…" : "Speichern"}
                        </button>

                        <button
                          type="button"
                          onClick={() => resetRow(index)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Zurücksetzen
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRow(index)}
                          disabled={isDeleting}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? "Löscht…" : "Löschen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function YearlyCapexPanel({
  propertyId,
  yearlyCapexEntries,
  ledgerYears,
  onEntriesChange,
}: {
  propertyId: string;
  yearlyCapexEntries: YearlyCapexEntry[];
  ledgerYears: number[];
  onEntriesChange: (entries: YearlyCapexEntry[]) => void;
}) {
  const [rows, setRows] = useState<EditableYearlyCapexRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [showAddYearBox, setShowAddYearBox] = useState(false);

  useEffect(() => {
    setRows(sortEditableYearlyCapexRows(yearlyCapexEntries.map(toEditableYearlyCapexRow)));
  }, [yearlyCapexEntries]);

  const existingYears = useMemo(() => {
    return new Set(rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year)));
  }, [rows]);

  const suggestedYears = useMemo(() => {
    return ledgerYears.filter((year) => !existingYears.has(year)).sort((a, b) => a - b);
  }, [ledgerYears, existingYears]);

  const totalCapex = useMemo(() => {
    return rows.reduce((sum, row) => sum + parseNumberInput(row.amount), 0);
  }, [rows]);

  function updateRow(index: number, field: keyof EditableYearlyCapexRow, value: string) {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
              isDirty: true,
            }
          : row
      )
    );
  }

  function addNewRow(prefilledYear?: number) {
    setError(null);

    const defaultYear =
      prefilledYear ??
      (() => {
        if (suggestedYears.length > 0) {
          return suggestedYears[0];
        }

        if (rows.length > 0) {
          return Math.max(...rows.map((row) => Number(row.year) || 0)) + 1;
        }

        if (ledgerYears.length > 0) {
          return ledgerYears[0];
        }

        return new Date().getFullYear();
      })();

    if (existingYears.has(defaultYear)) {
      setError(`Für das Jahr ${defaultYear} existiert bereits ein CapEx-Eintrag.`);
      return;
    }

    const newRow: EditableYearlyCapexRow = {
      year: String(defaultYear),
      amount: "0",
      category: "",
      note: "",
      isNew: true,
      isDirty: true,
    };

    setRows((prev) => sortEditableYearlyCapexRows([...prev, newRow]));
  }

  function resetRow(index: number) {
    const row = rows[index];
    if (!row) return;

    if (!row.id) {
      setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
      return;
    }

    const original = yearlyCapexEntries.find((entry) => entry.id === row.id);
    if (!original) return;

    setRows((prev) =>
      prev.map((currentRow, rowIndex) =>
        rowIndex === index ? toEditableYearlyCapexRow(original) : currentRow
      )
    );
  }

  async function handleSaveRow(index: number) {
    const row = rows[index];
    if (!row || !propertyId) {
      return;
    }

    const year = parseYearInput(row.year);
    const amount = parseNumberInput(row.amount);
    const category = row.category.trim() || null;
    const note = row.note.trim() || null;

    const validationError = validateYearlyCapexValues(year, amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    const duplicateCount = rows.filter((entry) => parseYearInput(entry.year) === year).length;
    if (duplicateCount > 1) {
      setError(`Das Jahr ${year} ist mehrfach vorhanden.`);
      return;
    }

    try {
      setError(null);
      const saveKey = row.id ?? `new-${index}`;
      setSavingRowKey(saveKey);

      let saved: YearlyCapexEntry;

      if (row.id) {
        saved = await yearlyCapexService.update(row.id, {
          year,
          amount,
          category,
          note,
        });
      } else {
        saved = await yearlyCapexService.create({
          propertyId,
          year,
          amount,
          category,
          note,
        });
      }

      const nextEntries = row.id
        ? yearlyCapexEntries.map((entry) => (entry.id === saved.id ? saved : entry))
        : [...yearlyCapexEntries, saved];

      onEntriesChange(sortYearlyCapexEntries(nextEntries));
    } catch (err) {
      console.error("YearlyCapexPanel.handleSaveRow error:", err);

      if (err instanceof Error) {
        setError(`Yearly CapEx konnte nicht gespeichert werden: ${err.message}`);
      } else {
        setError("Yearly CapEx konnte nicht gespeichert werden.");
      }
    } finally {
      setSavingRowKey(null);
    }
  }

  async function handleDeleteRow(index: number) {
    const row = rows[index];
    if (!row) {
      return;
    }

    if (!row.id) {
      setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
      return;
    }

    const confirmed = window.confirm("Diesen yearly-capex-Eintrag wirklich löschen?");
    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setDeletingRowId(row.id);

      await yearlyCapexService.remove(row.id);

      onEntriesChange(yearlyCapexEntries.filter((entry) => entry.id !== row.id));
    } catch (err) {
      console.error("YearlyCapexPanel.handleDeleteRow error:", err);

      if (err instanceof Error) {
        setError(`Yearly CapEx konnte nicht gelöscht werden: ${err.message}`);
      } else {
        setError("Yearly CapEx konnte nicht gelöscht werden.");
      }
    } finally {
      setDeletingRowId(null);
    }
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Yearly CapEx</h2>
          <p className="mt-1 text-sm text-gray-500">
            Pflege jahresbezogene Investitionsausgaben direkt pro Jahr. Wenn für ein Jahr
            kein Eintrag existiert, wird standardmäßig 0 € CapEx verwendet.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowAddYearBox((prev) => !prev)}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Jahr hinzufügen
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">CapEx über alle gepflegten Jahre</p>
        <p className="mt-2 text-xl font-semibold text-gray-900">{formatCurrency(totalCapex)}</p>
        <p className="mt-2 text-xs text-gray-500">
          Nicht gepflegte Jahre werden in der Berechnung mit 0 € behandelt.
        </p>
      </div>

      {showAddYearBox && (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Schnelles Hinzufügen</h3>
              <p className="mt-1 text-sm text-gray-500">
                Neue Jahre können aus vorhandenen Ledger-Jahren vorgeschlagen werden.
              </p>
            </div>

            <button
              type="button"
              onClick={() => addNewRow()}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Leere Zeile hinzufügen
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestedYears.length > 0 ? (
              suggestedYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => addNewRow(year)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  {year}
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                Keine zusätzlichen Ledger-Jahre ohne CapEx-Eintrag gefunden.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
              <th className="px-4 py-3 font-medium">Jahr</th>
              <th className="px-4 py-3 font-medium">CapEx</th>
              <th className="px-4 py-3 font-medium">Kategorie</th>
              <th className="px-4 py-3 font-medium">Notiz</th>
              <th className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-0 py-4">
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    Noch keine yearly-capex-Einträge vorhanden.
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const saveKey = row.id ?? `new-${index}`;
                const isSaving = savingRowKey === saveKey;
                const isDeleting = deletingRowId === row.id;

                return (
                  <tr
                    key={row.id ?? `temp-capex-${index}`}
                    className="border-b border-gray-100 text-sm text-gray-800 last:border-0"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        value={row.year}
                        onChange={(e) => updateRow(index, "year", e.target.value)}
                        className="w-28 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.amount}
                        onChange={(e) => updateRow(index, "amount", e.target.value)}
                        className="w-40 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="text"
                        value={row.category}
                        onChange={(e) => updateRow(index, "category", e.target.value)}
                        className="w-44 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="z. B. Dach"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => updateRow(index, "note", e.target.value)}
                        className="w-64 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="optional"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveRow(index)}
                          disabled={!row.isDirty || isSaving}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving ? "Speichert…" : "Speichern"}
                        </button>

                        <button
                          type="button"
                          onClick={() => resetRow(index)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Zurücksetzen
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRow(index)}
                          disabled={isDeleting}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? "Löscht…" : "Löschen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Panel>
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

function InfoCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-gray-900">{value}</p>
      <p className="mt-3 text-sm text-gray-600">{description}</p>
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

function EmptyChartState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-sm text-gray-500">
      Noch keine Ledger-Daten für die Chart-Ansicht vorhanden.
    </div>
  );
}