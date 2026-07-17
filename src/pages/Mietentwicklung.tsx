import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Building2, CalendarDays, FileText, Mail, TrendingUp, WalletCards, X } from "lucide-react";
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
  netRent: number;
  utilitiesRent: number;
  warmRent: number;
  previousNetRent: number;
  previousUtilitiesRent: number;
  previousWarmRent: number;
  tenantName: string;
  lastAdjustmentDate: string | null;
  adjustmentReason: string;
  lastActualAmount: number;
  lastActualMonthLabel: string | null;
  previousExpected: number;
  deltaExpected: number;
  latestIncrease: RentChange | null;
  activeUnitSummary: string;
  activeUnitBreakdown: Array<{ key: string; label: string; amount: number }>;
  hasGarageUnit: boolean;
  monthPoints: MonthPoint[];
  quality: "ok" | "check" | "missing";
  qualityText: string;
  adjustmentStatus: "Aktiv" | "Prüfung empfohlen" | "Geplant" | "Offene Zustimmung";
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE");
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

function isLilienthalerObject(object: AppObject): boolean {
  return normalizeText(object.label).includes("lilienthaler");
}

function isFuertherObject(object: AppObject): boolean {
  return normalizeText(object.label).includes("further") || normalizeText(object.label).includes("fuerther");
}

function isRosensteinObject(object: AppObject): boolean {
  return normalizeText(object.label).includes("rosenstein");
}

function isGarageLikeText(value: string | null | undefined): boolean {
  const normalized = normalizeText(value);
  return normalized.includes("garage") || normalized.includes("stellplatz") || normalized.includes("tiefgarage") || normalized.includes("tg") || /\bp\d{2,}\b/.test(normalized);
}

function isSameRentalPeriod(a: PortfolioRentalRow, b: PortfolioRentalRow): boolean {
  return (
    money(a.rent_monthly) === money(b.rent_monthly) &&
    (a.start_date ?? "") === (b.start_date ?? "") &&
    (a.end_date ?? "") === (b.end_date ?? "") &&
    normalizeText(a.unit_id) === normalizeText(b.unit_id) &&
    normalizeText(a.rent_type) === normalizeText(b.rent_type)
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

function effectiveRentMonthForObject(entry: FinanceEntry, object: AppObject) {
  if (isLilienthalerObject(object)) {
    if (!entry.booking_date) return null;
    const date = new Date(`${entry.booking_date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }
  return effectiveRentMonth(entry);
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
  if (rental.unit_id?.trim()) return compactText(rental.unit_id);
  if (isGarageLikeText(raw)) {
    return compactText(raw);
  }
  const parkingCode = normalized.match(/\bp\d{2,}\b/)?.[0];
  const unitCode = normalized.match(/\be\d{6,}\b/)?.[0];
  if (parkingCode || unitCode) return `${parkingCode ?? ""}-${unitCode ?? ""}`;
  return "hauptmiete";
}

function unitLabelFromRental(rental: PortfolioRentalRow) {
  const raw = `${rental.unit_id ?? ""} ${rental.rent_type ?? ""}`;
  const normalized = normalizeText(raw);
  if (normalized.includes("p250")) return "Garage 1";
  if (normalized.includes("p253")) return "Garage 2";
  if (normalized.includes("p254")) return "Garage 3";
  if (rental.unit_id?.trim()) return rental.unit_id.trim();
  const type = rental.rent_type?.trim();
  const normalizedType = normalizeText(type);
  if (!type || normalizedType === "monthly") return "Hauptmiete";
  return type;
}

function friendlyUnitLabel(object: AppObject, rental: PortfolioRentalRow, index: number) {
  const rawLabel = unitLabelFromRental(rental);
  const compactLabel = compactText(rawLabel);
  const looksTechnicalId = /^[0-9a-f]{16,}$/i.test(compactLabel) || compactLabel.length >= 24;

  if (isRosensteinObject(object)) return `Garage ${index + 1}`;
  if (isFuertherObject(object)) {
    if (money(rental.rent_monthly) <= 100 || isGarageLikeText(`${rental.unit_id ?? ""} ${rental.rent_type ?? ""}`)) return "Garage";
    return "Wohnung";
  }
  if (looksTechnicalId) return isGarageLikeText(rawLabel) ? "Garage" : "Wohnung";
  return rawLabel;
}

function completeKnownUnitBreakdown(
  object: AppObject,
  units: Array<{ key: string; label: string; amount: number }>,
) {
  if (!isRosensteinObject(object)) return units;

  const byLabel = new Map(units.map((unit) => [unit.label, unit]));
  return ["Garage 1", "Garage 2", "Garage 3"].map((label) => byLabel.get(label) ?? {
    key: `${object.id}-${label}`,
    label,
    amount: 0,
  });
}

function selectActiveRentalsForMonth(rentals: PortfolioRentalRow[], candidateIds: Set<string>, year: number, month: number) {
  const matches = rentals.filter((rental) => candidateIds.has(String(rental.property_id)) && rentalOverlapsMonth(rental, year, month));
  const byUnit = new Map<string, PortfolioRentalRow>();

  for (const rental of matches) {
    const baseKey = unitKeyFromRental(rental);
    let key = baseKey;
    const current = byUnit.get(key);
    if (!current) {
      byUnit.set(key, rental);
      continue;
    }

    if (!isSameRentalPeriod(current, rental)) {
      key = `${baseKey}-${rental.id}`;
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
    const effective = effectiveRentMonthForObject(entry, object);
    if (effective && effective.year === year && effective.month === month) return sum + money(entry.amount);
    if (!effective && dateInMonth(entry.booking_date, year, month)) return sum + money(entry.amount);
    return sum;
  }, 0);
}

function actualRentPartForMonth(entries: FinanceEntry[], object: AppObject, candidateIds: Set<string>, year: number, month: number, mode: "utilities" | "base") {
  return entries.reduce((sum, entry) => {
    if (!isRentBookingForObject(entry, object, candidateIds)) return sum;
    const effective = effectiveRentMonthForObject(entry, object);
    if (!effective || effective.year !== year || effective.month !== month) return sum;
    const text = normalizeText(bookingReference(entry));
    const isUtilities = text.includes("mietbestandteil nk") || text.includes("nebenkosten") || text.includes("hausgeld");
    if (mode === "utilities" && isUtilities) return sum + money(entry.amount);
    if (mode === "base" && !isUtilities) return sum + money(entry.amount);
    return sum;
  }, 0);
}

function latestAdjustmentDate(change: RentChange | null) {
  if (!change) return null;
  return `${change.sortKey}-01`;
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
        const effective = effectiveRentMonthForObject(entry, object);
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

export default function Mietentwicklung() {
  const appData = useAppData();
  const [portfolioProperties, setPortfolioProperties] = useState<PortfolioPropertyRow[]>([]);
  const [portfolioRentals, setPortfolioRentals] = useState<PortfolioRentalRow[]>([]);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objectFilter, setObjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "action" | "future">("all");
  const [selectedRow, setSelectedRow] = useState<DevelopmentRow | null>(null);

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
      const lastActual = [...monthPoints].reverse().find((point) => point.actual > 0);
      const activeRentals = selectActiveRentalsForMonth(portfolioRentals, candidateIds, currentMonth.year, currentMonth.month);
      const previousRentals = selectActiveRentalsForMonth(portfolioRentals, candidateIds, previous.year, previous.month);
      const activeUnitBreakdown = completeKnownUnitBreakdown(object, activeRentals.map((rental, index) => ({
        key: rental.id,
        label: friendlyUnitLabel(object, rental, index),
        amount: money(rental.rent_monthly),
      })));
      const activeUnitLabels = activeUnitBreakdown.map((unit) => `${unit.label} ${formatCurrency(unit.amount)}`).filter(Boolean);
      const activeUnitSummary = activeUnitLabels.length ? activeUnitLabels.join(" + ") : "Keine aktive Einheit";
      const hasGarageUnit = activeUnitLabels.some((label) => {
        return isGarageLikeText(label);
      });
      const changes = rentChangesForObject(object, appData.entries, portfolioRentals, candidateIds, monthPoints);
      const latestIncrease = [...changes].reverse()[0] ?? null;
      const currentUtilitiesFromBookings = actualRentPartForMonth(appData.entries, object, candidateIds, currentMonth.year, currentMonth.month, "utilities");
      const previousUtilitiesFromBookings = actualRentPartForMonth(appData.entries, object, candidateIds, previous.year, previous.month, "utilities");
      const rentalUtilities = activeRentals
        .filter((rental) => normalizeText(`${rental.unit_id ?? ""} ${rental.rent_type ?? ""}`).includes("nk") || normalizeText(rental.rent_type).includes("nebenkosten"))
        .reduce((sum, rental) => sum + money(rental.rent_monthly), 0);
      const previousRentalUtilities = previousRentals
        .filter((rental) => normalizeText(`${rental.unit_id ?? ""} ${rental.rent_type ?? ""}`).includes("nk") || normalizeText(rental.rent_type).includes("nebenkosten"))
        .reduce((sum, rental) => sum + money(rental.rent_monthly), 0);
      const utilitiesRent = money(rentalUtilities || currentUtilitiesFromBookings);
      const previousUtilitiesRent = money(previousRentalUtilities || previousUtilitiesFromBookings);
      const warmRent = money(current.expected || current.actual);
      const previousWarmRent = money(previous.expected || previous.actual || warmRent);
      const netRent = Math.max(0, money(warmRent - utilitiesRent));
      const previousNetRent = Math.max(0, money(previousWarmRent - previousUtilitiesRent));
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
      const adjustmentStatus: DevelopmentRow["adjustmentStatus"] = quality === "check"
        ? "Prüfung empfohlen"
        : latestIncrease
          ? "Aktiv"
          : hasRentals
            ? "Aktiv"
            : "Offene Zustimmung";

      return {
        object,
        currentExpected: current.expected,
        currentActual: current.actual,
        netRent,
        utilitiesRent,
        warmRent,
        previousNetRent,
        previousUtilitiesRent,
        previousWarmRent,
        tenantName: "Mieterdaten aus Vermietungszeitraum",
        lastAdjustmentDate: latestAdjustmentDate(latestIncrease),
        adjustmentReason: latestIncrease?.source === "Buchungen" ? "Indexmiete / Buchungsänderung" : latestIncrease ? "Anpassung aus Vermietungszeitraum" : "Aktive Mietstruktur",
        lastActualAmount: lastActual?.actual ?? 0,
        lastActualMonthLabel: lastActual ? monthLabel(lastActual.year, lastActual.month, true) : null,
        previousExpected: previous.expected,
        deltaExpected: current.expected - previous.expected,
        latestIncrease,
        activeUnitSummary,
        activeUnitBreakdown,
        hasGarageUnit,
        monthPoints,
        quality,
        qualityText,
        adjustmentStatus,
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
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "action" && row.adjustmentStatus === "Prüfung empfohlen") ||
        (statusFilter === "future" && row.adjustmentStatus === "Geplant");
      return objectMatch && statusMatch;
    });
  }, [objectFilter, rows, statusFilter]);

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
        <div className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
          <TrendingUp size={16} />
          Mietanpassungen
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          Mietanpassungen
        </h1>
        <p className="mt-3 max-w-5xl text-sm font-semibold leading-6 text-slate-600">
          Hier sehen Sie die aktuellen Mietzusammensetzungen aller Ihrer Objekte. Klicken Sie auf eine Zeile, um die Details, den Vorher-Nachher-Vergleich und die Historie in der Seitenleiste zu öffnen.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-sm font-black text-slate-600">
            Immobilien
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950" value={objectFilter} onChange={(event) => setObjectFilter(event.target.value)}>
              <option value="">Alle Immobilien</option>
              {appData.objects.map((object) => (
                <option key={object.id} value={object.id}>{object.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-slate-600">
            Status
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Status: Alle</option>
              <option value="action">Nur Handlungsbedarf</option>
              <option value="future">Zukünftige Anpassungen</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 md:min-w-[260px]">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">Warmmiete</span>
              <strong className="mt-1 block text-lg font-black text-emerald-800">{formatCurrency(stats.currentExpected)}</strong>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">Prüfen</span>
              <strong className="mt-1 block text-lg font-black text-amber-800">{stats.checks}</strong>
            </div>
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
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.15fr_1fr_150px_150px_150px_150px_165px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs font-black uppercase tracking-[0.13em] text-slate-500 xl:grid">
            <span>Objekt & Einheit</span>
            <span>Mieter</span>
            <span>Letzte Anpassung</span>
            <span>Nettokaltmiete</span>
            <span>Nebenkosten</span>
            <span>Warmmiete</span>
            <span>Status</span>
          </div>
          {filteredRows.length ? (
            filteredRows.map((row) => (
              <button
                key={row.object.id}
                type="button"
                onClick={() => setSelectedRow(row)}
                className="grid w-full gap-3 border-b border-slate-100 bg-white px-5 py-5 text-left transition last:border-b-0 hover:bg-[#f8fbfa] xl:grid-cols-[1.15fr_1fr_150px_150px_150px_150px_165px] xl:items-center"
              >
                <div>
                  <h2 className="text-base font-black text-slate-950">{row.object.label}</h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">{row.activeUnitSummary}</p>
                </div>
                <div className="text-sm font-bold text-slate-700">{row.tenantName}</div>
                <div className="text-sm font-black text-slate-950">{formatDate(row.lastAdjustmentDate)}</div>
                <div className="text-sm font-black text-slate-950">{formatCurrency(row.netRent)}</div>
                <div className="text-sm font-black text-slate-950">{formatCurrency(row.utilitiesRent)}</div>
                <div className="text-sm font-black text-emerald-700">{formatCurrency(row.warmRent)}</div>
                <div>
                  <span className={[
                    "inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em]",
                    row.adjustmentStatus === "Aktiv" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
                      row.adjustmentStatus === "Prüfung empfohlen" ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" :
                        row.adjustmentStatus === "Geplant" ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" :
                          "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
                  ].join(" ")}>
                    {row.adjustmentStatus}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="p-6 text-sm font-black text-slate-500">
              {rows.length ? "Keine Objekte oder Einheiten mit diesen Filtereinstellungen gefunden." : "Sie haben noch keine Mietverhältnisse angelegt. Sobald Sie Ihren ersten Mietvertrag mit Mietstruktur hinterlegen, erscheint hier Ihre dynamische Übersicht."}
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-blue-700" size={20} />
            <h2 className="text-lg font-black text-slate-950">Letzte Erhöhungen</h2>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-500">{stats.changes} erkannte Änderungen seit Januar 2024</p>
        </div>
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-700" size={20} />
            <h2 className="text-lg font-black text-amber-950">Datenqualität</h2>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-amber-900">
            {MIETBESTANDTEIL_NK_CATEGORY} wird als Mietbestandteil mitgezählt.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-2 text-sm font-black text-slate-700">
            <span><Building2 size={16} className="mr-2 inline text-slate-500" />Objekte: {rows.length}</span>
            <span><WalletCards size={16} className="mr-2 inline text-slate-500" />Buchungen: {appData.entries.length}</span>
            <span><BarChart3 size={16} className="mr-2 inline text-slate-500" />Vermietungszeiträume: {portfolioRentals.length}</span>
          </div>
        </div>
      </section>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5" onClick={() => setSelectedRow(null)}>
          <aside className="ml-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Details zur Mietanpassung</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Details zur Mietanpassung</h2>
                <p className="mt-2 text-sm font-bold text-slate-600">Einheit: {selectedRow.object.label} | Mieter: {selectedRow.tenantName}</p>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700" aria-label="Details schließen">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-lg font-black text-slate-950">Aktuelle Anpassung</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Wirksam seit / ab</span>
                    <strong className="mt-2 block text-base font-black text-slate-950">{formatDate(selectedRow.lastAdjustmentDate)}</strong>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Grund der Anpassung</span>
                    <strong className="mt-2 block text-base font-black text-slate-950">{selectedRow.adjustmentReason}</strong>
                  </div>
                </div>
              </section>

              <section className="rounded-[22px] border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-black text-slate-950">Mietentwicklung im Detail</h3>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-4 gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <span>Kostenart</span>
                    <span>Alter Stand</span>
                    <span>Neuer Stand</span>
                    <span>Differenz</span>
                  </div>
                  {[
                    ["Nettokaltmiete", selectedRow.previousNetRent, selectedRow.netRent],
                    ["Nebenkosten", selectedRow.previousUtilitiesRent, selectedRow.utilitiesRent],
                    ["Warmmiete", selectedRow.previousWarmRent, selectedRow.warmRent],
                  ].map(([label, oldValue, newValue]) => (
                    <div key={String(label)} className="grid grid-cols-4 gap-3 border-t border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                      <span className="font-black text-slate-950">{label}</span>
                      <span>{formatCurrency(Number(oldValue))}</span>
                      <span>{formatCurrency(Number(newValue))}</span>
                      <span className="text-emerald-700">{formatCurrency(Number(newValue) - Number(oldValue))}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[22px] border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-black text-slate-950">Historie aller Mietanpassungen</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Lückenlose Dokumentation der bisherigen Erhöhungen und Begründungen für dieses Mietverhältnis.</p>
                <div className="mt-4 grid gap-3">
                  {(selectedRow.latestIncrease ? [selectedRow.latestIncrease] : allChanges.filter((change) => change.objectLabel === selectedRow.object.label).slice(0, 3)).map((change) => (
                    <div key={change.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-2 text-sm font-bold text-slate-700">
                        <span><strong>Datum:</strong> {change.monthLabel}</span>
                        <span><strong>Art:</strong> {change.source === "Buchungen" ? "Erhöhung aus Mietbuchung" : "Anpassung im Vermietungszeitraum"}</span>
                        <span><strong>Änderung:</strong> Kaltmiete erhöht um {formatCurrency(change.delta)} (von {formatCurrency(change.previousAmount)} auf {formatCurrency(change.newAmount)})</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600">
                        <span className="inline-flex items-center gap-2"><FileText size={14} /> Ankündigungsschreiben_Mietanpassung.pdf (Download-Link)</span>
                        <span className="inline-flex items-center gap-2"><Mail size={14} /> Zustimmung_Mieter_E-Mail.pdf (Download-Link)</span>
                        <span>Notiz des Vermieters: Zustimmung und Begründung bitte bei Bedarf ergänzen.</span>
                      </div>
                    </div>
                  ))}
                  {!selectedRow.latestIncrease && !allChanges.some((change) => change.objectLabel === selectedRow.object.label) ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                      Noch keine Mietanpassung für dieses Mietverhältnis erkannt.
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
            <div className="grid gap-3 border-t border-slate-200 p-5 sm:grid-cols-2">
              <button type="button" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm">
                Neue Mietanpassung planen
              </button>
              <button type="button" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm">
                Schreiben für Mieter generieren
              </button>
              <p className="sm:col-span-2 text-xs font-bold leading-5 text-slate-500">
                Rechtlicher Hinweis: Beachten Sie bei Erhöhungen auf die ortsübliche Vergleichsmiete die gesetzliche Kappungsgrenze sowie die Jahressperrfrist von 12 Monaten seit der letzten Anpassung.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
