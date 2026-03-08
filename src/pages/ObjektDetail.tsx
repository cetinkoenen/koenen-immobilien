import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EditableLoanLedgerTable from '../components/EditableLoanLedgerTable'
import LoanChart from '../components/LoanChart'
import { loadPropertyLoanLedger } from '../services/propertyLoanLedgerService'
import type { LoanLedgerRow } from '../types/loanLedger'
import { supabase } from '../lib/supabase'

type SummaryRow = {
  property_id: string
  property_name: string
  first_year: number | null
  last_year: number | null
  last_balance_year: number | null
  last_balance: number | null
  interest_total: number | null
  principal_total: number | null
  repaid_percent: number | null
  repaid_percent_display: string | null
  repayment_status: string | null
  repayment_label: string | null
  refreshed_at: string | null
}

type LoanChartPoint = {
  year: number
  balance: number
}

type LedgerStats = {
  firstYear: number | null
  lastYear: number | null
  lastBalanceYear: number | null
  lastBalance: number | null
  interestTotal: number | null
  principalTotal: number | null
  repaidPercent: number | null
}

type QueryDebugResult = {
  ok: boolean
  rowCount?: number
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

type DebugInfo = {
  timestamp: string
  origin: string | null
  hostname: string | null
  href: string | null
  propertyId: string | null
  supabaseUrl: string | null
  hasSession: boolean
  accessTokenExists: boolean
  userId: string | null
  sessionError: string | null
  userError: string | null
  summaryQuery: QueryDebugResult | null
  eurViewQuery: QueryDebugResult | null
  portfolioViewQuery: QueryDebugResult | null
  ledgerQuery: {
    ok: boolean
    rowCount?: number
    error?: string | null
  } | null
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null

  if (Array.isArray(value)) {
    return parseNumber(value[0])
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'

  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null, displayValue?: string | null): string {
  if (displayValue) return displayValue
  if (value == null || !Number.isFinite(value)) return '—'

  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatYearRange(startYear: number | null, endYear: number | null): string {
  if (startYear != null && endYear != null) return `${startYear} – ${endYear}`
  if (startYear != null) return `${startYear} – ?`
  if (endYear != null) return `? – ${endYear}`
  return '—'
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getStatusTone(status: string | null): {
  background: string
  color: string
  border: string
} {
  const normalized = (status ?? '').toLowerCase()

  if (normalized.includes('healthy') || normalized.includes('ok') || normalized.includes('gut')) {
    return {
      background: '#dcfce7',
      color: '#166534',
      border: '#bbf7d0',
    }
  }

  if (normalized.includes('warning') || normalized.includes('warn') || normalized.includes('kritisch')) {
    return {
      background: '#fef3c7',
      color: '#92400e',
      border: '#fde68a',
    }
  }

  if (normalized.includes('red') || normalized.includes('error') || normalized.includes('critical')) {
    return {
      background: '#fee2e2',
      color: '#991b1b',
      border: '#fecaca',
    }
  }

  return {
    background: '#f3f4f6',
    color: '#374151',
    border: '#e5e7eb',
  }
}

function getSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback

  if (error instanceof Error) {
    return error.message || fallback
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage = 'message' in error ? error.message : null
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
  }

  return fallback
}

function normalizeQueryError(error: unknown): QueryDebugResult {
  if (!error) {
    return { ok: true }
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      code?: string
      message?: string
      details?: string
      hint?: string
    }

    return {
      ok: false,
      code: maybeError.code ?? null,
      message: maybeError.message ?? 'Unknown query error',
      details: maybeError.details ?? null,
      hint: maybeError.hint ?? null,
    }
  }

  return {
    ok: false,
    code: null,
    message: String(error),
    details: null,
    hint: null,
  }
}

function StatBox(props: { label: string; value: string; subvalue?: string }) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#6b7280',
          marginBottom: 6,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: '#111827',
          lineHeight: 1.25,
          wordBreak: 'break-word',
        }}
      >
        {props.value}
      </div>

      {props.subvalue ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: '#6b7280',
            wordBreak: 'break-word',
          }}
        >
          {props.subvalue}
        </div>
      ) : null}
    </div>
  )
}

function SectionCard(props: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginTop: 24,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 20,
        minWidth: 0,
      }}
    >
      <div
        style={{
          marginBottom: 16,
          fontSize: 18,
          fontWeight: 800,
          color: '#111827',
        }}
      >
        {props.title}
      </div>
      {props.children}
    </section>
  )
}

export default function ObjektDetail() {
  const { propertyId } = useParams<{ propertyId: string }>()

  const [summary, setSummary] = useState<SummaryRow | null>(null)
  const [ledger, setLedger] = useState<LoanLedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

  const loadDebugInfo = useCallback(async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : null
    const hostname = typeof window !== 'undefined' ? window.location.hostname : null
    const href = typeof window !== 'undefined' ? window.location.href : null

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    let summaryQuery: QueryDebugResult | null = null
    let eurViewQuery: QueryDebugResult | null = null
    let portfolioViewQuery: QueryDebugResult | null = null
    let ledgerQuery: DebugInfo['ledgerQuery'] = null

    try {
      const { data, error } = await supabase
        .from('vw_property_loan_dashboard_dedup')
        .select(
          `
            property_id,
            property_name,
            first_year,
            last_year,
            last_balance_year,
            last_balance,
            interest_total,
            principal_total,
            repaid_percent,
            repaid_percent_display,
            repayment_status,
            repayment_label,
            refreshed_at
          `
        )
        .eq('property_id', propertyId ?? '')
        .limit(1)

      summaryQuery = error
        ? normalizeQueryError(error)
        : {
            ok: true,
            rowCount: data?.length ?? 0,
          }
    } catch (err) {
      summaryQuery = normalizeQueryError(err)
    }

    try {
      const { data, error } = await supabase
        .from('vw_property_loan_dashboard_eur')
        .select('*')
        .limit(1)

      eurViewQuery = error
        ? normalizeQueryError(error)
        : {
            ok: true,
            rowCount: data?.length ?? 0,
          }
    } catch (err) {
      eurViewQuery = normalizeQueryError(err)
    }

    try {
      const { data, error } = await supabase
        .from('vw_property_loan_dashboard_portfolio_v2')
        .select('*')
        .limit(1)

      portfolioViewQuery = error
        ? normalizeQueryError(error)
        : {
            ok: true,
            rowCount: data?.length ?? 0,
          }
    } catch (err) {
      portfolioViewQuery = normalizeQueryError(err)
    }

    try {
      if (propertyId) {
        const ledgerRows = await loadPropertyLoanLedger(propertyId)
        ledgerQuery = {
          ok: true,
          rowCount: ledgerRows.length,
          error: null,
        }
      } else {
        ledgerQuery = {
          ok: false,
          error: 'propertyId missing',
        }
      }
    } catch (err) {
      ledgerQuery = {
        ok: false,
        error: getSupabaseErrorMessage(err, 'Ledger query failed'),
      }
    }

    const nextDebugInfo: DebugInfo = {
      timestamp: new Date().toISOString(),
      origin,
      hostname,
      href,
      propertyId: propertyId ?? null,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? null,
      hasSession: !!sessionData?.session,
      accessTokenExists: !!sessionData?.session?.access_token,
      userId: userData?.user?.id ?? null,
      sessionError: sessionError?.message ?? null,
      userError: userError?.message ?? null,
      summaryQuery,
      eurViewQuery,
      portfolioViewQuery,
      ledgerQuery,
    }

    console.log('ObjektDetail debug info', nextDebugInfo)
    setDebugInfo(nextDebugInfo)
  }, [propertyId])

  const loadDetail = useCallback(async () => {
    if (!propertyId) {
      setError('Keine Immobilien-ID in der URL gefunden.')
      setSummary(null)
      setLedger([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: summaryData, error: summaryError } = await supabase
        .from('vw_property_loan_dashboard_dedup')
        .select(
          `
            property_id,
            property_name,
            first_year,
            last_year,
            last_balance_year,
            last_balance,
            interest_total,
            principal_total,
            repaid_percent,
            repaid_percent_display,
            repayment_status,
            repayment_label,
            refreshed_at
          `
        )
        .eq('property_id', propertyId)
        .maybeSingle()

      if (summaryError) {
        console.error('Summary query failed', {
          code: summaryError.code,
          message: summaryError.message,
          details: summaryError.details,
          hint: summaryError.hint,
          propertyId,
        })

        throw new Error(
          `Fehler beim Laden der Objektdaten: ${summaryError.message}${
            summaryError.code ? ` (Code: ${summaryError.code})` : ''
          }`
        )
      }

      if (!summaryData) {
        throw new Error('Für diese Immobilien-ID wurde kein Datensatz gefunden.')
      }

      const mappedSummary: SummaryRow = {
        property_id: summaryData.property_id,
        property_name: summaryData.property_name ?? 'Unbenannte Immobilie',
        first_year: parseNumber(summaryData.first_year),
        last_year: parseNumber(summaryData.last_year),
        last_balance_year: parseNumber(summaryData.last_balance_year),
        last_balance: parseNumber(summaryData.last_balance),
        interest_total: parseNumber(summaryData.interest_total),
        principal_total: parseNumber(summaryData.principal_total),
        repaid_percent: parseNumber(summaryData.repaid_percent),
        repaid_percent_display: summaryData.repaid_percent_display ?? null,
        repayment_status: summaryData.repayment_status ?? null,
        repayment_label: summaryData.repayment_label ?? null,
        refreshed_at: summaryData.refreshed_at ?? null,
      }

      let ledgerData: LoanLedgerRow[] = []

      try {
        ledgerData = await loadPropertyLoanLedger(propertyId)
      } catch (ledgerError) {
        console.error('Ledger query failed', {
          propertyId,
          error: ledgerError,
        })

        throw new Error(
          `Fehler beim Laden des Darlehens-Ledgers: ${getSupabaseErrorMessage(
            ledgerError,
            'Unbekannter Ledger-Fehler'
          )}`
        )
      }

      setSummary(mappedSummary)
      setLedger(ledgerData)
    } catch (err) {
      const message = getSupabaseErrorMessage(err, 'Fehler beim Laden der Objektseite.')
      setError(message)
      setSummary(null)
      setLedger([])
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void loadDetail()
    void loadDebugInfo()
  }, [loadDetail, loadDebugInfo])

  const sortedLedger = useMemo(() => {
    return [...ledger].sort((a, b) => a.year - b.year)
  }, [ledger])

  const chartData = useMemo<LoanChartPoint[]>(() => {
    return sortedLedger
      .filter((row) => row.balance != null && Number.isFinite(row.balance))
      .map((row) => ({
        year: row.year,
        balance: row.balance,
      }))
  }, [sortedLedger])

  const ledgerStats = useMemo<LedgerStats>(() => {
    if (sortedLedger.length === 0) {
      return {
        firstYear: null,
        lastYear: null,
        lastBalanceYear: null,
        lastBalance: null,
        interestTotal: null,
        principalTotal: null,
        repaidPercent: null,
      }
    }

    const firstRow = sortedLedger[0]
    const lastRow = sortedLedger[sortedLedger.length - 1]

    const interestTotal = sortedLedger.reduce((sum, row) => {
      return sum + (Number.isFinite(row.interest) ? row.interest : 0)
    }, 0)

    const principalTotal = sortedLedger.reduce((sum, row) => {
      return sum + (Number.isFinite(row.principal) ? row.principal : 0)
    }, 0)

    const startingBalance =
      firstRow.balance != null && Number.isFinite(firstRow.balance)
        ? firstRow.balance + (Number.isFinite(firstRow.principal) ? firstRow.principal : 0)
        : null

    const repaidPercent =
      startingBalance != null && startingBalance > 0
        ? principalTotal / startingBalance
        : null

    return {
      firstYear: firstRow.year ?? null,
      lastYear: lastRow.year ?? null,
      lastBalanceYear: lastRow.year ?? null,
      lastBalance:
        lastRow.balance != null && Number.isFinite(lastRow.balance) ? lastRow.balance : null,
      interestTotal,
      principalTotal,
      repaidPercent,
    }
  }, [sortedLedger])

  const effectiveFirstYear = ledgerStats.firstYear ?? summary?.first_year ?? null
  const effectiveLastYear = ledgerStats.lastYear ?? summary?.last_year ?? null
  const effectiveLastBalanceYear = ledgerStats.lastBalanceYear ?? summary?.last_balance_year ?? null
  const effectiveLastBalance = ledgerStats.lastBalance ?? summary?.last_balance ?? null
  const effectiveInterestTotal = ledgerStats.interestTotal ?? summary?.interest_total ?? null
  const effectivePrincipalTotal = ledgerStats.principalTotal ?? summary?.principal_total ?? null
  const effectiveRepaidPercent = ledgerStats.repaidPercent ?? summary?.repaid_percent ?? null

  const statusLabel = summary?.repayment_label ?? summary?.repayment_status ?? '—'
  const statusTone = getStatusTone(summary?.repayment_status ?? summary?.repayment_label ?? null)

  const hasLoanData =
    effectiveLastBalance != null ||
    effectiveInterestTotal != null ||
    effectivePrincipalTotal != null ||
    ledger.length > 0

  if (loading) {
    return (
      <div style={{ width: '100%', padding: 24 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 24,
              padding: 24,
            }}
          >
            <div style={{ color: '#374151' }}>Objektdetails werden geladen…</div>

            {debugInfo ? (
              <pre
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: '#0f172a',
                  color: '#86efac',
                  borderRadius: 12,
                  fontSize: 12,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div style={{ width: '100%', padding: 24 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              to="/objekte"
              style={{
                textDecoration: 'none',
                color: '#4f46e5',
                fontWeight: 700,
              }}
            >
              ← Zurück zu Objekte
            </Link>
          </div>

          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 24,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: '#b91c1c' }}>
              Fehler beim Laden der Objektseite
            </div>
            <div style={{ marginTop: 8, color: '#dc2626', whiteSpace: 'pre-wrap' }}>
              {error}
            </div>

            {debugInfo ? (
              <pre
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: '#111827',
                  color: '#93c5fd',
                  borderRadius: 12,
                  fontSize: 12,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            to="/objekte"
            style={{
              textDecoration: 'none',
              color: '#4f46e5',
              fontWeight: 700,
            }}
          >
            ← Zurück zu Objekte
          </Link>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 24,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#111827',
                  lineHeight: 1.1,
                  wordBreak: 'break-word',
                }}
              >
                {summary?.property_name ?? 'Immobilie'}
              </h1>

              <div
                style={{
                  marginTop: 10,
                  color: '#6b7280',
                  fontSize: 15,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}
              >
                Zeitraum: {formatYearRange(effectiveFirstYear, effectiveLastYear)}
                {' · '}
                Stand Restschuld: {effectiveLastBalanceYear ?? '—'}
                {' · '}
                Letzte Aktualisierung: {formatDateTime(summary?.refreshed_at ?? null)}
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 999,
                background: statusTone.background,
                color: statusTone.color,
                border: `1px solid ${statusTone.border}`,
                fontSize: 13,
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              {statusLabel}
            </div>
          </div>

          {error ? (
            <div
              style={{
                marginBottom: 20,
                padding: 14,
                borderRadius: 14,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: 'pre-wrap',
              }}
            >
              Hinweis: {error}
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            <StatBox
              label="Aktuelle Restschuld"
              value={formatCurrency(effectiveLastBalance)}
              subvalue={`Stand: ${effectiveLastBalanceYear ?? '—'}`}
            />
            <StatBox
              label="Zinsen gesamt"
              value={formatCurrency(effectiveInterestTotal)}
            />
            <StatBox
              label="Tilgung gesamt"
              value={formatCurrency(effectivePrincipalTotal)}
            />
            <StatBox
              label="Rückzahlungsgrad"
              value={formatPercent(
                effectiveRepaidPercent,
                ledger.length === 0 ? summary?.repaid_percent_display ?? null : null
              )}
            />
          </div>

          {!hasLoanData ? (
            <div
              style={{
                marginTop: 24,
                padding: 18,
                borderRadius: 16,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                Keine Darlehensdaten vorhanden
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: '#b45309' }}>
                Für diese Immobilie wurden aktuell weder zusammengefasste Kennzahlen noch
                Ledger-Daten gefunden.
              </div>
            </div>
          ) : (
            <>
              <SectionCard title="Darlehensverlauf">
                <div
                  style={{
                    width: '100%',
                    minWidth: 0,
                    height: 360,
                  }}
                >
                  <LoanChart data={chartData} />
                </div>
              </SectionCard>

              <SectionCard title="Editierbares Darlehens-Ledger">
                {propertyId ? (
                  <EditableLoanLedgerTable
                    propertyId={propertyId}
                    rows={ledger}
                    onChanged={loadDetail}
                  />
                ) : null}
              </SectionCard>
            </>
          )}
        </div>

        {debugInfo ? (
          <pre
            style={{
              position: 'fixed',
              left: 8,
              right: 8,
              bottom: 8,
              maxHeight: '40vh',
              overflow: 'auto',
              background: '#000000',
              color: '#39ff14',
              padding: 12,
              borderRadius: 12,
              fontSize: 11,
              lineHeight: 1.4,
              zIndex: 9999,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  )
}