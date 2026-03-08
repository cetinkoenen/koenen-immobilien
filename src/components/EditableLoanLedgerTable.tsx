import { useMemo, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import {
  deletePropertyLoanLedgerRow,
  insertPropertyLoanLedgerRow,
  parseLoanLedgerFormValues,
  rowToFormValues,
  updatePropertyLoanLedgerRow,
  validateLedgerRow,
} from '@/services/propertyLoanLedgerService'
import {
  EMPTY_LOAN_LEDGER_FORM_VALUES,
  LOAN_LEDGER_SOURCE_OPTIONS,
} from '@/types/loanLedger'
import type { LoanLedgerFormValues, LoanLedgerRow } from '@/types/loanLedger'

type EditableLoanLedgerTableProps = {
  propertyId: string
  rows: LoanLedgerRow[]
  onChanged: () => Promise<void> | void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    background: '#ffffff',
    padding: 20,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#111827',
  },
  primaryButton: {
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '10px 14px',
    background: '#ffffff',
    color: '#374151',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerButton: {
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '8px 12px',
    background: '#ffffff',
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  neutralButton: {
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 12px',
    background: '#ffffff',
    color: '#374151',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorBox: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  scroll: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 900,
    tableLayout: 'fixed',
  },
  thead: {
    background: '#f8fafc',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
    color: '#374151',
    fontSize: 13,
    fontWeight: 700,
    verticalAlign: 'middle',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
    color: '#111827',
    fontSize: 14,
    verticalAlign: 'top',
  },
  mutedText: {
    color: '#6b7280',
  },
  rowActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '9px 10px',
    fontSize: 14,
    color: '#111827',
    background: '#ffffff',
  },
  select: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '9px 10px',
    fontSize: 14,
    color: '#111827',
    background: '#ffffff',
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
  },
  emptyState: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '20px 12px',
    fontSize: 14,
  },
  addRow: {
    background: '#f8fafc',
  },
}

export default function EditableLoanLedgerTable({
  propertyId,
  rows,
  onChanged,
}: EditableLoanLedgerTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValues, setEditingValues] = useState<LoanLedgerFormValues | null>(null)
  const [isAddingRow, setIsAddingRow] = useState(false)
  const [newValues, setNewValues] = useState<LoanLedgerFormValues>({
    ...EMPTY_LOAN_LEDGER_FORM_VALUES,
  })
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof LoanLedgerFormValues, string>>
  >({})
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.year - b.year)
  }, [rows])

  function clearMessages() {
    setFieldErrors({})
    setErrorMessage(null)
  }

  function handleStartAdd() {
    setIsAddingRow(true)
    setEditingId(null)
    setEditingValues(null)
    setNewValues({ ...EMPTY_LOAN_LEDGER_FORM_VALUES })
    clearMessages()
  }

  function handleCancelAdd() {
    setIsAddingRow(false)
    setNewValues({ ...EMPTY_LOAN_LEDGER_FORM_VALUES })
    clearMessages()
  }

  function handleEdit(row: LoanLedgerRow) {
    setEditingId(row.id)
    setEditingValues(rowToFormValues(row))
    setIsAddingRow(false)
    clearMessages()
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditingValues(null)
    clearMessages()
  }

  function handleNewFieldChange(
    field: keyof LoanLedgerFormValues,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const value = event.target.value

    setNewValues((prev) => ({
      ...prev,
      [field]: value,
    }))

    setFieldErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }))
  }

  function handleEditFieldChange(
    field: keyof LoanLedgerFormValues,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const value = event.target.value

    setEditingValues((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [field]: value,
      }
    })

    setFieldErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }))
  }

  async function handleSaveNewRow() {
    clearMessages()

    const validation = validateLedgerRow(newValues)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      return
    }

    try {
      setSaving(true)
      const payload = parseLoanLedgerFormValues(newValues)
      await insertPropertyLoanLedgerRow(propertyId, payload)
      setIsAddingRow(false)
      setNewValues({ ...EMPTY_LOAN_LEDGER_FORM_VALUES })
      await onChanged()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Die neue Zeile konnte nicht gespeichert werden.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (editingId == null || !editingValues) return

    clearMessages()

    const validation = validateLedgerRow(editingValues)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      return
    }

    try {
      setSaving(true)
      const payload = parseLoanLedgerFormValues(editingValues)
      await updatePropertyLoanLedgerRow(editingId, payload)
      setEditingId(null)
      setEditingValues(null)
      await onChanged()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Die Änderung konnte nicht gespeichert werden.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: LoanLedgerRow) {
    const confirmed = window.confirm(
      `Möchtest du den Ledger-Eintrag für ${row.year} wirklich löschen?`
    )

    if (!confirmed) return

    try {
      setSaving(true)
      clearMessages()
      await deletePropertyLoanLedgerRow(row.id)
      await onChanged()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Die Zeile konnte nicht gelöscht werden.'
      )
    } finally {
      setSaving(false)
    }
  }

  function renderFieldError(field: keyof LoanLedgerFormValues) {
    if (!fieldErrors[field]) return null
    return <div style={styles.fieldError}>{fieldErrors[field]}</div>
  }

  function renderFormCells(values: LoanLedgerFormValues, mode: 'add' | 'edit') {
    const onChange = mode === 'add' ? handleNewFieldChange : handleEditFieldChange

    return (
      <>
        <td style={styles.td}>
          <input
            type="number"
            step="1"
            min="1900"
            max="2200"
            value={values.year}
            onChange={(event) => onChange('year', event)}
            disabled={saving}
            style={styles.input}
          />
          {renderFieldError('year')}
        </td>

        <td style={styles.td}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.interest}
            onChange={(event) => onChange('interest', event)}
            disabled={saving}
            style={styles.input}
          />
          {renderFieldError('interest')}
        </td>

        <td style={styles.td}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.principal}
            onChange={(event) => onChange('principal', event)}
            disabled={saving}
            style={styles.input}
          />
          {renderFieldError('principal')}
        </td>

        <td style={styles.td}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.balance}
            onChange={(event) => onChange('balance', event)}
            disabled={saving}
            style={styles.input}
          />
          {renderFieldError('balance')}
        </td>

        <td style={styles.td}>
          <select
            value={values.source}
            onChange={(event) => onChange('source', event)}
            disabled={saving}
            style={styles.select}
          >
            <option value="">Bitte wählen</option>
            {LOAN_LEDGER_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {renderFieldError('source')}
        </td>
      </>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <h3 style={styles.title}>Darlehens-Ledger</h3>

        <button
          type="button"
          onClick={handleStartAdd}
          disabled={saving || isAddingRow || editingId !== null}
          style={{
            ...styles.primaryButton,
            ...(saving || isAddingRow || editingId !== null ? styles.disabledButton : {}),
          }}
        >
          Neue Zeile
        </button>
      </div>

      {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}

      <div style={styles.scroll}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              <th style={{ ...styles.th, width: '12%' }}>Jahr</th>
              <th style={{ ...styles.th, width: '18%' }}>Zinsen</th>
              <th style={{ ...styles.th, width: '18%' }}>Tilgung</th>
              <th style={{ ...styles.th, width: '20%' }}>Restschuld</th>
              <th style={{ ...styles.th, width: '16%' }}>Quelle</th>
              <th style={{ ...styles.th, width: '16%' }}>Aktionen</th>
            </tr>
          </thead>

          <tbody>
            {isAddingRow ? (
              <tr style={styles.addRow}>
                {renderFormCells(newValues, 'add')}
                <td style={styles.td}>
                  <div style={styles.rowActions}>
                    <button
                      type="button"
                      onClick={handleSaveNewRow}
                      disabled={saving}
                      style={{
                        ...styles.neutralButton,
                        ...(saving ? styles.disabledButton : {}),
                      }}
                    >
                      Speichern
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAdd}
                      disabled={saving}
                      style={{
                        ...styles.neutralButton,
                        ...(saving ? styles.disabledButton : {}),
                      }}
                    >
                      Abbrechen
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}

            {sortedRows.length === 0 && !isAddingRow ? (
              <tr>
                <td colSpan={6} style={styles.emptyState}>
                  Noch keine Ledger-Einträge vorhanden.
                </td>
              </tr>
            ) : null}

            {sortedRows.map((row) => {
              const isEditing = editingId === row.id && editingValues

              return (
                <tr key={row.id}>
                  {isEditing ? (
                    <>
                      {renderFormCells(editingValues, 'edit')}
                      <td style={styles.td}>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={saving}
                            style={{
                              ...styles.neutralButton,
                              ...(saving ? styles.disabledButton : {}),
                            }}
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={saving}
                            style={{
                              ...styles.neutralButton,
                              ...(saving ? styles.disabledButton : {}),
                            }}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={styles.td}>{row.year}</td>
                      <td style={styles.td}>{formatCurrency(row.interest)}</td>
                      <td style={styles.td}>{formatCurrency(row.principal)}</td>
                      <td style={styles.td}>{formatCurrency(row.balance)}</td>
                      <td style={{ ...styles.td, ...styles.mutedText }}>{row.source ?? '—'}</td>
                      <td style={styles.td}>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            onClick={() => handleEdit(row)}
                            disabled={saving || isAddingRow || editingId !== null}
                            style={{
                              ...styles.neutralButton,
                              ...(saving || isAddingRow || editingId !== null
                                ? styles.disabledButton
                                : {}),
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            disabled={saving || isAddingRow || editingId !== null}
                            style={{
                              ...styles.dangerButton,
                              ...(saving || isAddingRow || editingId !== null
                                ? styles.disabledButton
                                : {}),
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}