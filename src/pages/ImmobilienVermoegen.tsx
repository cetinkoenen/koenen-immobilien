import { useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Euro,
  Home,
  Landmark,
  MapPin,
  PlusCircle,
  Save,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { EmptyState, KpiCard, PageHeader, SectionPanel } from "@/components/ui/professional";
import { useAuth } from "@/auth/AuthProvider";
import { isAdminEmail } from "@/auth/accessControl";
import { useAppData, type PortfolioLoanRow } from "@/state/AppDataContext";

type WealthDraft = Record<string, string>;

type WealthTemplate = {
  key: string;
  match: string[];
  defaults: WealthDraft;
};

type WealthCard = {
  id: string;
  row?: PortfolioLoanRow;
  draft: WealthDraft;
};

type FieldConfig = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "checkbox" | "date";
  options?: string[];
  placeholder?: string;
};

const STORAGE_KEY = "koenen:immobilienvermoegen:v2";

const EMPTY_DRAFT: WealthDraft = {
  name: "",
  financingReason: "",
  propertyType: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  state: "",
  inhabitants: "",
  surroundings: "",
  purchasePrice: "",
  purchaseYear: "",
  usageType: "",
  unitCount: "",
  totalArea: "",
  coldRentMonthly: "",
  landArea: "",
  convertedSpace: "",
  equipmentYear: "",
  constructionType: "",
  constructionSpecials: "",
  equipmentRating: "",
  floors: "",
  elevator: "",
  condition: "",
  attic: "",
  cellar: "",
  parkingSpaces: "",
  marketValue: "",
  landValue: "",
  acquisitionSpecials: "",
  estimatedMarketValue: "",
  heritableBuildingRight: "",
  energyClass: "",
  primaryEnergyDemand: "",
  primaryEnergyConsumption: "",
  co2Emissions: "",
  modernizations: "",
  lastModernizationYear: "",
  modernizationCosts: "",
  lender: "",
  ibanBic: "",
  loanNumber: "",
  landRegisterRank: "",
  subsidizedLoan: "",
  originalLoanAmount: "",
  currentMonthlyRate: "",
  agreedFutureRate: "",
  interestRate: "",
  interestBinding: "",
  fullRepaymentDate: "",
  release: "",
  shouldBeRedeemed: "",
  remainingDebt: "",
  expectedEndDate: "",
  borrowers: "",
  notes: "",
};

const WEALTH_TEMPLATES: WealthTemplate[] = [
  {
    key: "lilienthaler-str-54",
    match: ["lilienthaler"],
    defaults: {
      ...EMPTY_DRAFT,
      name: "Lilienthaler Str. 54",
      financingReason: "Bestandsimmobilie",
      propertyType: "Reihenmittelhaus",
      street: "Lilienthaler Str.",
      houseNumber: "54",
      postalCode: "28215",
      city: "Bremen",
      state: "Bremen",
      marketValue: "530000",
      estimatedMarketValue: "530000",
      remainingDebt: "41667",
      currentMonthlyRate: "1100",
      purchasePrice: "145000",
      purchaseYear: "2007",
      landArea: "100",
      equipmentYear: "1956",
      constructionType: "Massivbauweise",
      floors: "3",
      elevator: "Nein",
      condition: "Gepflegt",
      attic: "Ausgebaut",
      cellar: "Voll unterkellert",
      lender: "Volksbank Stuttgart eG",
      interestRate: "1,67",
      interestBinding: "3 Jahre",
      borrowers: "Cetin Könen",
    },
  },
  {
    key: "elsasser-str-52",
    match: ["elsasser", "elsäßer"],
    defaults: {
      ...EMPTY_DRAFT,
      name: "Elsasser Str. 52",
      street: "Elsasser Str.",
      houseNumber: "52",
      postalCode: "28211",
      city: "Bremen",
      state: "Bremen",
      marketValue: "160000",
      estimatedMarketValue: "160000",
      remainingDebt: "78168",
      currentMonthlyRate: "300",
    },
  },
  {
    key: "colmarer-str-45",
    match: ["colmarer"],
    defaults: {
      ...EMPTY_DRAFT,
      name: "Colmarer Str. 45",
      street: "Colmarer Str.",
      houseNumber: "45",
      postalCode: "28211",
      city: "Bremen",
      state: "Bremen",
      marketValue: "145000",
      estimatedMarketValue: "145000",
      remainingDebt: "105616",
      currentMonthlyRate: "411",
    },
  },
  {
    key: "fuerther-str-74",
    match: ["fürther", "fuerther"],
    defaults: {
      ...EMPTY_DRAFT,
      name: "Fürther Str. 74",
      street: "Fürther Str.",
      houseNumber: "74",
      postalCode: "28215",
      city: "Bremen",
      state: "Bremen",
      marketValue: "140000",
      estimatedMarketValue: "140000",
      remainingDebt: "125063",
      currentMonthlyRate: "439",
    },
  },
  {
    key: "hohenloher-str-78",
    match: ["hohenloher"],
    defaults: {
      ...EMPTY_DRAFT,
      name: "Hohenloher Str. 78",
      street: "Hohenloher Str.",
      houseNumber: "78",
      postalCode: "74243",
      city: "Brettach",
      state: "Baden-Württemberg",
      marketValue: "530000",
      estimatedMarketValue: "530000",
      remainingDebt: "400000",
      currentMonthlyRate: "1690",
    },
  },
  {
    key: "rosensteinstr-25",
    match: ["rosenstein"],
    defaults: {
      ...EMPTY_DRAFT,
      name: "Rosensteinstr. 25",
      street: "Rosensteinstr.",
      houseNumber: "25",
      notes: "Vollständige Standardmaske für manuelle Einpflege.",
    },
  },
];

const SECTION_FIELDS: Array<{ title: string; description: string; icon: typeof Home; fields: FieldConfig[] }> = [
  {
    title: "Sektion 1: Vorhaben & Adresse",
    description: "Stammdaten und Kostenbasis der Immobilie.",
    icon: MapPin,
    fields: [
      { key: "financingReason", label: "Finanzierungsgrund", type: "select", options: ["", "Kauf", "Bestandsimmobilie", "Anschlussfinanzierung", "Modernisierung"] },
      { key: "propertyType", label: "Immobilientyp", type: "select", options: ["", "Wohnung", "Garage", "Reihenmittelhaus", "Mehrfamilienhaus", "Gewerbe", "Sonstiges"] },
      { key: "name", label: "Immobilienbezeichnung" },
      { key: "street", label: "Straße" },
      { key: "houseNumber", label: "Hausnummer" },
      { key: "postalCode", label: "PLZ" },
      { key: "city", label: "Ort" },
      { key: "state", label: "Bundesland" },
      { key: "inhabitants", label: "Anzahl Einwohner im Ort", type: "select", options: ["", "unter 10.000", "10.000 - 50.000", "50.000 - 250.000", "über 250.000"] },
      { key: "surroundings", label: "Umgebung", type: "select", options: ["", "Wohngebiet", "Mischgebiet", "Innenstadt", "Gewerbegebiet", "Randlage"] },
      { key: "purchasePrice", label: "Ursprünglich bezahlter Kaufpreis / Baukosten (€)", type: "number" },
      { key: "purchaseYear", label: "Jahr des Kaufs / der Fertigstellung", type: "number" },
    ],
  },
  {
    title: "Sektion 2: Beschreibung",
    description: "Flächen, Nutzung und Ausstattung.",
    icon: Building2,
    fields: [
      { key: "usageType", label: "Nutzungstyp", type: "select", options: ["", "Wohnwirtschaftlich vermietet", "Eigennutzung", "Leerstand", "Gewerblich", "Garage/Stellplatz"] },
      { key: "unitCount", label: "Anzahl der Einheiten", type: "number" },
      { key: "totalArea", label: "Gesamtfläche aller Einheiten (m²)", type: "number" },
      { key: "coldRentMonthly", label: "Monatliche Netto-Kaltmiete", type: "number" },
      { key: "landArea", label: "Grundstücksfläche (m²)", type: "number" },
      { key: "convertedSpace", label: "Umbauter Raum (m³)", type: "number" },
      { key: "equipmentYear", label: "Ausstattung & Baujahr (YYYY)", type: "number" },
      { key: "constructionType", label: "Bauweise", type: "select", options: ["", "Massivbauweise", "Fertigbauweise", "Sonstiges"] },
      { key: "constructionSpecials", label: "Besonderheiten der Bauart", type: "select", options: ["", "Keine", "Denkmalschutz", "Sondernutzung", "Erweiterungspotenzial"] },
      { key: "equipmentRating", label: "Beurteilung der Ausstattung", type: "select", options: ["", "Gut", "Marktüblich", "Einfach", "Gehoben"] },
      { key: "floors", label: "Anzahl Vollgeschosse", type: "number" },
      { key: "elevator", label: "Aufzug vorhanden?", type: "checkbox" },
      { key: "condition", label: "Zustand", type: "select", options: ["", "Gepflegt", "Renovierungsbedürftig", "Modernisiert", "Neuwertig"] },
      { key: "attic", label: "Dachgeschoss", type: "select", options: ["", "Ausgebaut", "Nicht ausgebaut", "Kein Dachgeschoss"] },
      { key: "cellar", label: "Keller", type: "select", options: ["", "Voll unterkellert", "Teilunterkellert", "Kein Keller"] },
      { key: "parkingSpaces", label: "Stellplätze", placeholder: "z. B. 1 Garage, 2 TG" },
    ],
  },
  {
    title: "Sektion 3: Bewertung",
    description: "Wertansätze und Erwerbsbesonderheiten.",
    icon: Euro,
    fields: [
      { key: "marketValue", label: "Marktwert (€)", type: "number" },
      { key: "landValue", label: "Bodenrichtwert", type: "number" },
      { key: "acquisitionSpecials", label: "Besonderheiten beim Erwerb", type: "select", options: ["", "Keine", "Erbschaft", "Schenkung", "Sonderpreis", "Privatkauf"] },
      { key: "estimatedMarketValue", label: "Geschätzter Marktwert (€)", type: "number" },
      { key: "heritableBuildingRight", label: "Erbbaurecht?", type: "checkbox" },
    ],
  },
  {
    title: "Sektion 4: Energie und Modernisierungen",
    description: "Energiekennzahlen und Modernisierungshistorie.",
    icon: Zap,
    fields: [
      { key: "energyClass", label: "Energieeffizienzklasse", type: "select", options: ["", "A+", "A", "B", "C", "D", "E", "F", "G", "H"] },
      { key: "primaryEnergyDemand", label: "Primärenergiebedarf" },
      { key: "primaryEnergyConsumption", label: "Primärenergieverbrauch" },
      { key: "co2Emissions", label: "CO2-Emissionen" },
      { key: "modernizations", label: "Bereits durchgeführte Modernisierungen" },
      { key: "lastModernizationYear", label: "Jahr der letzten Modernisierung", type: "number" },
      { key: "modernizationCosts", label: "Kosten Gesamt-Modernisierung", type: "number" },
    ],
  },
  {
    title: "Sektion 5: Bestehende Darlehen",
    description: "Finanzierungsdaten, Raten und Restschuld.",
    icon: Landmark,
    fields: [
      { key: "lender", label: "Aktueller Darlehensgeber" },
      { key: "ibanBic", label: "BLZ, BIC & Darlehensnummer" },
      { key: "loanNumber", label: "Darlehensnummer" },
      { key: "landRegisterRank", label: "Rangstelle im Grundbuch" },
      { key: "subsidizedLoan", label: "Förderdarlehen?", type: "checkbox" },
      { key: "originalLoanAmount", label: "Ursprüngliche Darlehenssumme", type: "number" },
      { key: "currentMonthlyRate", label: "Aktuelle Monatsrate", type: "number" },
      { key: "agreedFutureRate", label: "Vereinbarte zukünftige Monatsrate", type: "number" },
      { key: "interestRate", label: "Sollzins (%)" },
      { key: "interestBinding", label: "Sollzinsbindung" },
      { key: "fullRepaymentDate", label: "Datum der Vollauszahlung", type: "date" },
      { key: "release", label: "Ablösung" },
      { key: "shouldBeRedeemed", label: "Soll das Darlehen abgelöst werden?", type: "checkbox" },
      { key: "remainingDebt", label: "Restschuld (€)", type: "number" },
      { key: "expectedEndDate", label: "Voraussichtliches Ende der Laufzeit", type: "date" },
      { key: "borrowers", label: "Darlehensnehmer*in" },
    ],
  },
];

const FIELD_BY_KEY = new Map<string, FieldConfig>(SECTION_FIELDS.flatMap((section) => section.fields.map((field) => [field.key, field])));

const DETAIL_TEMPLATE_SECTIONS: Array<{
  id: string;
  title: string;
  subtitle: string;
  pageLabel: string;
  icon: typeof Home;
  columns: Array<{ title: string; description?: string; fields: string[]; action?: "parking" | "modernization" | "borrower" }>;
}> = [
  {
    id: "vorhaben",
    title: "Vorhaben & Adresse",
    subtitle: "Stammdaten, Kontaktadresse und Kostenbasis nach Vorlage Seite 2.",
    pageLabel: "Vorlage S. 2",
    icon: MapPin,
    columns: [
      { title: "Vorhaben", fields: ["financingReason", "propertyType", "name"] },
      { title: "Adresse und Kontaktdaten", fields: ["street", "houseNumber", "postalCode", "city", "state", "inhabitants", "surroundings"] },
      { title: "Kostenaufstellung", fields: ["purchasePrice", "purchaseYear"] },
    ],
  },
  {
    id: "beschreibung",
    title: "Beschreibung",
    subtitle: "Flächen, Nutzung, Ausstattung und Stellplätze nach Vorlage Seite 3.",
    pageLabel: "Vorlage S. 3",
    icon: Building2,
    columns: [
      { title: "Flächen und Nutzung", fields: ["usageType", "unitCount", "totalArea", "coldRentMonthly", "landArea", "convertedSpace"] },
      { title: "Ausstattung", fields: ["equipmentYear", "constructionType", "constructionSpecials", "equipmentRating", "floors", "elevator", "condition", "attic", "cellar"] },
      { title: "Stellplätze", description: "Parkplätze, Garagen oder Tiefgaragenstellplätze separat dokumentieren.", fields: ["parkingSpaces"], action: "parking" },
    ],
  },
  {
    id: "bewertung",
    title: "Bewertung",
    subtitle: "Marktwert, Bodenrichtwert und Erwerbsbesonderheiten nach Vorlage Seite 4.",
    pageLabel: "Vorlage S. 4",
    icon: Euro,
    columns: [
      { title: "Wertansätze", fields: ["marketValue", "landValue", "estimatedMarketValue"] },
      { title: "Erwerb", fields: ["acquisitionSpecials", "heritableBuildingRight"] },
    ],
  },
  {
    id: "energie",
    title: "Energie und Modernisierungen",
    subtitle: "Energiekennzahlen und Modernisierungshistorie nach Vorlage Seite 5.",
    pageLabel: "Vorlage S. 5",
    icon: Zap,
    columns: [
      { title: "Energie", fields: ["energyClass", "primaryEnergyDemand", "primaryEnergyConsumption", "co2Emissions"] },
      { title: "Bereits durchgeführte Modernisierungen", fields: ["modernizations", "lastModernizationYear", "modernizationCosts"], action: "modernization" },
    ],
  },
  {
    id: "darlehen",
    title: "Bestehende Darlehen",
    subtitle: "Darlehensgeber, Konditionen, Ablösung und Darlehensnehmer nach Vorlage Seite 6.",
    pageLabel: "Vorlage S. 6",
    icon: Landmark,
    columns: [
      { title: "Darlehen 1", fields: ["lender", "ibanBic", "loanNumber", "landRegisterRank", "subsidizedLoan"] },
      { title: "Konditionen", fields: ["originalLoanAmount", "currentMonthlyRate", "agreedFutureRate", "interestRate", "interestBinding", "fullRepaymentDate"] },
      { title: "Ablösung", fields: ["release", "shouldBeRedeemed", "remainingDebt", "expectedEndDate", "borrowers"], action: "borrower" },
    ],
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatCurrency(value: string | number | null | undefined): string {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number.isFinite(parsed) ? parsed : 0);
}

function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadStoredDrafts(): Record<string, WealthDraft> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WealthDraft>) : {};
  } catch {
    return {};
  }
}

function findTemplate(rowName: string): WealthTemplate | undefined {
  const normalized = normalize(rowName);
  return WEALTH_TEMPLATES.find((template) => template.match.some((term) => normalized.includes(normalize(term))));
}

function mergeDraft(row: PortfolioLoanRow | undefined, template: WealthTemplate, stored: Record<string, WealthDraft>): WealthDraft {
  const id = row?.portfolio_property_id ?? row?.property_id ?? template.key;
  const liveFallback: WealthDraft = row ? { name: template.defaults.name || row.property_name } : {};

  return {
    ...template.defaults,
    ...liveFallback,
    ...(stored[id] ?? {}),
  };
}

function buildCards(rows: PortfolioLoanRow[], stored: Record<string, WealthDraft>): WealthCard[] {
  const usedRowIds = new Set<string>();

  const cards = WEALTH_TEMPLATES.map((template) => {
    const row = rows.find((candidate) => {
      if (usedRowIds.has(candidate.property_id)) return false;
      return findTemplate(candidate.property_name)?.key === template.key;
    });
    if (row) usedRowIds.add(row.property_id);
    const id = row?.portfolio_property_id ?? row?.property_id ?? template.key;
    return { id, row, draft: mergeDraft(row, template, stored) };
  });

  rows.forEach((row) => {
    if (usedRowIds.has(row.property_id)) return;
    const id = row.portfolio_property_id ?? row.property_id;
    cards.push({
      id,
      row,
      draft: {
        ...EMPTY_DRAFT,
        ...(stored[id] ?? {}),
        name: stored[id]?.name || row.property_name,
        remainingDebt: stored[id]?.remainingDebt || String(Math.round(row.last_balance || 0)),
      },
    });
  });

  return cards;
}

function DetailField({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const commonClass = [
    "min-h-11 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-950 shadow-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100",
    disabled ? "bg-slate-100 text-slate-500" : "bg-white",
  ].join(" ");

  if (field.type === "select") {
    return (
      <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {field.label}
        <select className={commonClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? [""]).map((option) => (
            <option key={option || "empty"} value={option}>
              {option || "Bitte auswählen"}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className={["flex min-h-[68px] items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-black shadow-sm", disabled ? "bg-slate-100 text-slate-500" : "bg-white text-slate-700"].join(" ")}>
        <input
          type="checkbox"
          checked={value === "Ja"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? "Ja" : "Nein")}
          className="h-5 w-5 accent-teal-700"
        />
        {field.label}
      </label>
    );
  }

  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
      {field.label}
      <input
        className={commonClass}
        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        value={value}
        disabled={disabled}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DetailPage({
  card,
  cards,
  onUpdate,
  onSave,
  saveStatus,
  isAdmin,
}: {
  card: WealthCard;
  cards: WealthCard[];
  onUpdate: (id: string, key: string, value: string) => void;
  onSave: (id: string) => void;
  saveStatus?: string;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const appendValue = (key: string, value: string) => {
    const current = card.draft[key]?.trim();
    onUpdate(card.id, key, current ? `${current}\n${value}` : value);
  };
  const renderAction = (action?: "parking" | "modernization" | "borrower") => {
    if (!action) return null;
    const config = {
      parking: { key: "parkingSpaces", label: "PKW Stellplatz hinzufügen", value: "PKW Stellplatz" },
      modernization: { key: "modernizations", label: "Modernisierung hinzufügen", value: "Neue Modernisierung" },
      borrower: { key: "borrowers", label: "Person hinzufügen", value: "Neue Person" },
    }[action];

    return (
      <button
        type="button"
        disabled={!isAdmin}
        onClick={() => appendValue(config.key, config.value)}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 text-sm font-black text-orange-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <PlusCircle size={17} /> {config.label}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_44px_rgba(51,65,85,0.08)] backdrop-blur">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Immobilienvermögen</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{card.draft.name || "Immobilie"}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {[card.draft.street && `${card.draft.street} ${card.draft.houseNumber}`.trim(), [card.draft.postalCode, card.draft.city].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ") || "Adresse offen"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/immobilienvermoegen")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm"
          >
            <ArrowLeft size={17} /> Zur Übersicht
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-600">
                  <Home size={16} /> Immobilienvermögen
                </div>
                {isAdmin ? (
                  <Link to="/immobilien/immobilie-anlegen" className="text-orange-600 no-underline" aria-label="Immobilie hinzufügen">
                    <PlusCircle size={20} />
                  </Link>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2">
                {cards.map((item) => {
                  const active = item.id === card.id;
                  return (
                    <Link
                      key={item.id}
                      to={`/immobilienvermoegen/${encodeURIComponent(item.id)}`}
                      className={[
                        "group rounded-xl border px-4 py-3 text-slate-950 no-underline transition",
                        active ? "border-orange-200 bg-white shadow-sm" : "border-transparent bg-white/60 hover:border-slate-200 hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{item.draft.name || "Unbenannte Immobilie"}</p>
                          <p className="mt-1 truncate text-xs font-bold text-slate-500">
                            {[item.draft.street && `${item.draft.street} ${item.draft.houseNumber}`.trim(), [item.draft.postalCode, item.draft.city].filter(Boolean).join(" ")]
                              .filter(Boolean)
                              .join(", ") || "Adresse offen"}
                          </p>
                        </div>
                        <span className="text-lg font-black text-slate-400">⌄</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 rounded-[18px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Marktwert</span>
                <b className="text-sm">{formatCurrency(card.draft.marketValue || card.draft.estimatedMarketValue)}</b>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Restschuld</span>
                <b className="text-sm">{formatCurrency(card.draft.remainingDebt)}</b>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">mtl. Rate</span>
                <b className="text-sm">{formatCurrency(card.draft.currentMonthlyRate)}</b>
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            {DETAIL_TEMPLATE_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <article key={section.id} id={section.id} className="rounded-[18px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                        <Icon size={19} />
                      </span>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{section.pageLabel}</p>
                        <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
                        <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{section.subtitle}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-5 bg-slate-50/70 p-5 lg:grid-cols-2 2xl:grid-cols-3">
                    {section.columns.map((column) => (
                      <div key={column.title} className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                        <h3 className="text-base font-black text-slate-950">{column.title}</h3>
                        {column.description ? <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{column.description}</p> : null}
                        <div className="mt-4 grid gap-3">
                          {column.fields.map((fieldKey) => {
                            const field = FIELD_BY_KEY.get(fieldKey);
                            if (!field) return null;
                            return (
                              <DetailField
                                key={field.key}
                                field={field}
                                value={card.draft[field.key] ?? ""}
                                disabled={!isAdmin}
                                onChange={(value) => onUpdate(card.id, field.key, value)}
                              />
                            );
                          })}
                        </div>
                        {renderAction(column.action)}
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <SectionPanel title="Notizen" description="Freier Bereich für manuelle Ergänzungen, Bankhinweise oder spätere Prüfnotizen.">
        <textarea
          className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
          value={card.draft.notes ?? ""}
          disabled={!isAdmin}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onUpdate(card.id, "notes", event.target.value)}
        />
      </SectionPanel>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">{!isAdmin ? "Nur-Lesen-Zugang: Die Detailmaske ist geschützt." : saveStatus ?? "Änderungen werden lokal in dieser App gespeichert."}</p>
        <button
          type="button"
          onClick={() => onSave(card.id)}
          disabled={!isAdmin}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#255f6f] px-5 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          <Save size={18} /> Detailmaske speichern
        </button>
      </div>
    </div>
  );
}

export default function ImmobilienVermoegen() {
  const params = useParams<{ propertyId?: string }>();
  const appData = useAppData();
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const [storedDrafts, setStoredDrafts] = useState<Record<string, WealthDraft>>(() => loadStoredDrafts());
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});

  const cards = useMemo(() => buildCards(appData.portfolioRows, storedDrafts), [appData.portfolioRows, storedDrafts]);
  const selectedCard = params.propertyId ? cards.find((card) => card.id === params.propertyId) : undefined;

  const totals = useMemo(() => {
    return cards.reduce(
      (acc, card) => ({
        marketValue: acc.marketValue + parseAmount(card.draft.marketValue || card.draft.estimatedMarketValue),
        remainingDebt: acc.remainingDebt + parseAmount(card.draft.remainingDebt),
        monthlyRate: acc.monthlyRate + parseAmount(card.draft.currentMonthlyRate),
      }),
      { marketValue: 0, remainingDebt: 0, monthlyRate: 0 },
    );
  }, [cards]);

  function updateDraft(id: string, key: string, value: string) {
    setStoredDrafts((current) => {
      const next = {
        ...current,
        [id]: {
          ...(cards.find((card) => card.id === id)?.draft ?? EMPTY_DRAFT),
          ...(current[id] ?? {}),
          [key]: value,
        },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSaveStatus((current) => ({ ...current, [id]: "Ungespeicherte Änderung lokal vorgemerkt." }));
  }

  function saveDraft(id: string) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedDrafts));
    setSaveStatus((current) => ({ ...current, [id]: "Gespeichert." }));
  }

  if (params.propertyId) {
    if (!selectedCard) {
      return <EmptyState title="Immobilie nicht gefunden" description="Die ausgewählte Vermögens-Detailmaske konnte nicht geladen werden." />;
    }
    return <DetailPage card={selectedCard} cards={cards} onUpdate={updateDraft} onSave={saveDraft} saveStatus={saveStatus[selectedCard.id]} isAdmin={isAdmin} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Immobilienvermögen"
        title="Immobilienvermögen"
        description="Dynamische Vermögensübersicht als neue Listenansicht für alle Immobilien. Die bestehende Objektübersicht unter Immobilien → Objekte bleibt unverändert erhalten."
        meta={[
          { label: "Quelle", value: "Portfolio, Darlehen, manuelle Vermögensmaske" },
          { label: "Objekte", value: cards.length },
        ]}
      >
        {isAdmin ? (
          <Link
            to="/immobilien/immobilie-anlegen"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#255f6f] px-5 text-sm font-black text-white no-underline shadow-sm"
          >
            <PlusCircle size={18} /> Immobilie hinzufügen
          </Link>
        ) : (
          <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-5 text-sm font-black text-slate-500 shadow-sm">
            <PlusCircle size={18} /> Nur Admin: Immobilie hinzufügen
          </span>
        )}
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Immobilien" value={cards.length} icon={Building2} tone="blue" />
        <KpiCard label="Marktwert gesamt" value={formatCurrency(totals.marketValue)} icon={Home} tone="green" />
        <KpiCard label="Restschuld gesamt" value={formatCurrency(totals.remainingDebt)} icon={Landmark} tone="violet" />
        <KpiCard label="Kreditrate / Monat" value={formatCurrency(totals.monthlyRate)} icon={Euro} tone="amber" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.id}
            to={`/immobilienvermoegen/${encodeURIComponent(card.id)}`}
            className="group grid min-h-[178px] overflow-hidden rounded-[18px] border border-slate-200 bg-white text-slate-950 no-underline shadow-[0_12px_28px_rgba(51,65,85,0.07)] transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_18px_42px_rgba(51,65,85,0.10)] sm:grid-cols-[116px_1fr]"
          >
            <div className="flex min-h-[96px] items-center justify-center bg-orange-100 text-orange-600">
              <Building2 size={38} strokeWidth={1.9} />
            </div>
            <div className="grid gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-slate-950">{card.draft.name || "Unbenannte Immobilie"}</h2>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                    {[card.draft.street && `${card.draft.street} ${card.draft.houseNumber}`.trim(), [card.draft.postalCode, card.draft.city].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(", ") || "Adresse offen"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
                  Detail
                </span>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold text-slate-500">Marktwert</span>
                  <b>{formatCurrency(card.draft.marketValue || card.draft.estimatedMarketValue)}</b>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold text-slate-500">Restschuld</span>
                  <b>{formatCurrency(card.draft.remainingDebt)}</b>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold text-slate-500">mtl. Rate</span>
                  <b>{formatCurrency(card.draft.currentMonthlyRate)}</b>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-black text-[#255f6f]">
                <ShieldCheck size={17} /> Detailmaske öffnen
              </div>
            </div>
          </Link>
        ))}
        {isAdmin ? (
          <Link
            to="/immobilien/immobilie-anlegen"
            className="flex min-h-[178px] items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-slate-300 bg-white/70 p-5 text-sm font-black text-orange-700 no-underline shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
          >
            <PlusCircle size={18} /> Immobilie hinzufügen
          </Link>
        ) : null}
      </section>
    </div>
  );
}
