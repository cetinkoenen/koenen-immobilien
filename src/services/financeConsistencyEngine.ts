import type { AppObject, FinanceEntry, LoanChartPoint, LoanDashboardRow, PortfolioLoanRow, YearlyFinanceSummaryRow } from "@/state/AppDataContext";

export type ConsistencySeverity = "ok" | "warning" | "critical";
export type ConsistencyCheck = {
  id: string;
  severity: ConsistencySeverity;
  area: "Buchungen" | "Miete" | "Jahreswerte" | "Darlehen" | "Portfolio" | "Datenmodell";
  propertyId: string | null;
  propertyName: string;
  detail: string;
  repairHint: string;
  expectedValue?: number | null;
  actualValue?: number | null;
  delta?: number | null;
};

export type ConsistencyInput = {
  objects: AppObject[];
  entries: FinanceEntry[];
  yearlyFinanceSummaries: YearlyFinanceSummaryRow[];
  portfolioRows: PortfolioLoanRow[];
  loanRows: LoanDashboardRow[];
  loanChartByPropertyId: Record<string, LoanChartPoint[]>;
  year: number;
  today?: Date;
};

export type ConsistencySummary = {
  total: number;
  critical: number;
  warning: number;
  ok: number;
  score: number;
  checks: ConsistencyCheck[];
};

function money(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/straße|strasse/g, "str")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isRentEntry(entry: FinanceEntry): boolean {
  if (entry.entry_type !== "income") return false;
  const text = normalize(`${entry.category ?? ""} ${entry.note ?? ""}`);
  return text.includes("miet") || text.includes("garage") || text.includes("pacht");
}

function entryMonth(value: string | null): { year: number; month: number; day: number } | null {
  if (!value || value.length < 7) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = value.length >= 10 ? Number(value.slice(8, 10)) : 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month, day: Number.isFinite(day) ? day : 1 };
}

function effectiveRentMonth(value: string | null): { year: number; month: number } | null {
  const parsed = entryMonth(value);
  if (!parsed) return null;
  if (parsed.day < 25) return { year: parsed.year, month: parsed.month };
  return parsed.month === 12 ? { year: parsed.year + 1, month: 1 } : { year: parsed.year, month: parsed.month + 1 };
}

function propertyNameById(objects: AppObject[], portfolioRows: PortfolioLoanRow[], loanRows: LoanDashboardRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const object of objects) result[object.id] = object.label;
  for (const row of portfolioRows) {
    result[row.property_id] = result[row.property_id] ?? row.property_name;
    if (row.portfolio_property_id) result[row.portfolio_property_id] = result[row.portfolio_property_id] ?? row.property_name;
  }
  for (const row of loanRows) result[row.property_id] = result[row.property_id] ?? row.property_name;
  return result;
}

function knownPropertyIds(objects: AppObject[], portfolioRows: PortfolioLoanRow[], loanRows: LoanDashboardRow[]): Set<string> {
  return new Set([
    ...objects.flatMap((object) => [object.id, ...(object.aliases ?? [])]),
    ...portfolioRows.flatMap((row) => [row.property_id, row.portfolio_property_id ?? ""]),
    ...loanRows.map((row) => row.property_id),
  ].map((value) => String(value ?? "").trim()).filter(Boolean));
}

function addCheck(checks: ConsistencyCheck[], check: ConsistencyCheck) {
  checks.push(check);
}

export function buildFinanceConsistencySummary(input: ConsistencyInput): ConsistencySummary {
  const today = input.today ?? new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const names = propertyNameById(input.objects, input.portfolioRows, input.loanRows);
  const knownIds = knownPropertyIds(input.objects, input.portfolioRows, input.loanRows);
  const checks: ConsistencyCheck[] = [];

  const duplicateMap = new Map<string, FinanceEntry[]>();
  for (const entry of input.entries) {
    // Eine Buchung ist nur dann als echte Dublette verdächtig, wenn auch die Notiz identisch ist.
    // Wiederkehrende Zahlungen haben oft denselben Betrag/Kategorie, unterscheiden sich aber über
    // Referenz, Zeitraum oder Beschreibung im Notizfeld und dürfen nicht als doppelt gelten.
    const key = [
      entry.object_id ?? "no-object",
      entry.booking_date ?? "no-date",
      entry.entry_type ?? "no-type",
      normalize(entry.category),
      round2(money(entry.amount)).toFixed(2),
      normalize(entry.note),
    ].join("|");
    duplicateMap.set(key, [...(duplicateMap.get(key) ?? []), entry]);

    if (entry.object_id && !knownIds.has(String(entry.object_id))) {
      addCheck(checks, {
        id: `unlinked-${entry.id ?? key}`,
        severity: "warning",
        area: "Datenmodell",
        propertyId: String(entry.object_id),
        propertyName: entry.objekt_code ?? "Unbekanntes Objekt",
        detail: `Buchung vom ${entry.booking_date ?? "ohne Datum"} ist mit einer Objekt-ID verknüpft, die nicht in der Objekt-/Portfolio-Liste gefunden wurde.`,
        repairHint: "Objekt-ID, Objektcode und Portfolio-Verknüpfung prüfen. Danach Datenprüfung neu laden.",
      });
    }

    if (!entry.booking_date) {
      addCheck(checks, {
        id: `missing-date-${entry.id ?? key}`,
        severity: "warning",
        area: "Buchungen",
        propertyId: entry.object_id ? String(entry.object_id) : null,
        propertyName: entry.object_id ? names[String(entry.object_id)] ?? "Unbekanntes Objekt" : "Ohne Objekt",
        detail: "Eine Buchung hat kein Buchungsdatum.",
        repairHint: "Buchungsdatum nachtragen, weil Monats- und Jahreswerte sonst nicht sicher berechnet werden können.",
      });
    }
  }

  for (const [key, group] of duplicateMap.entries()) {
    if (group.length < 2) continue;
    const first = group[0];
    addCheck(checks, {
      id: `duplicate-${key}`,
      severity: "critical",
      area: "Buchungen",
      propertyId: first.object_id ? String(first.object_id) : null,
      propertyName: first.object_id ? names[String(first.object_id)] ?? first.objekt_code ?? "Unbekanntes Objekt" : first.objekt_code ?? "Ohne Objekt",
      detail: `${group.length} mögliche doppelte Buchungen: ${first.booking_date ?? "ohne Datum"}, ${first.category ?? "ohne Kategorie"}, ${round2(money(first.amount)).toLocaleString("de-DE")} €.` ,
      repairHint: "Buchungen manuell vergleichen und nur echte Dubletten löschen. Nicht automatisch löschen.",
      actualValue: group.length,
    });
  }

  const entriesByPropertyYear = new Map<string, { income: number; expense: number; rent: number }>();
  const rentByPropertyMonth = new Map<string, number>();
  for (const entry of input.entries) {
    if (!entry.object_id) continue;
    const id = String(entry.object_id);
    const ym = entryMonth(entry.booking_date);
    if (ym?.year === input.year) {
      const key = `${id}|${input.year}`;
      const existing = entriesByPropertyYear.get(key) ?? { income: 0, expense: 0, rent: 0 };
      if (entry.entry_type === "income") existing.income += money(entry.amount);
      if (entry.entry_type === "expense") existing.expense += money(entry.amount);
      if (isRentEntry(entry)) existing.rent += money(entry.amount);
      entriesByPropertyYear.set(key, existing);
    }

    if (isRentEntry(entry)) {
      const rentMonth = effectiveRentMonth(entry.booking_date);
      if (rentMonth) {
        const rentKey = `${id}|${rentMonth.year}|${rentMonth.month}`;
        rentByPropertyMonth.set(rentKey, (rentByPropertyMonth.get(rentKey) ?? 0) + money(entry.amount));
      }
    }
  }

  for (const summary of input.yearlyFinanceSummaries.filter((row) => row.jahr === input.year)) {
    const id = String(summary.object_id ?? "");
    if (!id) continue;
    const calculated = entriesByPropertyYear.get(`${id}|${input.year}`);
    if (!calculated) continue;
    const dbNet = round2(money(summary.einnahmen) - money(summary.ausgaben));
    const entryNet = round2(calculated.income - calculated.expense);
    const delta = round2(entryNet - dbNet);
    if (Math.abs(delta) > 1) {
      addCheck(checks, {
        id: `yearly-delta-${id}-${input.year}`,
        severity: Math.abs(delta) > 100 ? "critical" : "warning",
        area: "Jahreswerte",
        propertyId: id,
        propertyName: names[id] ?? summary.objekt_code ?? "Unbekanntes Objekt",
        detail: `Jahres-Netto ${input.year} aus Buchungen weicht von der Jahres-View ab.`,
        repairHint: "Materialized Views/Finanz-Views refreshen und prüfen, ob alle Buchungen korrekt kategorisiert sind.",
        expectedValue: dbNet,
        actualValue: entryNet,
        delta,
      });
    }
  }

  const propertiesWithCurrentRent = new Set<string>();
  for (const entry of input.entries) {
    if (!entry.object_id || !isRentEntry(entry)) continue;
    const rentMonth = effectiveRentMonth(entry.booking_date);
    if (rentMonth?.year === input.year) propertiesWithCurrentRent.add(String(entry.object_id));
  }

  if (input.year <= currentYear) {
    const maxMonth = input.year === currentYear ? currentMonth : 12;
    for (const propertyId of propertiesWithCurrentRent) {
      for (let month = 1; month <= maxMonth; month += 1) {
        if (input.year === currentYear && month > currentMonth) continue;
        const value = rentByPropertyMonth.get(`${propertyId}|${input.year}|${month}`) ?? 0;
        if (value <= 0) {
          addCheck(checks, {
            id: `missing-rent-${propertyId}-${input.year}-${month}`,
            severity: month === currentMonth ? "warning" : "critical",
            area: "Miete",
            propertyId,
            propertyName: names[propertyId] ?? "Unbekanntes Objekt",
            detail: `Für ${String(month).padStart(2, "0")}/${input.year} wurde kein Mieteingang gefunden. Zukünftige Monate werden bewusst nicht rot markiert.`,
            repairHint: "Mieteingang prüfen. Zahlungen ab dem 25. des Vormonats zählen bereits automatisch als Folgemonat.",
            actualValue: value,
          });
        }
      }
    }
  }

  for (const [propertyId, chart] of Object.entries(input.loanChartByPropertyId)) {
    const sorted = [...chart].sort((a, b) => a.year - b.year);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const delta = round2(current.balance - previous.balance);
      if (delta > 1) {
        addCheck(checks, {
          id: `loan-increase-${propertyId}-${current.year}`,
          severity: "warning",
          area: "Darlehen",
          propertyId,
          propertyName: names[propertyId] ?? "Unbekanntes Objekt",
          detail: `Restschuld steigt von ${previous.year} auf ${current.year}.`,
          repairHint: "Ledger-Zeilen prüfen. Falls Sonderfall/Neufinanzierung: bewusst akzeptieren, sonst Saldo korrigieren.",
          expectedValue: previous.balance,
          actualValue: current.balance,
          delta,
        });
      }
    }
  }

  for (const portfolio of input.portfolioRows) {
    const loan = input.loanRows.find((row) => row.property_id === portfolio.property_id || row.property_id === portfolio.portfolio_property_id);
    if (!loan || loan.last_balance == null) continue;
    const delta = round2(money(portfolio.last_balance) - money(loan.last_balance));
    if (Math.abs(delta) > 1) {
      addCheck(checks, {
        id: `portfolio-loan-delta-${portfolio.property_id}`,
        severity: "critical",
        area: "Portfolio",
        propertyId: portfolio.property_id,
        propertyName: portfolio.property_name,
        detail: "Portfolio-Restschuld und Darlehensdashboard zeigen unterschiedliche Werte.",
        repairHint: "Materialized Views refreshen und prüfen, ob Portfolio-ID und Darlehens-ID auf dasselbe Objekt zeigen.",
        expectedValue: money(loan.last_balance),
        actualValue: money(portfolio.last_balance),
        delta,
      });
    }
  }

  const sortedChecks = checks.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, ok: 2 } satisfies Record<ConsistencySeverity, number>;
    return severityOrder[a.severity] - severityOrder[b.severity] || a.area.localeCompare(b.area, "de") || a.propertyName.localeCompare(b.propertyName, "de");
  });

  const critical = sortedChecks.filter((check) => check.severity === "critical").length;
  const warning = sortedChecks.filter((check) => check.severity === "warning").length;
  const total = sortedChecks.length;
  const score = Math.max(0, Math.round(100 - critical * 12 - warning * 4));

  return { total, critical, warning, ok: total === 0 ? 1 : 0, score, checks: sortedChecks };
}
