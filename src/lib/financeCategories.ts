export type FinanceEntryType = "income" | "expense";

export type FinanceCategoryOption = {
  value: string;
  type: FinanceEntryType | "both";
};

export const FINANCE_CATEGORY_OPTIONS: FinanceCategoryOption[] = [
  { value: "Miete", type: "income" },
  { value: "Mietbestandteil-NK", type: "income" },
  { value: "Nebenkostenvorauszahlung", type: "income" },
  { value: "Kaution erhalten", type: "income" },
  { value: "Erstattung / Rückzahlung", type: "income" },
  { value: "Sonstige Einnahmen", type: "income" },

  { value: "Hausgeld / WEG", type: "expense" },
  { value: "Instandhaltung / Reparatur", type: "expense" },
  { value: "Modernisierung / Sanierung", type: "expense" },
  { value: "Verwaltungskosten", type: "expense" },
  { value: "Grundsteuer", type: "expense" },
  { value: "Versicherung", type: "expense" },
  { value: "Wasser / Abwasser", type: "expense" },
  { value: "Heizung / Energie", type: "expense" },
  { value: "Strom Allgemein", type: "expense" },
  { value: "Müllgebühren", type: "expense" },
  { value: "Darlehenszinsen", type: "expense" },
  { value: "Darlehen Tilgung", type: "expense" },
  { value: "Bankgebühren", type: "expense" },
  { value: "Steuerberatung", type: "expense" },
  { value: "Kaution zurückgezahlt", type: "expense" },
  { value: "Sonstige Ausgaben", type: "expense" },
];

const CATEGORY_ALIAS_PAIRS: Array<[string, string]> = [
  ["nk", "Nebenkostenvorauszahlung"],
  ["nebenkosten", "Nebenkostenvorauszahlung"],
  ["betriebskosten", "Nebenkostenvorauszahlung"],
  ["mietbestandteil nk", "Mietbestandteil-NK"],
  ["hausverwaltung", "Hausgeld / WEG"],
  ["hausgeld", "Hausgeld / WEG"],
  ["weg", "Hausgeld / WEG"],
  ["weg hausgeld", "Hausgeld / WEG"],
  ["verwaltung", "Verwaltungskosten"],
  ["verwaltungskosten", "Verwaltungskosten"],
  ["reparatur", "Instandhaltung / Reparatur"],
  ["handwerker", "Instandhaltung / Reparatur"],
  ["instandhaltung", "Instandhaltung / Reparatur"],
  ["sanierung", "Modernisierung / Sanierung"],
  ["modernisierung", "Modernisierung / Sanierung"],
  ["grundsteuer", "Grundsteuer"],
  ["versicherung", "Versicherung"],
  ["wasser", "Wasser / Abwasser"],
  ["abwasser", "Wasser / Abwasser"],
  ["kanal", "Wasser / Abwasser"],
  ["heizung", "Heizung / Energie"],
  ["energie", "Heizung / Energie"],
  ["strom", "Strom Allgemein"],
  ["muell", "Müllgebühren"],
  ["müll", "Müllgebühren"],
  ["darlehenszinsen", "Darlehenszinsen"],
  ["zinsen", "Darlehenszinsen"],
  ["tilgung", "Darlehen Tilgung"],
  ["bank", "Bankgebühren"],
  ["bankgebuehren", "Bankgebühren"],
  ["bankgebühren", "Bankgebühren"],
  ["steuerberater", "Steuerberatung"],
  ["steuerberatung", "Steuerberatung"],
  ["kaution", "Kaution erhalten"],
  ["miete", "Miete"],
  ["kaltmiete", "Miete"],
  ["warmmiete", "Miete"],
  ["garage", "Miete"],
];

export function normalizeFinanceCategoryText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function canonicalizeFinanceCategory(value: string | null | undefined, entryType?: FinanceEntryType | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = normalizeFinanceCategoryText(raw);
  const exactOption = FINANCE_CATEGORY_OPTIONS.find((option) => normalizeFinanceCategoryText(option.value) === normalized);
  if (exactOption) return exactOption.value;

  if (normalized === "kaution" && entryType === "expense") return "Kaution zurückgezahlt";
  if (normalized === "kaution" && entryType === "income") return "Kaution erhalten";

  const alias = CATEGORY_ALIAS_PAIRS.find(([source]) => normalized === normalizeFinanceCategoryText(source));
  return alias?.[1] ?? raw;
}

export function getFinanceCategoryOptions(entryType: FinanceEntryType, additionalCategories: string[] = []): string[] {
  const base = FINANCE_CATEGORY_OPTIONS
    .filter((option) => option.type === "both" || option.type === entryType)
    .map((option) => option.value);

  const additional = additionalCategories
    .map((category) => canonicalizeFinanceCategory(category, entryType))
    .filter(Boolean);

  return Array.from(new Set([...base, ...additional])).sort((a, b) => a.localeCompare(b, "de"));
}
