import { canonicalizeFinanceCategory, normalizeFinanceCategoryText, type FinanceEntryType } from "./financeCategories";
import { isHohenloherMietbestandteilNk, MIETBESTANDTEIL_NK_CATEGORY } from "./financeEntryLabels";

export type TaxRuleDecision = {
  taxRelevant: boolean;
  relevance: "tax" | "check" | "private";
  group: string;
  hint: string;
  locked: boolean;
};

export type TaxRuleEntry = {
  entry_type?: string | null;
  amount?: number | null;
  category?: string | null;
  note?: string | null;
  objekt_code?: string | null;
};

function normalize(value: string | null | undefined): string {
  return normalizeFinanceCategoryText(value);
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(normalize(needle)));
}

export function canonicalCategoryForTax(entry: TaxRuleEntry, objectLabel?: string | null): string {
  const entryType = entry.entry_type === "income" || entry.entry_type === "expense" ? entry.entry_type as FinanceEntryType : null;
  if (isHohenloherMietbestandteilNk(entry, objectLabel)) return MIETBESTANDTEIL_NK_CATEGORY;
  return canonicalizeFinanceCategory(entry.category, entryType) || "";
}

export function isCreditRateEntry(entry: TaxRuleEntry, objectLabel?: string | null): boolean {
  if (entry.entry_type !== "expense") return false;
  const canonicalCategory = canonicalCategoryForTax(entry, objectLabel);
  const text = normalize(`${canonicalCategory} ${entry.category ?? ""} ${entry.note ?? ""}`);
  return canonicalCategory === "Kreditrate" || includesAny(text, ["kreditrate", "monatsrate", "darlehensrate", "zins tilgung", "zins und tilgung", "tilgung"]);
}

export function classifyTaxRelevance(entry: TaxRuleEntry, objectLabel?: string | null): TaxRuleDecision {
  const entryType = entry.entry_type === "expense" ? "expense" : "income";
  const canonicalCategory = canonicalCategoryForTax({ ...entry, entry_type: entryType }, objectLabel);
  const text = normalize(`${canonicalCategory} ${entry.category ?? ""} ${entry.note ?? ""} ${entry.objekt_code ?? ""} ${objectLabel ?? ""}`);

  if (entryType === "income") {
    if (canonicalCategory === "Kaution" && !includesAny(text, ["einbehalten", "schadenersatz", "verrechnung"])) {
      return {
        taxRelevant: false,
        relevance: "check",
        group: "Kaution prüfen",
        hint: "Kaution ist nur steuerlich zu prüfen, wenn sie einbehalten oder verrechnet wurde.",
        locked: false,
      };
    }

    if (
      ["Miete", "Miete Garage", MIETBESTANDTEIL_NK_CATEGORY].includes(canonicalCategory) ||
      includesAny(text, ["warmmiete", "kaltmiete", "nebenkosten", "betriebskosten", "garage", "stellplatz", "sonderzahlung", "nachzahlung"])
    ) {
      return {
        taxRelevant: true,
        relevance: "tax",
        group: canonicalCategory === "Miete Garage" || includesAny(text, ["garage", "stellplatz"])
          ? "Miete Garage (Einnahme)"
          : "Miete / Warmmiete (Einnahme)",
        hint: "Warmmiete, Nebenkostenvorauszahlung, Garagenmiete und steuerrelevante Sonderzahlungen werden fuer Anlage V als Einnahme gewertet.",
        locked: false,
      };
    }

    return {
      taxRelevant: true,
      relevance: "tax",
      group: "Miete / Warmmiete (Einnahme)",
      hint: "Einnahmen aus Vermietung werden fuer Anlage V als steuerrelevant behandelt.",
      locked: false,
    };
  }

  if (isCreditRateEntry({ ...entry, entry_type: entryType }, objectLabel)) {
    return {
      taxRelevant: false,
      relevance: "private",
      group: "Kreditrate (nicht direkt Anlage V)",
      hint: "Laufende Kreditrate enthaelt Zins und Tilgung zusammen. Nicht als St markieren; Jahreswerte kommen ueber Darlehen, nur Zinsanteil steuerrelevant.",
      locked: true,
    };
  }

  const fullExpenseGroups: Record<string, string> = {
    Reparatur: "Reparatur / Instandhaltung (Werbungskosten)",
    Grundsteuer: "Grundsteuer (Werbungskosten)",
    "Abfallgebühr": "Abfallgebühr (Werbungskosten)",
    Schonsteinfeger: "Schonsteinfeger (Werbungskosten)",
    Versicherung: "Versicherung (Werbungskosten)",
    Wartung: "Wartung (Werbungskosten)",
    Kontoführungsgebühr: "Kontoführungskosten (Werbungskosten)",
    Verwaltungskosten: "Verwaltungskosten (Werbungskosten)",
    Fahrtkosten: "Fahrtkosten (Werbungskosten)",
    Software: "Software (Werbungskosten)",
    "Büro / Porto": "Büro / Porto (Werbungskosten)",
  };

  if (fullExpenseGroups[canonicalCategory]) {
    return {
      taxRelevant: true,
      relevance: "tax",
      group: fullExpenseGroups[canonicalCategory],
      hint: "Laufende objektbezogene Ausgabe wird als Werbungskosten fuer Anlage V vorbereitet.",
      locked: false,
    };
  }

  if (includesAny(text, ["leerstand"])) {
    return {
      taxRelevant: false,
      relevance: "check",
      group: "Leerstandskosten prüfen",
      hint: "Kosten bei Leerstand nur bei nachgewiesener Vermietungsabsicht als steuerrelevant bestaetigen.",
      locked: false,
    };
  }

  if (canonicalCategory === "Allgemein" || !canonicalCategory) {
    return {
      taxRelevant: false,
      relevance: "check",
      group: "Allgemein / Sonstige Kosten prüfen",
      hint: "Unklare Ausgabe gezielt pruefen und bei objektbezogener Werbungskosten-Qualitaet als St bestaetigen.",
      locked: false,
    };
  }

  return {
    taxRelevant: true,
    relevance: "tax",
    group: `${canonicalCategory} (Werbungskosten)`,
    hint: "Ausgabe wird nach Kategorie als objektbezogene Werbungskosten vorbereitet.",
    locked: false,
  };
}
