import { useEffect, useMemo, useState, type CSSProperties } from "react";

type AllocationKey = "Einheiten" | "Verbrauch/Direkt" | "Direktbetrag";

type CostRow = {
  id: string;
  label: string;
  totalCost: number;
  key: AllocationKey;
  totalUnits: number | null;
  yourUnits: number | null;
  note: string;
  autoMode?: "annualHausgeld";
};

type BillingYearData = {
  year: number;
  propertyLabel: string;
  unitLabel: string;
  periodFrom: string;
  periodTo: string;
  monthlyHausgeld: number;
  tenantPrepayments: number;
  landlordName: string;
  landlordAddress: string;
  tenantName: string;
  tenantAddress: string;
  totalUnits: number;
  yourUnits: number;
  footerNote: string;
  apportionableRows: CostRow[];
  nonApportionableRows: CostRow[];
};

type StoredPayload = {
  records: BillingYearData[];
};

const STORAGE_KEY = "koenen:tiefgarage-nebenkosten:v1";

const pageStyles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1320,
    margin: "0 auto",
    padding: 24,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 0.9fr)",
    gap: 20,
    alignItems: "stretch",
    marginBottom: 24,
  },
  heroCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 28,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  },
  heroTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.05,
  },
  heroText: {
    margin: "14px 0 0",
    fontSize: 16,
    lineHeight: 1.6,
    color: "#475569",
  },
  subtleList: {
    margin: "18px 0 0",
    paddingLeft: 18,
    color: "#334155",
    lineHeight: 1.7,
    fontSize: 14,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  summaryCard: {
    borderRadius: 18,
    border: "1px solid #dbe3f0",
    background: "#f8fafc",
    padding: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
  },
  section: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    marginBottom: 24,
    overflow: "hidden",
  },
  sectionHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#111827",
  },
  sectionBody: {
    padding: 24,
  },
  inputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  inputCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    background: "#f8fafc",
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    background: "#ffffff",
    color: "#111827",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 104,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    background: "#ffffff",
    color: "#111827",
    fontSize: 14,
    resize: "vertical",
    fontFamily: "inherit",
  },
  button: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
  },
  primaryButton: {
    border: "1px solid #c7d2fe",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#eef2ff",
    color: "#3730a3",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
  },
  accentButton: {
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#fff1f2",
    color: "#b91c1c",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
  },
  yearBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  yearButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "8px 14px",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
  },
  activeYearButton: {
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 980,
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
    verticalAlign: "top",
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
  },
  amountCell: {
    fontWeight: 800,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  mutedText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  onePager: {
    maxWidth: 820,
    margin: "0 auto",
    border: "1px solid #dbe3f0",
    borderRadius: 24,
    padding: 32,
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
  },
  onePagerTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
  },
  onePagerSubTitle: {
    margin: "10px 0 0",
    fontSize: 15,
    color: "#475569",
    lineHeight: 1.6,
  },
  onePagerMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    marginTop: 24,
    marginBottom: 24,
  },
  onePagerBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    background: "#f8fafc",
  },
  onePagerTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 14,
  },
  onePagerFooter: {
    marginTop: 28,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 18,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#334155",
  },
};

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthsInclusive(periodFrom: string, periodTo: string) {
  if (!periodFrom || !periodTo) return 12;

  const from = new Date(`${periodFrom}T00:00:00`);
  const to = new Date(`${periodTo}T00:00:00`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return 12;

  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
}

function buildDefaultYear(year: number): BillingYearData {
  return {
    year,
    propertyLabel: "Tiefgaragenstellplatz",
    unitLabel: "Stellplatz 1",
    periodFrom: `${year}-01-01`,
    periodTo: `${year}-12-31`,
    monthlyHausgeld: 0,
    tenantPrepayments: 0,
    landlordName: "",
    landlordAddress: "",
    tenantName: "",
    tenantAddress: "",
    totalUnits: 1,
    yourUnits: 1,
    footerNote:
      "Bitte prüfen Sie die Werte vor dem Versand. Diese Seite ist als kompakter Onepager für den Mieter gedacht.",
    apportionableRows: [
      {
        id: createId(),
        label: "Hausgeld / TG (Jahressumme)",
        totalCost: 0,
        key: "Einheiten",
        totalUnits: null,
        yourUnits: null,
        note: "Wird automatisch aus dem monatlichen Hausgeld berechnet.",
        autoMode: "annualHausgeld",
      },
      {
        id: createId(),
        label: "Strom / Beleuchtung",
        totalCost: 0,
        key: "Einheiten",
        totalUnits: null,
        yourUnits: null,
        note: "Optional",
      },
      {
        id: createId(),
        label: "Reinigung / Sonstiges",
        totalCost: 0,
        key: "Einheiten",
        totalUnits: null,
        yourUnits: null,
        note: "Optional",
      },
    ],
    nonApportionableRows: [
      {
        id: createId(),
        label: "Rücklage / Instandhaltung",
        totalCost: 0,
        key: "Direktbetrag",
        totalUnits: null,
        yourUnits: null,
        note: "Nur interne Übersicht",
      },
      {
        id: createId(),
        label: "Verwaltung",
        totalCost: 0,
        key: "Direktbetrag",
        totalUnits: null,
        yourUnits: null,
        note: "Nur interne Übersicht",
      },
    ],
  };
}

function loadStoredYears(): BillingYearData[] {
  if (typeof window === "undefined") {
    return [buildDefaultYear(new Date().getFullYear())];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [buildDefaultYear(new Date().getFullYear())];

    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed || !Array.isArray(parsed.records) || parsed.records.length === 0) {
      return [buildDefaultYear(new Date().getFullYear())];
    }

    return parsed.records
      .map((record) => ({
        ...buildDefaultYear(toNumber(record.year, new Date().getFullYear())),
        ...record,
      }))
      .sort((a, b) => a.year - b.year);
  } catch (error) {
    console.error("Nebenkosten-TG localStorage konnte nicht gelesen werden", error);
    return [buildDefaultYear(new Date().getFullYear())];
  }
}

function saveStoredYears(records: BillingYearData[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      records,
    } satisfies StoredPayload),
  );
}

function deriveRowTotalCost(row: CostRow, yearData: BillingYearData) {
  if (row.autoMode === "annualHausgeld") {
    return roundMoney(yearData.monthlyHausgeld * monthsInclusive(yearData.periodFrom, yearData.periodTo));
  }

  return roundMoney(toNumber(row.totalCost));
}

function deriveRowShare(row: CostRow, yearData: BillingYearData) {
  const totalCost = deriveRowTotalCost(row, yearData);

  if (row.key === "Direktbetrag" || row.key === "Verbrauch/Direkt") {
    return totalCost;
  }

  const totalUnits = row.totalUnits ?? yearData.totalUnits;
  const yourUnits = row.yourUnits ?? yearData.yourUnits;

  if (!totalUnits || totalUnits <= 0) return 0;
  return roundMoney((totalCost / totalUnits) * yourUnits);
}

function YearButton(props: {
  active: boolean;
  year: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        ...pageStyles.yearButton,
        ...(props.active ? pageStyles.activeYearButton : null),
      }}
    >
      {props.year}
    </button>
  );
}

function RowEditor(props: {
  row: CostRow;
  yearData: BillingYearData;
  onChange: (nextRow: CostRow) => void;
  onDelete: () => void;
}) {
  const rowTotal = deriveRowTotalCost(props.row, props.yearData);
  const share = deriveRowShare(props.row, props.yearData);

  return (
    <tr>
      <td style={pageStyles.td}>
        <input
          style={pageStyles.input}
          value={props.row.label}
          onChange={(event) => props.onChange({ ...props.row, label: event.target.value })}
          placeholder="Kostenart"
        />
        {props.row.note ? <div style={{ ...pageStyles.mutedText, marginTop: 8 }}>{props.row.note}</div> : null}
      </td>
      <td style={pageStyles.td}>
        <input
          style={pageStyles.input}
          type="number"
          step="0.01"
          value={props.row.autoMode === "annualHausgeld" ? rowTotal : props.row.totalCost}
          disabled={props.row.autoMode === "annualHausgeld"}
          onChange={(event) =>
            props.onChange({
              ...props.row,
              totalCost: toNumber(event.target.value),
            })
          }
        />
      </td>
      <td style={pageStyles.td}>
        <select
          style={pageStyles.input}
          value={props.row.key}
          onChange={(event) =>
            props.onChange({
              ...props.row,
              key: event.target.value as AllocationKey,
            })
          }
        >
          <option value="Einheiten">Einheiten</option>
          <option value="Verbrauch/Direkt">Verbrauch/Direkt</option>
          <option value="Direktbetrag">Direktbetrag</option>
        </select>
      </td>
      <td style={pageStyles.td}>
        <input
          style={pageStyles.input}
          type="number"
          step="0.01"
          value={props.row.totalUnits ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            props.onChange({
              ...props.row,
              totalUnits: raw === "" ? null : toNumber(raw),
            });
          }}
          placeholder={`Standard: ${props.yearData.totalUnits}`}
        />
      </td>
      <td style={pageStyles.td}>
        <input
          style={pageStyles.input}
          type="number"
          step="0.01"
          value={props.row.yourUnits ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            props.onChange({
              ...props.row,
              yourUnits: raw === "" ? null : toNumber(raw),
            });
          }}
          placeholder={`Standard: ${props.yearData.yourUnits}`}
        />
      </td>
      <td style={{ ...pageStyles.td, ...pageStyles.amountCell }}>{formatCurrency(share)}</td>
      <td style={pageStyles.td}>
        <button type="button" style={pageStyles.button} onClick={props.onDelete}>
          Entfernen
        </button>
      </td>
    </tr>
  );
}

function SummaryValue(props: { label: string; value: string; tone?: "default" | "positive" | "danger" }) {
  const toneStyles: Record<string, CSSProperties> = {
    default: { color: "#0f172a" },
    positive: { color: "#166534" },
    danger: { color: "#b91c1c" },
  };

  return (
    <div style={pageStyles.summaryCard}>
      <div style={pageStyles.summaryLabel}>{props.label}</div>
      <div style={{ ...pageStyles.summaryValue, ...(toneStyles[props.tone ?? "default"] ?? null) }}>
        {props.value}
      </div>
    </div>
  );
}

export default function NebenkostenTiefgarage() {
  const [records, setRecords] = useState<BillingYearData[]>(() => loadStoredYears());
  const [activeYear, setActiveYear] = useState<number>(() => loadStoredYears()[0]?.year ?? new Date().getFullYear());
  const [newYearInput, setNewYearInput] = useState<string>(String(new Date().getFullYear() + 1));

  useEffect(() => {
    saveStoredYears(records);
  }, [records]);

  const activeRecord = useMemo(() => {
    return records.find((record) => record.year === activeYear) ?? records[0] ?? buildDefaultYear(new Date().getFullYear());
  }, [records, activeYear]);

  const monthCount = monthsInclusive(activeRecord.periodFrom, activeRecord.periodTo);
  const annualHausgeld = roundMoney(activeRecord.monthlyHausgeld * monthCount);

  const apportionableRows = useMemo(
    () =>
      activeRecord.apportionableRows.map((row) => ({
        ...row,
        totalCost: deriveRowTotalCost(row, activeRecord),
      })),
    [activeRecord],
  );

  const apportionableTotal = useMemo(
    () => roundMoney(activeRecord.apportionableRows.reduce((sum, row) => sum + deriveRowShare(row, activeRecord), 0)),
    [activeRecord],
  );

  const nonApportionableTotal = useMemo(
    () => roundMoney(activeRecord.nonApportionableRows.reduce((sum, row) => sum + deriveRowShare(row, activeRecord), 0)),
    [activeRecord],
  );

  const settlementBalance = roundMoney(apportionableTotal - activeRecord.tenantPrepayments);

  function updateActiveRecord(patch: Partial<BillingYearData>) {
    setRecords((current) =>
      current.map((record) => (record.year === activeRecord.year ? { ...record, ...patch } : record)),
    );
  }

  function updateRow(section: "apportionableRows" | "nonApportionableRows", rowId: string, nextRow: CostRow) {
    updateActiveRecord({
      [section]: activeRecord[section].map((row) => (row.id === rowId ? nextRow : row)),
    } as Partial<BillingYearData>);
  }

  function deleteRow(section: "apportionableRows" | "nonApportionableRows", rowId: string) {
    updateActiveRecord({
      [section]: activeRecord[section].filter((row) => row.id !== rowId),
    } as Partial<BillingYearData>);
  }

  function addRow(section: "apportionableRows" | "nonApportionableRows") {
    const nextRow: CostRow = {
      id: createId(),
      label: "Neue Kostenart",
      totalCost: 0,
      key: section === "apportionableRows" ? "Einheiten" : "Direktbetrag",
      totalUnits: null,
      yourUnits: null,
      note: "",
    };

    updateActiveRecord({
      [section]: [...activeRecord[section], nextRow],
    } as Partial<BillingYearData>);
  }

  function createNewYear() {
    const nextYear = Math.trunc(toNumber(newYearInput, Number.NaN));
    if (!Number.isFinite(nextYear)) {
      window.alert("Bitte ein gültiges Jahr eingeben.");
      return;
    }

    if (records.some((record) => record.year === nextYear)) {
      setActiveYear(nextYear);
      return;
    }

    const nextRecord = buildDefaultYear(nextYear);
    const nextRecords = [...records, nextRecord].sort((a, b) => a.year - b.year);
    setRecords(nextRecords);
    setActiveYear(nextYear);
  }

  function resetActiveYear() {
    const shouldReset = window.confirm(`Möchtest du die Daten für ${activeRecord.year} wirklich zurücksetzen?`);
    if (!shouldReset) return;

    updateActiveRecord(buildDefaultYear(activeRecord.year));
  }

  function openPrintPreview() {
    const printable = document.getElementById("tg-onepager-preview");
    if (!printable) return;

    const printWindow = window.open("", "_blank", "width=960,height=1200");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Nebenkostenabrechnung TG ${activeRecord.year}</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: Inter, Arial, sans-serif; background: #f8fafc; padding: 32px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            .print-card { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #dbe3f0; border-radius: 24px; padding: 32px; }
            @media print {
              body { background: #fff; padding: 0; }
              .print-card { border: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="print-card">${printable.innerHTML}</div>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.hero}>
        <section style={pageStyles.heroCard}>
          <h1 style={pageStyles.heroTitle}>Nebenkostenabrechnungen für Tiefgaragenstellplätze</h1>
          <p style={pageStyles.heroText}>
            Diese Seite ist auf Basis deiner XLS-Vorlage aufgebaut: pro Jahr können alle Eingaben gepflegt werden,
            die Umlage wird automatisch berechnet und am Ende entsteht ein kompakter Onepager für den Mieter.
          </p>
          <ul style={pageStyles.subtleList}>
            <li>Jahresbezogene Datensätze direkt im Browser pflegen.</li>
            <li>Umlagefähige und nicht umlagefähige Kosten getrennt erfassen.</li>
            <li>Onepager für Mieter als Druck/PDF direkt aus der Seite öffnen.</li>
          </ul>
        </section>

        <aside style={pageStyles.heroCard}>
          <div style={pageStyles.summaryGrid}>
            <SummaryValue label="Aktives Jahr" value={String(activeRecord.year)} />
            <SummaryValue label="Monate im Zeitraum" value={String(monthCount)} />
            <SummaryValue label="Jahres-Hausgeld" value={formatCurrency(annualHausgeld)} />
            <SummaryValue label="Mieter-Vorauszahlungen" value={formatCurrency(activeRecord.tenantPrepayments)} />
            <SummaryValue label="Umlagefähig" value={formatCurrency(apportionableTotal)} />
            <SummaryValue
              label={settlementBalance >= 0 ? "Nachzahlung" : "Guthaben"}
              value={formatCurrency(Math.abs(settlementBalance))}
              tone={settlementBalance >= 0 ? "danger" : "positive"}
            />
          </div>
        </aside>
      </div>

      <section style={pageStyles.section}>
        <div style={pageStyles.sectionHeader}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Jahre verwalten</h2>
            <div style={pageStyles.mutedText}>Für jedes Jahr bleibt ein eigener Datensatz mit eigener Abrechnung erhalten.</div>
          </div>
          <div style={pageStyles.yearBar}>
            {records.map((record) => (
              <YearButton
                key={record.year}
                year={record.year}
                active={record.year === activeYear}
                onClick={() => setActiveYear(record.year)}
              />
            ))}
            <input
              style={{ ...pageStyles.input, width: 110 }}
              value={newYearInput}
              onChange={(event) => setNewYearInput(event.target.value)}
              placeholder="Jahr"
            />
            <button type="button" style={pageStyles.primaryButton} onClick={createNewYear}>
              Jahr anlegen
            </button>
            <button type="button" style={pageStyles.accentButton} onClick={resetActiveYear}>
              Aktives Jahr zurücksetzen
            </button>
          </div>
        </div>
      </section>

      <section style={pageStyles.section}>
        <div style={pageStyles.sectionHeader}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Kopf- und Stammdaten</h2>
            <div style={pageStyles.mutedText}>Eingabemaske nach deiner Excel-Vorlage für Vermieter, Mieter, Zeitraum und Einheiten.</div>
          </div>
        </div>
        <div style={pageStyles.sectionBody}>
          <div style={pageStyles.inputGrid}>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Objekt / Abrechnung</label>
              <input
                style={pageStyles.input}
                value={activeRecord.propertyLabel}
                onChange={(event) => updateActiveRecord({ propertyLabel: event.target.value })}
                placeholder="z. B. TG Stellplatz Rosensteinstraße 25"
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Einheit / Stellplatz</label>
              <input
                style={pageStyles.input}
                value={activeRecord.unitLabel}
                onChange={(event) => updateActiveRecord({ unitLabel: event.target.value })}
                placeholder="z. B. Stellplatz Nr. 12"
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Abrechnungszeitraum von</label>
              <input
                type="date"
                style={pageStyles.input}
                value={activeRecord.periodFrom}
                onChange={(event) => updateActiveRecord({ periodFrom: event.target.value })}
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Abrechnungszeitraum bis</label>
              <input
                type="date"
                style={pageStyles.input}
                value={activeRecord.periodTo}
                onChange={(event) => updateActiveRecord({ periodTo: event.target.value })}
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Monatliches Hausgeld</label>
              <input
                type="number"
                step="0.01"
                style={pageStyles.input}
                value={activeRecord.monthlyHausgeld}
                onChange={(event) => updateActiveRecord({ monthlyHausgeld: toNumber(event.target.value) })}
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Vorauszahlungen Mieter (Jahr)</label>
              <input
                type="number"
                step="0.01"
                style={pageStyles.input}
                value={activeRecord.tenantPrepayments}
                onChange={(event) => updateActiveRecord({ tenantPrepayments: toNumber(event.target.value) })}
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Gesamt Einheiten</label>
              <input
                type="number"
                step="0.01"
                style={pageStyles.input}
                value={activeRecord.totalUnits}
                onChange={(event) => updateActiveRecord({ totalUnits: toNumber(event.target.value, 1) })}
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Ihre / Mieter-Einheiten</label>
              <input
                type="number"
                step="0.01"
                style={pageStyles.input}
                value={activeRecord.yourUnits}
                onChange={(event) => updateActiveRecord({ yourUnits: toNumber(event.target.value, 1) })}
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Vermieter</label>
              <input
                style={pageStyles.input}
                value={activeRecord.landlordName}
                onChange={(event) => updateActiveRecord({ landlordName: event.target.value })}
              />
            </div>
            <div style={pageStyles.inputCard}>
              <label style={pageStyles.label}>Mieter</label>
              <input
                style={pageStyles.input}
                value={activeRecord.tenantName}
                onChange={(event) => updateActiveRecord({ tenantName: event.target.value })}
              />
            </div>
            <div style={{ ...pageStyles.inputCard, gridColumn: "span 2" }}>
              <label style={pageStyles.label}>Adresse Vermieter</label>
              <textarea
                style={pageStyles.textarea}
                value={activeRecord.landlordAddress}
                onChange={(event) => updateActiveRecord({ landlordAddress: event.target.value })}
              />
            </div>
            <div style={{ ...pageStyles.inputCard, gridColumn: "span 2" }}>
              <label style={pageStyles.label}>Adresse Mieter</label>
              <textarea
                style={pageStyles.textarea}
                value={activeRecord.tenantAddress}
                onChange={(event) => updateActiveRecord({ tenantAddress: event.target.value })}
              />
            </div>
          </div>
        </div>
      </section>

      <section style={pageStyles.section}>
        <div style={pageStyles.sectionHeader}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Umlagefähige Kosten</h2>
            <div style={pageStyles.mutedText}>Die Tabelle rechnet deinen Anteil automatisch aus. Leer gelassene Einheiten greifen auf die Stammdaten oben zurück.</div>
          </div>
          <button type="button" style={pageStyles.primaryButton} onClick={() => addRow("apportionableRows")}>
            Kostenart hinzufügen
          </button>
        </div>
        <div style={pageStyles.sectionBody}>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={{ ...pageStyles.th, width: "24%" }}>Kostenart</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Gesamtkosten</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Schlüssel</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Gesamt-Einheiten</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Ihre Einheiten</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Ihr Anteil</th>
                  <th style={{ ...pageStyles.th, width: "6%" }} />
                </tr>
              </thead>
              <tbody>
                {activeRecord.apportionableRows.map((row) => (
                  <RowEditor
                    key={row.id}
                    row={row}
                    yearData={activeRecord}
                    onChange={(nextRow) => updateRow("apportionableRows", row.id, nextRow)}
                    onDelete={() => deleteRow("apportionableRows", row.id)}
                  />
                ))}
                <tr>
                  <td style={{ ...pageStyles.td, fontWeight: 900 }}>Summe umlagefähig</td>
                  <td style={pageStyles.td} />
                  <td style={pageStyles.td} />
                  <td style={pageStyles.td} />
                  <td style={pageStyles.td} />
                  <td style={{ ...pageStyles.td, ...pageStyles.amountCell }}>{formatCurrency(apportionableTotal)}</td>
                  <td style={pageStyles.td} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={pageStyles.section}>
        <div style={pageStyles.sectionHeader}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Nicht umlagefähige Kosten</h2>
            <div style={pageStyles.mutedText}>Interne Eigentümer-Sicht. Diese Positionen erscheinen nicht im Mieter-Onepager.</div>
          </div>
          <button type="button" style={pageStyles.button} onClick={() => addRow("nonApportionableRows")}>
            Interne Kostenart hinzufügen
          </button>
        </div>
        <div style={pageStyles.sectionBody}>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={{ ...pageStyles.th, width: "24%" }}>Kostenart</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Gesamtkosten</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Schlüssel</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Gesamt-Einheiten</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Ihre Einheiten</th>
                  <th style={{ ...pageStyles.th, width: "14%" }}>Betrag</th>
                  <th style={{ ...pageStyles.th, width: "6%" }} />
                </tr>
              </thead>
              <tbody>
                {activeRecord.nonApportionableRows.map((row) => (
                  <RowEditor
                    key={row.id}
                    row={row}
                    yearData={activeRecord}
                    onChange={(nextRow) => updateRow("nonApportionableRows", row.id, nextRow)}
                    onDelete={() => deleteRow("nonApportionableRows", row.id)}
                  />
                ))}
                <tr>
                  <td style={{ ...pageStyles.td, fontWeight: 900 }}>Summe intern</td>
                  <td style={pageStyles.td} />
                  <td style={pageStyles.td} />
                  <td style={pageStyles.td} />
                  <td style={pageStyles.td} />
                  <td style={{ ...pageStyles.td, ...pageStyles.amountCell }}>{formatCurrency(nonApportionableTotal)}</td>
                  <td style={pageStyles.td} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={pageStyles.section}>
        <div style={pageStyles.sectionHeader}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Onepager für Mieter</h2>
            <div style={pageStyles.mutedText}>Nur die umlagefähigen Kosten und das Ergebnis werden für den Weiterleitungs-Onepager dargestellt.</div>
          </div>
          <button type="button" style={pageStyles.primaryButton} onClick={openPrintPreview}>
            Onepager drucken / als PDF speichern
          </button>
        </div>
        <div style={pageStyles.sectionBody}>
          <div id="tg-onepager-preview" style={pageStyles.onePager}>
            <h2 style={pageStyles.onePagerTitle}>Nebenkostenabrechnung Tiefgaragenstellplatz {activeRecord.year}</h2>
            <p style={pageStyles.onePagerSubTitle}>
              {activeRecord.propertyLabel} · {activeRecord.unitLabel} · Zeitraum {formatDate(activeRecord.periodFrom)} bis {formatDate(activeRecord.periodTo)}
            </p>

            <div style={pageStyles.onePagerMeta}>
              <div style={pageStyles.onePagerBox}>
                <div style={pageStyles.summaryLabel}>Vermieter</div>
                <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#0f172a" }}>
                  {activeRecord.landlordName || "—"}
                  {activeRecord.landlordAddress ? `\n${activeRecord.landlordAddress}` : ""}
                </div>
              </div>
              <div style={pageStyles.onePagerBox}>
                <div style={pageStyles.summaryLabel}>Mieter</div>
                <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#0f172a" }}>
                  {activeRecord.tenantName || "—"}
                  {activeRecord.tenantAddress ? `\n${activeRecord.tenantAddress}` : ""}
                </div>
              </div>
            </div>

            <table style={pageStyles.onePagerTable}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Kostenart</th>
                  <th style={{ ...pageStyles.th, textAlign: "right" }}>Ihr Anteil</th>
                </tr>
              </thead>
              <tbody>
                {apportionableRows.map((row) => (
                  <tr key={row.id}>
                    <td style={pageStyles.td}>{row.label}</td>
                    <td style={{ ...pageStyles.td, textAlign: "right", ...pageStyles.amountCell }}>
                      {formatCurrency(deriveRowShare(row, activeRecord))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...pageStyles.td, fontWeight: 900 }}>Summe umlagefähige Kosten</td>
                  <td style={{ ...pageStyles.td, textAlign: "right", ...pageStyles.amountCell }}>{formatCurrency(apportionableTotal)}</td>
                </tr>
                <tr>
                  <td style={pageStyles.td}>Abzüglich geleistete Vorauszahlungen</td>
                  <td style={{ ...pageStyles.td, textAlign: "right", ...pageStyles.amountCell }}>{formatCurrency(activeRecord.tenantPrepayments)}</td>
                </tr>
                <tr>
                  <td style={{ ...pageStyles.td, fontWeight: 900 }}>{settlementBalance >= 0 ? "Nachzahlung" : "Guthaben"}</td>
                  <td
                    style={{
                      ...pageStyles.td,
                      textAlign: "right",
                      ...pageStyles.amountCell,
                      color: settlementBalance >= 0 ? "#b91c1c" : "#166534",
                    }}
                  >
                    {formatCurrency(Math.abs(settlementBalance))}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={pageStyles.onePagerFooter}>
              <div>
                Die Abrechnung basiert auf dem Zeitraum vom {formatDate(activeRecord.periodFrom)} bis {formatDate(activeRecord.periodTo)}.
                Das monatliche Hausgeld beträgt {formatCurrency(activeRecord.monthlyHausgeld)} und ergibt im Abrechnungszeitraum eine Jahressumme von {formatCurrency(annualHausgeld)}.
              </div>
              {activeRecord.footerNote ? <div style={{ marginTop: 14 }}>{activeRecord.footerNote}</div> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
