import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

type EntryType = "income" | "expense";
type TypeFilter = "all" | EntryType;

type EntryRow = {
  id: number;
  objekt_code: string | null;
  booking_date: string;
  amount: number;
  category: string | null;
  note: string | null;
  entry_type: EntryType;
};

type DropdownRow = {
  objekt_code: string;
  label: string;
};

type SortKey = "booking_date" | "objekt_code" | "entry_type" | "category" | "amount";
type SortDirection = "asc" | "desc";

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

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRangeISO(year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function yearRangeISO(year: number) {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function parseNumberInput(raw: string): number {
  const normalized = raw.replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function compareStrings(a: string, b: string, direction: SortDirection) {
  const result = a.localeCompare(b, "de", { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function compareNumbers(a: number, b: number, direction: SortDirection) {
  const result = a - b;
  return direction === "asc" ? result : -result;
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);

  if (
    stringValue.includes(";") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  const headerLine = headers.map(escapeCsvValue).join(";");
  const dataLines = rows.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(";"));
  return [headerLine, ...dataLines].join("\n");
}

function downloadCsv(filename: string, csvContent: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^\wäöüÄÖÜß-]+/g, "_");
}

function rowSelectionKey(row: EntryRow) {
  return `${row.entry_type}-${row.id}`;
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
  const isNegative = value < 0;

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
      <div
        style={{
          fontSize: 17,
          fontWeight: 900,
          marginTop: 6,
          color: title === "Netto" ? (isNegative ? "#991b1b" : "#166534") : undefined,
        }}
      >
        {loading ? "…" : formatEUR(value)}
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
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
          <div style={{ fontWeight: 900, fontSize: 17 }}>{title}</div>
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

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onClick: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  const arrow = isActive ? (direction === "asc" ? " ▲" : " ▼") : "";

  return (
    <th
      onClick={() => onClick(sortKey)}
      style={{
        textAlign: align,
        padding: 10,
        fontSize: 12,
        opacity: 0.85,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      title="Sortieren"
    >
      {label}
      {arrow}
    </th>
  );
}

export default function Monate() {
  const now = new Date();

  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [objects, setObjects] = useState<DropdownRow[]>([]);
  const [objektCode, setObjektCode] = useState<string>("ALL");

  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("booking_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<EntryRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [editType, setEditType] = useState<EntryType>("income");
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  const [editCategoryMode, setEditCategoryMode] = useState<"existing" | "new">("existing");
  const [editCategorySelect, setEditCategorySelect] = useState("");
  const [editCategoryCustom, setEditCategoryCustom] = useState("");

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

        const list = ((data ?? []).filter(
          (x: any) => x?.objekt_code && x?.label
        ) as DropdownRow[]).sort((a, b) => a.label.localeCompare(b.label, "de"));

        setObjects(list);
      } catch (e) {
        console.error("Dropdown load exception:", e);
        if (!alive) return;
        setObjects([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const objectLabelMap = useMemo(() => {
    return new Map(objects.map((o) => [o.objekt_code, o.label]));
  }, [objects]);

  async function fetchEntriesForRange(from: string, to: string, code: string) {
    let incomeQuery = supabase
      .from("v_income_entries")
      .select("id,objekt_code,booking_date,amount,category,note")
      .gte("booking_date", from)
      .lt("booking_date", to);

    let expenseQuery = supabase
      .from("v_expense_entries")
      .select("id,objekt_code,booking_date,amount,category,note")
      .gte("booking_date", from)
      .lt("booking_date", to);

    if (code && code !== "ALL") {
      incomeQuery = incomeQuery.eq("objekt_code", code);
      expenseQuery = expenseQuery.eq("objekt_code", code);
    }

    const [incRes, expRes] = await Promise.all([incomeQuery, expenseQuery]);

    if (incRes.error) throw incRes.error;
    if (expRes.error) throw expRes.error;

    const income: EntryRow[] = (incRes.data ?? []).map((r: any) => ({
      id: Number(r.id),
      objekt_code: r.objekt_code ?? null,
      booking_date: r.booking_date,
      amount: Number(r.amount || 0),
      category: r.category ?? null,
      note: r.note ?? null,
      entry_type: "income",
    }));

    const expense: EntryRow[] = (expRes.data ?? []).map((r: any) => ({
      id: Number(r.id),
      objekt_code: r.objekt_code ?? null,
      booking_date: r.booking_date,
      amount: Number(r.amount || 0),
      category: r.category ?? null,
      note: r.note ?? null,
      entry_type: "expense",
    }));

    return [...income, ...expense];
  }

  async function loadMonth() {
    setLoading(true);
    setErr(null);

    if (!Number.isFinite(year) || year < 1900 || year > 3000) {
      setRows([]);
      setErr("Bitte ein gültiges Jahr eingeben.");
      setLoading(false);
      return;
    }

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      setRows([]);
      setErr("Bitte einen gültigen Monat auswählen.");
      setLoading(false);
      return;
    }

    const { from, to } = monthRangeISO(year, month);
    const code = objektCode.trim();

    try {
      const data = await fetchEntriesForRange(from, to, code);
      setRows(data);
    } catch (e: any) {
      console.error("loadMonth failed:", e);
      setRows([]);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objektCode, year, month]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => (r.category?.trim() ? r.category.trim() : "Ohne Kategorie"))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      const category = r.category?.trim() || "Ohne Kategorie";
      const note = r.note?.trim() || "";
      const objectCode = r.objekt_code?.trim() || "";
      const objectLabel = objectLabelMap.get(objectCode)?.trim() || "";
      const typeLabel = r.entry_type === "income" ? "einnahme" : "ausgabe";

      const matchesType = typeFilter === "all" ? true : r.entry_type === typeFilter;
      const matchesCategory = categoryFilter === "ALL" ? true : category === categoryFilter;

      const matchesSearch =
        !q ||
        category.toLowerCase().includes(q) ||
        note.toLowerCase().includes(q) ||
        objectCode.toLowerCase().includes(q) ||
        objectLabel.toLowerCase().includes(q) ||
        typeLabel.includes(q) ||
        r.booking_date.includes(q);

      return matchesType && matchesCategory && matchesSearch;
    });
  }, [rows, search, typeFilter, categoryFilter, objectLabelMap]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];

    list.sort((a, b) => {
      switch (sortKey) {
        case "booking_date":
          return compareStrings(a.booking_date, b.booking_date, sortDirection);

        case "objekt_code": {
          const aLabel = objectLabelMap.get(a.objekt_code ?? "") ?? a.objekt_code ?? "";
          const bLabel = objectLabelMap.get(b.objekt_code ?? "") ?? b.objekt_code ?? "";
          return compareStrings(aLabel, bLabel, sortDirection);
        }

        case "entry_type": {
          const aLabel = a.entry_type === "income" ? "Einnahme" : "Ausgabe";
          const bLabel = b.entry_type === "income" ? "Einnahme" : "Ausgabe";
          return compareStrings(aLabel, bLabel, sortDirection);
        }

        case "category":
          return compareStrings(
            a.category?.trim() || "Ohne Kategorie",
            b.category?.trim() || "Ohne Kategorie",
            sortDirection
          );

        case "amount":
          return compareNumbers(a.amount, b.amount, sortDirection);

        default:
          return 0;
      }
    });

    return list;
  }, [filteredRows, sortKey, sortDirection, objectLabelMap]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, categoryFilter, objektCode, year, month, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedRows.slice(start, end);
  }, [sortedRows, currentPage, pageSize]);

  const pageStart = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = sortedRows.length === 0 ? 0 : Math.min(currentPage * pageSize, sortedRows.length);

  const visiblePageKeys = useMemo(() => paginatedRows.map((r) => rowSelectionKey(r)), [paginatedRows]);

  const allVisibleSelected =
    visiblePageKeys.length > 0 && visiblePageKeys.every((key) => selectedKeys.includes(key));

  const someVisibleSelected =
    visiblePageKeys.some((key) => selectedKeys.includes(key)) && !allVisibleSelected;

  useEffect(() => {
    const validKeys = new Set(sortedRows.map((r) => rowSelectionKey(r)));
    setSelectedKeys((prev) => prev.filter((key) => validKeys.has(key)));
  }, [sortedRows]);

  const totals = useMemo(() => {
    const income = sortedRows
      .filter((r) => r.entry_type === "income")
      .reduce((sum, r) => sum + r.amount, 0);

    const expense = sortedRows
      .filter((r) => r.entry_type === "expense")
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [sortedRows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);

    if (key === "booking_date" || key === "amount") {
      setSortDirection("desc");
    } else {
      setSortDirection("asc");
    }
  }

  function toggleRowSelection(row: EntryRow) {
    const key = rowSelectionKey(row);
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  function toggleSelectVisibleRows() {
    if (allVisibleSelected) {
      setSelectedKeys((prev) => prev.filter((key) => !visiblePageKeys.includes(key)));
      return;
    }

    setSelectedKeys((prev) => Array.from(new Set([...prev, ...visiblePageKeys])));
  }

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

  async function deleteSelectedEntries() {
    if (selectedKeys.length === 0) return;

    const selectedIds = Array.from(
      new Set(
        selectedKeys
          .map((key) => {
            const parts = key.split("-");
            const id = Number(parts[1]);
            return Number.isFinite(id) ? id : null;
          })
          .filter((id): id is number => id !== null)
      )
    );

    if (selectedIds.length === 0) {
      alert("Keine gültigen Einträge ausgewählt.");
      return;
    }

    const ok = window.confirm(
      `Wirklich ${selectedIds.length} ausgewählte Buchung${selectedIds.length === 1 ? "" : "en"} löschen?`
    );
    if (!ok) return;

    setBulkDeleting(true);

    try {
      const { error } = await supabase.from("finance_entry").delete().in("id", selectedIds);

      if (error) throw error;

      setSelectedKeys([]);
      await loadMonth();
    } catch (e: any) {
      alert(`Batch Delete fehlgeschlagen: ${e?.message ?? String(e)}`);
    } finally {
      setBulkDeleting(false);
    }
  }

  function openEdit(row: EntryRow) {
    const rawCategory = row.category?.trim() ?? "";
    const normalizedCategory = rawCategory || "Ohne Kategorie";

    setEditRow(row);
    setEditType(row.entry_type);
    setEditDate(row.booking_date);
    setEditAmount(String(row.amount));
    setEditNote(row.note ?? "");

    if (!rawCategory) {
      setEditCategoryMode("existing");
      setEditCategorySelect("Ohne Kategorie");
      setEditCategoryCustom("");
    } else if (categories.includes(normalizedCategory)) {
      setEditCategoryMode("existing");
      setEditCategorySelect(normalizedCategory);
      setEditCategoryCustom("");
    } else {
      setEditCategoryMode("new");
      setEditCategorySelect("__NEW__");
      setEditCategoryCustom(rawCategory);
    }

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

    if (editCategoryMode === "new" && !editCategoryCustom.trim()) {
      alert("Bitte eine neue Kategorie eingeben.");
      return;
    }

    const resolvedCategory =
      editCategoryMode === "new"
        ? editCategoryCustom.trim()
        : editCategorySelect === "Ohne Kategorie"
        ? ""
        : editCategorySelect.trim();

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
        category: resolvedCategory || null,
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

  async function exportYearCsv() {
    if (!Number.isFinite(year) || year < 1900 || year > 3000) {
      alert("Bitte ein gültiges Jahr eingeben.");
      return;
    }

    const code = objektCode.trim();
    const { from, to } = yearRangeISO(year);

    try {
      setLoading(true);
      const exportRowsRaw = await fetchEntriesForRange(from, to, code);
      const exportRows = exportRowsRaw
        .sort((a, b) => compareStrings(a.booking_date, b.booking_date, "asc"))
        .map((r) => {
          const objectCode = r.objekt_code ?? "";
          const objectLabel = objectCode ? objectLabelMap.get(objectCode) ?? objectCode : "—";
          const signedAmount = r.entry_type === "expense" ? -Math.abs(r.amount) : Math.abs(r.amount);

          return {
            Datum: formatDate(r.booking_date),
            Objekt: objectLabel,
            Objektcode: objectCode || "—",
            Typ: r.entry_type === "income" ? "Einnahme" : "Ausgabe",
            Kategorie: r.category?.trim() || "Ohne Kategorie",
            Betrag: signedAmount.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            Notiz: r.note?.trim() || "",
          };
        });

      const headers = ["Datum", "Objekt", "Objektcode", "Typ", "Kategorie", "Betrag", "Notiz"];
      const csv = toCsv(exportRows, headers);
      const objectPart = code && code !== "ALL" ? `${sanitizeFilenamePart(code)}_` : "alle_objekte_";
      const filename = `jahresuebersicht_${objectPart}${year}.csv`;
      downloadCsv(filename, csv);
    } catch (e: any) {
      alert(`Jahres-CSV fehlgeschlagen: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const exportRows = sortedRows.map((r) => {
      const objectCode = r.objekt_code ?? "";
      const objectLabel = objectCode ? objectLabelMap.get(objectCode) ?? objectCode : "—";
      const signedAmount = r.entry_type === "expense" ? -Math.abs(r.amount) : Math.abs(r.amount);

      return {
        Datum: formatDate(r.booking_date),
        Objekt: objectLabel,
        Objektcode: objectCode || "—",
        Typ: r.entry_type === "income" ? "Einnahme" : "Ausgabe",
        Kategorie: r.category?.trim() || "Ohne Kategorie",
        Betrag: signedAmount.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        Notiz: r.note?.trim() || "",
      };
    });

    const headers = ["Datum", "Objekt", "Objektcode", "Typ", "Kategorie", "Betrag", "Notiz"];
    const csv = toCsv(exportRows, headers);

    const monthPart = String(month).padStart(2, "0");
    const objectPart =
      objektCode !== "ALL" ? `${sanitizeFilenamePart(objektCode)}_` : "alle_objekte_";

    const filename = `monatsuebersicht_${objectPart}${year}_${monthPart}.csv`;

    downloadCsv(filename, csv);
  }

  const monthLabel = MONTHS.find((x) => x.m === month)?.label ?? String(month);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>
            Monate
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Monatsübersicht aller Buchungen mit Filtern, Sortierung, Bearbeiten, Löschen, CSV-Export, Pagination, Batch Delete und smarter Kategorienbearbeitung.
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            background: "white",
            padding: 16,
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              alignItems: "end",
            }}
          >
            <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, display: "grid", gap: 6 }}>
              Objekt
              <select
                value={objektCode}
                onChange={(e) => setObjektCode(e.target.value)}
                style={{
                  width: "100%",
                  height: 46,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
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

            <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, display: "grid", gap: 6 }}>
              Jahr
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{
                  width: "100%",
                  height: 46,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                  background: "white",
                }}
              />
            </label>

            <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, display: "grid", gap: 6 }}>
              Monat
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                style={{
                  width: "100%",
                  height: 46,
                  padding: "0 14px",
                  borderRadius: 12,
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
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={() => void loadMonth()}
              disabled={loading}
              style={{
                minHeight: 46,
                padding: "0 18px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: loading ? "#f3f4f6" : "white",
                fontWeight: 900,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Neu laden
            </button>

            <button
              onClick={exportCsv}
              disabled={loading || sortedRows.length === 0}
              style={{
                minHeight: 46,
                padding: "0 18px",
                borderRadius: 12,
                border: "1px solid #c7d2fe",
                background: loading || sortedRows.length === 0 ? "#eef2ff" : "#eef2ff",
                color: loading || sortedRows.length === 0 ? "#6366f1" : "#4338ca",
                fontWeight: 900,
                cursor: loading || sortedRows.length === 0 ? "not-allowed" : "pointer",
              }}
              title="Aktuell gefilterte und sortierte Monatstabelle als CSV exportieren"
            >
              Monats-CSV exportieren
            </button>

            <button
              onClick={() => void exportYearCsv()}
              disabled={loading}
              style={{
                minHeight: 46,
                padding: "0 18px",
                borderRadius: 12,
                border: "1px solid #0f172a",
                background: loading ? "#e2e8f0" : "#0f172a",
                color: loading ? "#64748b" : "white",
                fontWeight: 900,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              title={objektCode === "ALL" ? "CSV für alle Objekte des gewählten Jahres exportieren" : "CSV für das gewählte Objekt im ganzen Jahr exportieren"}
            >
              Jahres-CSV exportieren
            </button>
          </div>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard title="Einnahmen" value={totals.income} loading={loading} />
        <StatCard title="Ausgaben" value={totals.expense} loading={loading} />
        <StatCard title="Netto" value={totals.net} loading={loading} />
      </div>

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

        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            background: "#fcfcfd",
          }}
        >
          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Suche
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kategorie, Notiz, Objekt, Typ, Datum"
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 700,
              }}
            />
          </label>

          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Typ
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 700,
                background: "white",
              }}
            >
              <option value="all">Alle Typen</option>
              <option value="income">Nur Einnahmen</option>
              <option value="expense">Nur Ausgaben</option>
            </select>
          </label>

          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Kategorie
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 700,
                background: "white",
              }}
            >
              <option value="ALL">Alle Kategorien</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
            Zeilen pro Seite
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontWeight: 700,
                background: "white",
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #e5e7eb",
            fontSize: 12,
            opacity: 0.75,
            fontWeight: 800,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span>Treffer: {sortedRows.length}</span>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              Anzeige: {pageStart}–{pageEnd} von {sortedRows.length}
            </span>

            <button
              onClick={() => void deleteSelectedEntries()}
              disabled={selectedKeys.length === 0 || bulkDeleting}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background:
                  selectedKeys.length === 0 || bulkDeleting ? "#f3f4f6" : "white",
                fontWeight: 900,
                cursor:
                  selectedKeys.length === 0 || bulkDeleting ? "not-allowed" : "pointer",
              }}
              title="Alle ausgewählten Buchungen löschen"
            >
              {bulkDeleting
                ? "Löscht…"
                : `Auswahl löschen${selectedKeys.length > 0 ? ` (${selectedKeys.length})` : ""}`}
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: 10, width: 42, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected;
                    }}
                    onChange={toggleSelectVisibleRows}
                    title="Alle sichtbaren Zeilen auswählen"
                  />
                </th>

                <SortableHeader
                  label="Datum"
                  sortKey="booking_date"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onClick={toggleSort}
                />
                <SortableHeader
                  label="Objekt"
                  sortKey="objekt_code"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onClick={toggleSort}
                />
                <SortableHeader
                  label="Typ"
                  sortKey="entry_type"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onClick={toggleSort}
                />
                <SortableHeader
                  label="Kategorie"
                  sortKey="category"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onClick={toggleSort}
                />
                <SortableHeader
                  label="Betrag"
                  sortKey="amount"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onClick={toggleSort}
                  align="right"
                />
                <th style={{ textAlign: "left", padding: 10, fontSize: 12, opacity: 0.75 }}>
                  Notiz
                </th>
                <th style={{ padding: 10, width: 140 }} />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                    Lädt…
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                    Keine Einträge für die aktuelle Filterung.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const isIncome = r.entry_type === "income";
                  const objectCode = r.objekt_code ?? "";
                  const objectLabel = objectCode ? objectLabelMap.get(objectCode) ?? objectCode : "—";
                  const key = rowSelectionKey(r);
                  const checked = selectedKeys.includes(key);

                  return (
                    <tr key={key} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 10, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRowSelection(r)}
                          title="Zeile auswählen"
                        />
                      </td>

                      <td style={{ padding: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                        {formatDate(r.booking_date)}
                      </td>

                      <td style={{ padding: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {objectLabel}
                      </td>

                      <td style={{ padding: 10, whiteSpace: "nowrap" }}>
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

                      <td style={{ padding: 10 }}>
                        {r.category?.trim() || "Ohne Kategorie"}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          textAlign: "right",
                          fontWeight: 900,
                          color: isIncome ? "#166534" : "#991b1b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isIncome ? formatEUR(r.amount) : `-${formatEUR(r.amount)}`}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          opacity: r.note ? 0.9 : 0.6,
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={r.note ?? ""}
                      >
                        {r.note?.trim() || "—"}
                      </td>

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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderTop: "1px solid #e5e7eb",
            flexWrap: "wrap",
            background: "#fcfcfd",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
            Seite {currentPage} von {totalPages}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: currentPage <= 1 ? "#f3f4f6" : "white",
                fontWeight: 900,
                cursor: currentPage <= 1 ? "not-allowed" : "pointer",
              }}
            >
              Zurück
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: currentPage >= totalPages ? "#f3f4f6" : "white",
                fontWeight: 900,
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
              }}
            >
              Weiter
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={editOpen}
        title={editRow ? `Buchung bearbeiten (#${editRow.id})` : "Buchung bearbeiten"}
        onClose={() => {
          if (editSaving) return;
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
                placeholder="z. B. 123,45"
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

            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                Kategorie
                <select
                  value={editCategoryMode === "new" ? "__NEW__" : editCategorySelect}
                  onChange={(e) => {
                    const value = e.target.value;

                    if (value === "__NEW__") {
                      setEditCategoryMode("new");
                      setEditCategorySelect("__NEW__");
                      setEditCategoryCustom("");
                      return;
                    }

                    setEditCategoryMode("existing");
                    setEditCategorySelect(value);
                    setEditCategoryCustom("");
                  }}
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
                  <option value="Ohne Kategorie">Ohne Kategorie</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="__NEW__">Neue Kategorie…</option>
                </select>
              </label>

              {editCategoryMode === "new" && (
                <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                  Neue Kategorie
                  <input
                    value={editCategoryCustom}
                    onChange={(e) => setEditCategoryCustom(e.target.value)}
                    placeholder="Neue Kategorie eingeben"
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
              )}
            </div>
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
                if (editSaving) return;
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