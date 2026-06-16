import { supabase } from "../lib/supabase";
import { isReadonlyApprovalEmail } from "../auth/accessControl";

export type TenantStatus = "active" | "notice" | "former" | "prospect";
export type RentalContractStatus = "active" | "vacant" | "ended" | "planned";

export type TenantProfile = {
  id: string;
  user_id: string;
  tenant_number: string | null;
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  bank_name: string | null;
  iban: string | null;
  notes: string | null;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
};

export type TenantContract = {
  id: string;
  user_id: string;
  tenant_id: string;
  property_id: string | null;
  object_code: string | null;
  unit_label: string | null;
  rent_type: string | null;
  cold_rent: number | null;
  operating_costs: number | null;
  total_rent: number | null;
  deposit_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  status: RentalContractStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantWithContract = {
  tenant: TenantProfile;
  contract: TenantContract | null;
};

export type TenantInput = {
  tenantNumber?: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  bankName?: string;
  iban?: string;
  notes?: string;
  status?: TenantStatus;
};

export type TenantContractInput = {
  propertyId?: string;
  objectCode?: string;
  unitLabel?: string;
  rentType?: string;
  coldRent?: number | null;
  operatingCosts?: number | null;
  totalRent?: number | null;
  depositAmount?: number | null;
  startDate?: string;
  endDate?: string;
  status?: RentalContractStatus;
  notes?: string;
};

function cleanText(value: string | undefined): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned : null;
}

function money(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Nicht eingeloggt.");
  return userId;
}

async function isCurrentUserReadonly(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return isReadonlyApprovalEmail(data.user?.email);
}

export async function listTenantProfiles(limit = 20): Promise<TenantProfile[]> {
  const userId = await getCurrentUserId();
  let query = supabase
    .from("tenant_profiles")
    .select("*")
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!(await isCurrentUserReadonly())) query = query.eq("user_id", userId);
  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as TenantProfile[];
}

export async function createTenantWithContract(
  tenantInput: TenantInput,
  contractInput: TenantContractInput,
): Promise<TenantWithContract> {
  const userId = await getCurrentUserId();

  const tenantPayload = {
    user_id: userId,
    tenant_number: cleanText(tenantInput.tenantNumber),
    salutation: cleanText(tenantInput.salutation),
    first_name: cleanText(tenantInput.firstName),
    last_name: cleanText(tenantInput.lastName),
    company_name: cleanText(tenantInput.companyName),
    email: cleanText(tenantInput.email),
    phone: cleanText(tenantInput.phone),
    mobile: cleanText(tenantInput.mobile),
    street: cleanText(tenantInput.street),
    postal_code: cleanText(tenantInput.postalCode),
    city: cleanText(tenantInput.city),
    bank_name: cleanText(tenantInput.bankName),
    iban: cleanText(tenantInput.iban),
    notes: cleanText(tenantInput.notes),
    status: tenantInput.status ?? "active",
  };

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenant_profiles")
    .insert(tenantPayload)
    .select("*")
    .single();

  if (tenantError) throw tenantError;

  const shouldCreateContract =
    Boolean(cleanText(contractInput.propertyId)) ||
    Boolean(cleanText(contractInput.objectCode)) ||
    Boolean(cleanText(contractInput.unitLabel)) ||
    money(contractInput.totalRent) !== null ||
    Boolean(cleanText(contractInput.startDate));

  if (!shouldCreateContract) {
    return { tenant: tenantData as TenantProfile, contract: null };
  }

  const contractPayload = {
    user_id: userId,
    tenant_id: (tenantData as TenantProfile).id,
    property_id: cleanText(contractInput.propertyId),
    object_code: cleanText(contractInput.objectCode),
    unit_label: cleanText(contractInput.unitLabel),
    rent_type: cleanText(contractInput.rentType),
    cold_rent: money(contractInput.coldRent),
    operating_costs: money(contractInput.operatingCosts),
    total_rent: money(contractInput.totalRent),
    deposit_amount: money(contractInput.depositAmount),
    start_date: cleanText(contractInput.startDate),
    end_date: cleanText(contractInput.endDate),
    status: contractInput.status ?? "active",
    notes: cleanText(contractInput.notes),
  };

  const { data: contractData, error: contractError } = await supabase
    .from("tenant_contracts")
    .insert(contractPayload)
    .select("*")
    .single();

  if (contractError) throw contractError;

  return {
    tenant: tenantData as TenantProfile,
    contract: contractData as TenantContract,
  };
}

export async function updateTenantProfile(id: string, tenantInput: TenantInput): Promise<TenantProfile> {
  const userId = await getCurrentUserId();
  const payload = {
    tenant_number: cleanText(tenantInput.tenantNumber),
    salutation: cleanText(tenantInput.salutation),
    first_name: cleanText(tenantInput.firstName),
    last_name: cleanText(tenantInput.lastName),
    company_name: cleanText(tenantInput.companyName),
    email: cleanText(tenantInput.email),
    phone: cleanText(tenantInput.phone),
    mobile: cleanText(tenantInput.mobile),
    street: cleanText(tenantInput.street),
    postal_code: cleanText(tenantInput.postalCode),
    city: cleanText(tenantInput.city),
    bank_name: cleanText(tenantInput.bankName),
    iban: cleanText(tenantInput.iban),
    notes: cleanText(tenantInput.notes),
    status: tenantInput.status ?? "active",
  };

  const { data, error } = await supabase
    .from("tenant_profiles")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as TenantProfile;
}
