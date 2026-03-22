import type {
  BaseFinanceMetrics,
  FinanceChartDataPoint,
  PropertyIncome,
  RiskLevel,
  SimulationInput,
  SimulationResult,
  YearlyCapexEntry,
  YearlyFinanceMetrics,
  YearlyIncomeEntry,
  YearlyLedgerEntry,
} from "@/types/finance";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

function sortLedgerEntriesAsc(entries: YearlyLedgerEntry[]): YearlyLedgerEntry[] {
  return [...entries].sort((a, b) => a.year - b.year);
}

function sortYearlyIncomeAsc(entries: YearlyIncomeEntry[]): YearlyIncomeEntry[] {
  return [...entries].sort((a, b) => a.year - b.year);
}

function sortYearlyCapexAsc(entries: YearlyCapexEntry[]): YearlyCapexEntry[] {
  return [...entries].sort((a, b) => a.year - b.year);
}

function getLastItem<T>(items: T[]): T | null {
  return items.length > 0 ? items[items.length - 1] ?? null : null;
}

function getLatestLedgerYear(entries: YearlyLedgerEntry[]): number | null {
  const latest = getLastItem(sortLedgerEntriesAsc(entries));
  return latest?.year ?? null;
}

function getLatestMetricsYear(entries: YearlyFinanceMetrics[]): number | null {
  const latest = getLastItem([...entries].sort((a, b) => a.year - b.year));
  return latest?.year ?? null;
}

function getLatestRemainingBalance(entries: YearlyLedgerEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }

  const sortedDesc = [...sortLedgerEntriesAsc(entries)].reverse();

  const latestWithBalance = sortedDesc.find(
    (entry) => entry.balance !== null && entry.balance !== undefined
  );

  return latestWithBalance?.balance ?? 0;
}

function getAnnualIncomeFromStaticIncome(income?: PropertyIncome | null): number {
  if (!income) {
    return 0;
  }

  return (income.annual_rent ?? 0) + (income.other_income ?? 0);
}

function getAnnualIncomeFromYearlyIncome(income?: YearlyIncomeEntry | null): number {
  if (!income) {
    return 0;
  }

  return (income.annual_rent ?? 0) + (income.other_income ?? 0);
}

function getAnnualCapexFromYearlyCapex(capex?: YearlyCapexEntry | null): number {
  if (!capex) {
    return 0;
  }

  return capex.amount ?? 0;
}

export function getRiskLevel(dscr: number | null): RiskLevel {
  if (dscr === null || Number.isNaN(dscr)) {
    return "unknown";
  }

  if (dscr > 1.2) {
    return "green";
  }

  if (dscr >= 1.0) {
    return "yellow";
  }

  return "red";
}

export function hasYearlyIncomeData(
  incomes: YearlyIncomeEntry[] | null | undefined
): boolean {
  return Array.isArray(incomes) && incomes.length > 0;
}

export function buildFallbackYearlyIncomeFromLedger(
  ledgerEntries: YearlyLedgerEntry[],
  fallbackIncome?: PropertyIncome | null
): YearlyIncomeEntry[] {
  const annualRent = fallbackIncome?.annual_rent ?? 0;
  const otherIncome = fallbackIncome?.other_income ?? 0;

  return sortLedgerEntriesAsc(ledgerEntries).map((entry) => ({
    id: `fallback-${entry.propertyId}-${entry.year}`,
    property_id: entry.propertyId ?? "",
    year: entry.year,
    annual_rent: annualRent,
    other_income: otherIncome,
    source: "fallback-from-property-income",
    created_at: undefined,
    updated_at: undefined,
  }));
}

export function calculateYearlyFinanceMetrics(
  ledgerEntries: YearlyLedgerEntry[],
  yearlyIncomeEntries: YearlyIncomeEntry[],
  yearlyCapexEntries: YearlyCapexEntry[],
  fallbackIncome?: PropertyIncome | null
): YearlyFinanceMetrics[] {
  const normalizedLedger = sortLedgerEntriesAsc(ledgerEntries);
  const normalizedIncome = sortYearlyIncomeAsc(yearlyIncomeEntries);
  const normalizedCapex = sortYearlyCapexAsc(yearlyCapexEntries);

  const incomeByYear = new Map<number, YearlyIncomeEntry>();
  const capexByYear = new Map<number, YearlyCapexEntry>();

  for (const entry of normalizedIncome) {
    incomeByYear.set(entry.year, entry);
  }

  for (const entry of normalizedCapex) {
    capexByYear.set(entry.year, entry);
  }

  const fallbackAnnualIncome = getAnnualIncomeFromStaticIncome(fallbackIncome);

  return normalizedLedger.map((ledgerEntry) => {
    const yearlyIncome = incomeByYear.get(ledgerEntry.year) ?? null;
    const yearlyCapex = capexByYear.get(ledgerEntry.year) ?? null;

    const income = yearlyIncome
      ? getAnnualIncomeFromYearlyIncome(yearlyIncome)
      : fallbackAnnualIncome;

    const capex = getAnnualCapexFromYearlyCapex(yearlyCapex);
    const interest = ledgerEntry.interest ?? 0;
    const principal = ledgerEntry.principal ?? 0;
    const debtService = interest + principal;
    const cashflow = income - debtService - capex;
    const dscr = debtService > 0 ? income / debtService : null;

    return {
      year: ledgerEntry.year,
      income,
      capex,
      interest,
      principal,
      debtService,
      cashflow,
      dscr,
      balance: ledgerEntry.balance ?? 0,
    };
  });
}

export function aggregateFinanceMetrics(
  yearlyMetrics: YearlyFinanceMetrics[],
  ledgerEntries: YearlyLedgerEntry[] = []
): BaseFinanceMetrics {
  const normalizedMetrics = [...yearlyMetrics].sort((a, b) => a.year - b.year);
  const latestMetric = getLastItem(normalizedMetrics);

  const totalInterest = sum(normalizedMetrics.map((entry) => entry.interest ?? 0));
  const totalPrincipal = sum(normalizedMetrics.map((entry) => entry.principal ?? 0));
  const totalCapex = sum(normalizedMetrics.map((entry) => entry.capex ?? 0));

  const avgInterestPerYear = average(
    normalizedMetrics.map((entry) => entry.interest ?? 0)
  );
  const avgPrincipalPerYear = average(
    normalizedMetrics.map((entry) => entry.principal ?? 0)
  );

  const annualIncome = latestMetric?.income ?? 0;
  const debtService = latestMetric?.debtService ?? 0;
  const cashflow = latestMetric?.cashflow ?? 0;
  const dscr = latestMetric?.dscr ?? null;

  const currentRemainingBalance =
    latestMetric?.balance ?? getLatestRemainingBalance(ledgerEntries);

  const estimatedRemainingYears =
    avgPrincipalPerYear > 0
      ? currentRemainingBalance / avgPrincipalPerYear
      : null;

  const latestYear =
    getLatestMetricsYear(normalizedMetrics) ??
    getLatestLedgerYear(ledgerEntries);

  const estimatedDebtFreeYear =
    latestYear !== null && estimatedRemainingYears !== null
      ? latestYear + Math.ceil(estimatedRemainingYears)
      : null;

  const riskLevel = getRiskLevel(dscr);

  return {
    totalInterest,
    totalPrincipal,
    totalCapex,
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

export function calculateBaseFinanceMetrics(
  ledgerEntries: YearlyLedgerEntry[],
  income?: PropertyIncome | null,
  yearlyIncomeEntries: YearlyIncomeEntry[] = [],
  yearlyCapexEntries: YearlyCapexEntry[] = []
): BaseFinanceMetrics {
  const yearlyMetrics = calculateYearlyFinanceMetrics(
    ledgerEntries,
    yearlyIncomeEntries,
    yearlyCapexEntries,
    income
  );

  return aggregateFinanceMetrics(yearlyMetrics, ledgerEntries);
}

export function simulateFinanceScenario(
  baseMetrics: BaseFinanceMetrics,
  input: SimulationInput
): SimulationResult {
  const baseAnnualIncome = baseMetrics.annualIncome ?? 0;
  const baseAvgInterestPerYear = baseMetrics.avgInterestPerYear ?? 0;
  const baseAvgPrincipalPerYear = baseMetrics.avgPrincipalPerYear ?? 0;
  const baseTotalCapex = baseMetrics.totalCapex ?? 0;
  const baseCurrentRemainingBalance = baseMetrics.currentRemainingBalance ?? 0;
  const baseEstimatedDebtFreeYear = baseMetrics.estimatedDebtFreeYear ?? null;
  const baseEstimatedRemainingYears = baseMetrics.estimatedRemainingYears ?? null;
  const baseCashflow = baseMetrics.cashflow ?? 0;
  const baseDscr = baseMetrics.dscr ?? null;

  const annualIncome =
    baseAnnualIncome * (1 + input.rentDeltaPct / 100);

  const avgInterestPerYear =
    baseAvgInterestPerYear * (1 + input.interestDeltaPct / 100);

  const avgPrincipalPerYear =
    baseAvgPrincipalPerYear * (1 + input.principalDeltaPct / 100);

  const capex = baseTotalCapex;
  const debtService = avgInterestPerYear + avgPrincipalPerYear;
  const cashflow = annualIncome - debtService - capex;
  const dscr = debtService > 0 ? annualIncome / debtService : null;
  const riskLevel = getRiskLevel(dscr);

  const estimatedRemainingYears =
    avgPrincipalPerYear > 0
      ? baseCurrentRemainingBalance / avgPrincipalPerYear
      : null;

  const estimatedDebtFreeYear =
    baseEstimatedDebtFreeYear !== null &&
    baseEstimatedRemainingYears !== null &&
    estimatedRemainingYears !== null
      ? baseEstimatedDebtFreeYear +
        Math.ceil(estimatedRemainingYears - baseEstimatedRemainingYears)
      : null;

  return {
    annualIncome,
    avgInterestPerYear,
    avgPrincipalPerYear,
    debtService,
    cashflow,
    capex,
    dscr,
    riskLevel,
    estimatedRemainingYears,
    estimatedDebtFreeYear,
    deltaCashflow: cashflow - baseCashflow,
    deltaDscr:
      dscr !== null && baseDscr !== null
        ? dscr - baseDscr
        : null,
    deltaRemainingYears:
      estimatedRemainingYears !== null &&
      baseEstimatedRemainingYears !== null
        ? estimatedRemainingYears - baseEstimatedRemainingYears
        : null,
  };
}

export function buildFinanceChartData(
  yearlyMetrics: YearlyFinanceMetrics[]
): FinanceChartDataPoint[] {
  return [...yearlyMetrics]
    .sort((a, b) => a.year - b.year)
    .map((entry) => ({
      year: entry.year,
      balance: entry.balance,
      cashflow: entry.cashflow,
      dscr: entry.dscr,
      capex: entry.capex,
    }));
}