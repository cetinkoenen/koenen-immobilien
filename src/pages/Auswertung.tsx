import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  LabelList,
} from "recharts";

type EntryType = "income" | "expense";

type EntryRow = {
  id: number;
  objekt_code: string;
  booking_date: string;
  amount: number;
  category: string | null;
  note: string | null;
};

type DropdownRow = {
  objekt_code: string;
  label: string;
};

type UnifiedEntryRow = EntryRow & {
  entry_type: EntryType;
};

type PieRow = {
  name: string;
  value: number;
};

type MonthlyRow = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

type ObjectNetRow = {
  object: string;
  income: number;
  expense: number;
  net: number;
};

type ExpenseCategoryTableRow = {
  name: string;
  value: number;
  share: number;
};

type TopTransactionRow = {
  id: number;
  booking_date: string;
  objekt_code: string;
  entry_type: EntryType;
  category: string | null;
  note: string | null;
  amount: number;
};

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#65a30d",
  "#be123c",
];

function formatEUR(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formatDate(dateString: string) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatMonthLabel(yyyyMm: string) {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  if (Number.isNaN(date.getTime())) return yyyyMm;

  return new Intl.DateTimeFormat("de-DE", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function StatCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        background: "white",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
        {loading ? "…" : formatEUR(value)}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        background: "white",
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{subtitle}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function EmptyChartHint({ text }: { text: string }) {
  return (
    <div style={{ padding: 14, fontSize: 13, opacity: 0.75 }}>
      {text}
    </div>
  );
}

function PieSection({
  title,
  data,
}: {
  title: string;
  data: PieRow[];
}) {
  const hasData = data.some((d) => d.value > 0);

  return (
    <SectionCard title={title}>
      {!hasData ? (
        <EmptyChartHint text="Keine Daten für das Kreisdiagramm vorhanden." />
      ) : (
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                innerRadius={58}
                paddingAngle={2}
                label={(entry) => entry.name}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={PIE_COLORS[idx % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatEUR(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

function MonthlyLineSection({
  data,
}: {
  data: MonthlyRow[];
}) {
  const hasData = data.length > 0;

  return (
    <SectionCard
      title="Cashflow-Entwicklung"
      subtitle="Einnahmen, Ausgaben und Netto pro Monat im gewählten Zeitraum."
    >
      {!hasData ? (
        <EmptyChartHint text="Keine Monatsdaten für die Zeitreihe vorhanden." />
      ) : (
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatEUR(Number(v))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                name="Einnahmen"
                stroke="#16a34a"
                strokeWidth={2.5}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Ausgaben"
                stroke="#dc2626"
                strokeWidth={2.5}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Netto"
                stroke="#2563eb"
                strokeWidth={2.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

function ExpenseCategoryBarSection({
  data,
}: {
  data: PieRow[];
}) {
  const hasData = data.length > 0;

  return (
    <SectionCard
      title="Ausgaben nach Kategorie"
      subtitle="Detaillierte Kostenstruktur im gewählten Zeitraum."
    >
      {!hasData ? (
        <EmptyChartHint text="Keine Ausgaben-Kategorien für den Balkenvergleich vorhanden." />
      ) : (
        <div style={{ width: "100%", height: Math.max(320, data.length * 52) }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 60, left: 24, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 12 }}
              />
              <Tooltip formatter={(v) => formatEUR(Number(v))} />
              <Legend />
              <Bar
                dataKey="value"
                name="Ausgaben"
                fill="#dc2626"
                radius={[0, 6, 6, 0]}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value) => formatEUR(Number(value ?? 0))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

function ExpenseCategoryTableSection({
  data,
}: {
  data: ExpenseCategoryTableRow[];
}) {
  const hasData = data.length > 0;

  return (
    <SectionCard
      title="Kostenstruktur im Detail"
      subtitle="Exakte Beträge und Anteile je Ausgaben-Kategorie."
    >
      {!hasData ? (
        <EmptyChartHint text="Keine Ausgaben-Daten für die Detailtabelle vorhanden." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Kategorie
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Betrag
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Anteil
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map((row) => (
                <tr key={row.name}>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      fontWeight: 700,
                    }}
                  >
                    {row.name}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatEUR(row.value)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.share.toFixed(1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function ObjectNetBarSection({
  data,
}: {
  data: ObjectNetRow[];
}) {
  const hasData = data.length > 0;

  return (
    <SectionCard
      title="Netto pro Objekt"
      subtitle="Vergleich der Objektperformance im gewählten Zeitraum."
    >
      {!hasData ? (
        <EmptyChartHint text="Keine Objektdaten für den Vergleich vorhanden." />
      ) : (
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="object" />
              <YAxis />
              <Tooltip formatter={(v) => formatEUR(Number(v))} />
              <Legend />
              <Bar dataKey="net" name="Netto" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

function TopTransactionsSection({
  data,
}: {
  data: TopTransactionRow[];
}) {
  const hasData = data.length > 0;

  return (
    <SectionCard
      title="Top-Transaktionen"
      subtitle="Größte Einzelbuchungen im gewählten Zeitraum."
    >
      {!hasData ? (
        <EmptyChartHint text="Keine Buchungen für die Top-Transaktionen vorhanden." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Datum
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Objekt
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Typ
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Kategorie
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Notiz
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 900,
                  }}
                >
                  Betrag
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map((row) => {
                const isIncome = row.entry_type === "income";

                return (
                  <tr key={`${row.entry_type}-${row.id}`}>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(row.booking_date)}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.objekt_code || "—"}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          background: isIncome ? "#ecfdf5" : "#fef2f2",
                          color: isIncome ? "#166534" : "#991b1b",
                        }}
                      >
                        {isIncome ? "Einnahme" : "Ausgabe"}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {row.category?.trim() || "Ohne Kategorie"}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        opacity: row.note ? 1 : 0.6,
                      }}
                      title={row.note || ""}
                    >
                      {row.note?.trim() || "—"}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 900,
                        color: isIncome ? "#166534" : "#991b1b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isIncome ? formatEUR(row.amount) : `-${formatEUR(row.amount)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export default function Auswertung() {
  const [from, setFrom] = useState(() => toISODate(addDays(new Date(), -29)));
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [mode, setMode] = useState<"income" | "expense">("income");

  const [objects, setObjects] = useState<DropdownRow[]>([]);
  const [objektCode, setObjektCode] = useState<string>("ALL");

  const [incomeRows, setIncomeRows] = useState<EntryRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
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

      const list = ((data ?? []).filter(
        (x: any) => x?.objekt_code && x?.label
      ) as DropdownRow[]).sort((a, b) => a.label.localeCompare(b.label, "de"));

      setObjects(list);
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);

    if (!from || !to) {
      setErr("Bitte Von- und Bis-Datum setzen.");
      setIncomeRows([]);
      setExpenseRows([]);
      setLoading(false);
      return;
    }

    if (from > to) {
      setErr("Das Von-Datum darf nicht nach dem Bis-Datum liegen.");
      setIncomeRows([]);
      setExpenseRows([]);
      setLoading(false);
      return;
    }

    const toPlus1 = toISODate(addDays(new Date(to), 1));
    const selectedCode = objektCode?.trim();

    try {
      let incomeQuery = supabase
        .from("v_income_entries")
        .select("id,objekt_code,booking_date,amount,category,note")
        .gte("booking_date", from)
        .lt("booking_date", toPlus1);

      let expenseQuery = supabase
        .from("v_expense_entries")
        .select("id,objekt_code,booking_date,amount,category,note")
        .gte("booking_date", from)
        .lt("booking_date", toPlus1);

      if (selectedCode && selectedCode !== "ALL") {
        incomeQuery = incomeQuery.eq("objekt_code", selectedCode);
        expenseQuery = expenseQuery.eq("objekt_code", selectedCode);
      }

      const [incRes, expRes] = await Promise.all([incomeQuery, expenseQuery]);

      if (incRes.error) throw incRes.error;
      if (expRes.error) throw expRes.error;

      setIncomeRows((incRes.data ?? []) as EntryRow[]);
      setExpenseRows((expRes.data ?? []) as EntryRow[]);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setIncomeRows([]);
      setExpenseRows([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objektCode]);

  const allRows: UnifiedEntryRow[] = useMemo(() => {
    const income: UnifiedEntryRow[] = incomeRows.map((r) => ({
      ...r,
      entry_type: "income",
    }));

    const expense: UnifiedEntryRow[] = expenseRows.map((r) => ({
      ...r,
      entry_type: "expense",
    }));

    return [...income, ...expense].sort((a, b) =>
      a.booking_date < b.booking_date ? -1 : a.booking_date > b.booking_date ? 1 : 0
    );
  }, [incomeRows, expenseRows]);

  const totals = useMemo(() => {
    const income = incomeRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expense = expenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [incomeRows, expenseRows]);

  const activeRows = mode === "income" ? incomeRows : expenseRows;

  const pieData: PieRow[] = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of activeRows) {
      const cat = (row.category && row.category.trim()) || "Ohne Kategorie";
      map.set(cat, (map.get(cat) ?? 0) + Number(row.amount || 0));
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeRows]);

  const expenseCategoryBarData: PieRow[] = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of expenseRows) {
      const cat = (row.category && row.category.trim()) || "Ohne Kategorie";
      map.set(cat, (map.get(cat) ?? 0) + Number(row.amount || 0));
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseRows]);

  const expenseCategoryTableData: ExpenseCategoryTableRow[] = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of expenseRows) {
      const cat = (row.category && row.category.trim()) || "Ohne Kategorie";
      map.set(cat, (map.get(cat) ?? 0) + Number(row.amount || 0));
    }

    const totalExpense = Array.from(map.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        share: totalExpense > 0 ? (value / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenseRows]);

  const monthlyData: MonthlyRow[] = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();

    for (const row of allRows) {
      const key = row.booking_date.slice(0, 7);

      if (!map.has(key)) {
        map.set(key, { income: 0, expense: 0 });
      }

      const bucket = map.get(key)!;

      if (row.entry_type === "income") {
        bucket.income += Number(row.amount || 0);
      } else {
        bucket.expense += Number(row.amount || 0);
      }
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, values]) => ({
        month: formatMonthLabel(month),
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense,
      }));
  }, [allRows]);

  const objectNetData: ObjectNetRow[] = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();

    for (const row of allRows) {
      const key = row.objekt_code || "Ohne Objekt";

      if (!map.has(key)) {
        map.set(key, { income: 0, expense: 0 });
      }

      const bucket = map.get(key)!;

      if (row.entry_type === "income") {
        bucket.income += Number(row.amount || 0);
      } else {
        bucket.expense += Number(row.amount || 0);
      }
    }

    return Array.from(map.entries())
      .map(([object, values]) => ({
        object,
        income: values.income,
        expense: values.expense,
        net: values.income - values.expense,
      }))
      .sort((a, b) => b.net - a.net);
  }, [allRows]);

  const topTransactions: TopTransactionRow[] = useMemo(() => {
    return [...allRows]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        booking_date: row.booking_date,
        objekt_code: row.objekt_code,
        entry_type: row.entry_type,
        category: row.category,
        note: row.note,
        amount: Number(row.amount || 0),
      }));
  }, [allRows]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Auswertung</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Zeitraum-Auswertung mit KPIs, Kreisdiagramm, Zeitreihe, Kostenstruktur, Objektvergleich und Top-Transaktionen.
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
              <option value="ALL">Alle Objekte</option>
              {objects.map((o) => (
                <option key={o.objekt_code} value={o.objekt_code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Von
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                marginLeft: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
              }}
            />
          </label>

          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Bis
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                marginLeft: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontWeight: 800,
              }}
            />
          </label>

          <button
            onClick={() => void load()}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Anwenden
          </button>
        </div>
      </div>

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <StatCard title="Einnahmen" value={totals.income} loading={loading} />
        <StatCard title="Ausgaben" value={totals.expense} loading={loading} />
        <StatCard title="Netto" value={totals.net} loading={loading} />
      </div>

      <MonthlyLineSection data={monthlyData} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => setMode("income")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: mode === "income" ? "#f3f4f6" : "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Kreisdiagramm: Einnahmen
        </button>
        <button
          onClick={() => setMode("expense")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: mode === "expense" ? "#f3f4f6" : "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Kreisdiagramm: Ausgaben
        </button>
      </div>

      <PieSection
        title={`${mode === "income" ? "Einnahmen" : "Ausgaben"} nach Kategorie`}
        data={pieData}
      />

      <ExpenseCategoryBarSection data={expenseCategoryBarData} />

      <ExpenseCategoryTableSection data={expenseCategoryTableData} />

      <ObjectNetBarSection data={objectNetData} />

      <TopTransactionsSection data={topTransactions} />
    </div>
  );
}