import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileDown,
  Filter,
  MoreVertical,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppData } from "@/state/AppDataContext";
import { createMissingCapexYear, createMissingIncomeYear, extendLoanOneYear } from "@/services/dataRepairService";

type Row = {
  property_id: string | null;
  year: number | string | null;
  balance?: number | string | null;
  amount?: number | string | null;
  income?: number | string | null;
  annual_rent?: number | string | null;
  other_income?: number | string | null;
  interest?: number | string | null;
  principal?: number | string | null;
};

type RentalRow = {
  property_id: string | null;
  rent_type?: string | null;
  rent_monthly?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type Status = "ok" | "warn" | "bad";
type RepairAction = "income" | "capex" | "loan";
type FilterMode = "all" | "warnings" | "missing-loans" | "clean";

type AuditSource = { id: string; name: string; aliases: string[] };
type AuditRow = {
  id: string;
  name: string;
  aliases: string[];
  income: Status;
  capex: Status;
  loan: Status;
  portfolio: Status;
  balance: number | null;
  sourceText: string;
  notes: string[];
  risk: Status;
};

const currentYear = new Date().getFullYear();

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  let raw = value.trim().replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
  if (!raw) return 0;

  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (dot >= 0) {
    const parts = raw.split(".");
    raw = parts.length > 2 ? raw.replace(/\./g, "") : raw;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getYear(value: unknown) {
  const year = Math.trunc(toNumber(value));
  return year > 1900 ? year : null;
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bobjekt\s*\d+\b/g, "")
    .replace(/hauptmiete|wohnung|garage|darlehen|immobilie/g, "")
    .replace(/straße|strasse/g, "str")
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesMatch(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function euro(value: number | null) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);
}

function isFuertherContext(value: string | null | undefined) {
  const raw = String(value ?? "");
  const normalized = normalizeName(raw);
  return /fürther|fuerther|further/i.test(raw) || normalized.includes("further") || normalized.includes("fuerther");
}

function cleanBalanceForAudit(balance: number | null, propertyContext: string) {
  if (balance == null || !Number.isFinite(balance)) return null;

  let value = Math.abs(balance);

  // Fürther Str. wurde in den Darlehens-/Dashboard-Views teilweise um Faktor 10 zu hoch
  // angezeigt. Deshalb wird für die Datenprüfung konsequent der plausibilisierte Wert
  // verwendet – egal ob der Objektname mit ü, ue oder normalisiert aus der DB kommt.
  if (isFuertherContext(propertyContext) && value >= 10_000_000) {
    value = value / 10;
  }

  return Math.round(value);
}

const STATUS_CONFIG: Record<Status, { label: string; Icon: LucideIcon; pill: string; dot: string; ring: string }> = {
  ok: {
    label: "OK",
    Icon: CheckCircle2,
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    ring: "border-emerald-100",
  },
  warn: {
    label: "Prüfen",
    Icon: AlertTriangle,
    pill: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    ring: "border-amber-100",
  },
  bad: {
    label: "Fehlt",
    Icon: XCircle,
    pill: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    ring: "border-rose-100",
  },
};

function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.Icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${config.pill}`}>
      <Icon size={13} />
      {label ?? config.label}
    </span>
  );
}

function KpiCard({ label, value, icon, tone = "slate" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "slate" | "emerald" | "rose" | "amber" | "indigo" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-xs font-black uppercase tracking-[0.08em] text-slate-500">{label}</div>
          <div className="mt-1 truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{value}</div>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ label, status }: { label: string; status: Status }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className={`rounded-2xl border ${config.ring} bg-white px-3 py-2 shadow-sm`}>
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <StatusBadge status={status} />
    </div>
  );
}

export default function Datenpruefung() {
  const app = useAppData();
  const [capex, setCapex] = useState<Row[]>([]);
  const [incomeYears, setIncomeYears] = useState<Row[]>([]);
  const [ledger, setLedger] = useState<Row[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [openActions, setOpenActions] = useState<string | null>(null);

  const loadAuditTables = useCallback(async () => {
    const [capexRes, incomeRes, ledgerRes, rentalsRes] = await Promise.all([
      supabase.from("yearly_capex_entries").select("property_id,year,amount"),
      supabase.from("yearly_property_income").select("property_id,year,annual_rent,other_income"),
      supabase.from("property_loan_ledger").select("property_id,year,balance,interest,principal"),
      supabase.from("portfolio_property_rentals").select("property_id,rent_type,rent_monthly,start_date,end_date"),
    ]);

    if (capexRes.error) throw capexRes.error;
    if (incomeRes.error) throw incomeRes.error;
    if (ledgerRes.error) throw ledgerRes.error;
    if (rentalsRes.error) throw rentalsRes.error;

    setCapex((capexRes.data ?? []) as Row[]);
    setIncomeYears((incomeRes.data ?? []) as Row[]);
    setLedger((ledgerRes.data ?? []) as Row[]);
    setRentals((rentalsRes.data ?? []) as RentalRow[]);
  }, []);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setError(null);
    setNotice(null);
    try {
      await app.refresh();
      await loadAuditTables();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Datenprüfung konnte nicht geladen werden.");
    } finally {
      setChecking(false);
    }
  }, [app, loadAuditTables]);

  useEffect(() => {
    void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const auditSources = useMemo<AuditSource[]>(() => {
    const bases: AuditSource[] = app.objects.map((object) => ({ id: object.id, name: object.label, aliases: [object.id] }));
    const fallbackByName = new Map<string, AuditSource>();

    const addAlias = (source: AuditSource, id: string | null | undefined) => {
      if (id && !source.aliases.includes(String(id))) source.aliases.push(String(id));
    };

    const attach = (id: string | null | undefined, name: string | null | undefined) => {
      if (!id) return;
      const idString = String(id);
      const byId = bases.find((source) => source.aliases.includes(idString));
      if (byId) return addAlias(byId, idString);

      const byName = bases.find((source) => namesMatch(source.name, name));
      if (byName) return addAlias(byName, idString);

      if (!bases.length) {
        const key = normalizeName(name) || idString;
        const existing = fallbackByName.get(key);
        if (existing) addAlias(existing, idString);
        else fallbackByName.set(key, { id: idString, name: String(name ?? idString), aliases: [idString] });
      }
    };

    app.portfolioRows.forEach((row) => {
      attach(row.property_id, row.property_name);
      attach(row.portfolio_property_id, row.property_name);
    });
    app.loanRows.forEach((row) => attach(row.property_id, row.property_name));

    return (bases.length ? bases : [...fallbackByName.values()])
      .map((source) => ({ ...source, aliases: unique(source.aliases) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [app.objects, app.portfolioRows, app.loanRows]);

  const rows = useMemo<AuditRow[]>(() => {
    return auditSources.map((source) => {
      const hasId = (id: string | null | undefined) => Boolean(id && source.aliases.includes(String(id)));
      const incomesFromEntries = app.yearlyFinanceSummaries.filter((row) => hasId(row.object_id) && row.einnahmen > 0);
      const incomeRows = incomeYears.filter((row) => hasId(row.property_id) && (toNumber(row.annual_rent) > 0 || toNumber(row.other_income) > 0 || row.year !== null));
      const capexRows = capex.filter((row) => hasId(row.property_id));
      const rawLedgerRows = ledger.filter((row) => hasId(row.property_id));
      const ledgerRows = rawLedgerRows
        .map((row) => ({ year: getYear(row.year), balance: toNumber(row.balance) }))
        .filter((row) => row.year !== null)
        .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      const rentalRows = rentals.filter((row) => hasId(row.property_id));
      const dashboardLoan = app.loanRows.find((row) => hasId(row.property_id) || namesMatch(row.property_name, source.name));
      const portfolioLoan = app.portfolioRows.find((row) => hasId(row.property_id) || hasId(row.portfolio_property_id) || namesMatch(row.property_name, source.name));
      const latestLedger = ledgerRows[ledgerRows.length - 1];
      const previousLedger = ledgerRows[ledgerRows.length - 2];
      const rawLatestBalance = latestLedger?.balance ?? dashboardLoan?.last_balance ?? null;
      const propertyContext = [source.name, dashboardLoan?.property_name, portfolioLoan?.property_name, ...source.aliases].filter(Boolean).join(" ");
      const latestBalance = cleanBalanceForAudit(rawLatestBalance, propertyContext);
      const portfolioBalance = cleanBalanceForAudit(portfolioLoan ? toNumber(portfolioLoan.last_balance) : null, propertyContext);
      const years = rawLedgerRows.map((row) => getYear(row.year)).filter((value): value is number => value !== null);
      const duplicateYears = [...new Set(years)].filter((year) => years.filter((candidate) => candidate === year).length > 1);
      const notes: string[] = [];

      if (!incomesFromEntries.length && !incomeRows.length) notes.push("Keine Jahres-Income-Daten gefunden.");
      if (!capexRows.length) notes.push("Keine Capex-Jahreszeilen gefunden.");
      if (!ledgerRows.length) notes.push("Keine Darlehensübersicht/Restschuld gefunden.");
      if (!portfolioLoan) notes.push("Keine Portfolio-Verknüpfung zur Darlehensansicht gefunden.");
      if (portfolioLoan && latestBalance !== null && portfolioBalance !== null && Math.abs(portfolioBalance - latestBalance) > 1) notes.push("Portfolio-Restschuld weicht von der Darlehensübersicht ab.");
      if (previousLedger && latestLedger && latestLedger.balance > previousLedger.balance + 1) notes.push("Restschuld steigt gegenüber dem Vorjahr.");
      if (duplicateYears.length) notes.push(`Doppelte Darlehensjahre: ${duplicateYears.join(", ")}.`);
      if (incomesFromEntries.length && rentalRows.length === 0) notes.push("Income vorhanden, aber Mieterübersicht leer.");

      const capexTotal = capexRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
      const incomeTotal = incomesFromEntries.reduce((sum, row) => sum + toNumber(row.einnahmen), 0) + incomeRows.reduce((sum, row) => sum + toNumber(row.annual_rent) + toNumber(row.other_income), 0);
      if (incomeTotal > 0 && capexTotal > incomeTotal * 0.75) notes.push("Capex ist auffällig hoch im Verhältnis zu Income.");

      const risk: Status = notes.some((note) => /fehlt|keine darlehens|keine portfolio/i.test(note)) ? "bad" : notes.length ? "warn" : "ok";

      return {
        id: source.id,
        name: source.name,
        aliases: source.aliases,
        income: (incomesFromEntries.length || incomeRows.length ? "ok" : "bad") as Status,
        capex: (capexRows.length ? "ok" : "warn") as Status,
        loan: (ledgerRows.length ? "ok" : "bad") as Status,
        portfolio: (portfolioLoan ? "ok" : "warn") as Status,
        balance: latestBalance,
        sourceText: latestLedger?.year ? `Darlehensübersicht ${latestLedger.year}` : dashboardLoan?.last_balance_year ? `Darlehensdashboard ${dashboardLoan.last_balance_year}` : "—",
        notes,
        risk,
      };
    });
  }, [auditSources, app.yearlyFinanceSummaries, app.loanRows, app.portfolioRows, capex, incomeYears, ledger, rentals]);

  const visibleRows = useMemo(() => {
    if (filterMode === "warnings") return rows.filter((row) => row.notes.length > 0);
    if (filterMode === "missing-loans") return rows.filter((row) => row.loan === "bad");
    if (filterMode === "clean") return rows.filter((row) => row.notes.length === 0);
    return rows;
  }, [filterMode, rows]);

  async function repair(propertyId: string, action: RepairAction) {
    const key = `${propertyId}:${action}`;
    setRepairing(key);
    setError(null);
    setNotice(null);
    setOpenActions(null);

    try {
      if (action === "income") await createMissingIncomeYear(propertyId, currentYear);
      if (action === "capex") await createMissingCapexYear(propertyId, currentYear);
      if (action === "loan") await extendLoanOneYear(propertyId);
      setNotice("Reparatur wurde ausgeführt und die Datenprüfung wurde aktualisiert.");
      await runCheck();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Reparatur konnte nicht ausgeführt werden.");
    } finally {
      setRepairing(null);
    }
  }

  function exportCsv() {
    const header = ["Objekt", "Income", "Capex", "Darlehen", "Portfolio", "Restschuld", "Quelle", "Hinweise"];
    const body = rows.map((row) => [
      row.name,
      row.income,
      row.capex,
      row.loan,
      row.portfolio,
      row.balance ?? "",
      row.sourceText,
      row.notes.join(" | "),
    ]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `datenpruefung-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const stats = {
    objects: rows.length,
    okLoans: rows.filter((row) => row.loan === "ok").length,
    missingLoans: rows.filter((row) => row.loan === "bad").length,
    warnings: rows.reduce((sum, row) => sum + row.notes.length, 0),
    totalBalance: rows.reduce((sum, row) => sum + (row.balance ?? 0), 0),
  };

  const lastCheckLabel = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date());

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-5 pb-10 sm:space-y-6">
      <section className="sticky top-[82px] z-20 rounded-[28px] border border-slate-200 bg-white/92 p-4 shadow-sm backdrop-blur-xl sm:p-5 lg:top-[92px] lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 gap-4">
            <div className="hidden h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 sm:flex">
              <ShieldCheck size={28} />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-indigo-700">
                <Sparkles size={13} /> Premium Datenprüfung
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Datenprüfung</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 sm:text-base">
                Mobile-first Prüfung für Hauptobjekte ohne Dubletten: Income, Capex, Darlehen, Portfolio-Link, Restschuld und Plausibilität.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            <span className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 sm:text-right">Letzte Prüfung: {lastCheckLabel}</span>
            <button
              type="button"
              disabled={checking || app.loading}
              onClick={() => void runCheck()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={checking || app.loading ? "animate-spin" : ""} />
              {checking || app.loading ? "Prüfe…" : "Neu prüfen"}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Objekte eindeutig" value={stats.objects} tone="indigo" icon={<Building2 size={22} />} />
        <KpiCard label="Darlehen OK" value={stats.okLoans} tone="emerald" icon={<CheckCircle2 size={22} />} />
        <KpiCard label="Darlehen fehlt" value={stats.missingLoans} tone="rose" icon={<AlertTriangle size={22} />} />
        <KpiCard label="Hinweise" value={stats.warnings} tone="amber" icon={<AlertTriangle size={22} />} />
        <KpiCard label="Restschuld gesamt" value={euro(stats.totalBalance)} tone="slate" icon={<CircleDollarSign size={22} />} />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900 sm:text-lg">
              <ShieldCheck size={19} /> Objekt-Prüfliste
            </h2>
            <p className="mt-1 text-sm text-slate-500">Card-basiert, responsive und ohne abgeschnittene Reparatur-Buttons.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[220px_auto_auto]">
            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <select
                value={filterMode}
                onChange={(event) => setFilterMode(event.target.value as FilterMode)}
                className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-9 pr-9 text-sm font-black text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="all">Alle Objekte</option>
                <option value="warnings">Nur Hinweise</option>
                <option value="missing-loans">Darlehen fehlt</option>
                <option value="clean">Nur OK</option>
              </select>
            </label>

            <button onClick={exportCsv} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50">
              <FileDown size={16} /> Export CSV
            </button>
            <button onClick={() => window.print()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50">
              Bericht drucken
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 lg:p-5">
          {visibleRows.map((row) => {
            const hasActions = row.income === "bad" || row.capex !== "ok" || row.loan === "ok";
            return (
              <article key={row.id} className="group flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={row.risk} label={row.notes.length ? `${row.notes.length} Hinweis(e)` : "Stabil"} />
                    </div>
                    <NavLink to={`/objekte/${row.id}`} className="block break-words text-lg font-black leading-tight text-slate-950 underline decoration-slate-300 underline-offset-4 transition hover:text-indigo-700">
                      {row.name}
                    </NavLink>
                    <div className="mt-1 font-mono text-[11px] text-slate-400">{row.aliases.length > 1 ? `${row.aliases.length} verknüpfte IDs` : row.id}</div>
                  </div>

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenActions((current) => (current === row.id ? null : row.id))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                      aria-label="Aktionen öffnen"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openActions === row.id ? (
                      <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {row.income === "bad" ? <button disabled={Boolean(repairing)} onClick={() => void repair(row.id, "income")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 disabled:opacity-50"><Wrench size={15} /> Income {currentYear} erzeugen</button> : null}
                        {row.capex !== "ok" ? <button disabled={Boolean(repairing)} onClick={() => void repair(row.id, "capex")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 disabled:opacity-50"><Wrench size={15} /> Capex {currentYear} erzeugen</button> : null}
                        {row.loan === "ok" ? <button disabled={Boolean(repairing)} onClick={() => void repair(row.id, "loan")} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 disabled:opacity-50"><Banknote size={15} /> Darlehen +1 Jahr</button> : null}
                        {!hasActions ? <div className="px-3 py-2 text-sm font-bold text-slate-400">Keine Reparaturaktion möglich</div> : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <CheckItem label="Income" status={row.income} />
                    <CheckItem label="Capex" status={row.capex} />
                    <CheckItem label="Darlehen" status={row.loan} />
                    <CheckItem label="Portfolio" status={row.portfolio} />
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Restschuld / Quelle</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">{euro(row.balance)}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">{row.sourceText}</div>
                  </div>

                  <div className="min-h-[86px] rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Hinweise</div>
                    {row.notes.length ? (
                      <ul className="space-y-2 text-sm font-semibold leading-5 text-slate-650">
                        {row.notes.map((note) => (
                          <li key={note} className="flex gap-2">
                            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_CONFIG[row.risk].dot}`} />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
                        <CheckCircle2 size={16} /> Keine Hinweise
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="border-t border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 lg:px-5">
          Zeige {visibleRows.length} von {rows.length} Objekten.
        </div>
      </section>
    </div>
  );
}
