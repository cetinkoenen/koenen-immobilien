import type { YearlyLedgerEntry } from "./ledgerService";

export type RiskLevel = "green" | "yellow" | "red" | "unknown";

export type PropertyIncome = {
  id: string;
  property_id: string;
  annual_rent: number;
  other_income: number;
};

export type BaseFinanceMetrics = {
  totalInterest: number;
  totalPrincipal: number;
  avgInterestPerYear: number;
  avgPrincipalPerYear: number;
  currentRemainingBalance: number;
  estimatedRemainingYears: number | null;
  estimatedDebtFreeYear: number | null;
  annualIncome: number;
  debtService: number;
  cashflow: number;
  dscr: number | null;
  riskLevel: RiskLevel;
};

export type SimulationInput = {
  rentDeltaPct: number;
  interestDeltaPct: number;
  principalDeltaPct: number;
};

export type SimulationResult = {
  annualIncome: number;
  avgInterestPerYear: number;
  avgPrincipalPerYear: number;
  debtService: number;
  cashflow: number;
  dscr: number | null;
  riskLevel: RiskLevel;
  estimatedRemainingYears: number | null;
  estimatedDebtFreeYear: number | null;
  deltaCashflow: number;
  deltaDscr: number | null;
  deltaRemainingYears: number | null;
};

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function sortLedgerEntriesDesc(entries: YearlyLedgerEntry[]): YearlyLedgerEntry[] {
  return [...entries].sort((a, b) => b.year - a.year);
}

function sortLedgerEntriesAsc(entries: YearlyLedgerEntry[]): YearlyLedgerEntry[] {
  return [...entries].sort((a, b) => a.year - b.year);
}

function getYearSpan(entries: YearlyLedgerEntry[]): number {
  if (entries.length === 0) return 1;

  const years = entries
    .map((entry) => entry.year)
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);

  if (years.length === 0) return 1;
  if (years.length === 1) return 1;

  const first = years[0];
  const last = years[years.length - 1];

  return Math.max(last - first + 1, 1);
}

function getLatestRemainingBalance(entries: YearlyLedgerEntry[]): number {
  if (entries.length === 0) return 0;

  const latestWithBalance = sortLedgerEntriesDesc(entries).find(
    (entry) => entry.balance !== null && entry.balance !== undefined
  );

  return latestWithBalance?.balance ?? 0;
}

function getLatestYear(entries: YearlyLedgerEntry[]): number | null {
  if (entries.length === 0) return null;
  return sortLedgerEntriesDesc(entries)[0]?.year ?? null;
}

export function getRiskLevel(dscr: number | null): RiskLevel {
  if (dscr === null || Number.isNaN(dscr)) return "unknown";
  if (dscr > 1.2) return "green";
  if (dscr >= 1.0) return "yellow";
  return "red";
}

export function calculateBaseFinanceMetrics(
  ledgerEntries: YearlyLedgerEntry[],
  income?: PropertyIncome | null
): BaseFinanceMetrics {
  const normalizedEntries = sortLedgerEntriesAsc(ledgerEntries);

  const totalInterest = sum(normalizedEntries.map((entry) => entry.interest || 0));
  const totalPrincipal = sum(normalizedEntries.map((entry) => entry.principal || 0));

  const yearSpan = getYearSpan(normalizedEntries);
  const avgInterestPerYear = totalInterest / yearSpan;
  const avgPrincipalPerYear = totalPrincipal / yearSpan;

  const currentRemainingBalance = getLatestRemainingBalance(normalizedEntries);

  const estimatedRemainingYears =
    avgPrincipalPerYear > 0
      ? currentRemainingBalance / avgPrincipalPerYear
      : null;

  const latestLedgerYear = getLatestYear(normalizedEntries);

  const estimatedDebtFreeYear =
    estimatedRemainingYears !== null
      ? (latestLedgerYear ?? new Date().getFullYear()) + Math.ceil(estimatedRemainingYears)
      : null;

  const annualIncome = (income?.annual_rent ?? 0) + (income?.other_income ?? 0);
  const debtService = avgInterestPerYear + avgPrincipalPerYear;
  const cashflow = annualIncome - debtService;
  const dscr = debtService > 0 ? annualIncome / debtService : null;
  const riskLevel = getRiskLevel(dscr);

  return {
    totalInterest,
    totalPrincipal,
    avgInterestPerYear,
    avgPrincipalPerYear,
    currentRemainingBalance,
    estimatedRemainingYears,
    estimatedDebtFreeYear,
    annualIncome,
    debtService,
    cashflow,
    dscr,
    riskLevel,
  };
}

export function simulateFinanceScenario(
  baseMetrics: BaseFinanceMetrics,
  input: SimulationInput
): SimulationResult {
  const annualIncome =
    baseMetrics.annualIncome * (1 + input.rentDeltaPct / 100);

  const avgInterestPerYear =
    baseMetrics.avgInterestPerYear * (1 + input.interestDeltaPct / 100);

  const avgPrincipalPerYear =
    baseMetrics.avgPrincipalPerYear * (1 + input.principalDeltaPct / 100);

  const debtService = avgInterestPerYear + avgPrincipalPerYear;
  const cashflow = annualIncome - debtService;
  const dscr = debtService > 0 ? annualIncome / debtService : null;
  const riskLevel = getRiskLevel(dscr);

  const estimatedRemainingYears =
    avgPrincipalPerYear > 0
      ? baseMetrics.currentRemainingBalance / avgPrincipalPerYear
      : null;

  const estimatedDebtFreeYear =
    estimatedRemainingYears !== null
      ? new Date().getFullYear() + Math.ceil(estimatedRemainingYears)
      : null;

  return {
    annualIncome,
    avgInterestPerYear,
    avgPrincipalPerYear,
    debtService,
    cashflow,
    dscr,
    riskLevel,
    estimatedRemainingYears,
    estimatedDebtFreeYear,
    deltaCashflow: cashflow - baseMetrics.cashflow,
    deltaDscr:
      dscr !== null && baseMetrics.dscr !== null
        ? dscr - baseMetrics.dscr
        : null,
    deltaRemainingYears:
      estimatedRemainingYears !== null &&
      baseMetrics.estimatedRemainingYears !== null
        ? estimatedRemainingYears - baseMetrics.estimatedRemainingYears
        : null,
  };
}