// src/types/finance.ts

export type RiskLevel = "green" | "yellow" | "red" | "unknown";

/**
 * Buchungsnahes Darlehensmodell.
 * Kann parallel zu aggregierten Jahresdaten bestehen bleiben.
 */
export type LoanLedgerEntry = {
  id: string;
  property_id: string;
  booking_date: string;
  interest_amount: number;
  principal_amount: number;
  remaining_balance: number | null;
  note?: string | null;
};

/**
 * Aggregierter Jahreseintrag für Zins, Tilgung und Restschuld.
 * Wird in der UI und in den Finanzberechnungen verwendet.
 */
export type YearlyLedgerEntry = {
  id: string;
  propertyId: string;
  year: number;
  interest: number;
  principal: number;
  balance: number;
  source?: string | null;
};

/**
 * Statische Einnahmenbasis pro Objekt.
 * Dient als persistenter Fallback, solange keine vollständige
 * yearly-income-Zeitreihe vorhanden ist.
 */
export type PropertyIncome = {
  id: string;
  property_id: string;
  annual_rent: number;
  other_income: number;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Jahresbezogene Einnahmen pro Objekt.
 * Genau ein Datensatz pro property_id + year.
 */
export type YearlyIncomeEntry = {
  id: string;
  property_id: string;
  year: number;
  annual_rent: number;
  other_income: number;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Zentrale berechnete Finanzreihe pro Jahr.
 * Grundlage für Charts, Aggregationen und Risiko-Logik.
 */
export type YearlyFinanceMetrics = {
  year: number;

  income: number;

  interest: number;
  principal: number;
  debtService: number;

  cashflow: number;
  dscr: number | null;

  balance: number;
};

/**
 * Aggregierte Kennzahlen für die Objektansicht.
 * Werden aus der Finanzzeitreihe abgeleitet.
 */
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

/**
 * Input für vereinfachte Szenario-Simulationen.
 */
export type SimulationInput = {
  rentDeltaPct: number;
  interestDeltaPct: number;
  principalDeltaPct: number;
};

/**
 * Ergebnis einer vereinfachten Szenario-Simulation.
 */
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

/**
 * Darstellungsmodell für Finance-Charts.
 * DSCR ist nullable, weil er fachlich nicht immer berechenbar ist.
 */
export type FinanceChartDataPoint = {
  year: number;
  balance: number;
  cashflow: number;
  dscr: number | null;
};