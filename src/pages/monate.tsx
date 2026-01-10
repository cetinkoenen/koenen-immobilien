// src/pages/Monate.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type EntryType = "income" | "expense";

type EntryRow = {
  id: number;
  objekt_code: string | null;
  booking_date: string; // YYYY-MM-DD
  amount: number;
  category: string | null;
  note: string | null;
  entry_type: EntryType;
};

type DropdownRow = {
  objekt_code: string;
  label: string;
};

const MONTHS = [
  { m: 1, label: "Januar" },
  { m: 2, label: "Februar" },
  { m: 3, label: "März" },
  { m: 4, label: "April" },
  { m: 5, label: "Mai" },
  { m: 6, label: "Juni" },
  { m: 7, label: "Juli" },
  { m: 8, label: "August" },
  { m: 9, label: "September" },
  { m: 10, label: "Oktober" },
  { m: 11, label: "November" },
  { m: 12, label: "Dezember" },
];

function formatEUR(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function monthRangeISO(year: number, month: number) {
  // month: 1..12
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1); // next month

  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return { from: iso(from), to: iso(to) }; // [from, to)
}

function parseNumberInput(raw: string): number {
  const normalized = raw.replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          padding: 14,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "1px solid #e5e7eb",
              background: "white",
              borderRadius: 10,
              padding: "8px 10px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Schließen
          </button>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

export default function Monate() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [objects, setObjects] = useState<DropdownRow[]>([]);
  const [objektCode, setObjektCode] = useState<string>("");

  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<EntryRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [editType, setEditType] = useState<EntryType>("income");
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");

  // 1) Dropdown laden
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("v_object_dropdown")
          .select("objekt_code,label")
          .order("label", { ascending: true });

        if (!alive) return;

        if (error) {
          console.error("Fehler beim Laden der Objekt-Dropdown-Liste:", error);
          setObjects([]);
          return;
        }

        const list = (data ?? []).filter(
          (x: any) => x?.objekt_code && x?.label
        ) as DropdownRow[];

        setObjects(list);

        // default selection
        if (!objektCode) {
          const first = list[0];
          if (first?.objekt_code) setObjektCode(first.objekt_code);
        }
      } catch (e) {
        console.error("Dropdown load exception:", e);
        if (!alive) return;
        setObjects([]);
      }
    })();

    return () => {
      alive = false;
    };
    // objektCode absichtlich NICHT in deps (wir wollen initial default setzen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Monat laden
  async function loadMonth() {
    setLoading(true);
    setErr(null);

    const code = objektCode.trim();
    if (!code) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { from, to } = monthRangeISO(year, month);

    try {
      const [incRes, expRes] = await Promise.all([
        supabase
          .from("v_income_entries")
          .select("id,objekt_code,booking_date,amount,category,note")
          .eq("objekt_code", code)
          .gte("booking_date", from)
          .lt("booking_date", to),
        supabase
          .from("v_expense_entries")
          .select("id,objekt_code,booking_date,amount,category,note")
          .eq("objekt_code", code)
          .gte("booking_date", from)
          .lt("booking_date", to),
      ]);

      if (incRes.error) throw incRes.error;
      if (expRes.error) throw expRes.error;

      const income: EntryRow[] = (incRes.data ?? []).map((r: any) => ({
        id: r.id,
        objekt_code: r.objekt_code ?? null,
        booking_date: r.booking_date,
        amount: Number(r.amount || 0),
        category: r.category ?? null,
        note: r.note ?? null,
        entry_type: "income",
      }));

      const expense: EntryRow[] = (expRes.data ?? []).map((r: any) => ({
        id: r.id,
        objekt_code: r.objekt_code ?? null,
        booking_date: r.booking_date,
        amount: Number(r.amount || 0),
        category: r.category ?? null,
        note: r.note ?? null,
        entry_type: "expense",
      }));

      const merged = [...income, ...expense].sort((a, b) =>
        a.booking_date.localeCompare(b.booking_date)
      );

      setRows(merged);
    } catch (e: any) {
      console.error("loadMonth failed:", e);
      setRows([]);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  // auto load wenn Auswahl wechselt
  useEffect(() => {
    if (!objektCode) return;
    void loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objektCode, year, month]);

  const totals = useMemo(() => {
    const income = rows
      .filter((r) => r.entry_type === "income")
      .reduce((s, r) => s + r.amount, 0);
    const expense = rows
      .filter((r) => r.entry_type === "expense")
      .reduce((s, r) => s + r.amount, 0);
    return { income, expense, net: income - expense };
  }, [rows]);

  async function deleteEntry(id: number) {
    const ok = window.confirm("Wirklich löschen?");
    if (!ok) return;

    const { error } = await supabase.from("finance_entry").delete().eq("id", id);
    if (error) {
      alert(`Löschen fehlgeschlagen: ${error.message}`);
      return;
    }
    await loadMonth();
  }

  function openEdit(r: EntryRow) {
    setEditRow(r);
    setEditType(r.entry_type);
    setEditDate(r.booking_date);
    setEditAmount(String(r.amount));
    setEditCategory(r.category ?? "");
    setEditNote(r.note ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editRow) return;

    const n = parseNumberInput(editAmount);
    if (!Number.isFinite(n) || n <= 0) {
      alert("Bitte einen gültigen Betrag > 0 eingeben.");
      return;
    }
    if (!editDate) {
      alert("Bitte Datum setzen.");
      return;
    }

    setEditSaving(true);
    try {
      const payload: {
        entry_type: EntryType;
        booking_date: string;
        amount: number;
        category: string | null;
        note: string | null;
      } = {
        entry_type: editType,
        booking_date: editDate,
        amount: n,
        category: editCategory.trim() || null,
        note: editNote.trim() || null,
      };

      const { error } = await supabase
        .from("finance_entry")
        .update(payload)
        .eq("id", editRow.id);

      if (error) throw error;

      setEditOpen(false);
      setEditRow(null);
      await loadMonth();
    } catch (e: any) {
      alert(`Speichern fehlgeschlagen: ${e?.message ?? String(e)}`);
    } finally {
      setEditSaving(false);
    }
  }

  const monthLabel = MONTHS.find((x) => x.m === month)?.label ?? String(month);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
            Monate
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Einträge ansehen, löschen, bearbeiten.
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Objekt
            {objects.length > 0 ? (
              <select
                value={objektCode}
                onChange={(e) => setObjektCode(e.target.value)}
                style={{
                  marginLeft: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                  minWidth: 260,
                  background: "white",
                }}
              >
                {objects.map((o) => (
                  <option key={o.objekt_code} value={o.objekt_code}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={objektCode}
                onChange={(e) => setObjektCode(e.target.value)}
                placeholder="Objekt_1"
                style={{
                  marginLeft: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                  width: 220,
                }}
              />
            )}
          </label>

          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Jahr
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                marginLeft: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
                width: 110,
              }}
            />
          </label>

          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Monat
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{
                marginLeft: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
                background: "white",
              }}
            >
              {MONTHS.map((x) => (
                <option key={x.m} value={x.m}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => void loadMonth()}
            disabled={loading || !objektCode.trim()}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: loading ? "#f3f4f6" : "white",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: !objektCode.trim() ? 0.6 : 1,
            }}
          >
            Neu laden
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#7f1d1d",
            padding: 12,
            borderRadius: 12,
            whiteSpace: "pre-wrap",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {err}
        </div>
      )}

      {/* Totals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 14,
            background: "white",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>
            Einnahmen
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
            {loading ? "…" : formatEUR(totals.income)}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 14,
            background: "white",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>
            Ausgaben
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
            {loading ? "…" : formatEUR(totals.expense)}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 14,
            background: "white",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Netto</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
            {loading ? "…" : formatEUR(totals.net)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          background: "white",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 900,
          }}
        >
          Buchungen im Monat ({monthLabel} {year})
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: 10, fontSize: 12, opacity: 0.75 }}>
                  Datum
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 12, opacity: 0.75 }}>
                  Typ
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 12, opacity: 0.75 }}>
                  Kategorie
                </th>
                <th style={{ textAlign: "right", padding: 10, fontSize: 12, opacity: 0.75 }}>
                  Betrag
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 12, opacity: 0.75 }}>
                  Notiz
                </th>
                <th style={{ padding: 10, width: 120 }} />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                    Lädt…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                    Keine Einträge im Zeitraum.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.entry_type}-${r.id}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 10, fontWeight: 800 }}>{r.booking_date}</td>
                    <td style={{ padding: 10, fontWeight: 800 }}>
                      {r.entry_type === "income" ? "Einnahme" : "Ausgabe"}
                    </td>
                    <td style={{ padding: 10 }}>{r.category ?? "—"}</td>
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 900 }}>
                      {formatEUR(r.amount)}
                    </td>
                    <td style={{ padding: 10, opacity: 0.85 }}>{r.note ?? ""}</td>
                    <td style={{ padding: 10, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => openEdit(r)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                          marginRight: 8,
                        }}
                        title="Bearbeiten"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => void deleteEntry(r.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                        title="Löschen"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        title={editRow ? `Buchung bearbeiten (#${editRow.id})` : "Buchung bearbeiten"}
        onClose={() => {
          setEditOpen(false);
          setEditRow(null);
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
              Typ
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as EntryType)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                  background: "white",
                }}
              >
                <option value="income">Einnahme</option>
                <option value="expense">Ausgabe</option>
              </select>
            </label>

            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
              Datum
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                }}
              />
            </label>

            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
              Betrag
              <input
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="z.B. 123,45"
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                }}
              />
            </label>

            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
              Kategorie
              <input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                }}
              />
            </label>
          </div>

          <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
            Notiz
            <input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => void saveEdit()}
              disabled={editSaving || !editRow}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: editSaving ? "#f3f4f6" : "white",
                fontWeight: 900,
                cursor: editSaving ? "not-allowed" : "pointer",
              }}
            >
              {editSaving ? "Speichert…" : "Änderungen speichern"}
            </button>

            <button
              onClick={() => {
                setEditOpen(false);
                setEditRow(null);
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
