import { supabase } from '@/lib/supabase'
import type {
  LoanLedgerFormValues,
  LoanLedgerRow,
  LoanLedgerValidationResult,
  SaveLoanLedgerPayload,
} from '@/types/loanLedger'

function toNumberOrNaN(value: string): number {
  if (value == null) return Number.NaN

  const normalized = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  if (normalized === '') return Number.NaN

  return Number(normalized)
}

function mapRowToLoanLedgerRow(row: any): LoanLedgerRow {
  return {
    id: Number(row.id),
    property_id: row.property_id,
    loan_id: row.loan_id,
    year: Number(row.year),
    interest: Number(row.interest ?? 0),
    principal: Number(row.principal ?? 0),
    balance: Number(row.balance ?? 0),
    source: row.source ?? null,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
    updated_by: row.updated_by ?? null,
  }
}

export function rowToFormValues(row: LoanLedgerRow): LoanLedgerFormValues {
  return {
    year: String(row.year ?? ''),
    interest: String(row.interest ?? ''),
    principal: String(row.principal ?? ''),
    balance: String(row.balance ?? ''),
    source: row.source ?? '',
  }
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
  }
}

export function validateLedgerRow(
  values: LoanLedgerFormValues
): LoanLedgerValidationResult {
  const errors: Partial<Record<keyof LoanLedgerFormValues, string>> = {}

  const year = Number(values.year)
  const interest = toNumberOrNaN(values.interest)
  const principal = toNumberOrNaN(values.principal)
  const balance = toNumberOrNaN(values.balance)

  if (!values.year.trim()) {
    errors.year = 'Jahr ist erforderlich.'
  } else if (!Number.isInteger(year)) {
    errors.year = 'Jahr muss eine ganze Zahl sein.'
  } else if (year < 1900 || year > 2200) {
    errors.year = 'Jahr muss zwischen 1900 und 2200 liegen.'
  }

  if (values.interest.trim() === '') {
    errors.interest = 'Zinsen sind erforderlich.'
  } else if (Number.isNaN(interest)) {
    errors.interest = 'Zinsen müssen eine Zahl sein.'
  } else if (interest < 0) {
    errors.interest = 'Zinsen müssen 0 oder größer sein.'
  }

  if (values.principal.trim() === '') {
    errors.principal = 'Tilgung ist erforderlich.'
  } else if (Number.isNaN(principal)) {
    errors.principal = 'Tilgung muss eine Zahl sein.'
  } else if (principal < 0) {
    errors.principal = 'Tilgung muss 0 oder größer sein.'
  }

  if (values.balance.trim() === '') {
    errors.balance = 'Restschuld ist erforderlich.'
  } else if (Number.isNaN(balance)) {
    errors.balance = 'Restschuld muss eine Zahl sein.'
  } else if (balance < 0) {
    errors.balance = 'Restschuld muss 0 oder größer sein.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

export function mapLedgerError(error: unknown): string {
  const err = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }

  const code = err?.code ?? ''
  const message = (err?.message ?? '').toLowerCase()
  const details = (err?.details ?? '').toLowerCase()
  const hint = (err?.hint ?? '').toLowerCase()
  const fullText = `${message} ${details} ${hint}`

  if (
    code === '23505' ||
    fullText.includes('duplicate key') ||
    fullText.includes('unique constraint')
  ) {
    return 'Für dieses Jahr existiert bereits ein Eintrag.'
  }

  if (
    code === '42501' ||
    fullText.includes('row-level security') ||
    fullText.includes('permission denied') ||
    fullText.includes('not allowed') ||
    fullText.includes('violates row-level security policy')
  ) {
    return 'Du hast keine Berechtigung diese Daten zu bearbeiten.'
  }

  if (code === '23514' || fullText.includes('check constraint')) {
    return 'Bitte nur gültige Werte eingeben.'
  }

  if (fullText.includes('multiple') && fullText.includes('loan')) {
    return 'Zu dieser Immobilie existieren mehrere Darlehen. Bitte die loan_id-Auswahl erweitern.'
  }

  if (fullText.includes('no loan') || fullText.includes('kein darlehen')) {
    return 'Zu dieser Immobilie wurde kein Darlehen gefunden.'
  }

  return err?.message || 'Die Änderung konnte nicht gespeichert werden.'
}

export async function loadPropertyLoanLedger(
  propertyId: string
): Promise<LoanLedgerRow[]> {
  const { data, error } = await supabase
    .from('property_loan_ledger')
    .select(`
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
    `)
    .eq('property_id', propertyId)
    .order('year', { ascending: true })

  if (error) {
    throw new Error(mapLedgerError(error))
  }

  return (data ?? []).map(mapRowToLoanLedgerRow)
}

export async function resolveLoanIdForProperty(
  propertyId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('property_loans')
    .select('id, created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(mapLedgerError(error))
  }

  if (!data || data.length === 0) {
    throw new Error('Zu dieser Immobilie wurde kein Darlehen gefunden.')
  }

  if (data.length > 1) {
    throw new Error(
      'Zu dieser Immobilie existieren mehrere Darlehen. Die automatische Auswahl von loan_id ist aktuell nicht eindeutig.'
    )
  }

  return data[0].id
}

export async function insertPropertyLoanLedgerRow(
  propertyId: string,
  values: SaveLoanLedgerPayload
): Promise<void> {
  const loanId = await resolveLoanIdForProperty(propertyId)

  const { data, error } = await supabase
    .from('property_loan_ledger')
    .insert({
      property_id: propertyId,
      loan_id: loanId,
      year: values.year,
      interest: values.interest,
      principal: values.principal,
      balance: values.balance,
      source: values.source,
    })
    .select(`
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
    `)

  if (error) {
    throw new Error(mapLedgerError(error))
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Die neue Ledger-Zeile konnte nicht angelegt werden. Es wurde kein Datensatz geschrieben.'
    )
  }
}

export async function updatePropertyLoanLedgerRow(
  rowId: number,
  values: SaveLoanLedgerPayload
): Promise<void> {
  const { data, error } = await supabase
    .from('property_loan_ledger')
    .update({
      year: values.year,
      interest: values.interest,
      principal: values.principal,
      balance: values.balance,
      source: values.source,
    })
    .eq('id', rowId)
    .select(`
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
    `)

  if (error) {
    throw new Error(mapLedgerError(error))
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Die Zeile konnte nicht aktualisiert werden. Es wurde kein Datensatz geändert. Bitte Row-ID, RLS und Update-Berechtigung prüfen.'
    )
  }
}

export async function deletePropertyLoanLedgerRow(
  rowId: number
): Promise<void> {
  const { data, error } = await supabase
    .from('property_loan_ledger')
    .delete()
    .eq('id', rowId)
    .select('id')

  if (error) {
    throw new Error(mapLedgerError(error))
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Die Zeile konnte nicht gelöscht werden. Es wurde kein Datensatz entfernt.'
    )
  }
}