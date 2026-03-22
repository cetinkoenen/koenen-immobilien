export type RiskLevel = "low" | "medium" | "high" | string;

export type FinanceChartDataPoint = {
  year: number | string;
  label?: string;
  value?: number;
  balance?: number;
  cashflow?: number;
  dscr?: number | null;
  capex?: number;
  [key: string]: any;
};

export type PropertyIncome = {
  id?: string;
  propertyId?: string;
  property_id?: string;
  coldRent?: number;
  parkingIncome?: number;
  otherIncome?: number;
  other_income?: number;
  vacancyRate?: number;
  annualRent?: number;
  annual_rent?: number;
  annualGrossIncome?: number;
  source?: string | null;
  created_at?: string | undefined;
  updated_at?: string | undefined;
  [key: string]: any;
};

export type YearlyIncomeEntry = {
  id?: string;
  propertyId?: string;
  property_id?: string;
  year: number;
  amount?: number;
  annual_rent?: number;
  other_income?: number;
  category?: string;
  note?: string;
  source?: string | null;
  created_at?: string | undefined;
  updated_at?: string | undefined;
  [key: string]: any;
};

export type YearlyCapexEntry = {
  id?: string;
  propertyId?: string;
  property_id?: string;
  year: number;
  amount?: number;
  category?: string;
  note?: string;
  source?: string | null;
  [key: string]: any;
};

export type DbYearlyCapexEntry = {
  id?: string;
  property_id?: string;
  year: number;
  amount?: number;
  category?: string;
  note?: string;
  source?: string | null;
  [key: string]: any;
};

export type YearlyLedgerEntry = {
  id?: string;
  propertyId?: string;
  property_id?: string;
  year: number;
  amount?: number;
  interest?: number;
  principal?: number;
  balance?: number;
  category?: string;
  note?: string;
  source?: string | null;
  [key: string]: any;
};

export type SimulationInput = {
  property?: any;
  ledger?: YearlyLedgerEntry[];
  income?: PropertyIncome | null;
  yearlyIncome?: YearlyIncomeEntry[];
  yearlyCapex?: YearlyCapexEntry[];
  riskLevel?: RiskLevel;
  [key: string]: any;
};

export type BaseFinanceMetrics = {
  grossIncome?: number;
  netIncome?: number;
  cashflow?: number;
  totalCapex?: number;
  totalExpenses?: number;
  vacancyCost?: number;
  totalInterest?: number;
  totalPrincipal?: number;
  avgInterestPerYear?: number;
  avgPrincipalPerYear?: number;
  currentRemainingBalance?: number;
  estimatedRemainingYears?: number | null;
  estimatedDebtFreeYear?: number | null;
  dscr?: number | null;
  debtService?: number;
  annualIncome?: number;
  riskLevel?: string;
  [key: string]: any;
};

export type YearlyFinanceMetrics = {
  year: number;
  income?: number;
  expenses?: number;
  cashflow?: number;
  capex?: number;
  interest?: number;
  principal?: number;
  debtService?: number;
  dscr?: number | null;
  balance?: number;
  [key: string]: any;
};

export type SimulationResult = {
  summary?: BaseFinanceMetrics;
  yearlyMetrics?: YearlyFinanceMetrics[];
  chartData?: FinanceChartDataPoint[];
  capex?: number;
  annualIncome?: number;
  avgInterestPerYear?: number;
  avgPrincipalPerYear?: number;
  debtService?: number;
  cashflow?: number;
  dscr?: number | null;
  riskLevel?: string;
  estimatedRemainingYears?: number | null;
  estimatedDebtFreeYear?: number | null;
  deltaCashflow?: number;
  deltaDscr?: number | null;
  deltaRemainingYears?: number | null;
  [key: string]: any;
};
