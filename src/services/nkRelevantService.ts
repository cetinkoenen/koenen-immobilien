import { supabase } from "../lib/supabase";

export type NkRelevantEntry = {
  id: number;
  objekt_code: string | null;
  booking_date: string;
  amount: number;
  category: string | null;
  note: string | null;
  entry_type: "income" | "expense";
  nk_relevant: boolean | null;
};

const NK_EXPENSE_WORDS = [
  "grundsteuer",
  "wasser",
  "wasserversorgung",
  "abwasser",
  "entwaesserung",
  "entwässerung",
  "kanal",
  "heizung",
  "warmwasser",
  "brennstoff",
  "wartung heizung",
  "aufzug",
  "strassenreinigung",
  "straßenreinigung",
  "winterdienst",
  "muell",
  "müll",
  "reinigung",
  "gebaeudereinigung",
  "gebäudereinigung",
  "garten",
  "gartenpflege",
  "beleuchtung",
  "hausstrom",
  "allgemeinstrom",
  "schornstein",
  "versicherung",
  "gebaeudeversicherung",
  "gebäudeversicherung",
  "haftpflicht",
  "glas",
  "hauswart",
  "hausmeister",
  "kabel",
  "antenne",
  "wascheinrichtung",
  "rauchwarn",
  "dachrinnenreinigung",
  "betriebskosten",
  "nebenkosten",
  "kalo",
  "techem",
];

const NK_INCOME_WORDS = [
  "nebenkosten",
  "betriebskosten",
  "vorauszahlung",
  "abschlag",
  "nk",
  "erstattung",
  "guthaben",
  "rueckzahlung",
  "rückzahlung",
];

const NK_EXCLUDE_WORDS = [
  "ruecklage",
  "rücklage",
  "instandhaltungsruecklage",
  "instandhaltungsrücklage",
  "erhaltungsruecklage",
  "erhaltungsrücklage",
  "reparatur",
  "instandsetzung",
  "sanierung",
  "modernisierung",
  "verwaltung",
  "verwalter",
  "bankgebuehr",
  "bankgebühr",
  "porto",
  "tilgung",
];

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(normalize(word)));
}

export function inferNkRelevant(entry: Pick<NkRelevantEntry, "entry_type" | "category" | "note">): boolean {
  const text = normalize(`${entry.category ?? ""} ${entry.note ?? ""}`);
  if (!text) return false;
  if (hasAny(text, NK_EXCLUDE_WORDS)) return false;
  return entry.entry_type === "income" ? hasAny(text, NK_INCOME_WORDS) : hasAny(text, NK_EXPENSE_WORDS);
}

export async function listNkRelevantEntries(year: number, objektCode?: string | null): Promise<NkRelevantEntry[]> {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  let query = supabase
    .from("finance_entry")
    .select("id,objekt_code,booking_date,amount,category,note,entry_type,nk_relevant")
    .eq("is_deleted", false)
    .eq("nk_relevant", true)
    .gte("booking_date", from)
    .lt("booking_date", to)
    .order("booking_date", { ascending: true });

  if (objektCode) query = query.eq("objekt_code", objektCode);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    objekt_code: row.objekt_code == null ? null : String(row.objekt_code),
    booking_date: String(row.booking_date ?? ""),
    amount: Number(row.amount ?? 0),
    category: row.category == null ? null : String(row.category),
    note: row.note == null ? null : String(row.note),
    entry_type: row.entry_type === "expense" ? "expense" : "income",
    nk_relevant: row.nk_relevant === true,
  }));
}

export async function classifyNkRelevantEntries(from = "2024-01-01", to = "2026-06-08"): Promise<{ updated: number; matched: number }> {
  const { data, error } = await supabase
    .from("finance_entry")
    .select("id,category,note,entry_type,nk_relevant")
    .eq("is_deleted", false)
    .gte("booking_date", from)
    .lt("booking_date", to)
    .in("entry_type", ["income", "expense"])
    .limit(10000);

  if (error) throw error;

  const rows: Array<Pick<NkRelevantEntry, "id" | "category" | "note" | "entry_type" | "nk_relevant">> = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    category: row.category == null ? null : String(row.category),
    note: row.note == null ? null : String(row.note),
    entry_type: row.entry_type === "expense" ? "expense" : "income",
    nk_relevant: row.nk_relevant === true,
  }));
  const ids = rows.filter((row) => inferNkRelevant(row)).map((row) => row.id);
  if (!ids.length) return { updated: 0, matched: 0 };

  const { error: updateError } = await supabase.from("finance_entry").update({ nk_relevant: true }).in("id", ids);
  if (updateError) throw updateError;

  return { updated: ids.length, matched: ids.length };
}
