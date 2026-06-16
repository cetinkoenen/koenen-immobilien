import type {
  BaseFinanceMetrics,
  FinanceChartDataPoint,
  PropertyIncome,
  SimulationInput,
  SimulationResult,
  YearlyCapexEntry,
  YearlyFinanceMetrics,
  YearlyIncomeEntry,
  YearlyLedgerEntry,
} from "@/types/finance";
import { getRiskLevel } from "@/types/finance";
import { parseLocaleNumber, parseNullableLocaleNumber } from "@/utils/numberParser";

type IncomeLike = Partial<PropertyIncome> & Partial<YearlyIncomeEntry>;
type LedgerLike = Partial<YearlyLedgerEntry> & {
  interest_payment?: unknown;
  principal_payment?: unknown;
  remaining_balance?: unknown;
};

function toSafeNumber(value: unknown, fallback = 0): number {
  return parseLocaleNumber(value, fallback);
}


function toSafeNullableNumber(value: unknown): number | null {
  return parseNullableLocaleNumber(value);
}


function normalizeYear(value: unknown): number {
  return Math.trunc(toSafeNumber(value, 0));
}

function getFirstDefined<T = unknown>(
  ...values: T[]
): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

function readAnnualRent(entry: IncomeLike | null | undefined): number {
  if (!entry) return 0;

  const value = getFirstDefined(
    entry.annualRent,
    entry.annual_rent,
  );

  return toSafeNumber(value);
}

function readOtherIncome(entry: IncomeLike | null | undefined): number {
  if (!entry) return 0;

  const value = getFirstDefined(
    entry.otherIncome,
    entry.other_income,
  );

  return toSafeNumber(value);
}

function readCapexAmount(entry: Partial<YearlyCapexEntry> | null | undefined): number {
  if (!entry) return 0;

  const value = getFirstDefined(
    entry.amount,
  );

  return toSafeNumber(value);
}

function readLedgerInterest(entry: LedgerLike | null | undefined): number {
  if (!entry) return 0;

  const value = getFirstDefined(
    entry.interestPayment,
    entry.interest_payment,
    entry.interest,
  );

  return toSafeNumber(value);
}

function readLedgerPrincipal(entry: LedgerLike | null | undefined): number {
  if (!entry) return 0;

  const value = getFirstDefined(
    entry.principalPayment,
    entry.principal_payment,
    entry.principal,
  );

  return toSafeNumber(value);
}

function readLedgerBalance(entry: LedgerLike | null | undefined): number | null {
  if (!entry) return null;

  const value = getFirstDefined(
    entry.remainingBalance,
    entry.remaining_balance,
    entry.balance,
  );

  return toSafeNullableNumber(value);
}

function sumIncomeEntry(entry: IncomeLike | null | undefined): number {
  return readAnnualRent(entry) + readOtherIncome(entry);
}

function sumIncomeForYear(
  year: number,
  yearlyIncome: YearlyIncomeEntry[],
  propertyIncome?: PropertyIncome | null,
): number {
  const matchingEntries = yearlyIncome.filter(
    (entry) => normalizeYear(entry.year) === year,
  );

  if (matchingEntries.length > 0) {
    return matchingEntries.reduce((sum, entry) => sum + sumIncomeEntry(entry), 0);
  }

  return sumIncomeEntry(propertyIncome);
}

function sumCapexForYear(year: number, yearlyCapex: YearlyCapexEntry[]): number {
  return yearlyCapex
    .filter((entry) => normalizeYear(entry.year) === year)
    .reduce((sum, entry) => sum + readCapexAmount(entry), 0);
}

function getAllRelevantYears(
  ledger: YearlyLedgerEntry[],
  yearlyIncome: YearlyIncomeEntry[],
  yearlyCapex: YearlyCapexEntry[],
): number[] {
  const years = new Set<number>();

  for (const entry of ledger) {
    const year = normalizeYear(entry.year);
    if (year > 0) years.add(year);
  }

  for (const entry of yearlyIncome) {
    const year = normalizeYear(entry.year);
    if (year > 0) years.add(year);
  }

  for (const entry of yearlyCapex) {
    const year = normalizeYear(entry.year);
    if (year > 0) years.add(year);
  }

  return Array.from(years).sort((a, b) => a - b);
}

function getYearlyCapexBasis(yearlyCapex: YearlyCapexEntry[]): number {
  if (yearlyCapex.length === 0) return 0;

  const totalsByYear = new Map<number, number>();

  for (const entry of yearlyCapex) {
    const year = normalizeYear(entry.year);
    if (year <= 0) continue;

    const current = totalsByYear.get(year) ?? 0;
    totalsByYear.set(year, current + readCapexAmount(entry));
  }

  const yearlyTotals = Array.from(totalsByYear.values());
  if (yearlyTotals.length === 0) return 0;

  const total = yearlyTotals.reduce((sum, value) => sum + value, 0);
  return total / yearlyTotals.length;
}

export function calculateYearlyFinanceMetrics(params: {
  ledger: YearlyLedgerEntry[];
  yearlyIncome: YearlyIncomeEntry[];
  yearlyCapex: YearlyCapexEntry[];
  propertyIncome?: PropertyIncome | null;
}): YearlyFinanceMetrics[] {
  const {
    ledger,
    yearlyIncome,
    yearlyCapex,
    propertyIncome = null,
  } = params;

  const years = getAllRelevantYears(ledger, yearlyIncome, yearlyCapex);
  const yearlyCapexBasis = getYearlyCapexBasis(yearlyCapex);

  return years.map((year) => {
    const ledgerEntry = ledger.find(
      (entry) => normalizeYear(entry.year) === year,
    );

    const income = sumIncomeForYear(year, yearlyIncome, propertyIncome);
    const actualCapex = sumCapexForYear(year, yearlyCapex);
    const capex = actualCapex > 0 ? actualCapex : yearlyCapexBasis;

    const interest = readLedgerInterest(ledgerEntry);
    const principal = readLedgerPrincipal(ledgerEntry);
    const debtService = interest + principal;
    const cashflow = income - capex - debtService;
    const dscr = debtService > 0 ? income / debtService : null;

    return {
      year,
      income,
      capex,
      interest,
      principal,
      debtService,
      cashflow,
      dscr,
    };
  });
}

export function aggregateFinanceMetrics(
  yearlyMetrics: YearlyFinanceMetrics[],
  ledger: YearlyLedgerEntry[],
): BaseFinanceMetrics {
  const annualIncome =
    yearlyMetrics.length > 0
      ? yearlyMetrics.reduce((sum, entry) => sum + toSafeNumber(entry.income), 0) /
        yearlyMetrics.length
      : 0;

  const debtService =
    yearlyMetrics.length > 0
      ? yearlyMetrics.reduce((sum, entry) => sum + toSafeNumber(entry.debtService), 0) /
        yearlyMetrics.length
      : 0;

  const cashflow =
    yearlyMetrics.length > 0
      ? yearlyMetrics.reduce((sum, entry) => sum + toSafeNumber(entry.cashflow), 0) /
        yearlyMetrics.length
      : 0;

  const dscr = debtService > 0 ? annualIncome / debtService : null;

  const sortedLedger = [...ledger].sort(
    (a, b) => normalizeYear(a.year) - normalizeYear(b.year),
  );

  const lastLedgerEntry = sortedLedger.at(-1);
  const remainingBalance = readLedgerBalance(lastLedgerEntry);

  let estimatedDebtFreeYear: number | null = null;
  const debtFreeEntry = sortedLedger.find((entry) => {
    const balance = readLedgerBalance(entry);
    return balance !== null && balance <= 0;
  });

  if (debtFreeEntry) {
    estimatedDebtFreeYear = normalizeYear(debtFreeEntry.year);
  }

  return {
    annualIncome,
    debtService,
    cashflow,
    dscr,
    remainingBalance,
    estimatedDebtFreeYear,
    riskLevel: getRiskLevel(dscr),
  };
}

export function simulateFinanceScenario(params: {
  baseMetrics: BaseFinanceMetrics;
  simulation: SimulationInput;
}): SimulationResult {
  const { baseMetrics, simulation } = params;

  const baseIncome = toSafeNumber(baseMetrics.annualIncome);
  const baseDebtService = toSafeNumber(baseMetrics.debtService);
  const baseCashflow = toSafeNumber(baseMetrics.cashflow);
  const baseDscr = baseMetrics.dscr;

  const rentFactor = 1 + toSafeNumber(simulation.rentDeltaPct) / 100;
  const interestFactor = 1 + toSafeNumber(simulation.interestDeltaPct) / 100;
  const principalFactor = 1 + toSafeNumber(simulation.principalDeltaPct) / 100;

  const adjustedIncome = baseIncome * rentFactor;

  const interestShare = baseDebtService * 0.5;
  const principalShare = baseDebtService * 0.5;

  const adjustedDebtService =
    interestShare * interestFactor + principalShare * principalFactor;

  const cashflow = adjustedIncome - adjustedDebtService;
  const dscr = adjustedDebtService > 0 ? adjustedIncome / adjustedDebtService : null;

  return {
    cashflow,
    dscr,
    riskLevel: getRiskLevel(dscr),
    deltaCashflow: cashflow - baseCashflow,
    deltaDscr:
      dscr !== null && baseDscr !== null
        ? dscr - baseDscr
        : dscr !== null && baseDscr === null
          ? dscr
          : null,
  };
}

export function buildFinanceChartData(
  yearlyMetrics: YearlyFinanceMetrics[],
): FinanceChartDataPoint[] {
  return yearlyMetrics.map((entry) => ({
    year: normalizeYear(entry.year),
    income: toSafeNumber(entry.income),
    capex: toSafeNumber(entry.capex),
    interest: toSafeNumber(entry.interest),
    principal: toSafeNumber(entry.principal),
    debtService: toSafeNumber(entry.debtService),
    cashflow: toSafeNumber(entry.cashflow),
    dscr: entry.dscr,
  }));
}

export function buildBaseFinanceMetrics(params: {
  ledger: YearlyLedgerEntry[];
  yearlyIncome: YearlyIncomeEntry[];
  yearlyCapex: YearlyCapexEntry[];
  propertyIncome?: PropertyIncome | null;
}): {
  yearlyMetrics: YearlyFinanceMetrics[];
  aggregated: BaseFinanceMetrics;
  chartData: FinanceChartDataPoint[];
} {
  const yearlyMetrics = calculateYearlyFinanceMetrics({
    ledger: params.ledger ?? [],
    yearlyIncome: params.yearlyIncome ?? [],
    yearlyCapex: params.yearlyCapex ?? [],
    propertyIncome: params.propertyIncome ?? null,
  });

  const aggregated = aggregateFinanceMetrics(yearlyMetrics, params.ledger ?? []);
  const chartData = buildFinanceChartData(yearlyMetrics);

  return {
    yearlyMetrics,
    aggregated,
    chartData,
  };
}
