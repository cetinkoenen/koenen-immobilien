import { supabase } from "@/lib/supabase";

export type InvestmentAiFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
};

export type InvestmentAiChapterStatus = {
  chapter: string;
  status: "Bereit" | "Prüfen" | "Offen";
  note: string;
};

export type InvestmentAiProfile = {
  objectType?: string;
  address?: string;
  purchasePrice?: number | null;
  buyerProvision?: number | null;
  acquisitionCosts?: number | null;
  livingArea?: number | null;
  rooms?: number | null;
  monthlyRent?: number | null;
  monthlyHousegeld?: number | null;
  annualRent?: number | null;
  grossYieldPurchasePrice?: number | null;
  grossYieldAcquisitionCosts?: number | null;
  purchaseFactor?: number | null;
  rentPerSqm?: number | null;
  monthlySurplusBeforeFinancing?: number | null;
  energyValue?: string;
  energyClass?: string;
  heating?: string;
  investorScore?: string;
  recommendation?: string;
  bankKeyMessage?: string;
  housegeldNote?: string;
};

export type InvestmentAiFinancingScenario = {
  label: string;
  loanAmount: number;
  monthlyRate: number;
  cashflowAfterRate: number | null;
};

export type InvestmentAiRiskMatrixItem = {
  field: string;
  rating: string;
  finding: string;
};

export type InvestmentAiDocumentFinding = {
  document: string;
  status: string;
  finding: string;
};

export type InvestmentAiReport = {
  generatedAt?: string;
  statusLabel: string;
  summary: string;
  risks: string[];
  nextSteps: string[];
  chapterStatus: InvestmentAiChapterStatus[];
  bankFazit: string;
  profile?: InvestmentAiProfile;
  financialScenarios?: InvestmentAiFinancingScenario[];
  riskMatrix?: InvestmentAiRiskMatrixItem[];
  openQuestions?: string[];
  documentFindings?: InvestmentAiDocumentFinding[];
};

type RunInvestmentAiAnalysisInput = {
  objectName: string;
  location: string;
  purchasePrice: string;
  buyerProvision: string;
  equity: string;
  targetRent: string;
  livingArea: string;
  rooms: string;
  monthlyHousegeld: string;
  interestRate: string;
  amortizationRate: string;
  files: InvestmentAiFile[];
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

export async function runInvestmentAiAnalysis(input: RunInvestmentAiAnalysisInput): Promise<InvestmentAiReport> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Bitte zuerst anmelden. Die KI-Bewertung benötigt eine aktive Supabase-Sitzung.");
  }

  const files = await Promise.all(
    input.files.map(async (entry) => ({
      name: entry.name,
      size: entry.size,
      type: entry.type || entry.file.type || "application/octet-stream",
      dataUrl: await readFileAsDataUrl(entry.file),
    })),
  );

  const { data, error } = await supabase.functions.invoke("investment-report-ai", {
    body: {
      objectName: input.objectName,
      location: input.location,
      purchasePrice: input.purchasePrice,
      buyerProvision: input.buyerProvision,
      equity: input.equity,
      targetRent: input.targetRent,
      livingArea: input.livingArea,
      rooms: input.rooms,
      monthlyHousegeld: input.monthlyHousegeld,
      interestRate: input.interestRate,
      amortizationRate: input.amortizationRate,
      files,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.report) {
    throw new Error(data?.error ?? "Die KI-Bewertung hat keinen Bericht zurückgegeben.");
  }

  return data.report as InvestmentAiReport;
}
