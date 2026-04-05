export type RiskLevel = "green" | "yellow" | "red";

export interface PropertyIncome {
  id: string;
  propertyId: string;

  // canonical
  annualRent: number;
  otherIncome: number;

  // metadata
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface YearlyLedgerEntry {
  id?: string;
  propertyId?: string;
  year: number;

  // canonical
  interestPayment: number;
  principalPayment: number;
  remainingBalance: number;

  // legacy compatibility
  interest?: number;
  principal?: number;
  balance?: number;
  source?: string | null;
}

export interface YearlyIncomeEntry {
  id?: string;
  propertyId?: string;
  year: number;

  // canonical
  annualRent: number;
  otherIncome: number;

  // legacy compatibility
  annual_rent?: number;
  other_income?: number;
  source?: string | null;
}

export interface YearlyCapexEntry {
  id?: string;
  propertyId?: string;
  year: number;
  amount: number;
  category?: string | null;
  note?: string | null;
  source?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DbYearlyCapexEntry {
  id: string;
  property_id: string;
  year: number;
  amount: number;
  category?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface YearlyFinanceMetrics {
  year: number;
  income: number;
  capex: number;
  interest: number;
  principal: number;
  debtService: number;
  cashflow: number;
  dscr: number | null;
}

export interface BaseFinanceMetrics {
  annualIncome: number;
  debtService: number;
  cashflow: number;
  dscr: number | null;
  remainingBalance: number | null;
  estimatedDebtFreeYear: number | null;
  riskLevel: RiskLevel;
}

export interface AggregatedFinanceMetrics {
  annualIncome: number;
  debtService: number;
  cashflow: number;
  dscr: number | null;
  remainingBalance: number | null;
  estimatedDebtFreeYear: number | null;
  riskLevel: RiskLevel;
}

export interface SimulationInput {
  rentDeltaPct: number;
  interestDeltaPct: number;
  principalDeltaPct: number;
}

export interface SimulationResult {
  cashflow: number;
  dscr: number | null;
  riskLevel: RiskLevel;
  deltaCashflow: number;
  deltaDscr: number | null;
}

export interface FinanceChartDataPoint {
  year: number;
  income: number;
  capex: number;
  interest: number;
  principal: number;
  debtService: number;
  cashflow: number;
  dscr: number | null;
}

export interface BuildBaseFinanceMetricsInput {
  ledger: YearlyLedgerEntry[];
  yearlyIncome: YearlyIncomeEntry[];
  yearlyCapex: YearlyCapexEntry[];
  propertyIncome?: PropertyIncome | null;
}

export interface BuildBaseFinanceMetricsResult {
  yearlyMetrics: YearlyFinanceMetrics[];
  aggregated: AggregatedFinanceMetrics;
}

export function getRiskLevel(dscr: number | null): RiskLevel {
  if (dscr === null || Number.isNaN(dscr)) {
    return "red";
  }

  if (dscr >= 1.2) {
    return "green";
  }

  if (dscr >= 1.0) {
    return "yellow";
  }

  return "red";
}