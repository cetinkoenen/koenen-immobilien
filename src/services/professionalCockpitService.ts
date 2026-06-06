import { supabase } from "../lib/supabase";
import {
  isVacancyEffectivelyActiveInRange,
  listVacancies,
  type UnitVacancy,
} from "./vacancyService";

export type OpenPostStatus = "paid" | "partial" | "missing" | "vacant";

export type OpenPostRow = {
  contractId: string;
  tenantId: string;
  tenantName: string;
  propertyId: string | null;
  objectCode: string | null;
  objectLabel: string;
  unitLabel: string | null;
  expectedAmount: number;
  paidAmount: number;
  openAmount: number;
  status: OpenPostStatus;
  dueDate: string;
};

export type CockpitTask = {
  id: string;
  title: string;
  category: string;
  priority: string;
  dueDate: string | null;
  propertyName: string | null;
};

export type CockpitDocumentIssue = {
  id: string;
  propertyName: string;
  category: string;
  detail: string;
};

export type CockpitSnapshot = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  expectedTotal: number;
  paidTotal: number;
  openTotal: number;
  paidCount: number;
  partialCount: number;
  missingCount: number;
  vacantCount: number;
  openPosts: OpenPostRow[];
  tasks: CockpitTask[];
  documentIssues: CockpitDocumentIssue[];
};

export type PaymentReminderRow = {
  id: string;
  reminder_level: "zahlungserinnerung" | "mahnung_1" | "mahnung_2" | "letzte_mahnung";
  status: "draft" | "sent" | "blocked" | "resolved" | "archived";
  tenant_id: string | null;
  tenant_contract_id: string | null;
  property_id: string | null;
  object_code: string | null;
  unit_label: string | null;
  due_date: string | null;
  open_amount: number;
  fee_amount: number;
  interest_amount: number;
  subject: string | null;
  body: string | null;
  reminder_key: string;
  created_at: string;
};

type ContractRow = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  object_code: string | null;
  unit_label: string | null;
  rent_type: string | null;
  cold_rent: number | string | null;
  operating_costs: number | string | null;
  total_rent: number | string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  tenant_profiles?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    tenant_number: string | null;
  } | null;
};

type FinanceRow = {
  object_id: string | null;
  objekt_code: string | null;
  booking_date: string | null;
  amount: number | string | null;
  category: string | null;
  note: string | null;
};

type ObjectRow = {
  value: string | null;
  object_id: string | null;
  property_id: string | null;
  objekt_code: string | null;
  label: string | null;
};

function toMoney(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthRange(baseDate = new Date()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const due = new Date(baseDate.getFullYear(), baseDate.getMonth(), 3);
  return {
    start: isoDate(start),
    end: isoDate(end),
    due: isoDate(due),
    label: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(start),
  };
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value: string | null | undefined): string {
  return normalize(value).replace(/\s+/g, "");
}

function tenantName(contract: ContractRow): string {
  const tenant = contract.tenant_profiles;
  const personal = [tenant?.first_name, tenant?.last_name].filter(Boolean).join(" ").trim();
  return tenant?.company_name || personal || tenant?.tenant_number || "Unbenannter Mieter";
}

function isContractRelevant(contract: ContractRow, start: string, end: string): boolean {
  if (contract.status === "ended" && contract.end_date && contract.end_date < start) return false;
  if (contract.status === "planned" && contract.start_date && contract.start_date > end) return false;
  if (contract.start_date && contract.start_date > end) return false;
  if (contract.end_date && contract.end_date < start) return false;
  return contract.status !== "vacant";
}

function expectedRent(contract: ContractRow): number {
  const total = toMoney(contract.total_rent);
  if (total > 0) return total;
  return toMoney(contract.cold_rent) + toMoney(contract.operating_costs);
}

function bookingEffectiveMonthDate(bookingDate: string | null): string | null {
  if (!bookingDate) return null;
  const day = Number(bookingDate.slice(8, 10));
  const date = new Date(`${bookingDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return bookingDate;
  if (Number.isFinite(day) && day >= 25) date.setMonth(date.getMonth() + 1);
  return isoDate(date);
}

function isRentPayment(row: FinanceRow): boolean {
  const text = normalize(`${row.category ?? ""} ${row.note ?? ""}`);
  return text.includes("miete") || text.includes("pacht") || text.includes("garage") || text.includes("stellplatz");
}

function bookingMatchesContract(row: FinanceRow, contract: ContractRow): boolean {
  if (row.object_id && contract.property_id && String(row.object_id) === String(contract.property_id)) return true;
  if (row.objekt_code && contract.object_code && normalize(row.objekt_code) === normalize(contract.object_code)) return true;
  const unit = compact(contract.unit_label);
  if (!unit) return true;
  const text = compact(`${row.category ?? ""} ${row.note ?? ""}`);
  return text.includes(unit);
}

function vacancyMatchesContract(vacancy: UnitVacancy, contract: ContractRow): boolean {
  const propertyMatch =
    String(vacancy.property_id ?? "") === String(contract.property_id ?? "") ||
    normalize(vacancy.object_code) === normalize(contract.object_code);
  if (!propertyMatch) return false;

  const vacancyUnit = compact(vacancy.unit_label);
  const contractUnit = compact(contract.unit_label);
  if (!vacancyUnit || !contractUnit) return true;
  return vacancyUnit.includes(contractUnit) || contractUnit.includes(vacancyUnit);
}

function buildObjectLabelMap(rows: ObjectRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const label = row.label || row.objekt_code || row.value || "Unbekanntes Objekt";
    for (const key of [row.value, row.object_id, row.property_id, row.objekt_code]) {
      if (key) result[String(key)] = label;
    }
  }
  return result;
}

export async function loadCockpitSnapshot(baseDate = new Date()): Promise<CockpitSnapshot> {
  const period = monthRange(baseDate);
  const previousWindowStart = isoDate(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 25));

  const [contractsRes, objectsRes, paymentsRes, taskRes, docsRes, vacancyRows] = await Promise.all([
    supabase
      .from("tenant_contracts")
      .select("*,tenant_profiles(first_name,last_name,company_name,tenant_number)")
      .eq("is_deleted", false)
      .in("status", ["active", "planned"]),
    supabase.from("v_object_dropdown").select("value,object_id,property_id,objekt_code,label"),
    supabase
      .from("finance_entry")
      .select("object_id,objekt_code,booking_date,amount,category,note")
      .eq("is_deleted", false)
      .eq("entry_type", "income")
      .gte("booking_date", previousWindowStart)
      .lte("booking_date", period.end),
    supabase
      .from("property_tasks")
      .select("id,title,category,priority,due_date,property_name,status")
      .in("status", ["offen", "in_bearbeitung"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("property_documents")
      .select("id,property_name,category,status,title")
      .in("status", ["fehlt", "läuft_bald_ab", "abgelaufen"])
      .limit(8),
    listVacancies({ from: period.start, to: period.end }).catch(() => [] as UnitVacancy[]),
  ]);

  if (contractsRes.error) throw contractsRes.error;
  if (objectsRes.error) throw objectsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const contracts = ((contractsRes.data ?? []) as unknown as ContractRow[]).filter((contract) =>
    isContractRelevant(contract, period.start, period.end),
  );
  const objectLabels = buildObjectLabelMap((objectsRes.data ?? []) as ObjectRow[]);
  const payments = ((paymentsRes.data ?? []) as FinanceRow[]).filter((row) => {
    const effectiveDate = bookingEffectiveMonthDate(row.booking_date);
    return Boolean(effectiveDate && effectiveDate >= period.start && effectiveDate <= period.end && isRentPayment(row));
  });

  const openPosts = contracts
    .map<OpenPostRow | null>((contract) => {
      const expectedAmount = expectedRent(contract);
      if (expectedAmount <= 0) return null;

      const isVacant = vacancyRows.some(
        (vacancy) =>
          isVacancyEffectivelyActiveInRange(vacancy, period.start, period.end) &&
          vacancyMatchesContract(vacancy, contract),
      );
      const paidAmount = isVacant
        ? 0
        : payments
            .filter((payment) => bookingMatchesContract(payment, contract))
            .reduce((sum, payment) => sum + toMoney(payment.amount), 0);
      const openAmount = Math.max(expectedAmount - paidAmount, 0);
      const status: OpenPostStatus = isVacant
        ? "vacant"
        : openAmount <= 0.01
          ? "paid"
          : paidAmount > 0
            ? "partial"
            : "missing";

      return {
        contractId: contract.id,
        tenantId: contract.tenant_id,
        tenantName: tenantName(contract),
        propertyId: contract.property_id,
        objectCode: contract.object_code,
        objectLabel: objectLabels[contract.property_id ?? ""] || objectLabels[contract.object_code ?? ""] || contract.object_code || "Unbekanntes Objekt",
        unitLabel: contract.unit_label,
        expectedAmount,
        paidAmount,
        openAmount,
        status,
        dueDate: period.due,
      };
    })
    .filter((row): row is OpenPostRow => Boolean(row));

  const expectedTotal = openPosts.reduce((sum, row) => sum + (row.status === "vacant" ? 0 : row.expectedAmount), 0);
  const paidTotal = openPosts.reduce((sum, row) => sum + row.paidAmount, 0);
  const openTotal = openPosts.reduce((sum, row) => sum + row.openAmount, 0);

  return {
    periodLabel: period.label,
    periodStart: period.start,
    periodEnd: period.end,
    dueDate: period.due,
    expectedTotal,
    paidTotal,
    openTotal,
    paidCount: openPosts.filter((row) => row.status === "paid").length,
    partialCount: openPosts.filter((row) => row.status === "partial").length,
    missingCount: openPosts.filter((row) => row.status === "missing").length,
    vacantCount: openPosts.filter((row) => row.status === "vacant").length,
    openPosts: openPosts.sort((a, b) => b.openAmount - a.openAmount),
    tasks: taskRes.error
      ? []
      : ((taskRes.data ?? []) as any[]).map((task) => ({
          id: String(task.id),
          title: String(task.title ?? "Aufgabe"),
          category: String(task.category ?? "allgemein"),
          priority: String(task.priority ?? "mittel"),
          dueDate: task.due_date ?? null,
          propertyName: task.property_name ?? null,
        })),
    documentIssues: docsRes.error
      ? []
      : ((docsRes.data ?? []) as any[]).map((doc) => ({
          id: String(doc.id),
          propertyName: doc.property_name ?? "Unbekanntes Objekt",
          category: String(doc.category ?? "sonstiges"),
          detail: doc.title || doc.status || "Dokument prüfen",
        })),
  };
}

export async function createPaymentReminderDraft(
  row: OpenPostRow,
  level: PaymentReminderRow["reminder_level"] = "zahlungserinnerung",
): Promise<PaymentReminderRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Nicht eingeloggt.");

  const levelLabel =
    level === "mahnung_1"
      ? "1. Mahnung"
      : level === "mahnung_2"
        ? "2. Mahnung"
        : level === "letzte_mahnung"
          ? "Letzte Mahnung"
          : "Zahlungserinnerung";
  const subject = `${levelLabel}: offener Mietbetrag ${row.objectLabel}`;
  const body = [
    `Sehr geehrte Damen und Herren,`,
    ``,
    `für ${row.objectLabel}${row.unitLabel ? `, ${row.unitLabel}` : ""} ist aktuell ein Mietbetrag offen.`,
    `Sollbetrag: ${eurText(row.expectedAmount)}`,
    `Bisher bezahlt: ${eurText(row.paidAmount)}`,
    `Offener Betrag: ${eurText(row.openAmount)}`,
    ``,
    `Bitte prüfen Sie die Zahlung und gleichen Sie den offenen Betrag aus.`,
  ].join("\n");

  const { data, error } = await supabase
    .from("payment_reminders")
    .insert({
      user_id: userId,
      tenant_id: row.tenantId,
      tenant_contract_id: row.contractId,
      property_id: row.propertyId,
      object_code: row.objectCode,
      unit_label: row.unitLabel,
      reminder_level: level,
      status: "draft",
      due_date: row.dueDate,
      open_amount: row.openAmount,
      subject,
      body,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PaymentReminderRow;
}

export async function listPaymentReminderDrafts(limit = 20): Promise<PaymentReminderRow[]> {
  const { data, error } = await supabase
    .from("payment_reminders")
    .select("*")
    .in("status", ["draft", "blocked", "sent"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PaymentReminderRow[];
}

function eurText(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value || 0);
}
