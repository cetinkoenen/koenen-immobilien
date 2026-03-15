import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import {
  loadPropertyLoanLedger,
  getLoanLedgerAuthDebugInfo
} from "../services/propertyLoanLedgerService"
import type { LoanLedgerRow } from "../types/loanLedger"

const DEBUG = import.meta.env.DEV

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

function formatCurrency(value: number | null) {
  if (!value) return "—"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value)
}

function formatPercent(value: number | null) {
  if (!value) return "—"
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 1
  }).format(value)
}

function DebugPanel({ title, data }: { title: string; data: unknown }) {
  if (!DEBUG) return null

  return (
    <section
      style={{
        marginTop: 24,
        background: "#0f172a",
        color: "#d1fae5",
        borderRadius: 16,
        padding: 16
      }}
    >
      <b>{title}</b>
      <pre style={{ fontSize: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  )
}

export default function ObjektDetail() {
  const { propertyId } = useParams()

  const [summary, setSummary] = useState<SummaryRow | null>(null)
  const [ledger, setLedger] = useState<LoanLedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const loadPage = useCallback(async () => {

    if (!propertyId) {
      setError("Keine property_id vorhanden")
      setLoading(false)
      return
    }

    try {

      setLoading(true)

      const { data: summaryData, error: summaryError } = await supabase
        .from("vw_property_loan_dashboard_dedup")
        .select("*")
        .eq("property_id", propertyId)
        .maybeSingle()

      if (summaryError) throw summaryError

      const ledgerRows = await loadPropertyLoanLedger(propertyId)

      setSummary(summaryData)
      setLedger(ledgerRows)

      if (DEBUG) {
        const authDebug = await getLoanLedgerAuthDebugInfo().catch(() => null)

        setDebugInfo({
          propertyId,
          ledgerRows: ledgerRows.length,
          summaryExists: !!summaryData,
          authDebug
        })
      }

    } catch (err: any) {

      setError(err?.message ?? "Fehler beim Laden")

    } finally {
      setLoading(false)
    }

  }, [propertyId])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  const chartData = useMemo(() => {
    return ledger
      .filter(r => r.balance)
      .map(r => ({
        year: r.year,
        balance: r.balance
      }))
  }, [ledger])

  if (loading) {
    return <div style={{ padding: 40 }}>Objektdetails werden geladen…</div>
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <Link to="/objekte">← zurück</Link>
        <h2>Fehler</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>

      <Link to="/objekte">← zurück</Link>

      <h1>{summary?.property_name ?? "Immobilie"}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>

        <Stat label="Restschuld" value={formatCurrency(summary?.last_balance ?? null)} />

        <Stat label="Zinsen gesamt" value={formatCurrency(summary?.interest_total ?? null)} />

        <Stat label="Tilgung gesamt" value={formatCurrency(summary?.principal_total ?? null)} />

        <Stat label="Rückzahlungsgrad" value={formatPercent(summary?.repaid_percent ?? null)} />

      </div>

      {chartData.length > 0 && (
        <Section title="Darlehensverlauf">

          {chartData.map(p => (
            <div key={p.year}>
              {p.year} — {formatCurrency(p.balance)}
            </div>
          ))}

        </Section>
      )}

      {ledger.length > 0 && (
        <Section title="Darlehens-Ledger">

          <table width="100%">
            <thead>
              <tr>
                <th>Jahr</th>
                <th>Zinsen</th>
                <th>Tilgung</th>
                <th>Restschuld</th>
              </tr>
            </thead>

            <tbody>
              {ledger.map(row => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{formatCurrency(row.interest)}</td>
                  <td>{formatCurrency(row.principal)}</td>
                  <td>{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>

          </table>

        </Section>
      )}

      <DebugPanel title="Debug" data={debugInfo} />

    </div>
  )
}

function Section({ title, children }: any) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: any) {
  return (
    <div
      style={{
        background: "#f8fafc",
        padding: 16,
        borderRadius: 12
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  )
}