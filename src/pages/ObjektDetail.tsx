import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EditableLoanLedgerTable from '../components/EditableLoanLedgerTable'
import LoanChart from '../components/LoanChart'
import {
  getLoanLedgerAuthDebugInfo,
  loadPropertyLoanLedger,
} from '../services/propertyLoanLedgerService'
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

type ResolvedPropertyIdentity = {
  routeId: string
  resolvedPropertyId: string | null
  matchedBy: 'property_id' | 'portfolio_property_id' | 'route_param' | 'none'
  propertyName: string | null
  portfolioPropertyId: string | null
}

type DebugInfo = {
  timestamp: string
  routePropertyId: string | null
  resolvedPropertyId: string | null
  matchedBy: 'property_id' | 'portfolio_property_id' | 'route_param' | 'none'
  propertyName: string | null
  portfolioPropertyId: string | null
  origin: string | null
  hostname: string | null
  href: string | null
  supabaseUrl: string | null
  hasSession: boolean
  accessTokenExists: boolean
  userId: string | null
  sessionError: string | null
  userError: string | null
  routeResolutionQuery: QueryDebugResult | null
  summaryQuery: QueryDebugResult | null
  eurViewQuery: QueryDebugResult | null
  portfolioViewQuery: QueryDebugResult | null
  ledgerQuery: {
    ok: boolean
    rowCount?: number
    error?: string | null
  } | null
}

type RenderDebugInfo = {
  loading: boolean
  error: string | null
  routePropertyId: string | null
  resolvedPropertyId: string | null
  matchedBy: 'property_id' | 'portfolio_property_id' | 'route_param' | 'none'
  resolvedPropertyName: string | null
  portfolioPropertyId: string | null
  summaryExists: boolean
  summaryPropertyId: string | null
  summaryPropertyName: string | null
  ledgerCount: number
  sortedLedgerCount: number
  chartDataCount: number
  hasLoanData: boolean
  effectiveFirstYear: number | null
  effectiveLastYear: number | null
  effectiveLastBalanceYear: number | null
  effectiveLastBalance: number | null
  effectiveInterestTotal: number | null
  effectivePrincipalTotal: number | null
  effectiveRepaidPercent: number | null
  willRenderNoLoanDataState: boolean
  willRenderChartSection: boolean
  willRenderLedgerSection: boolean
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

  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${Math.round(value)} €`
  }
}

function formatPercent(value: number | null, displayValue?: string | null): string {
  if (displayValue) return displayValue
  if (value == null || !Number.isFinite(value)) return '—'

  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${(value * 100).toFixed(2)} %`
  }
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

  try {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return value
  }
}

function getStatusTone(status: string | null): {
  background: string
  color: string
  border: string
} {
  const normalized = (status ?? '').toLowerCase()

  if (
    normalized.includes('healthy') ||
    normalized.includes('ok') ||
    normalized.includes('gut') ||
    normalized.includes('läuft') ||
    normalized.includes('in_progress')
  ) {
    return {
      background: '#dcfce7',
      color: '#166534',
      border: '#bbf7d0',
    }
  }

  if (
    normalized.includes('warning') ||
    normalized.includes('warn') ||
    normalized.includes('kritisch')
  ) {
    return {
      background: '#fef3c7',
      color: '#92400e',
      border: '#fde68a',
    }
  }

  if (
    normalized.includes('red') ||
    normalized.includes('error') ||
    normalized.includes('critical')
  ) {
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback
  if (error instanceof Error) return error.message || fallback

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
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

function buildUiErrorMessage(title: string, error: unknown): string {
  const message = getErrorMessage(error, title)
  return `${title}: ${message}`
}

async function resolvePropertyIdentity(
  routeId: string
): Promise<{
  identity: ResolvedPropertyIdentity
  debug: QueryDebugResult
}> {
  try {
    const { data, error } = await supabase
      .from('vw_property_loan_dashboard_portfolio_v2')
      .select('property_id, portfolio_property_id, property_name')
      .or(`property_id.eq.${routeId},portfolio_property_id.eq.${routeId}`)
      .limit(2)

    if (error) {
      return {
        identity: {
          routeId,
          resolvedPropertyId: routeId,
          matchedBy: 'route_param',
          propertyName: null,
          portfolioPropertyId: null,
        },
        debug: normalizeQueryError(error),
      }
    }

    const rows = data ?? []

    if (rows.length > 0) {
      const row = rows[0]
      const matchedBy =
        row.property_id === routeId ? 'property_id' : 'portfolio_property_id'

      return {
        identity: {
          routeId,
          resolvedPropertyId: row.property_id ?? routeId,
          matchedBy,
          propertyName: row.property_name ?? null,
          portfolioPropertyId: row.portfolio_property_id ?? null,
        },
        debug: {
          ok: true,
          rowCount: rows.length,
        },
      }
    }

    return {
      identity: {
        routeId,
        resolvedPropertyId: routeId,
        matchedBy: 'route_param',
        propertyName: null,
        portfolioPropertyId: null,
      },
      debug: {
        ok: true,
        rowCount: 0,
      },
    }
  } catch (error) {
    return {
      identity: {
        routeId,
        resolvedPropertyId: routeId,
        matchedBy: 'route_param',
        propertyName: null,
        portfolioPropertyId: null,
      },
      debug: normalizeQueryError(error),
    }
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

function DebugPanel(props: {
  title: string
  data: unknown
  bottom?: number
  background?: string
  color?: string
}) {
  return (
    <pre
      style={{
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: props.bottom ?? 8,
        maxHeight: '28vh',
        overflow: 'auto',
        background: props.background ?? '#000000',
        color: props.color ?? '#39ff14',
        padding: 12,
        borderRadius: 12,
        fontSize: 11,
        lineHeight: 1.4,
        zIndex: 9999,
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {props.title}
      {'\n'}
      {JSON.stringify(props.data, null, 2)}
    </pre>
  )
}

function InlineDebugCard(props: { title: string; data: unknown }) {
  return (
    <section
      style={{
        marginTop: 24,
        background: '#0f172a',
        color: '#d1fae5',
        border: '1px solid #1e293b',
        borderRadius: 20,
        padding: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          marginBottom: 12,
          fontSize: 16,
          fontWeight: 800,
          color: '#ffffff',
        }}
      >
        {props.title}
      </div>

      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: 12,
          lineHeight: 1.5,
          overflow: 'auto',
        }}
      >
        {JSON.stringify(props.data, null, 2)}
      </pre>
    </section>
  )
}

export default function ObjektDetail() {
  const { propertyId: routePropertyId } = useParams<{ propertyId: string }>()

  const [summary, setSummary] = useState<SummaryRow | null>(null)
  const [ledger, setLedger] = useState<LoanLedgerRow[]>([])
  const [resolvedPropertyId, setResolvedPropertyId] = useState<string | null>(null)
  const [matchedBy, setMatchedBy] = useState<
    'property_id' | 'portfolio_property_id' | 'route_param' | 'none'
  >('none')
  const [portfolioPropertyId, setPortfolioPropertyId] = useState<string | null>(null)
  const [resolvedPropertyName, setResolvedPropertyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

  const loadPage = useCallback(async () => {
    if (!routePropertyId) {
      setSummary(null)
      setLedger([])
      setResolvedPropertyId(null)
      setMatchedBy('none')
      setPortfolioPropertyId(null)
      setResolvedPropertyName(null)
      setError('Keine Immobilien-ID in der URL gefunden.')
      setLoading(false)
      return
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : null
    const hostname = typeof window !== 'undefined' ? window.location.hostname : null
    const href = typeof window !== 'undefined' ? window.location.href : null

    let summaryQuery: QueryDebugResult | null = null
    let eurViewQuery: QueryDebugResult | null = null
    let portfolioViewQuery: QueryDebugResult | null = null
    let ledgerQuery: DebugInfo['ledgerQuery'] = null
    let identityResultForDebug:
      | {
          identity: ResolvedPropertyIdentity
          debug: QueryDebugResult
        }
      | null = null

    try {
      setLoading(true)
      setError(null)

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const { data: userData, error: userError } = await supabase.auth.getUser()

      const [identityResult, ledgerAuth] = await Promise.all([
        resolvePropertyIdentity(routePropertyId),
        getLoanLedgerAuthDebugInfo().catch(() => null),
      ])

      identityResultForDebug = identityResult

      const identity = identityResult.identity
      const corePropertyId = identity.resolvedPropertyId

      setResolvedPropertyId(corePropertyId)
      setMatchedBy(identity.matchedBy)
      setPortfolioPropertyId(identity.portfolioPropertyId)
      setResolvedPropertyName(identity.propertyName)

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
        .eq('property_id', corePropertyId ?? '')
        .maybeSingle()

      summaryQuery = summaryError
        ? normalizeQueryError(summaryError)
        : {
            ok: true,
            rowCount: summaryData ? 1 : 0,
          }

      const { data: eurData, error: eurError } = await supabase
        .from('vw_property_loan_dashboard_eur')
        .select('property_id, property_name, last_balance')
        .eq('property_id', corePropertyId ?? '')
        .limit(5)

      eurViewQuery = eurError
        ? normalizeQueryError(eurError)
        : {
            ok: true,
            rowCount: eurData?.length ?? 0,
          }

      const { data: portfolioData, error: portfolioError } = await supabase
        .from('vw_property_loan_dashboard_portfolio_v2')
        .select('property_id, portfolio_property_id, property_name, last_balance')
        .or(
          `property_id.eq.${routePropertyId},portfolio_property_id.eq.${routePropertyId},property_id.eq.${corePropertyId ?? ''}`
        )
        .limit(5)

      portfolioViewQuery = portfolioError
        ? normalizeQueryError(portfolioError)
        : {
            ok: true,
            rowCount: portfolioData?.length ?? 0,
          }

      if (summaryError) {
        throw new Error(
          `Fehler beim Laden der Objektdaten: ${summaryError.message}${
            summaryError.code ? ` (Code: ${summaryError.code})` : ''
          }`
        )
      }

      if (!summaryData) {
        throw new Error(
          `Für diese Immobilien-ID wurde kein Datensatz gefunden. Route-ID: ${routePropertyId}, aufgelöste property_id: ${corePropertyId ?? '—'}`
        )
      }

      const mappedSummary: SummaryRow = {
        property_id: summaryData.property_id,
        property_name:
          summaryData.property_name ??
          identity.propertyName ??
          'Unbenannte Immobilie',
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

      let ledgerRows: LoanLedgerRow[] = []

      try {
        if (!corePropertyId) {
          throw new Error('Es konnte keine gültige property_id aufgelöst werden.')
        }

        ledgerRows = await loadPropertyLoanLedger(corePropertyId)
        ledgerQuery = {
          ok: true,
          rowCount: ledgerRows.length,
          error: null,
        }
      } catch (ledgerError) {
        ledgerQuery = {
          ok: false,
          error: getErrorMessage(ledgerError, 'Ledger query failed'),
        }

        throw new Error(
          buildUiErrorMessage('Fehler beim Laden des Darlehens-Ledgers', ledgerError)
        )
      }

      setSummary(mappedSummary)
      setLedger(Array.isArray(ledgerRows) ? ledgerRows : [])

      setDebugInfo({
        timestamp: new Date().toISOString(),
        routePropertyId,
        resolvedPropertyId: corePropertyId,
        matchedBy: identity.matchedBy,
        propertyName: identity.propertyName,
        portfolioPropertyId: identity.portfolioPropertyId,
        origin,
        hostname,
        href,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? null,
        hasSession: !!sessionData?.session || !!ledgerAuth?.hasSession,
        accessTokenExists: !!sessionData?.session?.access_token,
        userId: userData?.user?.id ?? ledgerAuth?.userId ?? null,
        sessionError:
          sessionError?.message ?? ledgerAuth?.sessionError?.message ?? null,
        userError: userError?.message ?? ledgerAuth?.userError?.message ?? null,
        routeResolutionQuery: identityResult.debug,
        summaryQuery,
        eurViewQuery,
        portfolioViewQuery,
        ledgerQuery,
      })
    } catch (err) {
      setSummary(null)
      setLedger([])
      setError(getErrorMessage(err, 'Fehler beim Laden der Objektseite.'))

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        const { data: userData, error: userError } = await supabase.auth.getUser()
        const ledgerAuth = await getLoanLedgerAuthDebugInfo().catch(() => null)
        const identityResult =
          identityResultForDebug ?? (await resolvePropertyIdentity(routePropertyId))

        setDebugInfo({
          timestamp: new Date().toISOString(),
          routePropertyId,
          resolvedPropertyId: identityResult.identity.resolvedPropertyId ?? null,
          matchedBy: identityResult.identity.matchedBy ?? 'none',
          propertyName: identityResult.identity.propertyName ?? null,
          portfolioPropertyId: identityResult.identity.portfolioPropertyId ?? null,
          origin,
          hostname,
          href,
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? null,
          hasSession: !!sessionData?.session || !!ledgerAuth?.hasSession,
          accessTokenExists: !!sessionData?.session?.access_token,
          userId: userData?.user?.id ?? ledgerAuth?.userId ?? null,
          sessionError:
            sessionError?.message ?? ledgerAuth?.sessionError?.message ?? null,
          userError: userError?.message ?? ledgerAuth?.userError?.message ?? null,
          routeResolutionQuery: identityResult.debug,
          summaryQuery,
          eurViewQuery,
          portfolioViewQuery,
          ledgerQuery,
        })
      } catch {
        // no-op
      }
    } finally {
      setLoading(false)
    }
  }, [routePropertyId])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const sortedLedger = useMemo(() => {
    return [...ledger].sort((a, b) => {
      const yearA = Number.isFinite(a.year) ? a.year : 0
      const yearB = Number.isFinite(b.year) ? b.year : 0
      return yearA - yearB
    })
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
      firstYear: Number.isFinite(firstRow.year) ? firstRow.year : null,
      lastYear: Number.isFinite(lastRow.year) ? lastRow.year : null,
      lastBalanceYear: Number.isFinite(lastRow.year) ? lastRow.year : null,
      lastBalance:
        lastRow.balance != null && Number.isFinite(lastRow.balance) ? lastRow.balance : null,
      interestTotal,
      principalTotal,
      repaidPercent,
    }
  }, [sortedLedger])

  const effectiveFirstYear = ledgerStats.firstYear ?? summary?.first_year ?? null
  const effectiveLastYear = ledgerStats.lastYear ?? summary?.last_year ?? null
  const effectiveLastBalanceYear =
    ledgerStats.lastBalanceYear ?? summary?.last_balance_year ?? null
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

  const canRenderChart = chartData.length > 0
  const canRenderLedgerTable = !!resolvedPropertyId

  const renderDebugInfo: RenderDebugInfo = {
    loading,
    error,
    routePropertyId: routePropertyId ?? null,
    resolvedPropertyId,
    matchedBy,
    resolvedPropertyName,
    portfolioPropertyId,
    summaryExists: !!summary,
    summaryPropertyId: summary?.property_id ?? null,
    summaryPropertyName: summary?.property_name ?? null,
    ledgerCount: ledger.length,
    sortedLedgerCount: sortedLedger.length,
    chartDataCount: chartData.length,
    hasLoanData,
    effectiveFirstYear,
    effectiveLastYear,
    effectiveLastBalanceYear,
    effectiveLastBalance,
    effectiveInterestTotal,
    effectivePrincipalTotal,
    effectiveRepaidPercent,
    willRenderNoLoanDataState: !hasLoanData,
    willRenderChartSection: hasLoanData,
    willRenderLedgerSection: hasLoanData && canRenderLedgerTable,
  }

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
          </div>
        </div>

        <DebugPanel title="FETCH DEBUG" data={debugInfo} bottom={8} />
        <DebugPanel
          title="RENDER DEBUG"
          data={renderDebugInfo}
          bottom={220}
          background="#111827"
          color="#93c5fd"
        />
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
          </div>

          <InlineDebugCard title="Render-Diagnose" data={renderDebugInfo} />
          <InlineDebugCard title="Fetch-Diagnose" data={debugInfo} />
        </div>

        <DebugPanel title="FETCH DEBUG" data={debugInfo} bottom={8} />
        <DebugPanel
          title="RENDER DEBUG"
          data={renderDebugInfo}
          bottom={220}
          background="#111827"
          color="#93c5fd"
        />
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
            overflow: 'hidden',
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
                {summary?.property_name ?? resolvedPropertyName ?? 'Immobilie'}
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

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: '#9ca3af',
                  wordBreak: 'break-word',
                }}
              >
                Route-ID: {routePropertyId ?? '—'}
                {' · '}
                property_id: {resolvedPropertyId ?? '—'}
                {' · '}
                Match: {matchedBy}
                {' · '}
                portfolio_property_id: {portfolioPropertyId ?? '—'}
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
                maxWidth: '100%',
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

          <SectionCard title="Render-Diagnose">
            <div
              style={{
                fontSize: 14,
                color: '#374151',
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              Dieser Block zeigt den tatsächlich gerenderten React-State. Wenn die Queries
              erfolgreich sind, aber die UI dennoch kaputt aussieht, sieht man hier sofort,
              ob das Problem im State, Mapping oder in einer Child-Komponente liegt.
            </div>

            <pre
              style={{
                margin: 0,
                background: '#0f172a',
                color: '#d1fae5',
                padding: 16,
                borderRadius: 16,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
                lineHeight: 1.5,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(renderDebugInfo, null, 2)}
            </pre>
          </SectionCard>

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
                {!canRenderChart ? (
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                    }}
                  >
                    Chart wird nicht gerendert, weil keine gültigen Balance-Daten im
                    `chartData`-Array vorhanden sind. Ledger-Zeilen: {ledger.length},
                    Chart-Punkte: {chartData.length}
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      minWidth: 0,
                      height: 360,
                    }}
                  >
                    <LoanChart data={chartData} />
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Editierbares Darlehens-Ledger">
                {!canRenderLedgerTable ? (
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                    }}
                  >
                    Ledger-Tabelle wird nicht gerendert, weil keine `resolvedPropertyId`
                    vorhanden ist.
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb',
                        color: '#475569',
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      Primitive Render-Prüfung: propertyId = {resolvedPropertyId},
                      rows = {ledger.length}
                    </div>

                    <EditableLoanLedgerTable
                      propertyId={resolvedPropertyId}
                      rows={ledger}
                      onChanged={async () => {
                        await loadPage()
                      }}
                    />
                  </>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>

      <DebugPanel title="FETCH DEBUG" data={debugInfo} bottom={8} />
      <DebugPanel
        title="RENDER DEBUG"
        data={renderDebugInfo}
        bottom={220}
        background="#111827"
        color="#93c5fd"
      />
    </div>
  )
}