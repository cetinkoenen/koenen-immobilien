import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BarChart3, Building2, CalendarDays, TrendingUp, WalletCards } from "lucide-react";
import { MIETBESTANDTEIL_NK_CATEGORY } from "../lib/financeEntryLabels";
import { supabase } from "../lib/supabase";
import { useAppData, type AppObject, type FinanceEntry } from "../state/AppDataContext";

type PortfolioPropertyRow = {
  id: string;
  name: string | null;
  core_property_id: string | null;
};

type PortfolioRentalRow = {
  id: string;
  property_id: string;
  unit_id: string | null;
  rent_type: string | null;
  rent_monthly: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MonthPoint = {
  key: string;
  year: number;
  month: number;
  label: string;
  expected: number;
  actual: number;
};

type RentChange = {
  key: string;
  sortKey: string;
  monthLabel: string;
  objectLabel: string;
  unitLabel: string;
  previousAmount: number;
  newAmount: number;
  delta: number;
  source: "Vermietungszeiträume" | "Buchungen";
};

type DevelopmentRow = {
  object: AppObject;
  currentExpected: number;
  currentActual: number;
  previousExpected: number;
  deltaExpected: number;
  latestIncrease: RentChange | null;
  activeUnitSummary: string;
  hasGarageUnit: boolean;
  monthPoints: MonthPoint[];
  quality: "ok" | "check" | "missing";
  qualityText: string;
};

const START_YEAR = 2024;
const MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const FULL_MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(year: number, month: number) {
  return toIso(new Date(year, month - 1, 1));
}

function monthEnd(year: number, month: number) {
  return toIso(new Date(year, month, 0));
}

function addMonths(year: number, month: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number, full = false) {
  const date = new Date(year, month - 1, 1);
  return (full ? FULL_MONTH_FORMATTER : MONTH_FORMATTER).format(date);
}

function monthsSince2024() {
  const now = new Date();
  const months: Array<{ year: number; month: number; key: string; label: string }> = [];
  for (let year = START_YEAR; year <= now.getFullYear(); year += 1) {
    const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let month = 1; month <= maxMonth; month += 1) {
      months.push({ year, month, key: monthKey(year, month), label: monthLabel(year, month) });
    }
  }
  return months;
}

function money(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(value);
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactText(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function relevantTokens(value: string | null | undefined): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !["objekt", "object", "miete", "str", "strasse", "wohnung", "haus"].includes(token));
}

function dateInMonth(date: string | null | undefined, year: number, month: number) {
  if (!date) return false;
  return date >= monthStart(year, month) && date <= monthEnd(year, month);
}

function bookingDay(date: string | null | undefined) {
  if (!date) return null;
  const day = Number(date.slice(8, 10));
  return Number.isFinite(day) ? day : null;
}

function bookingReference(entry: FinanceEntry) {
  return `${entry.category ?? ""} ${entry.note ?? ""} ${entry.objekt_code ?? ""}`;
}

function isStrictRentText(value: string | null | undefined): boolean {
  const text = normalizeText(value);
  return (
    text.includes("miete") ||
    text.includes("mietbestandteil nk") ||
    text.includes("kaltmiete") ||
    text.includes("warmmiete") ||
    text.includes("monatsmiete") ||
    text.includes("pacht")
  );
}

function isExcludedIncome(entry: FinanceEntry): boolean {
  const text = normalizeText(bookingReference(entry));
  const isMietbestandteilNk = text.includes("mietbestandteil nk") || normalizeText(entry.category).includes(normalizeText(MIETBESTANDTEIL_NK_CATEGORY));
  if (isMietbestandteilNk) return false;
  return (
    text.includes("kaution") ||
    text.includes("erstattung") ||
    text.includes("rueckzahlung") ||
    text.includes("ruckzahlung") ||
    text.includes("darlehen") ||
    text.includes("zinsen") ||
    text.includes("versicherung") ||
    text.includes("steuer")
  );
}

function effectiveRentMonth(entry: FinanceEntry) {
  if (!entry.booking_date) return null;
  const day = bookingDay(entry.booking_date);
  const date = new Date(`${entry.booking_date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (day !== null && day >= 25 && isStrictRentText(bookingReference(entry))) {
    const shifted = addMonths(date.getFullYear(), date.getMonth() + 1, 1);
    return shifted;
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function entryMatchesObject(entry: FinanceEntry, object: AppObject, candidateIds: Set<string>) {
  if (entry.object_id && candidateIds.has(String(entry.object_id))) return true;
  if (entry.objekt_code && object.code && normalizeText(entry.objekt_code) === normalizeText(object.code)) return true;

  const reference = normalizeText(bookingReference(entry));
  const label = normalizeText(object.label);
  if (label && (reference.includes(label) || label.includes(reference))) return true;

  const tokens = relevantTokens(object.label);
  return tokens.length > 0 && tokens.some((token) => reference.includes(token));
}

function isRentBookingForObject(entry: FinanceEntry, object: AppObject, candidateIds: Set<string>) {
  if (entry.entry_type !== "income" || money(entry.amount) <= 0) return false;
  if (isExcludedIncome(entry)) return false;
  if (!entryMatchesObject(entry, object, candidateIds)) return false;
  return isStrictRentText(bookingReference(entry));
}

function rentalOverlapsMonth(rental: PortfolioRentalRow, year: number, month: number) {
  const start = monthStart(year, month);
  const end = monthEnd(year, month);
  if (!rental.start_date || rental.start_date > end) return false;
  if (rental.end_date && rental.end_date < start) return false;
  return money(rental.rent_monthly) > 0;
}

function unitKeyFromRental(rental: PortfolioRentalRow) {
  const raw = `${rental.unit_id ?? ""} ${rental.rent_type ?? ""}`.trim();
  const normalized = normalizeText(raw);
  if (!normalized) return "hauptmiete";
  if (normalized.includes("garage") || normalized.includes("stellplatz") || normalized.includes("tiefgarage") || normalized.includes("tg")) {
    return compactText(raw);
  }
  const parkingCode = normalized.match(/\bp\d{2,}\b/)?.[0];
  const unitCode = normalized.match(/\be\d{6,}\b/)?.[0];
  if (parkingCode || unitCode) return `${parkingCode ?? ""}-${unitCode ?? ""}`;
  return "hauptmiete";
}

function unitLabelFromRental(rental: PortfolioRentalRow) {
  return rental.rent_type?.trim() || rental.unit_id?.trim() || "Hauptmiete";
}

function selectActiveRentalsForMonth(rentals: PortfolioRentalRow[], candidateIds: Set<string>, year: number, month: number) {
  const matches = rentals.filter((rental) => candidateIds.has(String(rental.property_id)) && rentalOverlapsMonth(rental, year, month));
  const byUnit = new Map<string, PortfolioRentalRow>();

  for (const rental of matches) {
    const key = unitKeyFromRental(rental);
    const current = byUnit.get(key);
    if (!current) {
      byUnit.set(key, rental);
      continue;
    }

    const rentalSortKey = `${rental.start_date ?? ""}|${rental.end_date ?? "9999-12-31"}|${rental.updated_at ?? ""}|${rental.created_at ?? ""}`;
    const currentSortKey = `${current.start_date ?? ""}|${current.end_date ?? "9999-12-31"}|${current.updated_at ?? ""}|${current.created_at ?? ""}`;
    if (rentalSortKey > currentSortKey) byUnit.set(key, rental);
  }

  return [...byUnit.values()];
}

function expectedRentForMonth(rentals: PortfolioRentalRow[], candidateIds: Set<string>, year: number, month: number) {
  return selectActiveRentalsForMonth(rentals, candidateIds, year, month).reduce((sum, rental) => sum + money(rental.rent_monthly), 0);
}

function actualRentForMonth(entries: FinanceEntry[], object: AppObject, candidateIds: Set<string>, year: number, month: number) {
  return entries.reduce((sum, entry) => {
    if (!isRentBookingForObject(entry, object, candidateIds)) return sum;
    const effective = effectiveRentMonth(entry);
    if (effective && effective.year === year && effective.month === month) return sum + money(entry.amount);
    if (!effective && dateInMonth(entry.booking_date, year, month)) return sum + money(entry.amount);
    return sum;
  }, 0);
}

function candidateIdsForObject(object: AppObject, portfolioProperties: PortfolioPropertyRow[]) {
  const ids = new Set<string>([object.id, ...(object.aliases ?? [])].filter(Boolean));
  const label = normalizeText(object.label);

  for (const property of portfolioProperties) {
    const propertyName = normalizeText(property.name);
    if (
      property.id === object.id ||
      property.core_property_id === object.id ||
      (propertyName && label && (propertyName === label || propertyName.includes(label) || label.includes(propertyName)))
    ) {
      ids.add(property.id);
      if (property.core_property_id) ids.add(property.core_property_id);
    }
  }

  return ids;
}

function rentChangesForObject(
  object: AppObject,
  entries: FinanceEntry[],
  rentals: PortfolioRentalRow[],
  candidateIds: Set<string>,
  points: MonthPoint[],
) {
  const changes: RentChange[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (previous.expected > 0 && current.expected - previous.expected > 0.01) {
      const activeRentals = selectActiveRentalsForMonth(rentals, candidateIds, current.year, current.month);
      changes.push({
        key: `${object.id}-${current.key}-expected`,
        sortKey: current.key,
        monthLabel: monthLabel(current.year, current.month, true),
        objectLabel: object.label,
        unitLabel: activeRentals.map(unitLabelFromRental).filter(Boolean).join(" + ") || "Gesamtmiete",
        previousAmount: previous.expected,
        newAmount: current.expected,
        delta: current.expected - previous.expected,
        source: "Vermietungszeiträume",
      });
    }

    if (previous.actual > 0 && current.actual - previous.actual > 5) {
      const currentMonthEntries = entries.filter((entry) => {
        const effective = effectiveRentMonth(entry);
        return effective?.year === current.year && effective.month === current.month && isRentBookingForObject(entry, object, candidateIds);
      });
      changes.push({
        key: `${object.id}-${current.key}-actual`,
        sortKey: current.key,
        monthLabel: monthLabel(current.year, current.month, true),
        objectLabel: object.label,
        unitLabel: currentMonthEntries.map((entry) => entry.category || entry.note || "Buchung").slice(0, 2).join(" + ") || "Buchungen",
        previousAmount: previous.actual,
        newAmount: current.actual,
        delta: current.actual - previous.actual,
        source: "Buchungen",
      });
    }
  }

  return changes;
}

function Sparkline({ points }: { points: MonthPoint[] }) {
  const visible = points.slice(-18);
  const max = Math.max(1, ...visible.map((point) => Math.max(point.expected, point.actual)));

  return (
    <div className="flex h-20 items-end gap-1" aria-label="Mietentwicklung der letzten 18 Monate">
      {visible.map((point) => (
        <div key={point.key} className="flex flex-1 items-end justify-center gap-[2px]" title={`${point.label}: Soll ${formatCurrency(point.expected)}, Ist ${formatCurrency(point.actual)}`}>
          <span className="w-1.5 rounded-t bg-indigo-300" style={{ height: `${Math.max(3, (point.expected / max) * 72)}px` }} />
          <span className="w-1.5 rounded-t bg-emerald-400" style={{ height: `${Math.max(3, (point.actual / max) * 72)}px` }} />
        </div>
      ))}
    </div>
  );
}

export default function Mietentwicklung() {
  const appData = useAppData();
  const [portfolioProperties, setPortfolioProperties] = useState<PortfolioPropertyRow[]>([]);
  const [portfolioRentals, setPortfolioRentals] = useState<PortfolioRentalRow[]>([]);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objectFilter, setObjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "wohnung" | "garage">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "changes" | "checks">("all");

  useEffect(() => {
    let cancelled = false;

    async function loadRentData() {
      setLoadingRentals(true);
      setLoadError(null);
      try {
        const [propertiesRes, rentalsRes] = await Promise.all([
          supabase.from("portfolio_properties").select("id,name,core_property_id"),
          supabase
            .from("portfolio_property_rentals")
            .select("id,property_id,unit_id,rent_type,rent_monthly,start_date,end_date,created_at,updated_at")
            .order("start_date", { ascending: true }),
        ]);
        if (propertiesRes.error) throw propertiesRes.error;
        if (rentalsRes.error) throw rentalsRes.error;
        if (cancelled) return;

        setPortfolioProperties(((propertiesRes.data ?? []) as PortfolioPropertyRow[]).map((row) => ({
          id: String(row.id),
          name: row.name ?? null,
          core_property_id: row.core_property_id ? String(row.core_property_id) : null,
        })));
        setPortfolioRentals(((rentalsRes.data ?? []) as PortfolioRentalRow[]).map((row) => ({
          id: String(row.id),
          property_id: String(row.property_id),
          unit_id: row.unit_id ?? null,
          rent_type: row.rent_type ?? null,
          rent_monthly: row.rent_monthly == null ? null : Number(row.rent_monthly),
          start_date: row.start_date ?? null,
          end_date: row.end_date ?? null,
          created_at: row.created_at ?? null,
          updated_at: row.updated_at ?? null,
        })));
      } catch (error) {
        if (cancelled) return;
        setPortfolioProperties([]);
        setPortfolioRentals([]);
        setLoadError(error instanceof Error ? error.message : "Mietentwicklungsdaten konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setLoadingRentals(false);
      }
    }

    void loadRentData();
    const reload = () => void loadRentData();
    window.addEventListener("focus", reload);
    window.addEventListener("koenen:rentals-changed", reload);
    window.addEventListener("koenen:finance-entry-changed", reload);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", reload);
      window.removeEventListener("koenen:rentals-changed", reload);
      window.removeEventListener("koenen:finance-entry-changed", reload);
    };
  }, []);

  const months = useMemo(() => monthsSince2024(), []);
  const currentMonth = months[months.length - 1];

  const rows = useMemo<DevelopmentRow[]>(() => {
    return appData.objects.map((object) => {
      const candidateIds = candidateIdsForObject(object, portfolioProperties);
      const monthPoints = months.map((month) => ({
        ...month,
        expected: expectedRentForMonth(portfolioRentals, candidateIds, month.year, month.month),
        actual: actualRentForMonth(appData.entries, object, candidateIds, month.year, month.month),
      }));
      const current = monthPoints[monthPoints.length - 1] ?? { expected: 0, actual: 0 };
      const previous = monthPoints[monthPoints.length - 2] ?? { expected: 0, actual: 0 };
      const activeRentals = selectActiveRentalsForMonth(portfolioRentals, candidateIds, currentMonth.year, currentMonth.month);
      const activeUnitLabels = activeRentals.map(unitLabelFromRental).filter(Boolean);
      const activeUnitSummary = activeUnitLabels.length ? activeUnitLabels.join(" + ") : "Keine aktive Einheit";
      const hasGarageUnit = activeUnitLabels.some((label) => {
        const normalized = normalizeText(label);
        return normalized.includes("garage") || normalized.includes("stellplatz") || normalized.includes("tiefgarage") || normalized.includes("tg") || /\bp\d{2,}\b/.test(normalized);
      });
      const changes = rentChangesForObject(object, appData.entries, portfolioRentals, candidateIds, monthPoints);
      const latestIncrease = [...changes].reverse()[0] ?? null;
      const hasRentals = activeRentals.length > 0;
      const hasActual = current.actual > 0;
      const quality: DevelopmentRow["quality"] = hasRentals && Math.abs(current.expected - current.actual) <= 1
        ? "ok"
        : hasRentals || hasActual
          ? "check"
          : "missing";
      const qualityText = quality === "ok"
        ? "Soll und Buchungen passen im aktuellen Monat."
        : quality === "check"
          ? "Soll/Ist oder Stammdaten prüfen."
          : "Keine aktuelle Miete erkennbar.";

      return {
        object,
        currentExpected: current.expected,
        currentActual: current.actual,
        previousExpected: previous.expected,
        deltaExpected: current.expected - previous.expected,
        latestIncrease,
        activeUnitSummary,
        hasGarageUnit,
        monthPoints,
        quality,
        qualityText,
      };
    });
  }, [appData.entries, appData.objects, currentMonth?.month, currentMonth?.year, months, portfolioProperties, portfolioRentals]);

  const allChanges = useMemo(
    () =>
      rows
        .flatMap((row) => {
          const candidateIds = candidateIdsForObject(row.object, portfolioProperties);
          return rentChangesForObject(row.object, appData.entries, portfolioRentals, candidateIds, row.monthPoints);
        })
        .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
        .slice(0, 12),
    [appData.entries, portfolioProperties, portfolioRentals, rows],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const objectMatch = !objectFilter || row.object.id === objectFilter;
      const typeMatch =
        typeFilter === "all" ||
        (typeFilter === "garage" && row.hasGarageUnit) ||
        (typeFilter === "wohnung" && !row.hasGarageUnit);
      const sourceMatch =
        sourceFilter === "all" ||
        (sourceFilter === "changes" && row.latestIncrease) ||
        (sourceFilter === "checks" && row.quality !== "ok");
      return objectMatch && typeMatch && sourceMatch;
    });
  }, [objectFilter, rows, sourceFilter, typeFilter]);

  const stats = useMemo(() => {
    const currentExpected = rows.reduce((sum, row) => sum + row.currentExpected, 0);
    const currentActual = rows.reduce((sum, row) => sum + row.currentActual, 0);
    const previousYearPointIndex = Math.max(0, months.length - 13);
    const previousYearExpected = rows.reduce((sum, row) => sum + (row.monthPoints[previousYearPointIndex]?.expected ?? 0), 0);
    const annualRunRate = currentExpected * 12;
    const changePct = previousYearExpected > 0 ? ((currentExpected - previousYearExpected) / previousYearExpected) * 100 : 0;
    return {
      currentExpected,
      currentActual,
      annualRunRate,
      changePct,
      checks: rows.filter((row) => row.quality !== "ok").length,
      changes: rows.filter((row) => row.latestIncrease).length,
    };
  }, [months.length, rows]);

  const loading = appData.loading || loadingRentals;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
              <TrendingUp size={16} />
              Mietentwicklung
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Mieten, Erhöhungen und Buchungen auf einen Blick
            </h1>
            <p className="mt-3 max-w-4xl text-base font-semibold leading-7 text-slate-600">
              Sollmieten kommen aus Portfolio → Vermietungszeiträume. Tatsächliche Erhöhungen werden zusätzlich aus Buchungen erkannt, wenn ab einem Monat höhere Miete oder {MIETBESTANDTEIL_NK_CATEGORY} eingeht.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Soll aktuell</span>
              <strong className="mt-2 block text-2xl font-black text-emerald-800">{formatCurrency(stats.currentExpected)}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Ist aktuell</span>
              <strong className="mt-2 block text-2xl font-black text-slate-950">{formatCurrency(stats.currentActual)}</strong>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-700">Jahres-Soll</span>
              <strong className="mt-2 block text-2xl font-black text-indigo-900">{formatCurrency(stats.annualRunRate)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Änderung ggü. Vorjahr</span>
          <strong className="mt-2 block text-2xl font-black text-slate-950">{formatPercent(stats.changePct)} %</strong>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Objekte prüfen</span>
          <strong className="mt-2 block text-2xl font-black text-amber-800">{stats.checks}</strong>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">Erhöhungen erkannt</span>
          <strong className="mt-2 block text-2xl font-black text-blue-900">{stats.changes}</strong>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Zeitraum</span>
          <strong className="mt-2 block text-2xl font-black text-slate-950">01/2024 bis heute</strong>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-black text-slate-600">
            Objekt
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950" value={objectFilter} onChange={(event) => setObjectFilter(event.target.value)}>
              <option value="">Alle Objekte</option>
              {appData.objects.map((object) => (
                <option key={object.id} value={object.id}>{object.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-slate-600">
            Typ
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <option value="all">Alle Einheiten</option>
              <option value="wohnung">Wohnung / Haus</option>
              <option value="garage">Garage / Stellplatz</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-slate-600">
            Ansicht
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}>
              <option value="all">Alle anzeigen</option>
              <option value="changes">Nur Erhöhungen</option>
              <option value="checks">Nur Prüfbedarf</option>
            </select>
          </label>
          <div className="flex items-end">
            <Link to="/mieter/mieteingang" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-black text-white no-underline shadow-sm">
              Zum Mieteingang
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {(loadError || appData.error) ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-900">
          Fehler beim Laden: {loadError || appData.error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-black text-slate-600 shadow-sm">
          Mietentwicklung wird geladen...
        </div>
      ) : null}

      {!loading ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-2xl font-black text-slate-950">Alle Immobilien</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Grün = Buchungen passen zur Sollmiete. Gelb = Prüfung sinnvoll. Blau/Grün-Balken = Soll/Ist der letzten Monate.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <article key={row.object.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(220px,1fr)_180px_180px_260px_160px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={[
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em]",
                        row.quality === "ok" ? "bg-emerald-50 text-emerald-700" : row.quality === "check" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500",
                      ].join(" ")}>
                        {row.quality === "ok" ? "OK" : row.quality === "check" ? "Prüfen" : "Keine Miete"}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{row.qualityText}</span>
                    </div>
                    <h3 className="mt-2 text-xl font-black text-slate-950">{row.object.label}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">Quelle: Vermietungszeiträume + Buchungen</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Aktive Einheit(en): {row.activeUnitSummary}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Soll aktuell</span>
                    <strong className="mt-1 block text-xl font-black text-slate-950">{formatCurrency(row.currentExpected)}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Ist aktuell</span>
                    <strong className="mt-1 block text-xl font-black text-emerald-700">{formatCurrency(row.currentActual)}</strong>
                  </div>
                  <Sparkline points={row.monthPoints} />
                  <div className="grid gap-2">
                    {row.latestIncrease ? (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">Letzte Erhöhung</span>
                        <strong className="mt-1 block text-sm font-black text-blue-950">{row.latestIncrease.monthLabel}</strong>
                        <span className="text-xs font-bold text-blue-800">+{formatCurrency(row.latestIncrease.delta)}</span>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                        Keine Erhöhung erkannt
                      </div>
                    )}
                    <Link to={`/immobilien/${row.object.id}/vermietung`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900 no-underline">
                      Details
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              ))}
              {!filteredRows.length ? (
                <div className="p-6 text-sm font-black text-slate-500">Keine Ergebnisse für diesen Filter.</div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-blue-700" size={20} />
                <h2 className="text-xl font-black text-slate-950">Letzte Erhöhungen</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {allChanges.map((change) => (
                  <div key={change.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="block text-sm font-black text-slate-950">{change.objectLabel}</strong>
                        <span className="text-xs font-bold text-slate-500">{change.monthLabel} · {change.source}</span>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-emerald-700">+{formatCurrency(change.delta)}</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-600">
                      {formatCurrency(change.previousAmount)} → {formatCurrency(change.newAmount)}
                    </p>
                  </div>
                ))}
                {!allChanges.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                    Seit Januar 2024 wurde keine eindeutige Mieterhöhung erkannt.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-700" size={20} />
                <h2 className="text-xl font-black text-amber-950">Datenqualität</h2>
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-amber-900">
                Wenn Sollmiete und Buchung auseinanderlaufen, prüfe zuerst Portfolio → Vermietungszeiträume und danach die Buchungskategorie. {MIETBESTANDTEIL_NK_CATEGORY} wird als Mietbestandteil mitgezählt.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-3">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <Building2 size={18} className="text-slate-500" />
                  <span className="text-sm font-black text-slate-700">Objekte: {rows.length}</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <WalletCards size={18} className="text-slate-500" />
                  <span className="text-sm font-black text-slate-700">Buchungen: {appData.entries.length}</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <BarChart3 size={18} className="text-slate-500" />
                  <span className="text-sm font-black text-slate-700">Vermietungszeiträume: {portfolioRentals.length}</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      ) : null}
    </div>
  );
}
