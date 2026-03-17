export type RiskLevel = "green" | "yellow" | "red" | "unknown";

export type LoanLedgerEntry = {
  id: string;
  property_id: string;
  booking_date: string;
  interest_amount: number;
  principal_amount: number;
  remaining_balance: number | null;
  note?: string | null;
};

export type PropertyIncome = {
  id: string;
  property_id: string;
  annual_rent: number;
  other_income: number;
  created_at?: string | null;
  updated_at?: string | null;
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