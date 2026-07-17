export type FinanceEntryType = "income" | "expense";

export type FinanceCategoryOption = {
  value: string;
  type: FinanceEntryType | "both";
};

export const FINANCE_CATEGORY_OPTIONS: FinanceCategoryOption[] = [
  { value: "Miete", type: "income" },
  { value: "Miete Garage", type: "income" },
  { value: "Kaution", type: "both" },
  { value: "Mietbestandteil-NK", type: "income" },

  { value: "Abfallgebühr", type: "expense" },
  { value: "Allgemein", type: "both" },
  { value: "Verwaltungskosten", type: "expense" },
  { value: "Fahrtkosten", type: "expense" },
  { value: "Kontoführungsgebühr", type: "expense" },
  { value: "Kreditrate", type: "expense" },
  { value: "Schonsteinfeger", type: "expense" },
  { value: "Software", type: "expense" },
  { value: "Steuer", type: "expense" },
  { value: "Reparatur", type: "expense" },
  { value: "Versicherung", type: "expense" },
  { value: "Wartung", type: "expense" },
];

const CATEGORY_ALIAS_PAIRS: Array<[string, string]> = [
  ["nebenkosten", "Mietbestandteil-NK"],
  ["betriebskosten", "Mietbestandteil-NK"],
  ["mietbestandteil nk", "Mietbestandteil-NK"],
  ["hausverwaltung", "Verwaltungskosten"],
  ["hausgeld", "Verwaltungskosten"],
  ["weg", "Verwaltungskosten"],
  ["weg hausgeld", "Verwaltungskosten"],
  ["verwaltung", "Verwaltungskosten"],
  ["verwaltungskosten", "Verwaltungskosten"],
  ["reparatur", "Reparatur"],
  ["handwerker", "Reparatur"],
  ["instandhaltung", "Reparatur"],
  ["sanierung", "Reparatur"],
  ["modernisierung", "Reparatur"],
  ["versicherung", "Versicherung"],
  ["wartung", "Wartung"],
  ["abfall", "Abfallgebühr"],
  ["abfallgebuehr", "Abfallgebühr"],
  ["abfallgebühr", "Abfallgebühr"],
  ["muell", "Abfallgebühr"],
  ["müll", "Abfallgebühr"],
  ["müllgebühren", "Abfallgebühr"],
  ["kontofuehrungsgebuehr", "Kontoführungsgebühr"],
  ["kontoführungsgebühr", "Kontoführungsgebühr"],
  ["kontofuehrung", "Kontoführungsgebühr"],
  ["kontoführung", "Kontoführungsgebühr"],
  ["bankgebuehren", "Kontoführungsgebühr"],
  ["bankgebühren", "Kontoführungsgebühr"],
  ["monatsrate", "Kreditrate"],
  ["kreditrate", "Kreditrate"],
  ["darlehensrate", "Kreditrate"],
  ["darlehen", "Kreditrate"],
  ["tilgung", "Kreditrate"],
  ["schonsteinfeger", "Schonsteinfeger"],
  ["schornsteinfeger", "Schonsteinfeger"],
  ["software", "Software"],
  ["steuer", "Steuer"],
  ["steuerberater", "Steuer"],
  ["steuerberatung", "Steuer"],
  ["fahrtkosten", "Fahrtkosten"],
  ["fahrt", "Fahrtkosten"],
  ["kaution", "Kaution"],
  ["miete", "Miete"],
  ["kaltmiete", "Miete"],
  ["warmmiete", "Miete"],
  ["miete garage", "Miete Garage"],
  ["garage", "Miete Garage"],
  ["stellplatz", "Miete Garage"],
  ["allgemein", "Allgemein"],
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

export function canonicalizeFinanceCategory(value: string | null | undefined, _entryType?: FinanceEntryType | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = normalizeFinanceCategoryText(raw);
  const exactOption = FINANCE_CATEGORY_OPTIONS.find((option) => normalizeFinanceCategoryText(option.value) === normalized);
  if (exactOption) return exactOption.value;

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
