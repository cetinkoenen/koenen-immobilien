import { useCallback, useState } from "react";

export interface UseSimulationResult {
  simulation: any | null;
  isLoading: boolean;
  error: Error | null;
  runSimulation: (input?: any) => Promise<any>;
  resetSimulation: () => void;
}

export function useSimulation(): UseSimulationResult {
  const [simulation, setSimulation] = useState<any | null>(null);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const runSimulation = useCallback(async (input?: any) => {
    const result = input ?? null;
    setSimulation(result);
    return result;
  }, []);

  const resetSimulation = useCallback(() => {
    setSimulation(null);
  }, []);

  return {
    simulation,
    isLoading,
    error,
    runSimulation,
    resetSimulation,
  };
}
