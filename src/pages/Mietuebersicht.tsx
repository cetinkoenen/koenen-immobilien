import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { MIETBESTANDTEIL_NK_CATEGORY } from "../lib/financeEntryLabels";
import { useAppData, type FinanceEntry } from "../state/AppDataContext";
import {
  isVacancyActiveInRange,
  isVacancyInRange,
  listDerivedVacanciesFromEndedRentals,
  listVacancies,
  type UnitVacancy,
} from "../services/vacancyService";

type TenantInfo = { firstName: string; lastName: string; phone: string; email: string };
type RentStatus = "paid" | "partial" | "missing" | "inactive" | "vacant";
type PeriodMode = "month" | "year";
type OverviewRow = {
  objectId: string;
  objectCode: string | null;
  tenantKey: string;
  tenantLookupKey: string;
  label: string;
  unitLabel?: string;
  referenceLabel?: string;
  paidAmount: number;
  expectedAmount: number | null;
  lastBookingDate: string | null;
  status: RentStatus;
  vacancyReason?: string | null;
  periodLabel: string;
  year: number;
  month: number;
  expectedSource: string;
};

const emptyTenant: TenantInfo = { firstName: "", lastName: "", phone: "", email: "" };

type TenantContractProfileRow = {
  id: string;
  property_id: string | null;
  object_code: string | null;
  unit_label: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  tenant_profiles?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
  } | null;
};

type PortfolioPropertyRow = {
  id: string;
  name: string | null;
  core_property_id: string | null;
};

type PortfolioRentalRow = {
  id: string;
  property_id: string;
  unit_id?: string | null;
  rent_type: string | null;
  rent_monthly: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UnitDefinition = {
  ref: string;
  title: string;
  matcher: (booking: FinanceEntry) => boolean;
  rentalMatcher?: (rental: PortfolioRentalRow) => boolean;
  expectedMode?: "sum" | "largest" | "single";
};

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonthRange(baseDate = new Date()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const previousMonthEndWindowStart = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 25);
  return {
    label: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(start),
    start: toIso(start),
    end: toIso(end),
    previousMonthEndWindowStart: toIso(previousMonthEndWindowStart),
    year: start.getFullYear(),
    month: start.getMonth() + 1,
  };
}

function isDateInRange(value: string | null | undefined, start: string, end: string): boolean {
  return Boolean(value) && value! >= start && value! <= end;
}

function shiftIsoDateByMonths(value: string, months: number): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return toIso(new Date(year, month - 1 + months, day));
}

function shiftIsoDateByDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return toIso(new Date(year, month - 1, day + days));
}

function bookingDayOfMonth(value: string | null | undefined): number | null {
  if (!value) return null;
  const day = Number(value.slice(8, 10));
  return Number.isFinite(day) ? day : null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("de-DE").format(date);
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function addMonthsToYearMonth(year: number, month: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function monthRangeFromYearMonth(year: number, month: number) {
  return currentMonthRange(new Date(year, month - 1, 1));
}

function buildDisplayedPeriods(year: number, month: number, mode: PeriodMode) {
  if (mode === "month") return [monthRangeFromYearMonth(year, month)];
  const now = new Date();
  const currentYear = now.getFullYear();
  const maxMonth = year === currentYear ? now.getMonth() + 1 : 12;
  return Array.from({ length: maxMonth }, (_, index) => monthRangeFromYearMonth(year, index + 1));
}

function rentStartDateForObject(objectLabel: string): string | null {
  const normalized = normalizeReferenceText(objectLabel);
  if (normalized.includes("hohenloher")) return "2025-04-01";
  if (normalized.includes("rosenstein")) return "2025-11-01";
  return null;
}

function isInactiveForRentMonth(objectLabel: string, monthStart: string): boolean {
  const startDate = rentStartDateForObject(objectLabel);
  return Boolean(startDate && monthStart < startDate);
}

function resolveRentStatus(paidAmount: number, expectedAmount: number | null, inactive: boolean): RentStatus {
  if (inactive) return "inactive";
  if (expectedAmount !== null) {
    if (Math.abs(paidAmount - expectedAmount) <= 0.01) return "paid";
    if (paidAmount > 0) return "partial";
    return "missing";
  }
  return paidAmount > 0 ? "paid" : "missing";
}

function statusLabel(status: RentStatus): string {
  if (status === "paid") return "BEZAHLT";
  if (status === "partial") return "TEILWEISE";
  if (status === "inactive") return "NEUTRAL";
  if (status === "vacant") return "LEERSTAND";
  return "FEHLT";
}

function statusClass(status: RentStatus): string {
  if (status === "paid") return "is-paid";
  if (status === "partial") return "is-partial";
  if (status === "inactive") return "is-inactive";
  if (status === "vacant") return "is-vacant";
  return "is-missing";
}

function normalizeFilterText(value: string | null | undefined): string {
  return normalizeReferenceText(value).replace(/\s+/g, " ").trim();
}

function rentalOverlapsMonth(rental: PortfolioRentalRow, start: string, end: string): boolean {
  if (!rental.start_date) return false;
  if (rental.start_date > end) return false;
  if (rental.end_date && rental.end_date < start) return false;
  return true;
}

function rentalMatchesUnit(rental: PortfolioRentalRow, unit: UnitDefinition): boolean {
  if (unit.rentalMatcher) return unit.rentalMatcher(rental);

  const unitText = normalizeReferenceText(`${unit.ref} ${unit.title}`);
  const rentalText = normalizeReferenceText(`${rental.rent_type ?? ""} ${rental.unit_id ?? ""}`);
  const compactRental = compactReferenceText(`${rental.rent_type ?? ""} ${rental.unit_id ?? ""}`);
  const compactUnit = compactReferenceText(`${unit.ref} ${unit.title}`);
  const rentalLooksGarage =
    rentalText.includes("garage") ||
    rentalText.includes("tiefgarage") ||
    rentalText.includes("stellplatz") ||
    rentalText.includes("tg") ||
    rentalText.includes("p250") ||
    rentalText.includes("p253") ||
    rentalText.includes("p254");

  if (!rentalText) return true;
  if (unit.ref === "hauptmiete" || unit.ref === "wohnung") return !rentalLooksGarage;
  if (unit.ref === "garage") return rentalLooksGarage;
  return rentalText.includes(unitText) || unitText.includes(rentalText) || compactRental.includes(compactUnit) || compactUnit.includes(compactRental);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function candidatePropertyIdsForObject(
  object: { id: string; code: string | null; label: string },
  portfolioRows: Array<{ property_id: string; portfolio_property_id: string | null; property_name: string }>,
  portfolioProperties: PortfolioPropertyRow[],
): string[] {
  const objectName = normalizeFilterText(object.label);
  const ids = [object.id];

  for (const row of portfolioRows) {
    if (String(row.property_id) === object.id || row.portfolio_property_id === object.id || normalizeFilterText(row.property_name) === objectName) {
      ids.push(row.property_id, row.portfolio_property_id ?? "");
    }
  }

  for (const property of portfolioProperties) {
    const propertyName = normalizeFilterText(property.name);
    if (
      property.id === object.id ||
      property.core_property_id === object.id ||
      (propertyName && (propertyName === objectName || propertyName.includes(objectName) || objectName.includes(propertyName)))
    ) {
      ids.push(property.id, property.core_property_id ?? "");
    }
  }

  return uniqueStrings(ids);
}

function expectedRentFromRentals(
  rentals: PortfolioRentalRow[],
  candidateIds: string[],
  unit: UnitDefinition,
  start: string,
  end: string,
): { expectedAmount: number | null; source: string; activeRentalCount: number } {
  const idSet = new Set(candidateIds);
  const matches = rentals.filter((rental) => idSet.has(String(rental.property_id)) && rentalOverlapsMonth(rental, start, end) && rentalMatchesUnit(rental, unit));
  const amounts = matches.map((rental) => Number(rental.rent_monthly) || 0).filter((amount) => amount > 0);
  let amount = 0;

  if (unit.expectedMode === "sum") {
    amount = amounts.reduce((sum, value) => sum + value, 0);
  } else if (unit.expectedMode === "largest") {
    amount = Math.max(0, ...amounts);
  } else {
    // Einzelobjekte wie Lilienthaler Str. haben teils doppelte historische
    // Vermietungszeiträume. Für den Mieteingang zählt pro Monat genau der
    // fachlich gültige Zeitraum aus Portfolio -> Vermietungszeiträume, nicht
    // die Summe überlappender Korrektur-/Duplikatzeilen.
    const selected = [...matches]
      .filter((rental) => Number(rental.rent_monthly) > 0)
      .sort((a, b) => {
        const startCompare = String(b.start_date ?? "").localeCompare(String(a.start_date ?? ""));
        if (startCompare !== 0) return startCompare;
        const endCompare = String(b.end_date ?? "9999-12-31").localeCompare(String(a.end_date ?? "9999-12-31"));
        if (endCompare !== 0) return endCompare;
        const updatedCompare = String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
        if (updatedCompare !== 0) return updatedCompare;
        return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      })[0];
    amount = Number(selected?.rent_monthly) || 0;
  }

  return {
    expectedAmount: amount > 0 ? amount : null,
    source: matches.length ? "Portfolio > Vermietungszeiträume" : "Kein aktiver Vermietungszeitraum",
    activeRentalCount: matches.length,
  };
}


function normalizeReferenceText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactReferenceText(value: string | null | undefined): string {
  return normalizeReferenceText(value).replace(/\s+/g, "");
}

function bookingReferenceText(booking: FinanceEntry): string {
  return `${booking.category ?? ""} ${booking.note ?? ""} ${booking.objekt_code ?? ""}`;
}

function objectNumberFromText(value: string | null | undefined): string | null {
  const normalized = normalizeReferenceText(value);
  const match = normalized.match(/(?:objekt|object)\s*0*([0-9]+)/);
  return match?.[1] ?? null;
}

function streetTokens(value: string | null | undefined): string[] {
  return referenceTokens(value).filter((token) => !/^\d+$/.test(token));
}

function referenceTokens(value: string | null | undefined): string[] {
  return normalizeReferenceText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !["objekt", "object", "wohnung", "miete", "miet", "euro", "eur", "und", "der", "die", "das", "str", "strasse", "straße"].includes(token));
}

function enoughTokenOverlap(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = referenceTokens(left);
  const b = referenceTokens(right);
  if (!a.length || !b.length) return false;
  const overlap = a.filter((token) => b.some((other) => other === token || other.includes(token) || token.includes(other)));
  return overlap.length >= Math.min(2, Math.min(a.length, b.length));
}

function isRentLikeText(value: string | null | undefined): boolean {
  const text = normalizeReferenceText(value);
  return (
    text.length === 0 ||
    text.includes("miete") ||
    text.includes("miet") ||
    text.includes("kaltmiete") ||
    text.includes("warmmiete") ||
    text.includes("pacht") ||
    text.includes("zahlung") ||
    text.includes("eingang")
  );
}

function isLikelyRentOrObjectIncome(booking: FinanceEntry): boolean {
  if (booking.entry_type !== "income" || booking.amount <= 0) return false;
  return isRentLikeText(`${booking.category ?? ""} ${booking.note ?? ""}`);
}


function isClearlyExcludedFromRent(booking: FinanceEntry): boolean {
  const text = normalizeReferenceText(bookingReferenceText(booking));
  return (
    text.includes("nebenkosten") ||
    text.includes("nk") ||
    text.includes("betriebskosten") ||
    text.includes("kaution") ||
    text.includes("erstattung") ||
    text.includes("rueckzahlung") ||
    text.includes("ruckzahlung") ||
    text.includes("darlehen") ||
    text.includes("loan") ||
    text.includes("zinsen") ||
    text.includes("versicherung") ||
    text.includes("steuer")
  );
}

function isServiceChargeRentComponent(booking: FinanceEntry): boolean {
  const text = normalizeReferenceText(bookingReferenceText(booking));
  return text.includes("mietbestandteil nk") || text.includes("nebenkosten") || text.includes("betriebskosten") || text.includes("hausgeld") || text.includes("nk");
}

function isHohenloherRentComponent(booking: FinanceEntry, objectId: string, objectCode: string | null | undefined, objectLabel: string, start: string, end: string): boolean {
  if (!normalizeReferenceText(objectLabel).includes("hohenloher")) return false;
  if (booking.entry_type !== "income" || booking.amount <= 0) return false;
  const effectiveDate = attributedRentDateForUnit(booking, objectLabel, "hauptmiete");
  const inMonth = isDateInRange(effectiveDate, start, end);
  if (!inMonth || !isServiceChargeRentComponent(booking)) return false;
  return directObjectMatch(booking, objectId, objectCode) || bookingMatchesObject(booking, objectId, objectCode, objectLabel);
}

function hasStrictRentText(booking: FinanceEntry): boolean {
  if (isClearlyExcludedFromRent(booking)) return false;
  const text = normalizeReferenceText(`${booking.category ?? ""} ${booking.note ?? ""}`);
  return (
    text.includes("miete") ||
    text.includes("mieteingang") ||
    text.includes("kaltmiete") ||
    text.includes("warmmiete") ||
    text.includes("monatsmiete") ||
    text.includes("wohnungsmiete") ||
    text.includes("pacht")
  );
}

function matchesTenantName(booking: FinanceEntry, tenant: TenantInfo): boolean {
  if (isClearlyExcludedFromRent(booking)) return false;
  const tenantTokens = referenceTokens(`${tenant.firstName} ${tenant.lastName}`);
  if (!tenantTokens.length) return false;
  const text = normalizeReferenceText(bookingReferenceText(booking));
  return tenantTokens.some((token) => text.includes(token));
}

function directObjectMatch(booking: FinanceEntry, objectId: string, objectCode: string | null | undefined): boolean {
  const exactIdMatch = String(booking.object_id ?? "") === String(objectId);
  const exactCodeMatch = Boolean(objectCode) && normalizeReferenceText(booking.objekt_code) === normalizeReferenceText(objectCode);
  return exactIdMatch || exactCodeMatch;
}

function isStrictRentBookingForObject(booking: FinanceEntry, objectId: string, objectCode: string | null | undefined, start: string, end: string): boolean {
  const exactIdMatch = String(booking.object_id ?? "") === String(objectId);
  const exactCodeMatch = Boolean(objectCode) && normalizeReferenceText(booking.objekt_code) === normalizeReferenceText(objectCode);
  const isIncome = booking.entry_type === "income";
  const effectiveDate = attributedRentDateForUnit(booking, "", "");
  const inMonth = isDateInRange(effectiveDate, start, end);

  return (exactIdMatch || exactCodeMatch) && isIncome && hasStrictRentText(booking) && inMonth;
}


function bookingMatchesObject(booking: FinanceEntry, objectId: string, objectCode: string | null | undefined, objectLabel: string): boolean {
  if (directObjectMatch(booking, objectId, objectCode)) return true;

  const refText = normalizeReferenceText(bookingReferenceText(booking));
  const labelText = normalizeReferenceText(objectLabel);
  const codeText = normalizeReferenceText(objectCode);
  const labelNumber = objectNumberFromText(objectLabel) ?? objectNumberFromText(objectCode);
  const bookingNumber = objectNumberFromText(booking.objekt_code) ?? objectNumberFromText(booking.note) ?? objectNumberFromText(booking.category);

  if (codeText && (refText.includes(codeText) || codeText.includes(refText))) return true;
  if (labelText && (refText.includes(labelText) || labelText.includes(refText))) return true;
  if (labelNumber && bookingNumber && labelNumber === bookingNumber) return true;

  const targetStreetTokens = streetTokens(objectLabel);
  if (targetStreetTokens.length && targetStreetTokens.some((token) => refText.includes(token))) return true;

  // Fallback für Buchungen, deren Objekt-Code/Objekt-ID nicht sauber gesetzt wurde,
  // aber in Notiz/Kategorie die Adresse, Objekt-Nr. oder der Objektname steht.
  return enoughTokenOverlap(refText, objectLabel) || enoughTokenOverlap(refText, objectCode);
}


function isPositiveIncomeInMonthForObject(booking: FinanceEntry, objectId: string, objectCode: string | null | undefined, objectLabel: string, start: string, end: string): boolean {
  const effectiveDate = attributedRentDateForUnit(booking, objectLabel, "hauptmiete");
  const inMonth = isDateInRange(effectiveDate, start, end) || isDateInRange(booking.booking_date, start, end);
  if (!inMonth || booking.entry_type !== "income" || booking.amount <= 0 || isClearlyExcludedFromRent(booking)) return false;

  // Priorität für echte Miet-Referenzen aus Monate/Buchungen. Dadurch wird ein Eingang
  // ab dem 25. mit Referenz "Miete" sauber als Folgemonatsmiete erkannt.
  if (hasStrictRentText(booking) && directObjectMatch(booking, objectId, objectCode)) return true;

  // Fallback für ältere Buchungen ohne saubere Kategorie: nur wenn objektbezogen und rentenähnlich.
  return isLikelyRentOrObjectIncome(booking) && bookingMatchesObject(booking, objectId, objectCode, objectLabel);
}

function getUnitDefinitions(objectLabel: string): UnitDefinition[] {
  const normalizedLabel = normalizeReferenceText(objectLabel);

  if (normalizedLabel.includes("further") || normalizedLabel.includes("fuerther")) {
    return [
      {
        ref: "wohnung",
        title: "Wohnung",
        expectedMode: "largest",
        matcher: (booking) => {
          const text = normalizeReferenceText(bookingReferenceText(booking));
          return !(text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz"));
        },
        rentalMatcher: (rental) => {
          const text = normalizeReferenceText(`${rental.rent_type ?? ""} ${rental.unit_id ?? ""}`);
          return !(
            text.includes("garage") ||
            text.includes("tiefgarage") ||
            text.includes("stellplatz") ||
            text.includes("tg")
          );
        },
      },
      {
        ref: "garage",
        title: "Garage",
        matcher: (booking) => {
          const text = normalizeReferenceText(bookingReferenceText(booking));
          return text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz");
        },
        rentalMatcher: (rental) => {
          const text = normalizeReferenceText(`${rental.rent_type ?? ""} ${rental.unit_id ?? ""}`);
          return text.includes("garage") || text.includes("tiefgarage") || text.includes("stellplatz") || text.includes("tg");
        },
      },
    ];
  }

  if (normalizedLabel.includes("rosenstein")) {
    const garages = [
      { ref: "P250 - E008440000121", title: "Garage 1" },
      { ref: "P253 - E008440000122", title: "Garage 2" },
      { ref: "P254 - E008440000123", title: "Garage 3" },
    ];

    // Rosensteinstraße hat laut Bestand nur 3 Garagen/Stellplätze und keine Wohnung.
    // Daher darf im Mieteingang keine zusätzliche Zeile "Wohnung / Hauptmiete"
    // erzeugt werden; die drei Garagen behalten ihre bisherigen Matcher/Funktionen.
    return garages.map((garage) => ({
      ref: garage.ref,
      title: garage.title,
      matcher: (booking: FinanceEntry) => {
        const text = compactReferenceText(bookingReferenceText(booking));
        return compactReferenceText(garage.ref).split("").length > 0 && (
          text.includes(compactReferenceText(garage.ref)) ||
          text.includes(compactReferenceText(garage.title)) ||
          text.includes(compactReferenceText(garage.ref.split(" - ")[0] ?? "")) ||
          text.includes(compactReferenceText(garage.ref.split(" - ")[1] ?? ""))
        );
      },
      rentalMatcher: (rental: PortfolioRentalRow) => {
        const text = compactReferenceText(`${rental.rent_type ?? ""} ${rental.unit_id ?? ""}`);
        const parkingCode = compactReferenceText(garage.ref.split(" - ")[0] ?? "");
        const unitCode = compactReferenceText(garage.ref.split(" - ")[1] ?? "");
        const title = compactReferenceText(garage.title);
        return Boolean(
          (parkingCode && text.includes(parkingCode)) ||
          (unitCode && text.includes(unitCode)) ||
          (title && text.includes(title))
        );
      },
    }));
  }

  return [{ ref: "hauptmiete", title: "Miete", matcher: () => true }];
}

function isFuertherObject(objectLabel: string): boolean {
  const normalizedLabel = normalizeReferenceText(objectLabel);
  return normalizedLabel.includes("further") || normalizedLabel.includes("fuerther");
}

function isLilienthalerObject(objectLabel: string): boolean {
  return normalizeReferenceText(objectLabel).includes("lilienthaler");
}

function isLilienthalerRentBookingForObject(
  booking: FinanceEntry,
  object: { id: string; code: string | null; label: string },
): boolean {
  return (
    booking.entry_type === "income" &&
    booking.amount > 0 &&
    hasStrictRentText(booking) &&
    (directObjectMatch(booking, object.id, object.code) || bookingMatchesObject(booking, object.id, object.code, object.label))
  );
}

function lilienthalerBookingAllocation(
  allKnownBookings: FinanceEntry[],
  object: { id: string; code: string | null; label: string },
  unit: UnitDefinition,
  period: ReturnType<typeof monthRangeFromYearMonth>,
  expectedAmount: number | null,
): { paidAmount: number; lastBookingDate: string | null } | null {
  if (!isLilienthalerObject(object.label) || unit.ref !== "hauptmiete" || expectedAmount === null) return null;

  const objectRentBookings = allKnownBookings
    .filter((booking) => booking.booking_date && isLilienthalerRentBookingForObject(booking, object) && unit.matcher(booking))
    .sort((a, b) => String(a.booking_date ?? "").localeCompare(String(b.booking_date ?? "")));

  const currentMonthBookings = objectRentBookings.filter((booking) => isDateInRange(booking.booking_date, period.start, period.end));
  const currentMonthTotal = currentMonthBookings.reduce((sum, booking) => sum + booking.amount, 0);
  const currentMonthDates = currentMonthBookings.map((booking) => booking.booking_date).filter(Boolean).sort() as string[];

  if (currentMonthBookings.length > 0) {
    const isCatchUpPayment = currentMonthBookings.some((booking) => {
      const text = normalizeReferenceText(bookingReferenceText(booking));
      return text.includes("nachzahlung") || booking.amount >= expectedAmount * 1.7;
    });

    return {
      paidAmount: isCatchUpPayment ? expectedAmount : currentMonthTotal,
      lastBookingDate: currentMonthDates[currentMonthDates.length - 1] ?? null,
    };
  }

  const nextMonth = addMonthsToYearMonth(period.year, period.month, 1);
  const nextPeriod = monthRangeFromYearMonth(nextMonth.year, nextMonth.month);
  const catchUpBooking = objectRentBookings.find((booking) => {
    if (!booking.booking_date || !isDateInRange(booking.booking_date, nextPeriod.start, nextPeriod.end)) return false;
    const day = bookingDayOfMonth(booking.booking_date);
    const text = normalizeReferenceText(bookingReferenceText(booking));
    return day !== null && day <= 10 && (text.includes("nachzahlung") || booking.amount >= expectedAmount * 1.7);
  });

  if (catchUpBooking) {
    return {
      paidAmount: expectedAmount,
      lastBookingDate: catchUpBooking.booking_date ?? null,
    };
  }

  return null;
}



function isFuertherWohnungUnit(objectLabel: string, unitRef: string): boolean {
  return isFuertherObject(objectLabel) && unitRef === "wohnung";
}

function isGarageLikeBooking(booking: FinanceEntry): boolean {
  const text = normalizeReferenceText(bookingReferenceText(booking));
  return text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz");
}

function attributedRentDateForUnit(booking: FinanceEntry, objectLabel: string, unitRef: string): string | null {
  void unitRef;
  if (!booking.booking_date) return null;

  // Dauerregel für die Verknüpfung Monate/Buchungen -> Mieteingang:
  // Wenn ab dem 25. Monatstag ein Zahlungseingang mit Referenz/Kategorie "Miete" gebucht wird,
  // zählt dieser Eingang automatisch als Miete für den Folgemonat.
  // Beispiel: 672,33 € am 30.04. mit Referenz "Miete" zählt als Mai-Miete.
  const day = bookingDayOfMonth(booking.booking_date);
  const isHohenloherNkComponent =
    normalizeReferenceText(objectLabel).includes("hohenloher") &&
    isServiceChargeRentComponent(booking);
  const keepSameMonthForLilienthaler = isLilienthalerObject(objectLabel);

  if (
    day !== null &&
    (((day >= 25 && hasStrictRentText(booking)) && !keepSameMonthForLilienthaler) || (day >= 24 && isHohenloherNkComponent))
  ) {
    return shiftIsoDateByMonths(booking.booking_date, 1);
  }

  return booking.booking_date;
}

function isBookingRelevantForDisplayedMonth(booking: FinanceEntry, objectLabel: string, unitRef: string, start: string, end: string): boolean {
  const effectiveDate = attributedRentDateForUnit(booking, objectLabel, unitRef);
  return isDateInRange(effectiveDate, start, end) || isDateInRange(booking.booking_date, start, end);
}

function rentAmountKey(amount: number): string {
  return String(Math.round(Math.abs(amount) * 100));
}

function pickMostLikelySingleRentBooking(currentCandidates: FinanceEntry[], historicalCandidates: FinanceEntry[]): FinanceEntry[] {
  if (currentCandidates.length <= 1) return currentCandidates;

  // Miete für eine Einheit soll im Mieteingang nicht als Summe mehrerer
  // Bankbuchungen erscheinen. Wenn im Buchungsfenster mehrere mögliche Treffer
  // existieren, nehmen wir den wiederkehrenden Monatsbetrag bzw. den besten
  // Einzel-Treffer. So werden z. B. zusätzliche Zahlungen am Monatsende nicht
  // in die Fürther-Wohnung-Miete hineinsummiert.
  const amountFrequency = new Map<string, number>();
  for (const booking of historicalCandidates) {
    if (booking.amount <= 0) continue;
    const key = rentAmountKey(booking.amount);
    amountFrequency.set(key, (amountFrequency.get(key) ?? 0) + 1);
  }

  const recurringKeys = [...amountFrequency.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  for (const key of recurringKeys) {
    const matching = currentCandidates.filter((booking) => rentAmountKey(booking.amount) === key);
    if (matching.length) {
      return [matching.sort((a, b) => String(b.booking_date ?? '').localeCompare(String(a.booking_date ?? '')))[0]];
    }
  }

  const strictRentCandidates = currentCandidates.filter(hasStrictRentText);
  const source = strictRentCandidates.length ? strictRentCandidates : currentCandidates;

  // Letzter Zahlungseingang gewinnt; bei mehreren Buchungen am gleichen Tag nehmen
  // wir den kleineren plausiblen Betrag, damit Nebenzahlungen nicht addiert werden.
  const latestDate = source
    .map((booking) => booking.booking_date)
    .filter(Boolean)
    .sort()
    .pop();
  const latest = latestDate ? source.filter((booking) => booking.booking_date === latestDate) : source;
  return [latest.sort((a, b) => a.amount - b.amount)[0]];
}

function vacancyMatchesUnit(vacancy: UnitVacancy, object: { id: string; code: string | null; label: string }, unit: UnitDefinition): boolean {
  const propertyMatch =
    vacancy.property_id === object.id ||
    normalizeReferenceText(vacancy.object_code) === normalizeReferenceText(object.code) ||
    normalizeReferenceText(vacancy.object_label) === normalizeReferenceText(object.label);

  if (!propertyMatch) return false;

  const vacancyUnit = normalizeReferenceText(vacancy.unit_label);
  if (!vacancyUnit) return true;

  const unitRef = normalizeReferenceText(unit.ref);
  const unitTitle = normalizeReferenceText(unit.title);
  const compactVacancyUnit = compactReferenceText(vacancy.unit_label);
  const compactUnitRef = compactReferenceText(unit.ref);
  const compactUnitTitle = compactReferenceText(unit.title);
  const combinedUnitText = normalizeReferenceText(`${unit.ref} ${unit.title}`);

  if (vacancyUnit.includes(unitRef) || unitRef.includes(vacancyUnit) || vacancyUnit.includes(unitTitle) || unitTitle.includes(vacancyUnit)) return true;
  if (compactVacancyUnit && (compactUnitRef.includes(compactVacancyUnit) || compactUnitTitle.includes(compactVacancyUnit))) return true;

  const vacancyTokens = referenceTokens(vacancy.unit_label);
  return vacancyTokens.some((token) => combinedUnitText.includes(token) || compactUnitRef.includes(token));
}

function isEndedTenancyVacancySignal(vacancy: UnitVacancy): boolean {
  if (!vacancy.end_date) return false;
  if (vacancy.vacancy_type === "contract_ended" || vacancy.vacancy_type === "notice") return true;
  const text = normalizeReferenceText(`${vacancy.reason ?? ""} ${vacancy.notes ?? ""}`);
  return text.includes("kundigung") || text.includes("kuendigung") || text.includes("mietende") || text.includes("mietzeitraum") || text.includes("auszug");
}

function deriveOpenVacancyAfterEndedTenancy(vacancy: UnitVacancy, monthEnd: string): UnitVacancy | null {
  if (vacancy.status !== "ended" || !isEndedTenancyVacancySignal(vacancy)) return null;
  const startDate = shiftIsoDateByDays(vacancy.end_date!, 1);
  if (startDate > monthEnd) return null;
  return {
    ...vacancy,
    id: `manual-ended-tenancy-${vacancy.id}`,
    status: "active",
    start_date: startDate,
    end_date: null,
    reason: vacancy.reason ? `Leerstand nach ${vacancy.reason}` : "Leerstand nach beendetem Mietzeitraum",
  };
}

function isContractInMonth(contract: TenantContractProfileRow, start: string, end: string): boolean {
  if (contract.status === "vacant") return false;
  if (contract.start_date && contract.start_date > end) return false;
  if (contract.end_date && contract.end_date < start) return false;
  return contract.status !== "ended" || !contract.end_date || contract.end_date >= start;
}

function contractMatchesUnit(contract: TenantContractProfileRow, object: { id: string; code: string | null; label: string }, unit: UnitDefinition): boolean {
  const propertyMatch =
    String(contract.property_id ?? "") === String(object.id) ||
    normalizeReferenceText(contract.object_code) === normalizeReferenceText(object.code) ||
    normalizeReferenceText(contract.object_code) === normalizeReferenceText(object.label);
  if (!propertyMatch) return false;

  const contractUnit = compactReferenceText(contract.unit_label);
  if (!contractUnit) return true;
  const unitRef = compactReferenceText(unit.ref);
  const unitTitle = compactReferenceText(unit.title);
  const contractUnitText = normalizeReferenceText(contract.unit_label);
  const isContractGarage = contractUnitText.includes("garage") || contractUnitText.includes("tiefgarage") || contractUnitText.includes("stellplatz") || contractUnitText.includes("tg") || contractUnitText.includes("p250") || contractUnitText.includes("p253") || contractUnitText.includes("p254");

  if (unitRef === "hauptmiete") return !isContractGarage;
  if (unitRef === "wohnung") return !isContractGarage;
  if (unitRef === "garage") return isContractGarage;

  return contractUnit.includes(unitRef) || unitRef.includes(contractUnit) || contractUnit.includes(unitTitle) || unitTitle.includes(contractUnit);
}

function tenantInfoFromContract(contract: TenantContractProfileRow | undefined): TenantInfo {
  const tenant = contract?.tenant_profiles;
  if (!tenant) return emptyTenant;
  return {
    firstName: tenant.company_name || tenant.first_name || "",
    lastName: tenant.company_name ? "" : tenant.last_name || "",
    phone: tenant.phone || tenant.mobile || "",
    email: tenant.email || "",
  };
}

function DonutChart({ paid, partial, missing, inactive, vacant }: { paid: number; partial: number; missing: number; inactive: number; vacant: number }) {
  const total = paid + partial + missing + inactive + vacant;
  const paidPercent = total > 0 ? Math.round((paid / total) * 100) : 0;
  const partialPercent = total > 0 ? Math.round((partial / total) * 100) : 0;
  const missingPercent = total > 0 ? Math.round((missing / total) * 100) : 0;
  const inactivePercent = total > 0 ? Math.round((inactive / total) * 100) : 0;
  const paidEnd = paidPercent;
  const partialEnd = paidEnd + partialPercent;
  const missingEnd = partialEnd + missingPercent;
  const inactiveEnd = missingEnd + inactivePercent;
  return (
    <div className="tenant-donut-wrap">
      <div className="tenant-donut" style={{ background: `conic-gradient(#22c55e 0 ${paidEnd}%, #f59e0b ${paidEnd}% ${partialEnd}%, #ef4444 ${partialEnd}% ${missingEnd}%, #94a3b8 ${missingEnd}% ${inactiveEnd}%, #a1a1aa ${inactiveEnd}% 100%)` }}>
        <div>{paidPercent}%</div>
      </div>
      <span>Mieteingänge</span>
    </div>
  );
}

export default function Mietuebersicht() {
  // Ab dem 25. gebuchte Mieten zählen fachlich zum Folgemonat.
  // Deshalb startet der Mieteingang ab dem 25. automatisch im Folgemonat,
  // damit z. B. eine am 29.05. gebuchte "Juni 2026"-Miete sofort sichtbar ist.
  const recommendedMonthOffset = () => (new Date().getDate() >= 25 ? 1 : 0);
  const recommendedYearMonth = () => {
    const now = new Date();
    return addMonthsToYearMonth(now.getFullYear(), now.getMonth() + 1, recommendedMonthOffset());
  };
  const [selectedPeriod, setSelectedPeriod] = useState(() => recommendedYearMonth());
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const month = useMemo(() => {
    return monthRangeFromYearMonth(selectedPeriod.year, selectedPeriod.month);
  }, [selectedPeriod.year, selectedPeriod.month]);
  const displayedPeriods = useMemo(() => buildDisplayedPeriods(selectedPeriod.year, selectedPeriod.month, periodMode), [selectedPeriod.year, selectedPeriod.month, periodMode]);
  const appData = useAppData();
  const [monthBookings, setMonthBookings] = useState<FinanceEntry[]>([]);
  const [vacancies, setVacancies] = useState<UnitVacancy[]>([]);
  const [tenantInfo, setTenantInfo] = useState<Record<string, TenantInfo>>({});
  const [portfolioProperties, setPortfolioProperties] = useState<PortfolioPropertyRow[]>([]);
  const [portfolioRentals, setPortfolioRentals] = useState<PortfolioRentalRow[]>([]);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [objectFilter, setObjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<RentStatus | "all">("all");

  const sourceObjects = useMemo(() => {
    if (appData.objects.length) return appData.objects.map((object) => ({ id: object.id, code: object.code, label: object.label }));
    return appData.portfolioRows.map((row, index) => ({ id: row.property_id, code: `Objekt_${index + 1}`, label: row.property_name }));
  }, [appData.objects, appData.portfolioRows]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentMonthBookings() {
      const today = toIso(new Date());
      const { data, error } = await supabase
        .from("finance_entry")
        .select("id,object_id,objekt_code,entry_type,booking_date,amount,category,note,is_deleted")
        .eq("entry_type", "income")
        .eq("is_deleted", false)
        .gte("booking_date", "2023-12-25")
        .lte("booking_date", today)
        .order("booking_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.warn("Mieteingänge konnten nicht direkt geladen werden:", error);
        setMonthBookings([]);
        return;
      }

      setMonthBookings(((data ?? []) as Array<Partial<FinanceEntry>>).map((row) => ({
        id: row.id ?? null,
        object_id: row.object_id == null ? null : String(row.object_id),
        objekt_code: row.objekt_code ?? null,
        entry_type: row.entry_type ?? null,
        booking_date: row.booking_date ?? null,
        amount: Number(row.amount) || 0,
        category: row.category ?? null,
        note: row.note ?? null,
      })));
    }

    void loadCurrentMonthBookings();
    const handler = () => void loadCurrentMonthBookings();
    window.addEventListener("koenen:finance-entry-changed", handler);
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("koenen:finance-entry-changed", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPortfolioRentals() {
      try {
        const [propertiesRes, rentalsRes] = await Promise.all([
          supabase.from("portfolio_properties").select("id,name,core_property_id"),
          supabase.from("portfolio_property_rentals").select("id,property_id,unit_id,rent_type,rent_monthly,start_date,end_date,created_at,updated_at"),
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
        console.warn("Vermietungszeiträume konnten nicht geladen werden:", error);
        setPortfolioProperties([]);
        setPortfolioRentals([]);
      }
    }

    void loadPortfolioRentals();
    const handler = () => void loadPortfolioRentals();
    window.addEventListener("focus", handler);
    window.addEventListener("koenen:rentals-changed", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handler);
      window.removeEventListener("koenen:rentals-changed", handler);
    };
  }, []);

  useEffect(() => {
    if (!sourceObjects.length) return;
    let cancelled = false;

    async function loadVacancies() {
      try {
        const propertyIds = sourceObjects.map((object) => object.id);
        const labelByPropertyId = Object.fromEntries(sourceObjects.map((object) => [object.id, object.label]));
        const [manualRows, derivedRows] = await Promise.all([
          listVacancies(),
          listDerivedVacanciesFromEndedRentals(propertyIds, month.start, month.end, labelByPropertyId),
        ]);
        if (cancelled) return;
        const derivedManualRows = manualRows
          .map((row) => deriveOpenVacancyAfterEndedTenancy(row, month.end))
          .filter((row): row is UnitVacancy => Boolean(row));
        const activeManualRows = manualRows.filter((row) => isVacancyActiveInRange(row, month.start, month.end));
        const monthRows = [...activeManualRows, ...derivedManualRows, ...derivedRows].filter((row) => isVacancyInRange(row, month.start, month.end));
        setVacancies(monthRows);
      } catch (error) {
        if (cancelled) return;
        console.warn("Leerstände konnten nicht geladen werden:", error);
        setVacancies([]);
      }
    }

    void loadVacancies();
    const handler = () => void loadVacancies();
    window.addEventListener("koenen:vacancy-changed", handler);
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("koenen:vacancy-changed", handler);
      window.removeEventListener("focus", handler);
    };
  }, [sourceObjects, month.start, month.end]);

  useEffect(() => {
    if (!sourceObjects.length) return;

    let cancelled = false;

    async function loadTenantContracts() {
      try {
        const { data, error } = await supabase
          .from("tenant_contracts")
          .select("id,property_id,object_code,unit_label,start_date,end_date,status,tenant_profiles(first_name,last_name,company_name,email,phone,mobile)")
          .eq("is_deleted", false)
          .in("status", ["active", "planned", "ended"])
          .order("start_date", { ascending: false, nullsFirst: false });

        if (error) throw error;
        if (cancelled) return;

        const contracts = ((data ?? []) as unknown as TenantContractProfileRow[]).filter((contract) =>
          isContractInMonth(contract, month.start, month.end),
        );
        const nextTenantInfo: Record<string, TenantInfo> = {};

        for (const object of sourceObjects) {
          const units = getUnitDefinitions(object.label);
          for (const unit of units) {
            const tenantKey = units.length > 1 ? `${object.id}::${unit.ref}` : object.id;
            const contract = contracts.find((candidate) => contractMatchesUnit(candidate, object, unit));
            nextTenantInfo[tenantKey] = tenantInfoFromContract(contract);
            if (units.length === 1) nextTenantInfo[object.id] = nextTenantInfo[tenantKey];
          }
        }

        setTenantInfo(nextTenantInfo);
        setStatus((prev) => ({ ...prev, __global: "Mieterdaten aus tenant_profiles/tenant_contracts geladen." }));
      } catch (error) {
        if (cancelled) return;
        setTenantInfo({});
        setStatus((prev) => ({
          ...prev,
          __global: "Mieterstammdaten konnten nicht geladen werden. Bitte tenant_profiles/tenant_contracts prüfen.",
        }));
        console.warn("Mietuebersicht tenant contract load failed:", error);
      }
    }

    void loadTenantContracts();
    return () => {
      cancelled = true;
    };
  }, [sourceObjects, month.start, month.end]);

  const rows = useMemo<OverviewRow[]>(
    () =>
      sourceObjects.flatMap((object) => {
        const objectCandidateIds = candidatePropertyIdsForObject(object, appData.portfolioRows, portfolioProperties);
        const allKnownBookings = [...monthBookings, ...appData.entries].filter((booking, index, list) => {
          const key = booking.id != null ? `id:${booking.id}` : `${booking.object_id ?? ""}|${booking.objekt_code ?? ""}|${booking.booking_date ?? ""}|${booking.amount}|${booking.category ?? ""}|${booking.note ?? ""}`;
          return list.findIndex((other) => (other.id != null ? `id:${other.id}` : `${other.object_id ?? ""}|${other.objekt_code ?? ""}|${other.booking_date ?? ""}|${other.amount}|${other.category ?? ""}|${other.note ?? ""}`) === key) === index;
        });
        const units = getUnitDefinitions(object.label);
        return displayedPeriods.flatMap((period) => {
          const monthlyKnownBookings = allKnownBookings.filter((booking) =>
            isBookingRelevantForDisplayedMonth(booking, object.label, "hauptmiete", period.start, period.end)
          );
          const strictRentBookings = monthlyKnownBookings.filter((booking) =>
            isStrictRentBookingForObject(booking, object.id, object.code, period.start, period.end)
          );
          const monthlyIncomeBookings = monthlyKnownBookings.filter((booking) =>
            isPositiveIncomeInMonthForObject(booking, object.id, object.code, object.label, period.start, period.end)
          );
          const hohenloherComponents = monthlyKnownBookings.filter((booking) =>
            isHohenloherRentComponent(booking, object.id, object.code, object.label, period.start, period.end)
          );
          const relevantBookings = [...(strictRentBookings.length > 0 ? strictRentBookings : monthlyIncomeBookings), ...hohenloherComponents].filter((booking, index, list) => {
            const key = booking.id != null ? `id:${booking.id}` : `${booking.object_id ?? ""}|${booking.objekt_code ?? ""}|${booking.booking_date ?? ""}|${booking.amount}|${booking.category ?? ""}|${booking.note ?? ""}`;
            return list.findIndex((other) => (other.id != null ? `id:${other.id}` : `${other.object_id ?? ""}|${other.objekt_code ?? ""}|${other.booking_date ?? ""}|${other.amount}|${other.category ?? ""}|${other.note ?? ""}`) === key) === index;
          });

          return units.map((unit) => {
            const tenantKey = units.length > 1 ? `${object.id}::${unit.ref}` : object.id;
            const tenantForMatch = tenantInfo[tenantKey] ?? tenantInfo[object.id] ?? emptyTenant;
            const vacancy = vacancies.find((candidate) => vacancyMatchesUnit(candidate, object, unit) && isVacancyInRange(candidate, period.start, period.end));
            let unitBookings = relevantBookings.filter(unit.matcher);

            if (isFuertherWohnungUnit(object.label, unit.ref)) {
              const matchesFuertherWohnungRent = (booking: FinanceEntry, requireCurrentMonth: boolean) => {
                if (booking.entry_type !== "income" || booking.amount <= 0) return false;
                if (isGarageLikeBooking(booking)) return false;
                if (isClearlyExcludedFromRent(booking)) return false;

                const effectiveDate = attributedRentDateForUnit(booking, object.label, unit.ref);
                if (requireCurrentMonth && !isDateInRange(effectiveDate, period.start, period.end) && !isDateInRange(booking.booking_date, period.start, period.end)) return false;

                const isRentPayment = hasStrictRentText(booking) || matchesTenantName(booking, tenantForMatch);
                if (!isRentPayment) return false;

                if (directObjectMatch(booking, object.id, object.code)) return true;
                return bookingMatchesObject(booking, object.id, object.code, object.label);
              };

              const currentCandidates = monthlyKnownBookings.filter((booking) => matchesFuertherWohnungRent(booking, true));
              const historicalCandidates = allKnownBookings.filter((booking) => matchesFuertherWohnungRent(booking, false));
              unitBookings = pickMostLikelySingleRentBooking(currentCandidates, historicalCandidates);
            }

            if (unitBookings.length === 0 && (tenantForMatch.firstName || tenantForMatch.lastName)) {
              const tenantTokens = referenceTokens(`${tenantForMatch.firstName} ${tenantForMatch.lastName}`);
              unitBookings = monthlyKnownBookings.filter((booking) => {
                const effectiveDate = attributedRentDateForUnit(booking, object.label, unit.ref);
                const inMonth = isDateInRange(effectiveDate, period.start, period.end) || isDateInRange(booking.booking_date, period.start, period.end);
                if (!inMonth || booking.entry_type !== "income" || booking.amount <= 0 || isClearlyExcludedFromRent(booking)) return false;
                const text = normalizeReferenceText(bookingReferenceText(booking));
                return tenantTokens.some((token) => text.includes(token));
              });
            }

            if (units.length > 1 && unit.ref === "hauptmiete" && unitBookings.length === 0) {
              unitBookings = relevantBookings.filter((booking) => {
                const text = normalizeReferenceText(bookingReferenceText(booking));
                return !(text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz") || text.includes("p250") || text.includes("p253") || text.includes("p254"));
              });
            }
            const rentalReference = expectedRentFromRentals(portfolioRentals, objectCandidateIds, unit, period.start, period.end);
            const expectedAmount = rentalReference.expectedAmount;
            const expectedSource = rentalReference.source;
            const inactive = rentalReference.activeRentalCount === 0 || isInactiveForRentMonth(object.label, period.start);
            const lilienthalerAllocation = lilienthalerBookingAllocation(allKnownBookings, object, unit, period, expectedAmount);
            const bookingAmount = lilienthalerAllocation?.paidAmount ?? unitBookings.reduce((sum, booking) => sum + booking.amount, 0);
            const paidAmount = vacancy || inactive ? 0 : bookingAmount;
            const sortedDates = unitBookings.map((booking) => booking.booking_date).filter(Boolean).sort() as string[];
            const lastBookingDate = lilienthalerAllocation?.lastBookingDate ?? (sortedDates.length ? sortedDates[sortedDates.length - 1] : null);

            return {
              objectId: object.id,
              objectCode: object.code,
              tenantKey: `${tenantKey}::${period.year}-${String(period.month).padStart(2, "0")}`,
              tenantLookupKey: tenantKey,
              label: object.label,
              unitLabel: units.length > 1 ? unit.title : undefined,
              referenceLabel: units.length > 1 ? unit.ref : undefined,
              paidAmount,
              expectedAmount,
              lastBookingDate: vacancy || inactive ? null : lastBookingDate,
              status: vacancy ? "vacant" : resolveRentStatus(paidAmount, expectedAmount, inactive),
              vacancyReason: vacancy?.reason ?? vacancy?.notes ?? null,
              periodLabel: period.label,
              year: period.year,
              month: period.month,
              expectedSource,
            };
          });
        });
      }),
    [sourceObjects, appData, portfolioProperties, monthBookings, displayedPeriods, tenantInfo, vacancies, portfolioRentals]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const objectMatches = !objectFilter || row.objectId === objectFilter;
      const statusMatches = statusFilter === "all" || row.status === statusFilter;
      return objectMatches && statusMatches;
    });
  }, [rows, objectFilter, statusFilter]);

  const resetToRecommendedMonth = () => setSelectedPeriod(recommendedYearMonth());
  const shiftSelectedMonth = (offset: number) => setSelectedPeriod((value) => addMonthsToYearMonth(value.year, value.month, offset));

  function openFilteredPdf() {
    const rowsHtml = filteredRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.periodLabel)}</td>
        <td>${escapeHtml(row.label)}${row.unitLabel ? `<br/><small>${escapeHtml(row.unitLabel)}</small>` : ""}</td>
        <td>${escapeHtml(statusLabel(row.status))}</td>
        <td class="right">${escapeHtml(formatCurrency(row.paidAmount))}</td>
        <td class="right">${escapeHtml(row.expectedAmount === null ? "—" : formatCurrency(row.expectedAmount))}</td>
        <td>${escapeHtml(row.expectedSource)}</td>
        <td>${escapeHtml(formatDate(row.lastBookingDate))}</td>
      </tr>
    `).join("");
    const printWindow = window.open("", "_blank", "width=960,height=1200");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Mieteingang ${escapeHtml(month.label)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:28px}
      h1{margin:0 0 6px;font-size:22px} .meta{color:#475569;margin-bottom:18px}
      table{width:100%;border-collapse:collapse;font-size:12px} th,td{padding:8px;border-bottom:1px solid #dbe3ee;text-align:left;vertical-align:top}
      th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.right{text-align:right}
      .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:16px 0}.kpi{border:1px solid #dbe3ee;padding:10px}.kpi b{display:block;font-size:16px;margin-top:4px}
      @media print{body{padding:0}.no-print{display:none}}
    </style></head><body>
      <button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 12px">Als PDF speichern / drucken</button>
      <h1>Mieteingang ${escapeHtml(month.label)}</h1>
      <div class="meta">Filter: Objekt "${escapeHtml(objectFilter || "Alle")}" · Status "${escapeHtml(statusFilter === "all" ? "Alle" : statusLabel(statusFilter))}"</div>
      <div class="kpis">
        <div class="kpi">Bezahlt<b>${stats.paid}</b></div>
        <div class="kpi">Teilweise<b>${stats.partial}</b></div>
        <div class="kpi">Fehlt<b>${stats.missing}</b></div>
        <div class="kpi">Neutral<b>${stats.inactive}</b></div>
        <div class="kpi">Leerstand<b>${stats.vacant}</b></div>
        <div class="kpi">Summe<b>${escapeHtml(formatCurrency(stats.amount))}</b></div>
      </div>
      <table><thead><tr><th>Zeitraum</th><th>Objekt</th><th>Status</th><th class="right">Eingang</th><th class="right">Sollmiete</th><th>Soll-Quelle</th><th>Letzter Eingang</th></tr></thead><tbody>${rowsHtml || `<tr><td colspan="7">Keine Ergebnisse.</td></tr>`}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print();},250)};</script>
    </body></html>`);
    printWindow.document.close();
  }

  const stats = useMemo(() => {
    const paid = filteredRows.filter((row) => row.status === "paid").length;
    const partial = filteredRows.filter((row) => row.status === "partial").length;
    const missing = filteredRows.filter((row) => row.status === "missing").length;
    const inactive = filteredRows.filter((row) => row.status === "inactive").length;
    const vacant = filteredRows.filter((row) => row.status === "vacant").length;
    return { paid, partial, missing, inactive, vacant, total: filteredRows.length, amount: filteredRows.reduce((sum, row) => sum + row.paidAmount, 0) };
  }, [filteredRows]);

  return (
    <div className="tenant-page">
      <header className="tenant-hero">
        <h1>Mieteingang</h1>
        <p>
          Abgleich von Buchhaltung und Portfolio-Vermietungszeiträumen: Ist-Zahlung, Sollmiete,
          Zeitraum und Abweichungen werden pro Objekt geprüft.
        </p>
        {status.__global ? <div className="tenant-message" style={{ marginTop: 12 }}>{status.__global}</div> : null}
      </header>

      <section className="tenant-dashboard-grid">
        <aside className="tenant-summary tenant-summary-top">
          <div>
            <h2>Zusammenfassung</h2>
            <p>{periodMode === "year" ? `Ganzes Jahr ${selectedPeriod.year}` : month.label}</p>
          </div>
          <DonutChart paid={stats.paid} partial={stats.partial} missing={stats.missing} inactive={stats.inactive} vacant={stats.vacant} />
          <div className="tenant-summary-lines">
            <div><span>Bezahlt</span><b>{stats.paid}</b></div>
            <div className="amber"><span>Teilweise</span><b>{stats.partial}</b></div>
            <div className="red"><span>Fehlt</span><b>{stats.missing}</b></div>
            <div className="gray"><span>Neutral</span><b>{stats.inactive}</b></div>
            <div className="gray"><span>Leerstand</span><b>{stats.vacant}</b></div>
            <div><span>Gesamt</span><b>{stats.total}</b></div>
          </div>
        </aside>

        <main className="tenant-card">
          <div className="tenant-card-head">
            <div>
              <h2>{periodMode === "year" ? `Mieteingänge ${selectedPeriod.year}` : `Mieteingänge ${month.label}`}</h2>
              <p>Soll: Portfolio → Vermietungszeiträume. Ist: Buchhaltung. Teilweise = weniger oder mehr als Sollmiete.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button type="button" onClick={() => shiftSelectedMonth(-1)} className="tenant-mini-button">← Vormonat</button>
                <button type="button" onClick={resetToRecommendedMonth} className="tenant-mini-button">Aktueller Mietmonat</button>
                <button type="button" onClick={() => shiftSelectedMonth(1)} className="tenant-mini-button">Folgemonat →</button>
              </div>
            </div>
            <div className="tenant-total-box">
              <span>Summe Zahlungseingänge</span>
              <strong>{formatCurrency(stats.amount)}</strong>
            </div>
          </div>

          <div className="tenant-search">
            <label>
              Objekt
              <select value={objectFilter} onChange={(event) => setObjectFilter(event.target.value)}>
                <option value="">Alle Objekte</option>
                {sourceObjects.map((object) => (
                  <option key={object.id} value={object.id}>{object.label}</option>
                ))}
              </select>
            </label>
            <label>
              Zeitraum
              <select value={periodMode} onChange={(event) => setPeriodMode(event.target.value as PeriodMode)}>
                <option value="month">Monat</option>
                <option value="year">Ganzes Jahr</option>
              </select>
            </label>
            <label>
              Monat
              <select value={selectedPeriod.month} disabled={periodMode === "year"} onChange={(event) => setSelectedPeriod((value) => ({ ...value, month: Number(event.target.value) }))}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{new Intl.DateTimeFormat("de-DE", { month: "long" }).format(new Date(2025, value - 1, 1))}</option>
                ))}
              </select>
            </label>
            <label>
              Jahr
              <input
                type="number"
                min="2024"
                max="2100"
                value={selectedPeriod.year}
                onChange={(event) => setSelectedPeriod((value) => ({ ...value, year: Number(event.target.value) || value.year }))}
              />
            </label>
            <label>
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RentStatus | "all")}>
                <option value="all">Alle</option>
                <option value="paid">Bezahlt</option>
                <option value="partial">Teilweise</option>
                <option value="missing">Fehlt</option>
                <option value="inactive">Neutral</option>
                <option value="vacant">Leerstand</option>
              </select>
            </label>
            <button type="button" onClick={openFilteredPdf} className="tenant-mini-button tenant-export-button">PDF exportieren</button>
          </div>

          {appData.error && <div className="tenant-message error">Fehler beim Laden: {appData.error}</div>}
          {appData.loading && <div className="tenant-message">Mieteingang wird geladen…</div>}

          {!appData.loading && filteredRows.length > 0 && (
            <div className="tenant-list">
              {filteredRows.map((row) => {
                const tenant = tenantInfo[row.tenantLookupKey] ?? tenantInfo[row.objectId] ?? emptyTenant;
                const vacant = row.status === "vacant";
                return (
                  <article key={row.tenantKey} className={`tenant-row ${statusClass(row.status)}`}>
                    <div className="tenant-row-top">
                      <div className="tenant-status"><span>{statusLabel(row.status)}</span></div>
                      <div className="tenant-unit"><small>{row.periodLabel}</small><b>{row.label}</b>{row.unitLabel ? <em style={{ display: "block", marginTop: 4, color: "#0f172a", fontStyle: "normal", fontWeight: 900 }}>{row.unitLabel}</em> : null}{row.referenceLabel && row.referenceLabel !== row.unitLabel ? <small style={{ display: "block", marginTop: 3 }}>Betreff-Referenz: {row.referenceLabel}</small> : null}</div>
                      <div className="tenant-amount"><small>Mieteingang</small><b>{vacant ? "Leerstand" : formatCurrency(row.paidAmount)}</b>{vacant && row.vacancyReason ? <small>{row.vacancyReason}</small> : null}</div>
                      <div className="tenant-date"><small>Sollmiete</small><b>{row.expectedAmount === null ? "—" : formatCurrency(row.expectedAmount)}</b><small style={{ marginTop: 4 }}>{row.expectedSource}</small>{normalizeReferenceText(row.label).includes("hohenloher") ? <small style={{ marginTop: 4 }}>{MIETBESTANDTEIL_NK_CATEGORY}: 270,00 € als Mietbestandteil</small> : null}<small style={{ marginTop: 4 }}>Letzter Eingang</small><b>{formatDate(row.lastBookingDate)}</b></div>
                    </div>
                    <div className="tenant-contact-grid" title="Mieterdaten werden zentral unter Mieter anlegen gepflegt">
                      <div><span>Vorname</span><b>{tenant.firstName || "—"}</b></div>
                      <div><span>Nachname</span><b>{tenant.lastName || "—"}</b></div>
                      <div><span>Telefon</span><b>{tenant.phone || "—"}</b></div>
                      <div><span>E-Mail</span><b>{tenant.email || "—"}</b></div>
                    </div>
                    <div className="tenant-row-note">
                      Mieterdaten sind hier nur lesbar · Pflege über Mieter anlegen
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!appData.loading && rows.length === 0 && <div className="tenant-message">Keine Objekte gefunden.</div>}
          {!appData.loading && rows.length > 0 && filteredRows.length === 0 && <div className="tenant-message">Keine Ergebnisse für diese Suche.</div>}
        </main>
      </section>
    </div>
  );
}
