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

const INVESTMENT_ANALYSIS_BUCKET = "investment-analysis-files";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function safeStorageFileName(value: string) {
  const extension = value.includes(".") ? value.slice(value.lastIndexOf(".")) : "";
  const baseName = value.replace(/\.[^.]+$/, "");
  const safeBase =
    baseName
      .trim()
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "unterlage";
  return `${safeBase}${extension.toLowerCase()}`;
}

function createSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function runInvestmentAiAnalysis(input: RunInvestmentAiAnalysisInput): Promise<InvestmentAiReport> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Bitte zuerst anmelden. Die KI-Bewertung benötigt eine aktive Supabase-Sitzung.");
  }

  const userId = session.user.id;
  const sessionId = createSessionId();
  const uploadedPaths: string[] = [];

  let storageFiles: Array<{
    bucket: string;
    path: string;
    name: string;
    size: number;
    type: string;
  }> = [];

  try {
    storageFiles = await Promise.all(
      input.files.map(async (entry, index) => {
        const path = `${userId}/${sessionId}/${String(index + 1).padStart(2, "0")}-${safeStorageFileName(entry.name)}`;
        const { error } = await supabase.storage
          .from(INVESTMENT_ANALYSIS_BUCKET)
          .upload(path, entry.file, {
            cacheControl: "60",
            contentType: entry.type || entry.file.type || "application/octet-stream",
            upsert: false,
          });

        if (error) {
          throw new Error(`Upload fehlgeschlagen (${entry.name}): ${error.message}`);
        }

        uploadedPaths.push(path);
        return {
          bucket: INVESTMENT_ANALYSIS_BUCKET,
          path,
          name: entry.name,
          size: entry.size,
          type: entry.type || entry.file.type || "application/octet-stream",
        };
      }),
    );
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(INVESTMENT_ANALYSIS_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }

  let data: { report?: InvestmentAiReport; error?: string } | null = null;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/investment-report-ai`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      storageFiles,
      }),
    });

    data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error ?? `KI-Backend Fehler (${response.status}). Bitte später erneut versuchen.`);
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(INVESTMENT_ANALYSIS_BUCKET).remove(uploadedPaths);
    }
    if (error instanceof Error) {
      throw new Error(
        error.message === "Failed to fetch"
          ? "Verbindung zur Supabase Edge Function fehlgeschlagen. Bitte Seite neu laden und erneut versuchen."
          : error.message,
      );
    }
    throw new Error("KI-Backend konnte nicht erreicht werden.");
  }

  if (!data?.report) {
    if (uploadedPaths.length) {
      await supabase.storage.from(INVESTMENT_ANALYSIS_BUCKET).remove(uploadedPaths);
    }
    throw new Error(data?.error ?? "Die KI-Bewertung hat keinen Bericht zurückgegeben.");
  }

  return data.report as InvestmentAiReport;
}
