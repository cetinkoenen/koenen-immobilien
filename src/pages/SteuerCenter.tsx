import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Download, FileText, Printer, RefreshCw, Search } from "lucide-react";

import { supabase } from "../lib/supabase";
import { parseLocaleNumber } from "../utils/numberParser";

type EntryType = "income" | "expense";
type RelevanceFilter = "all" | "tax" | "check" | "private";

type ObjectOption = {
  objekt_code: string;
  label: string;
};

type EntryRow = {
  id: number;
  objekt_code: string | null;
  booking_date: string;
  amount: number;
  category: string | null;
  note: string | null;
  entry_type: EntryType;
};

type ClassifiedEntry = EntryRow & {
  object_label: string;
  tax_group: string;
  tax_hint: string;
  relevance: "tax" | "check" | "private";
};

type SummaryRow = {
  group: string;
  income: number;
  expense: number;
  count: number;
};

const currentYear = new Date().getFullYear();

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1500,
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  hero: {
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    background: "#ffffff",
    padding: 24,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  },
  heroTop: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #dbeafe",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "14px 0 0",
    fontSize: 31,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "#0f172a",
  },
  text: {
    margin: "10px 0 0",
    maxWidth: 850,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.65,
  },
  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    background: "#ffffff",
    padding: 18,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    alignItems: "end",
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "#475569",
  },
  input: {
    height: 42,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
  },
  button: {
    height: 42,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "#ffffff",
    color: "#0f172a",
    padding: "0 13px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButton: {
    height: 42,
    border: "1px solid #0f172a",
    borderRadius: 12,
    background: "#0f172a",
    color: "#ffffff",
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
  },
  table: {
    width: "100%",
    minWidth: 980,
    borderCollapse: "collapse",
  },
  th: {
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    padding: "11px 10px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 950,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: {
    borderBottom: "1px solid #eef2f7",
    padding: "10px",
    fontSize: 13,
    color: "#0f172a",
    verticalAlign: "top",
  },
};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function yearRange(year: number) {
  return {
    from: isoDate(new Date(year, 0, 1)),
    to: isoDate(new Date(year + 1, 0, 1)),
  };
}

function eur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateDE(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function classifyEntry(entry: EntryRow, objectLabel: string): ClassifiedEntry {
  const text = normalize(`${entry.category ?? ""} ${entry.note ?? ""}`);

  if (entry.entry_type === "income") {
    if (includesAny(text, ["miete", "kaltmiete", "warmmiete", "pacht"])) {
      return {
        ...entry,
        object_label: objectLabel,
        tax_group: "Mieteinnahmen",
        tax_hint: "Anlage V: Einnahmen aus Vermietung",
        relevance: "tax",
      };
    }

    if (includesAny(text, ["nebenkosten", "betriebskosten", "vorauszahlung", "nk"])) {
      return {
        ...entry,
        object_label: objectLabel,
        tax_group: "Nebenkosten-Vorauszahlungen",
        tax_hint: "Anlage V: Einnahmen, gegen Ausgaben abstimmen",
        relevance: "tax",
      };
    }

    if (includesAny(text, ["kaution", "deposit"])) {
      return {
        ...entry,
        object_label: objectLabel,
        tax_group: "Kaution / nicht ertragswirksam pruefen",
        tax_hint: "Meist nicht als Einnahme zu versteuern, bitte pruefen",
        relevance: "check",
      };
    }

    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Sonstige Einnahmen pruefen",
      tax_hint: "Bitte steuerliche Zuordnung pruefen",
      relevance: "check",
    };
  }

  if (includesAny(text, ["zins", "darlehenszins", "kredit"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Darlehenszinsen",
      tax_hint: "Anlage V: Werbungskosten, Zinsanteil",
      relevance: "tax",
    };
  }

  if (includesAny(text, ["tilgung", "sondertilgung", "restschuld"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Tilgung / nicht abziehbar",
      tax_hint: "Tilgung ist in der Regel nicht als Werbungskosten abziehbar",
      relevance: "private",
    };
  }

  if (includesAny(text, ["reparatur", "instandhaltung", "erhaltung", "wartung", "handwerker"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Reparatur / Erhaltungsaufwand",
      tax_hint: "Anlage V: Werbungskosten, Beleg aufbewahren",
      relevance: "tax",
    };
  }

  if (includesAny(text, ["sanierung", "modernisierung", "capex", "umbau", "renovierung"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Modernisierung / Aktivierung pruefen",
      tax_hint: "Sofortabzug vs. Herstellungskosten mit Steuerberater pruefen",
      relevance: "check",
    };
  }

  if (includesAny(text, ["grundsteuer", "steuer"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Grundsteuer",
      tax_hint: "Anlage V: Werbungskosten",
      relevance: "tax",
    };
  }

  if (includesAny(text, ["versicherung", "gebaeudeversicherung", "haftpflicht"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Versicherungen",
      tax_hint: "Anlage V: Werbungskosten",
      relevance: "tax",
    };
  }

  if (includesAny(text, ["hausgeld", "weg", "verwaltung", "verwalter"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Hausgeld / Verwaltung",
      tax_hint: "Abziehbare Bestandteile getrennt pruefen",
      relevance: "check",
    };
  }

  if (includesAny(text, ["nebenkosten", "betriebskosten", "wasser", "strom", "heizung", "muell", "müll", "reinigung", "winterdienst", "garten"])) {
    return {
      ...entry,
      object_label: objectLabel,
      tax_group: "Betriebs- / Nebenkosten",
      tax_hint: "Anlage V: Werbungskosten bzw. Umlage pruefen",
      relevance: "tax",
    };
  }

  return {
    ...entry,
    object_label: objectLabel,
    tax_group: "Sonstige Ausgaben pruefen",
    tax_hint: "Bitte steuerliche Zuordnung pruefen",
    relevance: "check",
  };
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes(";") || text.includes("\"") || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: ClassifiedEntry[]) {
  const headers = [
    "Datum",
    "Objekt",
    "Typ",
    "Steuergruppe",
    "Kategorie",
    "Notiz",
    "Betrag",
    "Hinweis",
  ];

  const lines = rows.map((row) => [
    row.booking_date,
    row.object_label,
    row.entry_type === "income" ? "Einnahme" : "Ausgabe",
    row.tax_group,
    row.category ?? "",
    row.note ?? "",
    row.amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    row.tax_hint,
  ]);

  const csv = [headers, ...lines].map((line) => line.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SteuerCenter() {
  const [year, setYear] = useState(currentYear);
  const [objectCode, setObjectCode] = useState("ALL");
  const [relevance, setRelevance] = useState<RelevanceFilter>("all");
  const [search, setSearch] = useState("");
  const [objects, setObjects] = useState<ObjectOption[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectLabelByCode = useMemo(() => {
    return new Map(objects.map((object) => [object.objekt_code, object.label]));
  }, [objects]);

  async function loadObjects() {
    const { data, error: loadError } = await supabase
      .from("v_object_dropdown")
      .select("objekt_code,label")
      .order("label", { ascending: true });

    if (loadError) throw loadError;

    const rows = (data ?? [])
      .map((row: unknown) => {
        const item = row as Partial<ObjectOption>;
        return {
          objekt_code: String(item.objekt_code ?? ""),
          label: String(item.label ?? ""),
        };
      })
      .filter((row) => row.objekt_code && row.label);

    setObjects(rows);
  }

  async function loadEntries() {
    setLoading(true);
    setError(null);

    const range = yearRange(year);

    try {
      if (objects.length === 0) {
        await loadObjects();
      }

      let incomeQuery = supabase
        .from("v_income_entries")
        .select("id,objekt_code,booking_date,amount,category,note")
        .gte("booking_date", range.from)
        .lt("booking_date", range.to);

      let expenseQuery = supabase
        .from("v_expense_entries")
        .select("id,objekt_code,booking_date,amount,category,note")
        .gte("booking_date", range.from)
        .lt("booking_date", range.to);

      if (objectCode !== "ALL") {
        incomeQuery = incomeQuery.eq("objekt_code", objectCode);
        expenseQuery = expenseQuery.eq("objekt_code", objectCode);
      }

      const [incomeResult, expenseResult] = await Promise.all([incomeQuery, expenseQuery]);

      if (incomeResult.error) throw incomeResult.error;
      if (expenseResult.error) throw expenseResult.error;

      const incomeRows: EntryRow[] = (incomeResult.data ?? []).map((row: unknown) => {
        const item = row as Partial<EntryRow>;
        return {
          id: Number(item.id ?? 0),
          objekt_code: item.objekt_code ?? null,
          booking_date: String(item.booking_date ?? ""),
          amount: parseLocaleNumber(item.amount, 0),
          category: item.category ?? null,
          note: item.note ?? null,
          entry_type: "income",
        };
      });

      const expenseRows: EntryRow[] = (expenseResult.data ?? []).map((row: unknown) => {
        const item = row as Partial<EntryRow>;
        return {
          id: Number(item.id ?? 0),
          objekt_code: item.objekt_code ?? null,
          booking_date: String(item.booking_date ?? ""),
          amount: parseLocaleNumber(item.amount, 0),
          category: item.category ?? null,
          note: item.note ?? null,
          entry_type: "expense",
        };
      });

      setEntries([...incomeRows, ...expenseRows].sort((a, b) => b.booking_date.localeCompare(a.booking_date)));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function initialLoad() {
      try {
        const { data, error: loadError } = await supabase
          .from("v_object_dropdown")
          .select("objekt_code,label")
          .order("label", { ascending: true });

        if (!alive) return;
        if (loadError) throw loadError;

        const rows = (data ?? [])
          .map((row: unknown) => {
            const item = row as Partial<ObjectOption>;
            return {
              objekt_code: String(item.objekt_code ?? ""),
              label: String(item.label ?? ""),
            };
          })
          .filter((row) => row.objekt_code && row.label);

        setObjects(rows);
      } catch (loadError) {
        if (!alive) return;
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setError(message);
      }
    }

    void initialLoad();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Initialer und filterbasierter Supabase-Ladevorgang fuer die Steueruebersicht.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, objectCode]);

  const classifiedRows = useMemo<ClassifiedEntry[]>(() => {
    return entries.map((entry) => {
      const objectLabel = entry.objekt_code
        ? objectLabelByCode.get(entry.objekt_code) ?? entry.objekt_code
        : "Ohne Objekt";
      return classifyEntry(entry, objectLabel);
    });
  }, [entries, objectLabelByCode]);

  const filteredRows = useMemo(() => {
    const query = normalize(search);
    return classifiedRows.filter((row) => {
      if (relevance !== "all" && row.relevance !== relevance) return false;
      if (!query) return true;
      return normalize(`${row.object_label} ${row.tax_group} ${row.category ?? ""} ${row.note ?? ""}`).includes(query);
    });
  }, [classifiedRows, relevance, search]);

  const summary = useMemo(() => {
    const map = new Map<string, SummaryRow>();

    for (const row of filteredRows) {
      const current = map.get(row.tax_group) ?? {
        group: row.tax_group,
        income: 0,
        expense: 0,
        count: 0,
      };

      current.count += 1;
      if (row.entry_type === "income") current.income += row.amount;
      else current.expense += row.amount;
      map.set(row.tax_group, current);
    }

    return Array.from(map.values()).sort((a, b) => Math.abs(b.income - b.expense) - Math.abs(a.income - a.expense));
  }, [filteredRows]);

  const totals = useMemo(() => {
    const income = filteredRows.filter((row) => row.entry_type === "income").reduce((sum, row) => sum + row.amount, 0);
    const expense = filteredRows.filter((row) => row.entry_type === "expense").reduce((sum, row) => sum + row.amount, 0);
    const taxRows = filteredRows.filter((row) => row.relevance === "tax").length;
    const checkRows = filteredRows.filter((row) => row.relevance === "check").length;
    return { income, expense, net: income - expense, taxRows, checkRows, count: filteredRows.length };
  }, [filteredRows]);

  const filenameObject = objectCode === "ALL" ? "alle_objekte" : objectCode.replace(/[^a-zA-Z0-9_-]+/g, "_");

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <div>
            <div style={styles.eyebrow}>
              <FileText size={16} />
              Steuer-Vorbereitung
            </div>
            <h1 style={styles.title}>Steuer-Center</h1>
            <p style={styles.text}>
              Jahresuebersicht fuer steuerrelevante Einnahmen und Ausgaben. Die Seite liest nur
              vorhandene Buchungen und hilft beim Export fuer Steuerberater oder Steuererklaerung.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void loadEntries()} style={styles.button}>
              <RefreshCw size={16} />
              Aktualisieren
            </button>
            <button type="button" onClick={() => window.print()} style={styles.button}>
              <Printer size={16} />
              Drucken
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(`steuer_center_${filenameObject}_${year}.csv`, filteredRows)}
              style={styles.primaryButton}
            >
              <Download size={16} />
              CSV Export
            </button>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.controls}>
          <label style={styles.label}>
            Jahr
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} style={styles.input}>
              {Array.from({ length: 12 }, (_, index) => currentYear - index).map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Objekt
            <select value={objectCode} onChange={(event) => setObjectCode(event.target.value)} style={styles.input}>
              <option value="ALL">Alle Objekte</option>
              {objects.map((object) => (
                <option key={object.objekt_code} value={object.objekt_code}>{object.label}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Steuerstatus
            <select value={relevance} onChange={(event) => setRelevance(event.target.value as RelevanceFilter)} style={styles.input}>
              <option value="all">Alle Buchungen</option>
              <option value="tax">Steuerrelevant</option>
              <option value="check">Pruefen</option>
              <option value="private">Nicht abziehbar</option>
            </select>
          </label>

          <label style={styles.label}>
            Suche
            <span style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#64748b" }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Kategorie, Notiz, Objekt"
                style={{ ...styles.input, paddingLeft: 36 }}
              />
            </span>
          </label>
        </div>
      </section>

      {error ? (
        <section style={{ ...styles.panel, borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 800 }}>
          Fehler beim Laden: {error}
        </section>
      ) : null}

      <section style={styles.grid3}>
        <MetricCard label="Einnahmen" value={loading ? "..." : eur(totals.income)} tone="green" />
        <MetricCard label="Ausgaben" value={loading ? "..." : eur(totals.expense)} tone="red" />
        <MetricCard label="Ueberschuss" value={loading ? "..." : eur(totals.net)} tone={totals.net >= 0 ? "blue" : "red"} />
        <MetricCard label="Steuerrelevant" value={loading ? "..." : String(totals.taxRows)} tone="green" />
        <MetricCard label="Zu pruefen" value={loading ? "..." : String(totals.checkRows)} tone="amber" />
        <MetricCard label="Buchungen" value={loading ? "..." : String(totals.count)} tone="slate" />
      </section>

      <section style={styles.panel}>
        <SectionHeading title="Summen nach Steuergruppe" subtitle="Automatische Vor-Klassifizierung aus Kategorie und Notiz. Bitte vor Abgabe fachlich pruefen." />
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Steuergruppe</th>
                <th style={styles.th}>Einnahmen</th>
                <th style={styles.th}>Ausgaben</th>
                <th style={styles.th}>Saldo</th>
                <th style={styles.th}>Buchungen</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.group}>
                  <td style={styles.td}><strong>{row.group}</strong></td>
                  <td style={styles.td}>{eur(row.income)}</td>
                  <td style={styles.td}>{eur(row.expense)}</td>
                  <td style={styles.td}><strong>{eur(row.income - row.expense)}</strong></td>
                  <td style={styles.td}>{row.count}</td>
                </tr>
              ))}
              {!summary.length ? (
                <tr><td colSpan={5} style={styles.td}>Keine Buchungen fuer die aktuelle Auswahl.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <SectionHeading title="Buchungen fuer Steuerpruefung" subtitle="Exportiert werden genau die aktuell gefilterten Zeilen." />
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Datum</th>
                <th style={styles.th}>Objekt</th>
                <th style={styles.th}>Typ</th>
                <th style={styles.th}>Steuergruppe</th>
                <th style={styles.th}>Kategorie / Notiz</th>
                <th style={styles.th}>Betrag</th>
                <th style={styles.th}>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.entry_type}-${row.id}`}>
                  <td style={styles.td}>{dateDE(row.booking_date)}</td>
                  <td style={styles.td}>{row.object_label}</td>
                  <td style={styles.td}>{row.entry_type === "income" ? "Einnahme" : "Ausgabe"}</td>
                  <td style={styles.td}>
                    <strong>{row.tax_group}</strong>
                    <div style={{ marginTop: 4 }}>
                      <StatusPill relevance={row.relevance} />
                    </div>
                  </td>
                  <td style={styles.td}>
                    <strong>{row.category || "Ohne Kategorie"}</strong>
                    <div style={{ marginTop: 4, color: "#64748b" }}>{row.note || "Keine Notiz"}</div>
                  </td>
                  <td style={styles.td}><strong>{eur(row.amount)}</strong></td>
                  <td style={styles.td}>{row.tax_hint}</td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr><td colSpan={7} style={styles.td}>Keine Buchungen fuer die aktuelle Auswahl.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "blue" | "amber" | "slate" }) {
  const colors = {
    green: ["#ecfdf5", "#047857"],
    red: ["#fff1f2", "#be123c"],
    blue: ["#eff6ff", "#1d4ed8"],
    amber: ["#fffbeb", "#b45309"],
    slate: ["#f8fafc", "#334155"],
  } satisfies Record<typeof tone, [string, string]>;

  const [bg, color] = colors[tone];

  return (
    <div style={{ ...styles.panel, background: bg }}>
      <div style={{ fontSize: 12, fontWeight: 950, color, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 23, fontWeight: 950, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 950, color: "#0f172a" }}>{title}</h2>
      <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "#64748b" }}>{subtitle}</p>
    </div>
  );
}

function StatusPill({ relevance }: { relevance: ClassifiedEntry["relevance"] }) {
  const config = {
    tax: ["Steuerrelevant", "#ecfdf5", "#047857"],
    check: ["Pruefen", "#fffbeb", "#b45309"],
    private: ["Nicht abziehbar", "#f1f5f9", "#475569"],
  } satisfies Record<typeof relevance, [string, string, string]>;

  const [label, bg, color] = config[relevance];

  return (
    <span style={{ display: "inline-flex", borderRadius: 999, background: bg, color, padding: "4px 8px", fontSize: 11, fontWeight: 950 }}>
      {label}
    </span>
  );
}
