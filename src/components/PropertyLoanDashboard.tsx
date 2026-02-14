import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** ========== Types ========== */

type PropertySummary = {
  property_id: string;
  user_id: string;
  interest_total: string;
  principal_total: string;
  last_year: number | null;
  last_balance: string;
};

type PropertyLoan = {
  id: string; // UUID
  property_id: string;
  loan_name: string;
  lender: string | null;
  currency: string;
  created_at: string;
};

type LedgerRow = {
  id: number; // bigint
  loan_id: string;
  property_id: string;
  year: number;
  interest: string;
  principal: string;
  balance: string;
  source: string | null;
  created_at: string;
};

type EditPayload = {
  year: number;
  interest: string;
  principal: string;
  balance: string;
};

/** ========== Helpers ========== */

function eur(v: string | number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(v ?? 0));
}

function isValidYear(y: number) {
  return Number.isInteger(y) && y >= 1900 && y <= 2100;
}

/**
 * Status aus Ledger ableiten
 * Tilgungsquote = 1 - (letzter_saldo / max_saldo)
 */
function getLoanStatusFromLedger(rows: LedgerRow[]) {
  if (!rows.length) return { label: "—", tone: "neutral" as const, percent: 0 };

  // sicherstellen, dass Reihenfolge nach Jahr stimmt (falls Cache mal unsortiert ist)
  const sorted = [...rows].sort((a, b) => a.year - b.year);

  const balances = sorted.map((r) => Number(r.balance ?? 0));
  const maxSaldo = Math.max(...balances);
  const lastSaldo = balances[balances.length - 1];

  if (!Number.isFinite(maxSaldo) || maxSaldo <= 0) return { label: "—", tone: "neutral" as const, percent: 0 };

  const raw = (1 - lastSaldo / maxSaldo) * 100;
  const percent = Math.round(raw * 100) / 100;

  if (lastSaldo > maxSaldo + 0.01) return { label: "Prüfen", tone: "warning" as const, percent: Math.max(0, percent) };
  if (percent >= 95) return { label: "Nahezu getilgt", tone: "success" as const, percent };
  if (percent >= 75) return { label: "Fortgeschritten", tone: "success" as const, percent };
  if (percent >= 25) return { label: "Laufend", tone: "info" as const, percent };
  return { label: "Frühe Phase", tone: "neutral" as const, percent: Math.max(0, percent) };
}

function StatusBadge({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number;
  tone: "neutral" | "info" | "success" | "warning";
}) {
  const colors = {
    neutral: { bg: "#f3f4f6", fg: "#374151", border: "#e5e7eb" },
    info: { bg: "#eef2ff", fg: "#3730a3", border: "#c7d2fe" },
    success: { bg: "#ecfdf5", fg: "#065f46", border: "#a7f3d0" },
    warning: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.border}`,
        whiteSpace: "nowrap",
      }}
      title={`Tilgungsquote: ${percent} %`}
    >
      {label} · {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(percent)} %
    </span>
  );
}

/** ========== Ledger Table (per loan) ========== */

function LoanLedgerTable({
  loanId,
  cachedRows,
  setCachedRows,
}: {
  loanId: string;
  cachedRows: LedgerRow[] | undefined;
  setCachedRows: (loanId: string, rows: LedgerRow[]) => void;
}) {
  const [rows, setRows] = useState<LedgerRow[]>(cachedRows ?? []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditPayload | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadRows(opts?: { force?: boolean }) {
    const force = opts?.force ?? false;

    if (!force && cachedRows && cachedRows.length) {
      setRows(cachedRows);
      return;
    }

    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("property_loan_ledger")
      .select("*")
      .eq("loan_id", loanId)
      .order("year", { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const next = (data ?? []) as LedgerRow[];
    setRows(next);
    setCachedRows(loanId, next);
    setLoading(false);
  }

  useEffect(() => {
    setEditingId(null);
    setEditForm(null);
    setErr(null);

    if (cachedRows && cachedRows.length) {
      setRows(cachedRows);
    } else {
      loadRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  const totals = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.year - b.year);
    const interest = sorted.reduce((s, r) => s + Number(r.interest ?? 0), 0);
    const principal = sorted.reduce((s, r) => s + Number(r.principal ?? 0), 0);
    const last = sorted.length ? sorted[sorted.length - 1] : null;

    return {
      interest,
      principal,
      lastYear: last?.year ?? null,
      lastBalance: last ? Number(last.balance) : 0,
    };
  }, [rows]);

  const status = useMemo(() => getLoanStatusFromLedger(rows), [rows]);

  function startEdit(r: LedgerRow) {
    setErr(null);
    setEditingId(r.id);
    setEditForm({
      year: r.year,
      interest: String(r.interest ?? "0"),
      principal: String(r.principal ?? "0"),
      balance: String(r.balance ?? "0"),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setErr(null);
  }

  async function saveInlineEdit() {
    if (editingId === null || !editForm) return;

    setErr(null);

    if (!isValidYear(editForm.year)) {
      setErr("Bitte ein gültiges Jahr (1900–2100) eingeben.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("property_loan_ledger")
      .update({
        year: editForm.year,
        interest: Number(editForm.interest),
        principal: Number(editForm.principal),
        balance: Number(editForm.balance),
        source: "app",
      })
      .eq("id", editingId);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingId(null);
    setEditForm(null);

    await loadRows({ force: true });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 13,
    outline: "none",
  };

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h3 style={{ margin: 0 }}>Ledger</h3>
          <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "monospace" }}>{loanId}</div>
        </div>

        <div style={{ textAlign: "right", fontSize: 13, opacity: 0.85 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 10 }}>
            <StatusBadge label={status.label} percent={status.percent} tone={status.tone} />

            <button
              onClick={() => loadRows({ force: true })}
              disabled={loading || saving}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: loading || saving ? "not-allowed" : "pointer",
                opacity: loading || saving ? 0.6 : 1,
                fontWeight: 800,
              }}
              title="Ledger neu laden"
            >
              Refresh
            </button>
          </div>

          <div>Letztes Jahr: {totals.lastYear ?? "—"}</div>
          <div>Letzter Saldo: {eur(totals.lastBalance)}</div>
          <div>Zinsen gesamt: {eur(totals.interest)}</div>
          <div>Tilgung gesamt: {eur(totals.principal)}</div>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#fff4f4", color: "#a00" }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 12 }}>Lade Ledger…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900, width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 10, width: 90 }}>Jahr</th>
                <th style={{ padding: 10 }}>Zinsen</th>
                <th style={{ padding: 10 }}>Tilgung</th>
                <th style={{ padding: 10 }}>Saldo</th>
                <th style={{ padding: 10 }}>Quelle</th>
                <th style={{ padding: 10, width: 220, textAlign: "right" }}>Aktion</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const isEditing = editingId === r.id;

                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                    <td style={{ padding: 10, fontWeight: 700 }}>
                      {isEditing && editForm ? (
                        <input
                          type="number"
                          value={editForm.year}
                          onChange={(e) => setEditForm({ ...editForm, year: Number(e.target.value) })}
                          style={inputStyle}
                          disabled={saving}
                        />
                      ) : (
                        r.year
                      )}
                    </td>

                    <td style={{ padding: 10 }}>
                      {isEditing && editForm ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.interest}
                          onChange={(e) => setEditForm({ ...editForm, interest: e.target.value })}
                          style={inputStyle}
                          disabled={saving}
                        />
                      ) : (
                        eur(r.interest)
                      )}
                    </td>

                    <td style={{ padding: 10 }}>
                      {isEditing && editForm ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.principal}
                          onChange={(e) => setEditForm({ ...editForm, principal: e.target.value })}
                          style={inputStyle}
                          disabled={saving}
                        />
                      ) : (
                        eur(r.principal)
                      )}
                    </td>

                    <td style={{ padding: 10, fontWeight: 700 }}>
                      {isEditing && editForm ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.balance}
                          onChange={(e) => setEditForm({ ...editForm, balance: e.target.value })}
                          style={inputStyle}
                          disabled={saving}
                        />
                      ) : (
                        eur(r.balance)
                      )}
                    </td>

                    <td style={{ padding: 10 }}>{r.source ?? "—"}</td>

                    <td style={{ padding: 10, textAlign: "right" }}>
                      {isEditing ? (
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: saving ? "not-allowed" : "pointer",
                              opacity: saving ? 0.7 : 1,
                            }}
                          >
                            Abbrechen
                          </button>

                          <button
                            onClick={saveInlineEdit}
                            disabled={saving}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #111",
                              background: "#111",
                              color: "white",
                              cursor: saving ? "not-allowed" : "pointer",
                              opacity: saving ? 0.7 : 1,
                              fontWeight: 800,
                            }}
                          >
                            {saving ? "Speichern…" : "Speichern"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(r)}
                          disabled={saving || editingId !== null}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: saving || editingId !== null ? "not-allowed" : "pointer",
                            opacity: saving || editingId !== null ? 0.6 : 1,
                          }}
                          title={editingId !== null ? "Erst laufende Bearbeitung speichern/abbrechen." : "Zeile bearbeiten"}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!rows.length && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                    Keine Ledger-Zeilen vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingId !== null && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Inline-Bearbeitung aktiv • Quelle wird beim Speichern auf <b>app</b> gesetzt
        </div>
      )}
    </div>
  );
}

/** ========== Page: PropertyLoanDashboard ========== */

export default function PropertyLoanDashboard() {
  const [rows, setRows] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openPropertyId, setOpenPropertyId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Cache: Loans pro Property
  const [loansCache, setLoansCache] = useState<Record<string, PropertyLoan[]>>({});
  const [loansLoading, setLoansLoading] = useState<Record<string, boolean>>({});

  // Cache: Ledger pro Loan
  const [ledgerCache, setLedgerCache] = useState<Record<string, LedgerRow[]>>({});

  const loans = openPropertyId ? loansCache[openPropertyId] ?? [] : [];
  const isLoansLoading = openPropertyId ? !!loansLoading[openPropertyId] : false;

  async function loadSummary() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("v_property_loan_summary")
      .select("*")
      .order("last_year", { ascending: false })
      .order("property_id", { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as PropertySummary[]);
    }

    setLoading(false);
  }

  async function loadLoans(propertyId: string, opts?: { force?: boolean }) {
    const force = opts?.force ?? false;

    if (!force && loansCache[propertyId] && loansCache[propertyId].length) return;

    setLoansLoading((p) => ({ ...p, [propertyId]: true }));
    setErr(null);

    const { data, error } = await supabase
      .from("property_loans")
      .select("id, property_id, loan_name, lender, currency, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setLoansCache((p) => ({ ...p, [propertyId]: [] }));
    } else {
      setLoansCache((p) => ({ ...p, [propertyId]: (data ?? []) as PropertyLoan[] }));
    }

    setLoansLoading((p) => ({ ...p, [propertyId]: false }));
  }

  function setCachedLedgerRows(loanId: string, nextRows: LedgerRow[]) {
    setLedgerCache((p) => ({ ...p, [loanId]: nextRows }));
  }

  useEffect(() => {
    console.log("PropertyLoanDashboard mounted ✅");
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const portfolio = useMemo(() => {
    const interest = rows.reduce((s, r) => s + Number(r.interest_total ?? 0), 0);
    const principal = rows.reduce((s, r) => s + Number(r.principal_total ?? 0), 0);
    const balance = rows.reduce((s, r) => s + Number(r.last_balance ?? 0), 0);
    return { interest, principal, balance };
  }, [rows]);

  function toggleProperty(propertyId: string) {
    if (openPropertyId === propertyId) {
      setOpenPropertyId(null);
      setSelectedLoanId(null);
      return;
    }

    setOpenPropertyId(propertyId);
    setSelectedLoanId(null);

    loadLoans(propertyId);
  }

  return (
    <div style={{ padding: 16 }}>
      {/* ✅ Debug Banner (zeigt eindeutig, dass diese Datei gerendert wird) */}
      <div
        style={{
          padding: 10,
          background: "black",
          color: "white",
          fontWeight: 900,
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        ✅ PROPERTY LOAN DASHBOARD IS ACTIVE (NUCLEAR)
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h2 style={{ margin: 0 }}>Darlehensübersicht (alle Immobilien)</h2>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Quelle: <code>v_property_loan_summary</code>
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: 13, opacity: 0.85 }}>
          <div>Portfolio Saldo (Summe): {eur(portfolio.balance)}</div>
          <div>Zinsen gesamt: {eur(portfolio.interest)}</div>
          <div>Tilgung gesamt: {eur(portfolio.principal)}</div>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fff4f4", color: "#a00" }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 12 }}>Lade…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 900, width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eee", background: "#fafafa" }}>
                  <th style={{ padding: 10 }}>Property</th>
                  <th style={{ padding: 10 }}>Letztes Jahr</th>
                  <th style={{ padding: 10 }}>Letzter Saldo</th>
                  <th style={{ padding: 10 }}>Zinsen gesamt</th>
                  <th style={{ padding: 10 }}>Tilgung gesamt</th>
                  <th style={{ padding: 10, width: 140, textAlign: "right" }}>Details</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const isOpen = openPropertyId === r.property_id;

                  return (
                    <React.Fragment key={r.property_id}>
                      <tr style={{ borderBottom: "1px solid #f2f2f2" }}>
                        <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{r.property_id}</td>
                        <td style={{ padding: 10 }}>{r.last_year ?? "—"}</td>
                        <td style={{ padding: 10, fontWeight: 700 }}>{eur(r.last_balance)}</td>
                        <td style={{ padding: 10 }}>{eur(r.interest_total)}</td>
                        <td style={{ padding: 10 }}>{eur(r.principal_total)}</td>
                        <td style={{ padding: 10, textAlign: "right" }}>
                          <button
                            onClick={() => toggleProperty(r.property_id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            {isOpen ? "Schließen" : "Öffnen"}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={6} style={{ padding: 12, background: "#fcfcfc" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                              <div style={{ fontWeight: 800 }}>Loans</div>

                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "monospace" }}>{r.property_id}</div>

                                <button
                                  onClick={() => loadLoans(r.property_id, { force: true })}
                                  disabled={isLoansLoading}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "1px solid #ddd",
                                    background: "white",
                                    cursor: isLoansLoading ? "not-allowed" : "pointer",
                                    opacity: isLoansLoading ? 0.6 : 1,
                                    fontWeight: 800,
                                  }}
                                  title="Loans neu laden"
                                >
                                  Refresh Loans
                                </button>
                              </div>
                            </div>

                            {isLoansLoading ? (
                              <div style={{ paddingTop: 10 }}>Lade Loans…</div>
                            ) : loans.length === 0 ? (
                              <div style={{ paddingTop: 10, opacity: 0.75 }}>
                                Keine Loans vorhanden. (Dann gibt es auch keine Ledger-Zeilen zum Bearbeiten.)
                              </div>
                            ) : (
                              <div style={{ paddingTop: 10 }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                  {loans.map((l) => {
                                    const active = selectedLoanId === l.id;
                                    return (
                                      <button
                                        key={l.id}
                                        onClick={() => setSelectedLoanId(l.id)}
                                        style={{
                                          padding: "8px 10px",
                                          borderRadius: 10,
                                          border: "1px solid #ddd",
                                          background: active ? "#111" : "white",
                                          color: active ? "white" : "black",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <div style={{ fontWeight: 800 }}>{l.loan_name}</div>
                                        <div style={{ fontSize: 12, opacity: active ? 0.9 : 0.7 }}>
                                          {l.lender ?? "—"} • {l.currency}
                                        </div>
                                        <div style={{ fontSize: 11, opacity: active ? 0.8 : 0.6, fontFamily: "monospace" }}>
                                          {l.id}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div style={{ marginTop: 14 }}>
                                  {selectedLoanId ? (
                                    <LoanLedgerTable
                                      loanId={selectedLoanId}
                                      cachedRows={ledgerCache[selectedLoanId]}
                                      setCachedRows={setCachedLedgerRows}
                                    />
                                  ) : (
                                    <div style={{ opacity: 0.75 }}>Wähle einen Loan aus, um den Ledger zu sehen und Zeilen zu bearbeiten.</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {!rows.length && (
                  <tr>
                    <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                      Keine Daten vorhanden
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Hinweis: Properties ohne Loans zeigen 0,00 und “—”. Du kannst sie im UI ausfiltern (last_year !== null), wenn du willst.
      </div>
    </div>
  );
}
