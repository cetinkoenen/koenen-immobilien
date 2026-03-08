import { supabase } from '@/lib/supabase'
import type {
  LoanLedgerFormValues,
  LoanLedgerRow,
  LoanLedgerValidationResult,
  SaveLoanLedgerPayload,
} from '@/types/loanLedger'

type SupabaseLikeError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
  name?: string | null
}

type LedgerServiceDebugInfo = {
  timestamp: string
  action: string
  propertyId?: string
  rowId?: number
  hasSession?: boolean
  userId?: string | null
  supabaseUrl?: string | null
  origin?: string | null
  hostname?: string | null
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
  extra?: Record<string, unknown>
}

function getRuntimeLocation() {
  if (typeof window === 'undefined') {
    return {
      origin: null,
      hostname: null,
      href: null,
    }
  }

  return {
    origin: window.location.origin,
    hostname: window.location.hostname,
    href: window.location.href,
  }
}

function getSupabaseProjectUrl(): string | null {
  try {
    return import.meta.env.VITE_SUPABASE_URL ?? null
  } catch {
    return null
  }
}

function toSupabaseLikeError(error: unknown): SupabaseLikeError {
  if (!error || typeof error !== 'object') {
    return {
      code: null,
      message: error ? String(error) : 'Unknown error',
      details: null,
      hint: null,
      name: null,
    }
  }

  const candidate = error as Record<string, unknown>

  return {
    code: typeof candidate.code === 'string' ? candidate.code : null,
    message: typeof candidate.message === 'string' ? candidate.message : 'Unknown error',
    details: typeof candidate.details === 'string' ? candidate.details : null,
    hint: typeof candidate.hint === 'string' ? candidate.hint : null,
    name: typeof candidate.name === 'string' ? candidate.name : null,
  }
}

async function getAuthDebugContext() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    return {
      hasSession: !!sessionData?.session,
      userId: userData?.user?.id ?? null,
      sessionError: sessionError ? toSupabaseLikeError(sessionError) : null,
      userError: userError ? toSupabaseLikeError(userError) : null,
    }
  } catch (error) {
    return {
      hasSession: false,
      userId: null,
      sessionError: toSupabaseLikeError(error),
      userError: null,
    }
  }
}

async function logLedgerDebug(
  action: string,
  options?: {
    propertyId?: string
    rowId?: number
    error?: unknown
    extra?: Record<string, unknown>
  }
) {
  const auth = await getAuthDebugContext()
  const location = getRuntimeLocation()
  const normalizedError = options?.error ? toSupabaseLikeError(options.error) : null

  const payload: LedgerServiceDebugInfo = {
    timestamp: new Date().toISOString(),
    action,
    propertyId: options?.propertyId,
    rowId: options?.rowId,
    hasSession: auth.hasSession,
    userId: auth.userId,
    supabaseUrl: getSupabaseProjectUrl(),
    origin: location.origin,
    hostname: location.hostname,
    code: normalizedError?.code ?? null,
    message: normalizedError?.message ?? null,
    details: normalizedError?.details ?? null,
    hint: normalizedError?.hint ?? null,
    extra: {
      ...(options?.extra ?? {}),
      sessionError: auth.sessionError,
      userError: auth.userError,
    },
  }

  console.error(`[propertyLoanLedgerService] ${action}`, payload)
}

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

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapRowToLoanLedgerRow(row: any): LoanLedgerRow {
  return {
    id: toSafeNumber(row.id),
    property_id: row.property_id,
    loan_id: row.loan_id,
    year: toSafeNumber(row.year),
    interest: toSafeNumber(row.interest),
    principal: toSafeNumber(row.principal),
    balance: toSafeNumber(row.balance),
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

function buildFriendlyLedgerErrorMessage(error: SupabaseLikeError): string {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  const details = (error.details ?? '').toLowerCase()
  const hint = (error.hint ?? '').toLowerCase()
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

  return error.message || 'Die Änderung konnte nicht gespeichert werden.'
}

function buildDetailedLedgerError(error: unknown, fallback: string): Error {
  const normalized = toSupabaseLikeError(error)
  const friendly = buildFriendlyLedgerErrorMessage(normalized)

  const detailParts = [
    normalized.code ? `Code: ${normalized.code}` : null,
    normalized.details ? `Details: ${normalized.details}` : null,
    normalized.hint ? `Hint: ${normalized.hint}` : null,
  ].filter(Boolean)

  const finalMessage = [friendly || fallback, ...detailParts].join(' | ')
  return new Error(finalMessage)
}

export function mapLedgerError(error: unknown): string {
  return buildDetailedLedgerError(
    error,
    'Die Änderung konnte nicht gespeichert werden.'
  ).message
}

export async function getLoanLedgerAuthDebugInfo() {
  const auth = await getAuthDebugContext()
  const location = getRuntimeLocation()

  return {
    timestamp: new Date().toISOString(),
    hasSession: auth.hasSession,
    userId: auth.userId,
    sessionError: auth.sessionError,
    userError: auth.userError,
    supabaseUrl: getSupabaseProjectUrl(),
    origin: location.origin,
    hostname: location.hostname,
    href: location.href,
  }
}

export async function loadPropertyLoanLedger(
  propertyId: string
): Promise<LoanLedgerRow[]> {
  const { data, error } = await supabase
    .from('property_loan_ledger')
    .select(
      `
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
    `
    )
    .eq('property_id', propertyId)
    .order('year', { ascending: true })

  if (error) {
    await logLedgerDebug('loadPropertyLoanLedger.error', {
      propertyId,
      error,
      extra: {
        table: 'property_loan_ledger',
      },
    })

    throw buildDetailedLedgerError(
      error,
      'Fehler beim Laden des Darlehens-Ledgers.'
    )
  }

  const rows = (data ?? []).map(mapRowToLoanLedgerRow)

  console.log('[propertyLoanLedgerService] loadPropertyLoanLedger.success', {
    timestamp: new Date().toISOString(),
    propertyId,
    rowCount: rows.length,
  })

  return rows
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
    await logLedgerDebug('resolveLoanIdForProperty.error', {
      propertyId,
      error,
      extra: {
        table: 'property_loans',
      },
    })

    throw buildDetailedLedgerError(
      error,
      'Fehler beim Auflösen der loan_id für die Immobilie.'
    )
  }

  if (!data || data.length === 0) {
    await logLedgerDebug('resolveLoanIdForProperty.noLoan', {
      propertyId,
      extra: {
        rowCount: 0,
      },
    })

    throw new Error('Zu dieser Immobilie wurde kein Darlehen gefunden.')
  }

  if (data.length > 1) {
    await logLedgerDebug('resolveLoanIdForProperty.multipleLoans', {
      propertyId,
      extra: {
        rowCount: data.length,
        loanIds: data.map((row) => row.id),
      },
    })

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
    .select(
      `
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
    `
    )

  if (error) {
    await logLedgerDebug('insertPropertyLoanLedgerRow.error', {
      propertyId,
      error,
      extra: {
        loanId,
        values,
        table: 'property_loan_ledger',
      },
    })

    throw buildDetailedLedgerError(
      error,
      'Die neue Ledger-Zeile konnte nicht angelegt werden.'
    )
  }

  if (!data || data.length === 0) {
    await logLedgerDebug('insertPropertyLoanLedgerRow.emptyResult', {
      propertyId,
      extra: {
        loanId,
        values,
      },
    })

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
    .select(
      `
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
    `
    )

  if (error) {
    await logLedgerDebug('updatePropertyLoanLedgerRow.error', {
      rowId,
      error,
      extra: {
        values,
        table: 'property_loan_ledger',
      },
    })

    throw buildDetailedLedgerError(
      error,
      'Die Zeile konnte nicht aktualisiert werden.'
    )
  }

  if (!data || data.length === 0) {
    await logLedgerDebug('updatePropertyLoanLedgerRow.emptyResult', {
      rowId,
      extra: {
        values,
      },
    })

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
    await logLedgerDebug('deletePropertyLoanLedgerRow.error', {
      rowId,
      error,
      extra: {
        table: 'property_loan_ledger',
      },
    })

    throw buildDetailedLedgerError(
      error,
      'Die Zeile konnte nicht gelöscht werden.'
    )
  }

  if (!data || data.length === 0) {
    await logLedgerDebug('deletePropertyLoanLedgerRow.emptyResult', {
      rowId,
    })

    throw new Error(
      'Die Zeile konnte nicht gelöscht werden. Es wurde kein Datensatz entfernt.'
    )
  }
}