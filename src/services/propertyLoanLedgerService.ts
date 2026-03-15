import { supabase } from "@/lib/supabase";
import type {
  LoanLedgerFormValues,
  LoanLedgerRow,
  LoanLedgerValidationResult,
  SaveLoanLedgerPayload,
} from "@/types/loanLedger";

const DEBUG = import.meta.env.DEV;

const LEDGER_TABLE = "property_loan_ledger";
const PROPERTY_LOANS_TABLE = "property_loans";

const LEDGER_SELECT = `
  id,
  property_id,
  loan_id,
  year,
  interest,
  principal,
  balance,
  source,
  created_at,
  updated_at,
  updated_by
`;

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  name?: string | null;
};

type PropertyLoanLedgerRowDb = {
  id: unknown;
  property_id: unknown;
  loan_id: unknown;
  year: unknown;
  interest: unknown;
  principal: unknown;
  balance: unknown;
  source: unknown;
  created_at: unknown;
  updated_at: unknown;
  updated_by: unknown;
};

function devLog(message: string, payload?: unknown) {
  if (!DEBUG) return;
  console.log(`[propertyLoanLedgerService] ${message}`, payload);
}

function devError(message: string, payload?: unknown) {
  if (!DEBUG) return;
  console.error(`[propertyLoanLedgerService] ${message}`, payload);
}

function toSupabaseLikeError(error: unknown): SupabaseLikeError {
  if (!error || typeof error !== "object") {
    return {
      code: null,
      message: error ? String(error) : "Unknown error",
      details: null,
      hint: null,
      name: null,
    };
  }

  const candidate = error as Record<string, unknown>;

  return {
    code: typeof candidate.code === "string" ? candidate.code : null,
    message:
      typeof candidate.message === "string" ? candidate.message : "Unknown error",
    details: typeof candidate.details === "string" ? candidate.details : null,
    hint: typeof candidate.hint === "string" ? candidate.hint : null,
    name: typeof candidate.name === "string" ? candidate.name : null,
  };
}

function toNumberOrNaN(value: string): number {
  if (value == null) return Number.NaN;

  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (normalized === "") return Number.NaN;

  return Number(normalized);
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function mapRowToLoanLedgerRow(row: PropertyLoanLedgerRowDb): LoanLedgerRow {
  return {
    id: toSafeNumber(row.id),
    property_id: toNullableString(row.property_id) ?? "",
    loan_id: toNullableString(row.loan_id) ?? "",
    year: toSafeNumber(row.year),
    interest: toSafeNumber(row.interest),
    principal: toSafeNumber(row.principal),
    balance: toSafeNumber(row.balance),
    source: toNullableString(row.source),
    created_at: toOptionalString(row.created_at),
    updated_at: toOptionalString(row.updated_at),
    updated_by: toNullableString(row.updated_by),
  };
}

function buildFriendlyLedgerErrorMessage(error: SupabaseLikeError): string {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  const details = (error.details ?? "").toLowerCase();
  const hint = (error.hint ?? "").toLowerCase();
  const fullText = `${message} ${details} ${hint}`;

  if (
    code === "23505" ||
    fullText.includes("duplicate key") ||
    fullText.includes("unique constraint")
  ) {
    return "Für dieses Jahr existiert bereits ein Eintrag.";
  }

  if (
    code === "42501" ||
    fullText.includes("row-level security") ||
    fullText.includes("permission denied") ||
    fullText.includes("not allowed") ||
    fullText.includes("violates row-level security policy")
  ) {
    return "Du hast keine Berechtigung diese Daten zu bearbeiten.";
  }

  if (code === "23514" || fullText.includes("check constraint")) {
    return "Bitte nur gültige Werte eingeben.";
  }

  if (fullText.includes("multiple") && fullText.includes("loan")) {
    return "Zu dieser Immobilie existieren mehrere Darlehen. Bitte die loan_id-Auswahl erweitern.";
  }

  if (fullText.includes("no loan") || fullText.includes("kein darlehen")) {
    return "Zu dieser Immobilie wurde kein Darlehen gefunden.";
  }

  return error.message || "Die Änderung konnte nicht gespeichert werden.";
}

function buildDetailedLedgerError(error: unknown, fallback: string): Error {
  const normalized = toSupabaseLikeError(error);
  const friendly = buildFriendlyLedgerErrorMessage(normalized);

  const detailParts = [
    normalized.code ? `Code: ${normalized.code}` : null,
    normalized.details ? `Details: ${normalized.details}` : null,
    normalized.hint ? `Hint: ${normalized.hint}` : null,
  ].filter(Boolean);

  const finalMessage = [friendly || fallback, ...detailParts].join(" | ");
  return new Error(finalMessage);
}

export function mapLedgerError(error: unknown): string {
  return buildDetailedLedgerError(
    error,
    "Die Änderung konnte nicht gespeichert werden."
  ).message;
}

export function rowToFormValues(row: LoanLedgerRow): LoanLedgerFormValues {
  return {
    year: String(row.year ?? ""),
    interest: String(row.interest ?? ""),
    principal: String(row.principal ?? ""),
    balance: String(row.balance ?? ""),
    source: row.source ?? "",
  };
}

export function parseLoanLedgerFormValues(
  values: LoanLedgerFormValues
): SaveLoanLedgerPayload {
  return {
    year: Number(values.year),
    interest: toNumberOrNaN(values.interest),
    principal: toNumberOrNaN(values.principal),
    balance: toNumberOrNaN(values.balance),
    source: values.source?.trim() ? values.source.trim() : null,
  };
}

export function validateLedgerRow(
  values: LoanLedgerFormValues
): LoanLedgerValidationResult {
  const errors: Partial<Record<keyof LoanLedgerFormValues, string>> = {};

  const year = Number(values.year);
  const interest = toNumberOrNaN(values.interest);
  const principal = toNumberOrNaN(values.principal);
  const balance = toNumberOrNaN(values.balance);

  if (!values.year.trim()) {
    errors.year = "Jahr ist erforderlich.";
  } else if (!Number.isInteger(year)) {
    errors.year = "Jahr muss eine ganze Zahl sein.";
  } else if (year < 1900 || year > 2200) {
    errors.year = "Jahr muss zwischen 1900 und 2200 liegen.";
  }

  if (values.interest.trim() === "") {
    errors.interest = "Zinsen sind erforderlich.";
  } else if (Number.isNaN(interest)) {
    errors.interest = "Zinsen müssen eine Zahl sein.";
  } else if (interest < 0) {
    errors.interest = "Zinsen müssen 0 oder größer sein.";
  }

  if (values.principal.trim() === "") {
    errors.principal = "Tilgung ist erforderlich.";
  } else if (Number.isNaN(principal)) {
    errors.principal = "Tilgung muss eine Zahl sein.";
  } else if (principal < 0) {
    errors.principal = "Tilgung muss 0 oder größer sein.";
  }

  if (values.balance.trim() === "") {
    errors.balance = "Restschuld ist erforderlich.";
  } else if (Number.isNaN(balance)) {
    errors.balance = "Restschuld muss eine Zahl sein.";
  } else if (balance < 0) {
    errors.balance = "Restschuld muss 0 oder größer sein.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export async function loadPropertyLoanLedger(
  propertyId: string
): Promise<LoanLedgerRow[]> {
  const { data, error } = await supabase
    .from(LEDGER_TABLE)
    .select(LEDGER_SELECT)
    .eq("property_id", propertyId)
    .order("year", { ascending: true });

  if (error) {
    devError("loadPropertyLoanLedger.error", {
      propertyId,
      table: LEDGER_TABLE,
      error: toSupabaseLikeError(error),
    });

    throw buildDetailedLedgerError(
      error,
      "Fehler beim Laden des Darlehens-Ledgers."
    );
  }

  const rows = ((data ?? []) as PropertyLoanLedgerRowDb[]).map(mapRowToLoanLedgerRow);

  devLog("loadPropertyLoanLedger.success", {
    propertyId,
    rowCount: rows.length,
  });

  return rows;
}

export async function resolveLoanIdForProperty(
  propertyId: string
): Promise<string> {
  const { data, error } = await supabase
    .from(PROPERTY_LOANS_TABLE)
    .select("id, created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (error) {
    devError("resolveLoanIdForProperty.error", {
      propertyId,
      table: PROPERTY_LOANS_TABLE,
      error: toSupabaseLikeError(error),
    });

    throw buildDetailedLedgerError(
      error,
      "Fehler beim Auflösen der loan_id für die Immobilie."
    );
  }

  if (!data || data.length === 0) {
    devError("resolveLoanIdForProperty.noLoan", {
      propertyId,
      rowCount: 0,
    });

    throw new Error("Zu dieser Immobilie wurde kein Darlehen gefunden.");
  }

  if (data.length > 1) {
    devError("resolveLoanIdForProperty.multipleLoans", {
      propertyId,
      rowCount: data.length,
      loanIds: data.map((row) => row.id),
    });

    throw new Error(
      "Zu dieser Immobilie existieren mehrere Darlehen. Die automatische Auswahl von loan_id ist aktuell nicht eindeutig."
    );
  }

  return data[0].id;
}

export async function insertPropertyLoanLedgerRow(
  propertyId: string,
  values: SaveLoanLedgerPayload
): Promise<void> {
  const loanId = await resolveLoanIdForProperty(propertyId);

  const { data, error } = await supabase
    .from(LEDGER_TABLE)
    .insert({
      property_id: propertyId,
      loan_id: loanId,
      year: values.year,
      interest: values.interest,
      principal: values.principal,
      balance: values.balance,
      source: values.source,
    })
    .select(LEDGER_SELECT);

  if (error) {
    devError("insertPropertyLoanLedgerRow.error", {
      propertyId,
      loanId,
      table: LEDGER_TABLE,
      values,
      error: toSupabaseLikeError(error),
    });

    throw buildDetailedLedgerError(
      error,
      "Die neue Ledger-Zeile konnte nicht angelegt werden."
    );
  }

  if (!data || data.length === 0) {
    devError("insertPropertyLoanLedgerRow.emptyResult", {
      propertyId,
      loanId,
      values,
    });

    throw new Error(
      "Die neue Ledger-Zeile konnte nicht angelegt werden. Es wurde kein Datensatz geschrieben."
    );
  }
}

export async function updatePropertyLoanLedgerRow(
  rowId: number,
  values: SaveLoanLedgerPayload
): Promise<void> {
  const { data, error } = await supabase
    .from(LEDGER_TABLE)
    .update({
      year: values.year,
      interest: values.interest,
      principal: values.principal,
      balance: values.balance,
      source: values.source,
    })
    .eq("id", rowId)
    .select(LEDGER_SELECT);

  if (error) {
    devError("updatePropertyLoanLedgerRow.error", {
      rowId,
      table: LEDGER_TABLE,
      values,
      error: toSupabaseLikeError(error),
    });

    throw buildDetailedLedgerError(
      error,
      "Die Zeile konnte nicht aktualisiert werden."
    );
  }

  if (!data || data.length === 0) {
    devError("updatePropertyLoanLedgerRow.emptyResult", {
      rowId,
      values,
    });

    throw new Error(
      "Die Zeile konnte nicht aktualisiert werden. Es wurde kein Datensatz geändert. Bitte Row-ID, RLS und Update-Berechtigung prüfen."
    );
  }
}

export async function deletePropertyLoanLedgerRow(
  rowId: number
): Promise<void> {
  const { data, error } = await supabase
    .from(LEDGER_TABLE)
    .delete()
    .eq("id", rowId)
    .select("id");

  if (error) {
    devError("deletePropertyLoanLedgerRow.error", {
      rowId,
      table: LEDGER_TABLE,
      error: toSupabaseLikeError(error),
    });

    throw buildDetailedLedgerError(
      error,
      "Die Zeile konnte nicht gelöscht werden."
    );
  }

  if (!data || data.length === 0) {
    devError("deletePropertyLoanLedgerRow.emptyResult", {
      rowId,
    });

    throw new Error(
      "Die Zeile konnte nicht gelöscht werden. Es wurde kein Datensatz entfernt."
    );
  }
}