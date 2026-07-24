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

const STORAGE_KEY = "koenen:immobilienvermoegen:v1";

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
  return {
    ...template.defaults,
    ...(row
      ? {
          name: row.property_name || template.defaults.name,
          remainingDebt: String(Math.round(row.last_balance || parseAmount(template.defaults.remainingDebt))),
        }
      : {}),
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
  onUpdate,
  onSave,
  saveStatus,
  isAdmin,
}: {
  card: WealthCard;
  onUpdate: (id: string, key: string, value: string) => void;
  onSave: (id: string) => void;
  saveStatus?: string;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Immobilienvermögen"
        title={card.draft.name || "Immobilie"}
        description="Separate Detailmaske mit den standardisierten Datenfeldern aus der neuen Vermögensvorlage."
        meta={[
          { label: "Marktwert", value: formatCurrency(card.draft.marketValue || card.draft.estimatedMarketValue) },
          { label: "Restschuld", value: formatCurrency(card.draft.remainingDebt || card.row?.last_balance) },
          { label: "Monatsrate", value: formatCurrency(card.draft.currentMonthlyRate) },
        ]}
      >
        <button
          type="button"
          onClick={() => navigate("/immobilienvermoegen")}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm"
        >
          <ArrowLeft size={17} /> Zur Übersicht
        </button>
      </PageHeader>

      {SECTION_FIELDS.map((section) => {
        const Icon = section.icon;
        return (
          <SectionPanel key={section.title} title={section.title} description={section.description}>
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f4] text-[#255f6f] ring-1 ring-teal-100">
              <Icon size={20} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.fields.map((field) => (
                <DetailField
                  key={field.key}
                  field={field}
                  value={card.draft[field.key] ?? ""}
                  disabled={!isAdmin}
                  onChange={(value) => onUpdate(card.id, field.key, value)}
                />
              ))}
            </div>
          </SectionPanel>
        );
      })}

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
        remainingDebt: acc.remainingDebt + parseAmount(card.draft.remainingDebt || card.row?.last_balance),
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
    return <DetailPage card={selectedCard} onUpdate={updateDraft} onSave={saveDraft} saveStatus={saveStatus[selectedCard.id]} isAdmin={isAdmin} />;
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.id}
            to={`/immobilienvermoegen/${encodeURIComponent(card.id)}`}
            className="group rounded-[24px] border border-white/70 bg-white/86 p-5 text-slate-950 no-underline shadow-[0_14px_34px_rgba(51,65,85,0.07)] backdrop-blur transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_18px_44px_rgba(51,65,85,0.10)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#66758a]">Immobilie</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">{card.draft.name || "Unbenannte Immobilie"}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {[card.draft.postalCode, card.draft.city].filter(Boolean).join(" ") || "Adresse offen"}
                </p>
              </div>
              <span className="rounded-2xl bg-[#eef7f4] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#255f6f]">
                Detail
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Marktwert</span>
                <b>{formatCurrency(card.draft.marketValue || card.draft.estimatedMarketValue)}</b>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Restschuld</span>
                <b>{formatCurrency(card.draft.remainingDebt || card.row?.last_balance)}</b>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Kreditrate</span>
                <b>{formatCurrency(card.draft.currentMonthlyRate)}</b>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-sm font-black text-[#255f6f]">
              <ShieldCheck size={17} /> Detailmaske öffnen
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
