import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAppData, type FinanceEntry } from "../state/AppDataContext";
import {
  emptyPropertyExtra,
  fetchPropertyExtras,
  loadLocalTenantExtras,
  mergeLocalSources,
  migrateLocalExtrasToSupabase,
  writeLocalTenantExtras,
  type PropertyExtraInfo,
} from "../services/propertyExtraService";
import {
  isVacancyActiveInRange,
  listDerivedVacanciesFromEndedRentals,
  listVacancies,
  type UnitVacancy,
} from "../services/vacancyService";

type TenantInfo = Pick<PropertyExtraInfo, "firstName" | "lastName" | "phone" | "email">;
type PaymentStatus = "paid" | "missing" | "vacant";
type OverviewRow = { objectId: string; objectCode: string | null; tenantKey: string; label: string; unitLabel?: string; referenceLabel?: string; paidAmount: number; lastBookingDate: string | null; status: PaymentStatus; vacancyReason?: string | null };

const emptyTenant: TenantInfo = { firstName: "", lastName: "", phone: "", email: "" };

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
  const inMonth = isDateInRange(effectiveDate, start, end);
  if (!inMonth || booking.entry_type !== "income" || booking.amount <= 0 || isClearlyExcludedFromRent(booking)) return false;

  // Priorität für echte Miet-Referenzen aus Monate/Buchungen. Dadurch wird ein Eingang
  // ab dem 25. mit Referenz "Miete" sauber als Folgemonatsmiete erkannt.
  if (hasStrictRentText(booking) && directObjectMatch(booking, objectId, objectCode)) return true;

  // Fallback für ältere Buchungen ohne saubere Kategorie: nur wenn objektbezogen und rentenähnlich.
  return isLikelyRentOrObjectIncome(booking) && bookingMatchesObject(booking, objectId, objectCode, objectLabel);
}

type UnitDefinition = { ref: string; title: string; matcher: (booking: FinanceEntry) => boolean };

function getUnitDefinitions(objectLabel: string): UnitDefinition[] {
  const normalizedLabel = normalizeReferenceText(objectLabel);

  if (normalizedLabel.includes("further") || normalizedLabel.includes("fuerther")) {
    return [
      {
        ref: "wohnung",
        title: "Wohnung",
        matcher: (booking) => {
          const text = normalizeReferenceText(bookingReferenceText(booking));
          return !(text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz"));
        },
      },
      {
        ref: "garage",
        title: "Garage",
        matcher: (booking) => {
          const text = normalizeReferenceText(bookingReferenceText(booking));
          return text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz");
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
    // Daher darf in der Mieterübersicht keine zusätzliche Zeile "Wohnung / Hauptmiete"
    // erzeugt werden; die drei Garagen behalten ihre bisherigen Matcher/Funktionen.
    return garages.map((garage) => ({
      ref: garage.ref,
      title: garage.title,
      matcher: (booking: FinanceEntry) => normalizeReferenceText(bookingReferenceText(booking)).includes(normalizeReferenceText(garage.ref)),
    }));
  }

  return [{ ref: "hauptmiete", title: "Miete", matcher: () => true }];
}

function isFuertherObject(objectLabel: string): boolean {
  const normalizedLabel = normalizeReferenceText(objectLabel);
  return normalizedLabel.includes("further") || normalizedLabel.includes("fuerther");
}



function isFuertherWohnungUnit(objectLabel: string, unitRef: string): boolean {
  return isFuertherObject(objectLabel) && unitRef === "wohnung";
}

function isGarageLikeBooking(booking: FinanceEntry): boolean {
  const text = normalizeReferenceText(bookingReferenceText(booking));
  return text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz");
}

function attributedRentDateForUnit(booking: FinanceEntry, _objectLabel: string, _unitRef: string): string | null {
  if (!booking.booking_date) return null;

  // Dauerregel für die Verknüpfung Monate/Buchungen -> Mieterübersicht:
  // Wenn ab dem 25. Monatstag ein Zahlungseingang mit Referenz/Kategorie "Miete" gebucht wird,
  // zählt dieser Eingang automatisch als Miete für den Folgemonat.
  // Beispiel: 672,33 € am 30.04. mit Referenz "Miete" zählt als Mai-Miete.
  const day = bookingDayOfMonth(booking.booking_date);
  if (day !== null && day >= 25 && hasStrictRentText(booking)) {
    return shiftIsoDateByMonths(booking.booking_date, 1);
  }

  return booking.booking_date;
}

function rentAmountKey(amount: number): string {
  return String(Math.round(Math.abs(amount) * 100));
}

function pickMostLikelySingleRentBooking(currentCandidates: FinanceEntry[], historicalCandidates: FinanceEntry[]): FinanceEntry[] {
  if (currentCandidates.length <= 1) return currentCandidates;

  // Miete für eine Einheit soll in der Mieterübersicht nicht als Summe mehrerer
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

function toTenantInfo(extra: Partial<PropertyExtraInfo> | undefined): TenantInfo {
  return {
    firstName: extra?.firstName ?? "",
    lastName: extra?.lastName ?? "",
    phone: extra?.phone ?? "",
    email: extra?.email ?? "",
  };
}

function loadStoredTenants(): Record<string, TenantInfo> {
  const extras = loadLocalTenantExtras();
  return Object.fromEntries(Object.entries(extras).map(([key, value]) => [key, toTenantInfo(value)]));
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
  return vacancyUnit.includes(unitRef) || unitRef.includes(vacancyUnit) || vacancyUnit.includes(unitTitle) || unitTitle.includes(vacancyUnit);
}

function DonutChart({ paid, missing, vacant }: { paid: number; missing: number; vacant: number }) {
  const total = paid + missing + vacant;
  const paidPercent = total > 0 ? Math.round((paid / total) * 100) : 0;
  const missingPercent = total > 0 ? Math.round((missing / total) * 100) : 0;
  return (
    <div className="tenant-donut-wrap">
      <div className="tenant-donut" style={{ background: `conic-gradient(#22c55e 0 ${paidPercent}%, #ef4444 ${paidPercent}% ${paidPercent + missingPercent}%, #a1a1aa ${paidPercent + missingPercent}% 100%)` }}>
        <div>{paidPercent}%</div>
      </div>
      <span>Mieteingänge</span>
    </div>
  );
}

export default function Mietuebersicht() {
  // Ab dem 25. gebuchte Mieten zählen fachlich zum Folgemonat.
  // Deshalb startet die Mieterübersicht ab dem 25. automatisch im Folgemonat,
  // damit z. B. eine am 29.05. gebuchte "Juni 2026"-Miete sofort sichtbar ist.
  const [monthOffset, setMonthOffset] = useState(() => (new Date().getDate() >= 25 ? 1 : 0));
  const month = useMemo(() => {
    const now = new Date();
    return currentMonthRange(new Date(now.getFullYear(), now.getMonth() + monthOffset, 1));
  }, [monthOffset]);
  const appData = useAppData();
  const [monthBookings, setMonthBookings] = useState<FinanceEntry[]>([]);
  const [vacancies, setVacancies] = useState<UnitVacancy[]>([]);
  const [tenantInfo, setTenantInfo] = useState<Record<string, TenantInfo>>(() => loadStoredTenants());
  const [, setFullExtras] = useState<Record<string, PropertyExtraInfo>>(() => mergeLocalSources());
  const [status, setStatus] = useState<Record<string, string>>({});

  const sourceObjects = useMemo(() => {
    if (appData.objects.length) return appData.objects.map((object) => ({ id: object.id, code: object.code, label: object.label }));
    return appData.portfolioRows.map((row, index) => ({ id: row.property_id, code: `Objekt_${index + 1}`, label: row.property_name }));
  }, [appData.objects, appData.portfolioRows]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentMonthBookings() {
      const { data, error } = await supabase
        .from("finance_entry")
        .select("id,object_id,objekt_code,entry_type,booking_date,amount,category,note,is_deleted")
        .eq("entry_type", "income")
        .eq("is_deleted", false)
        .gte("booking_date", month.previousMonthEndWindowStart)
        .lte("booking_date", month.end)
        .order("booking_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.warn("Mieteingänge konnten nicht direkt geladen werden:", error);
        setMonthBookings([]);
        return;
      }

      setMonthBookings(((data ?? []) as any[]).map((row) => ({
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
  }, [month.previousMonthEndWindowStart, month.end]);

  useEffect(() => {
    if (!sourceObjects.length) return;
    let cancelled = false;

    async function loadVacancies() {
      try {
        const propertyIds = sourceObjects.map((object) => object.id);
        const labelByPropertyId = Object.fromEntries(sourceObjects.map((object) => [object.id, object.label]));
        const [manualRows, derivedRows] = await Promise.all([
          listVacancies({ from: month.start, to: month.end }),
          listDerivedVacanciesFromEndedRentals(propertyIds, month.start, month.end, labelByPropertyId),
        ]);
        if (cancelled) return;
        const activeRows = [...manualRows, ...derivedRows].filter((row) => isVacancyActiveInRange(row, month.start, month.end));
        setVacancies(activeRows);
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
    const ids = sourceObjects.map((object) => object.id).filter(Boolean);
    if (!ids.length) return;

    let cancelled = false;

    async function loadSavedTenants() {
      const local = mergeLocalSources();
      try {
        const remote = await fetchPropertyExtras(ids);
        if (cancelled) return;

        const mergedExtras: Record<string, PropertyExtraInfo> = {};
        const mergedTenants: Record<string, TenantInfo> = {};

        for (const id of ids) {
          mergedExtras[id] = { ...emptyPropertyExtra, ...(local[id] ?? {}), ...(remote[id] ?? {}) };
          mergedTenants[id] = toTenantInfo(mergedExtras[id]);
        }

        setFullExtras((prev) => ({ ...prev, ...mergedExtras }));
        setTenantInfo((prev) => ({ ...prev, ...mergedTenants }));
        writeLocalTenantExtras({ ...local, ...mergedExtras });
        setStatus((prev) => ({ ...prev, __global: "Mieterdaten aus Supabase geladen." }));

        void migrateLocalExtrasToSupabase(ids, local, remote).catch((error) => {
          console.warn("Lokale Mieterdaten konnten nicht automatisch übernommen werden:", error);
        });
      } catch (error: any) {
        if (cancelled) return;
        const tenants = Object.fromEntries(Object.entries(local).map(([id, value]) => [id, toTenantInfo(value)]));
        setFullExtras((prev) => ({ ...local, ...prev }));
        setTenantInfo((prev) => ({ ...tenants, ...prev }));
        setStatus((prev) => ({
          ...prev,
          __global: "Supabase-Speichertabelle nicht erreichbar. Lokale Mieterdaten bleiben sichtbar.",
        }));
        console.warn("Mietuebersicht extra load failed:", error);
      }
    }

    void loadSavedTenants();
    return () => {
      cancelled = true;
    };
  }, [sourceObjects]);

  const rows = useMemo<OverviewRow[]>(
    () =>
      sourceObjects.flatMap((object) => {
        const allKnownBookings = [...monthBookings, ...appData.entries].filter((booking, index, list) => {
          const key = booking.id != null ? `id:${booking.id}` : `${booking.object_id ?? ""}|${booking.objekt_code ?? ""}|${booking.booking_date ?? ""}|${booking.amount}|${booking.category ?? ""}|${booking.note ?? ""}`;
          return list.findIndex((other) => (other.id != null ? `id:${other.id}` : `${other.object_id ?? ""}|${other.objekt_code ?? ""}|${other.booking_date ?? ""}|${other.amount}|${other.category ?? ""}|${other.note ?? ""}`) === key) === index;
        });
        const strictRentBookings = allKnownBookings.filter((booking) =>
          isStrictRentBookingForObject(booking, object.id, object.code, month.start, month.end)
        );
        const monthlyIncomeBookings = allKnownBookings.filter((booking) =>
          isPositiveIncomeInMonthForObject(booking, object.id, object.code, object.label, month.start, month.end)
        );
        const relevantBookings = strictRentBookings.length > 0 ? strictRentBookings : monthlyIncomeBookings;
        const units = getUnitDefinitions(object.label);
        return units.map((unit) => {
          const tenantKey = units.length > 1 ? `${object.id}::${unit.ref}` : object.id;
          const tenantForMatch = tenantInfo[tenantKey] ?? tenantInfo[object.id] ?? emptyTenant;
          const vacancy = vacancies.find((candidate) => vacancyMatchesUnit(candidate, object, unit));
          let unitBookings = relevantBookings.filter(unit.matcher);

          if (isFuertherWohnungUnit(object.label, unit.ref)) {
            const matchesFuertherWohnungRent = (booking: FinanceEntry, requireCurrentMonth: boolean) => {
              if (booking.entry_type !== "income" || booking.amount <= 0) return false;
              if (isGarageLikeBooking(booking)) return false;
              if (isClearlyExcludedFromRent(booking)) return false;

              const effectiveDate = attributedRentDateForUnit(booking, object.label, unit.ref);
              if (requireCurrentMonth && !isDateInRange(effectiveDate, month.start, month.end)) return false;

              const isRentPayment = hasStrictRentText(booking) || matchesTenantName(booking, tenantForMatch);
              if (!isRentPayment) return false;

              if (directObjectMatch(booking, object.id, object.code)) return true;
              return bookingMatchesObject(booking, object.id, object.code, object.label);
            };

            const currentCandidates = allKnownBookings.filter((booking) => matchesFuertherWohnungRent(booking, true));
            const historicalCandidates = allKnownBookings.filter((booking) => matchesFuertherWohnungRent(booking, false));
            unitBookings = pickMostLikelySingleRentBooking(currentCandidates, historicalCandidates);
          }

          // Zusätzlicher Fallback: Viele Bankbuchungen enthalten im Verwendungszweck nur den Namen
          // des Mieters, aber keine saubere Objekt-ID. Dann ordnen wir den Zahlungseingang über
          // Vor-/Nachname zu, statt die Einheit fälschlich als „FEHLT" zu markieren.
          if (unitBookings.length === 0 && (tenantForMatch.firstName || tenantForMatch.lastName)) {
            const tenantTokens = referenceTokens(`${tenantForMatch.firstName} ${tenantForMatch.lastName}`);
            unitBookings = allKnownBookings.filter((booking) => {
              const effectiveDate = attributedRentDateForUnit(booking, object.label, unit.ref);
              const inMonth = isDateInRange(effectiveDate, month.start, month.end);
              if (!inMonth || booking.entry_type !== "income" || booking.amount <= 0 || isClearlyExcludedFromRent(booking)) return false;
              const text = normalizeReferenceText(bookingReferenceText(booking));
              return tenantTokens.some((token) => text.includes(token));
            });
          }

          // Falls eine positive Objekt-Einnahme nicht eindeutig einer Garage/TG zugeordnet werden kann,
          // wird sie der Hauptmiete/Wohnung zugeordnet, damit die Mieterübersicht nicht fälschlich „FEHLT" zeigt.
          if (units.length > 1 && unit.ref === "hauptmiete" && unitBookings.length === 0) {
            unitBookings = relevantBookings.filter((booking) => {
              const text = normalizeReferenceText(bookingReferenceText(booking));
              return !(text.includes("garage") || text.includes("tiefgarage") || text.includes("tg") || text.includes("stellplatz") || text.includes("p250") || text.includes("p253") || text.includes("p254"));
            });
          }
          const bookingAmount = unitBookings.reduce((sum, booking) => sum + booking.amount, 0);
          const paidAmount = bookingAmount;
          const sortedDates = unitBookings.map((booking) => booking.booking_date).filter(Boolean).sort() as string[];

          return {
            objectId: object.id,
            objectCode: object.code,
            tenantKey,
            label: object.label,
            unitLabel: units.length > 1 ? unit.title : undefined,
            referenceLabel: units.length > 1 ? unit.ref : undefined,
            paidAmount,
            lastBookingDate: sortedDates.length ? sortedDates[sortedDates.length - 1] : null,
            status: vacancy ? "vacant" : paidAmount > 0 ? "paid" : "missing",
            vacancyReason: vacancy?.reason ?? vacancy?.notes ?? null,
          };
        });
      }),
    [sourceObjects, appData, monthBookings, tenantInfo, month.start, month.end, vacancies]
  );

  const resetToRecommendedMonth = () => setMonthOffset(new Date().getDate() >= 25 ? 1 : 0);

  const stats = useMemo(() => {
    const paid = rows.filter((row) => row.status === "paid").length;
    const vacant = rows.filter((row) => row.status === "vacant").length;
    const missing = rows.filter((row) => row.status === "missing").length;
    return { paid, missing, vacant, total: rows.length, amount: rows.reduce((sum, row) => sum + row.paidAmount, 0) };
  }, [rows]);

  return (
    <div className="tenant-page">
      <header className="tenant-hero">
        <h1>Mieter prüfen</h1>
        <p>
          Diese Seite kontrolliert Mieteingänge aus den vorhandenen Buchungen. Neue
          Mieterstammdaten werden zentral unter „Mieter anlegen“ gepflegt.
        </p>
        <div className="tenant-actions">
          <NavLink to="/mieter-anlegen">Mieter anlegen</NavLink>
          <NavLink to="/leerstand">Leerstand verwalten</NavLink>
          <NavLink to="/buchungen">Buchung / Mieteingang erfassen</NavLink>
          <NavLink to="/nebenkosten/wohnungen">Nebenkosten Wohnungen</NavLink>
          <NavLink to="/nebenkosten/tiefgarage">Nebenkosten TG</NavLink>
        </div>
        {status.__global ? <div className="tenant-message" style={{ marginTop: 12 }}>{status.__global}</div> : null}
      </header>

      <section className="tenant-layout">
        <main className="tenant-card">
          <div className="tenant-card-head">
            <div>
              <h2>Mieteingänge {month.label}</h2>
              <p>Prüfung: kompletter Mietmonat. Zahlungen ab dem 25. zählen automatisch zum Folgemonat.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button type="button" onClick={() => setMonthOffset((value) => value - 1)} className="tenant-mini-button">← Vormonat</button>
                <button type="button" onClick={resetToRecommendedMonth} className="tenant-mini-button">Aktueller Mietmonat</button>
                <button type="button" onClick={() => setMonthOffset((value) => value + 1)} className="tenant-mini-button">Folgemonat →</button>
              </div>
            </div>
            <strong>{formatCurrency(stats.amount)}</strong>
          </div>

          {appData.error && <div className="tenant-message error">Fehler beim Laden: {appData.error}</div>}
          {appData.loading && <div className="tenant-message">Mieterübersicht wird geladen…</div>}

          {!appData.loading && rows.length > 0 && (
            <div className="tenant-list">
              {rows.map((row) => {
                const tenant = tenantInfo[row.tenantKey] ?? tenantInfo[row.objectId] ?? emptyTenant;
                const missing = row.status === "missing";
                const vacant = row.status === "vacant";
                return (
                  <article key={row.tenantKey} className={`tenant-row ${vacant ? "is-vacant" : missing ? "is-missing" : "is-paid"}`}>
                    <div className="tenant-row-top">
                      <div className="tenant-status"><span>{vacant ? "LEERSTAND" : missing ? "FEHLT" : "BEZAHLT"}</span></div>
                      <div className="tenant-unit"><small>Einheit</small><b>{row.label}</b>{row.unitLabel ? <em style={{ display: "block", marginTop: 4, color: "#0f172a", fontStyle: "normal", fontWeight: 900 }}>{row.unitLabel}</em> : null}{row.referenceLabel && row.referenceLabel !== row.unitLabel ? <small style={{ display: "block", marginTop: 3 }}>Betreff-Referenz: {row.referenceLabel}</small> : null}</div>
                      <div className="tenant-amount"><small>Mieteingang</small><b>{vacant ? "Leerstand" : formatCurrency(row.paidAmount)}</b>{vacant && row.vacancyReason ? <small>{row.vacancyReason}</small> : null}</div>
                      <div className="tenant-date"><small>Letzter Eingang</small><b>{formatDate(row.lastBookingDate)}</b></div>
                    </div>
                    <div className="tenant-fields">
                      <input value={tenant.firstName} placeholder="Name" readOnly disabled title="Mieterdaten werden zentral unter Mieter anlegen gepflegt" />
                      <input value={tenant.lastName} placeholder="Nachname" readOnly disabled title="Mieterdaten werden zentral unter Mieter anlegen gepflegt" />
                      <input value={tenant.phone} placeholder="Telefon" readOnly disabled title="Mieterdaten werden zentral unter Mieter anlegen gepflegt" />
                      <input value={tenant.email} placeholder="E-Mail" type="email" readOnly disabled title="Mieterdaten werden zentral unter Mieter anlegen gepflegt" />
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                      <small>Mieterdaten sind hier nur lesbar · Pflege ueber Mieter anlegen</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!appData.loading && rows.length === 0 && <div className="tenant-message">Keine Objekte gefunden.</div>}
        </main>

        <aside className="tenant-summary">
          <h2>Zusammenfassung</h2>
          <DonutChart paid={stats.paid} missing={stats.missing} vacant={stats.vacant} />
          <div className="tenant-summary-lines">
            <div><span>Bezahlt</span><b>{stats.paid}</b></div>
            <div className="red"><span>Fehlt</span><b>{stats.missing}</b></div>
            <div className="gray"><span>Leerstand</span><b>{stats.vacant}</b></div>
            <div><span>Gesamt</span><b>{stats.total}</b></div>
          </div>
        </aside>
      </section>
    </div>
  );
}
