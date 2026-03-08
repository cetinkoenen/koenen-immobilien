export type LoanLedgerRow = {
  id: number
  property_id: string
  loan_id: string
  year: number
  interest: number
  principal: number
  balance: number
  source: string | null
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export type LoanLedgerFormValues = {
  year: string
  interest: string
  principal: string
  balance: string
  source: string
}

export type LoanLedgerValidationResult = {
  valid: boolean
  errors: Partial<Record<keyof LoanLedgerFormValues, string>>
}

export type SaveLoanLedgerPayload = {
  year: number
  interest: number
  principal: number
  balance: number
  source: string | null
}

export type LoanLedgerSourceOption = {
  value: string
  label: string
}

export const LOAN_LEDGER_SOURCE_OPTIONS: LoanLedgerSourceOption[] = [
  { value: 'manual_real', label: 'manual_real' },
  { value: 'manual_plan', label: 'manual_plan' },
  { value: 'import_csv', label: 'import_csv' },
  { value: 'system_generated', label: 'system_generated' },
]

export const EMPTY_LOAN_LEDGER_FORM_VALUES: LoanLedgerFormValues = {
  year: '',
  interest: '',
  principal: '',
  balance: '',
  source: 'manual_real',
}