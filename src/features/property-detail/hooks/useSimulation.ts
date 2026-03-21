import { useMemo } from "react";

// An Projekt anpassen
import {
  calculateBaseFinanceMetrics,
  calculateYearlyFinanceMetrics,
  simulateFinanceScenario,
  buildFinanceChartData,
} from "@/services/financeService";

import type { Property } from "@/types/property";
import type { LedgerEntry } from "@/types/ledger";
import type { PropertyIncome } from "@/types/income";
import type { YearlyIncomeEntry } from "@/types/yearlyIncome";
import type { YearlyCapexEntry } from "@/types/yearlyCapex";
import type { SimulationInput } from "@/types/simulation";

interface UseSimulationParams {
  property: Property | null;
  ledgerEntries: LedgerEntry[];
  propertyIncome: PropertyIncome | null;
  yearlyIncomeEntries: YearlyIncomeEntry[];
  yearlyCapexEntries: YearlyCapexEntry[];
  simulationInput: SimulationInput;
}

export function useSimulation({
  property,
  ledgerEntries,
  propertyIncome,
  yearlyIncomeEntries,
  yearlyCapexEntries,
  simulationInput,
}: UseSimulationParams) {
  const baseMetrics = useMemo(() => {
    if (!property) return null;

    return calculateBaseFinanceMetrics({
      property,
      ledgerEntries,
      propertyIncome,
    });
  }, [property, ledgerEntries, propertyIncome]);

  const yearlyMetrics = useMemo(() => {
    if (!property) return [];

    return calculateYearlyFinanceMetrics(
      ledgerEntries,
      yearlyIncomeEntries,
      yearlyCapexEntries,
      propertyIncome
    );
  }, [
    property,
    ledgerEntries,
    yearlyIncomeEntries,
    yearlyCapexEntries,
    propertyIncome,
  ]);

  const simulationResult = useMemo(() => {
    if (!property || !baseMetrics) return null;

    return simulateFinanceScenario({
      property,
      baseMetrics,
      simulationInput,
      yearlyMetrics,
    });
  }, [property, baseMetrics, simulationInput, yearlyMetrics]);

  const chartData = useMemo(() => {
    if (!simulationResult) return [];
    return buildFinanceChartData(simulationResult);
  }, [simulationResult]);

  return {
    baseMetrics,
    yearlyMetrics,
    simulationResult,
    chartData,
  };
}