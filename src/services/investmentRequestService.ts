import { supabase } from "@/lib/supabase";

export type InvestmentRequestStatus = "draft" | "in_review" | "bank_sent" | "archived";

export type InvestmentRequestFileMetadata = {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
};

export type InvestmentRequestPayload = {
  unitDescription?: string;
  purchasePrice?: string;
  loanAmount?: string;
  buyerProvision?: string;
  equity?: string;
  targetRent?: string;
  apartmentRent?: string;
  parkingRent?: string;
  nkPrepayment?: string;
  livingArea?: string;
  rooms?: string;
  monthlyHousegeld?: string;
  interestRate?: string;
  amortizationRate?: string;
  monthlyBankRate?: string;
  personalTaxRate?: string;
  plannedRentIncreaseRate?: string;
  additionalMaintenance?: string;
  nonDeductibleHousegeld?: string;
  persons?: unknown[];
  checklist?: unknown[];
};

export type InvestmentRequestRow = {
  id: string;
  user_id: string;
  title: string;
  object_name: string;
  request_date: string;
  address: string | null;
  location: string | null;
  status: InvestmentRequestStatus;
  expires_at: string | null;
  payload: InvestmentRequestPayload;
  ai_report: Record<string, unknown> | null;
  file_metadata: InvestmentRequestFileMetadata[];
  created_at: string;
  updated_at: string;
};

export type SaveInvestmentRequestInput = {
  id?: string;
  title: string;
  objectName: string;
  requestDate: string;
  address?: string | null;
  location?: string | null;
  status?: InvestmentRequestStatus;
  expiresAt?: string | null;
  payload: InvestmentRequestPayload;
  aiReport?: Record<string, unknown> | null;
  fileMetadata?: InvestmentRequestFileMetadata[];
};

function toDbPayload(input: SaveInvestmentRequestInput) {
  return {
    title: input.title.trim() || "Neue Investition",
    object_name: input.objectName.trim() || "Neue Investition",
    request_date: input.requestDate,
    address: input.address?.trim() || null,
    location: input.location?.trim() || null,
    status: input.status ?? "draft",
    expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    payload: input.payload,
    ai_report: input.aiReport ?? null,
    file_metadata: input.fileMetadata ?? [],
  };
}

export async function listInvestmentRequests() {
  const { data, error } = await supabase
    .from("investment_requests")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InvestmentRequestRow[];
}

export async function saveInvestmentRequest(input: SaveInvestmentRequestInput) {
  const payload = toDbPayload(input);
  const query = input.id
    ? supabase.from("investment_requests").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("investment_requests").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return data as InvestmentRequestRow;
}

export async function archiveInvestmentRequest(id: string) {
  const { data, error } = await supabase
    .from("investment_requests")
    .update({ status: "archived" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as InvestmentRequestRow;
}
