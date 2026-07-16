import { Component, lazy, Suspense, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  Euro,
  FileText,
  FolderKanban,
  FolderOpen,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Menu,
  PieChart,
  PlusCircle,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

import Login from "./pages/Login";
import MFA from "./pages/MFA";
import AuthCallback from "./pages/AuthCallback";
import RequireAuthMFA from "./components/RequireAuthMFA";
import BackupButton from "./components/BackupButton";
import { useAuth } from "./auth/AuthProvider";
import { isAdminEmail, isReadonlyApprovalEmail } from "./auth/accessControl";
import { supabase } from "./lib/supabaseClient";
import { clearAppSessionStorage } from "./lib/security";
import logo from "./assets/koenen-brand-logo.webp";
import { AppDataProvider, useAppData, type FinanceEntry } from "./state/AppDataContext";
import { EmptyState, InfoList, KpiCard, ModuleCard, PageHeader, SectionPanel } from "./components/ui/professional";
import "./App.css";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Die Seite konnte nicht geladen werden.",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("App route crashed:", error, info.componentStack);
  }

  handleReload = () => {
    clearAppSessionStorage();
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto max-w-[1760px] px-3 py-6 sm:px-5 lg:px-8">
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-red-700">
            Seite konnte nicht geladen werden
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">
            Bitte Seite neu starten
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold text-red-800">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-900 shadow-sm"
          >
            Session zurücksetzen und neu laden
          </button>
        </section>
      </div>
    );
  }
}

const EntryAdd = lazy(() => import("./pages/EntryAdd"));
const Cockpit = lazy(() => import("./pages/Cockpit"));
const Monate = lazy(() => import("./pages/Monate"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Auswertung = lazy(() => import("./pages/Auswertung"));
const SteuerCenter = lazy(() => import("./pages/SteuerCenter"));
const Funktionsvergleich = lazy(() => import("./pages/Funktionsvergleich"));
const NebenkostenTiefgarage = lazy(() => import("./pages/NebenkostenTiefgarage"));
const NebenkostenWohnungen = lazy(() => import("./pages/NebenkostenWohnungen"));
const Administrator = lazy(() => import("./pages/Administrator"));
const Datenschutz = lazy(() => import("./pages/Datenschutz"));
const Mietuebersicht = lazy(() => import("./pages/Mietuebersicht"));
const MieterAnlegen = lazy(() => import("./pages/MieterAnlegen"));
const Leerstand = lazy(() => import("./pages/Leerstand"));
const Mahnwesen = lazy(() => import("./pages/Mahnwesen"));
const Kautionen = lazy(() => import("./pages/Kautionen"));
const EinAuszug = lazy(() => import("./pages/EinAuszug"));
const Transaktionsregeln = lazy(() => import("./pages/Transaktionsregeln"));
const Darlehensuebersicht = lazy(() => import("./pages/Darlehensuebersicht"));
const Datenpruefung = lazy(() => import("./pages/Datenpruefung"));
const PortfolioAddress = lazy(() => import("./pages/portfolio/PortfolioAddress"));
const PortfolioDetails = lazy(() => import("./pages/portfolio/PortfolioDetails"));
const PortfolioEnergy = lazy(() => import("./pages/portfolio/PortfolioEnergy"));
const PortfolioFinance = lazy(() => import("./pages/portfolio/PortfolioFinance"));
const PortfolioPropertyLayout = lazy(() => import("./pages/portfolio/PortfolioPropertyLayout"));
const PortfolioRenting = lazy(() => import("./pages/portfolio/PortfolioRenting"));
const PortfolioObjectDetail = lazy(() => import("./pages/portfolio/PortfolioObjectDetail"));
const PortfolioFinanceModules = lazy(() => import("./pages/portfolio/PortfolioFinanceModules"));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-[1760px] px-3 py-6 sm:px-5 lg:px-8">
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm font-black text-slate-600 shadow-sm">
        Seite wird geladen...
      </div>
    </div>
  );
}

function sidebarNavLinkClass(isActive: boolean): string {
  return [
    "group flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-black no-underline transition",
    isActive
      ? "bg-white/12 text-white shadow-[inset_3px_0_0_#8b7cf6]"
      : "text-slate-300 hover:bg-white/8 hover:text-white",
  ].join(" ");
}

type ShellNavItem = {
  to: string;
  label: string;
  group: string;
  icon: LucideIcon;
  end?: boolean;
};

type ModuleLink = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  adminOnly?: boolean;
};

type ModuleHubConfig = {
  eyebrow: string;
  title: string;
  description: string;
  links: ModuleLink[];
};

type WorkspaceSubpage = {
  path: string;
  label: string;
  icon: LucideIcon;
};

type WorkspaceTab = {
  label: string;
  description: string;
};

type WorkspaceConfig = {
  eyebrow: string;
  title: string;
  description: string;
  basePath: string;
  source: string;
  subpages: WorkspaceSubpage[];
  tabs: WorkspaceTab[];
};

const groupAccent: Record<string, string> = {
  "1. 📊 Dashboard": "text-sky-300",
  "2. 🏢 Immobilien & Einheiten": "text-cyan-300",
  "3. 👥 Kontakte & Mietverhältnisse": "text-emerald-300",
  "4. 💼 Buchhaltung & Finanzen": "text-violet-300",
  "5. 🔧 Aufgaben & Ticketsystem": "text-teal-300",
  "6. ⚙️ System-Einstellungen": "text-slate-300",
  Überblick: "text-sky-300",
  Finanzen: "text-violet-300",
  Verwaltung: "text-amber-300",
};

const auswertungSubNav = [
  { view: "cockpit", label: "Objektakte & Workflows" },
  { view: "finanzen", label: "Finanzanalyse" },
  { view: "objektjahr", label: "Objekt-Jahresübersicht" },
  { view: "business", label: "Business Intelligence 4C" },
  { view: "backend5b", label: "Backend 5B" },
  { view: "single-source", label: "Single Source 3A" },
  { view: "stability", label: "Stabilität 3B" },
  { view: "automation", label: "Automatisierung 2B" },
  { view: "reporting4d", label: "Reporting/PDF 4D" },
  { view: "reporting", label: "Archiv 2C" },
];


function RedirectObjectRoute({ section = "objektakte" }: { section?: string }) {
  const { propertyId } = useParams<{ propertyId: string }>();
  return <Navigate to={propertyId ? `/portfolio/${encodeURIComponent(propertyId)}/${section}` : "/portfolio"} replace />;
}

function RedirectLoanRoute() {
  const { propertyId } = useParams<{ propertyId: string }>();
  return <Navigate to={propertyId ? `/darlehen/${encodeURIComponent(propertyId)}` : "/darlehen"} replace />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE");
}

function isCurrentMonthEntry(entry: FinanceEntry, today = new Date()): boolean {
  if (!entry.booking_date) return false;
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return entry.booking_date.startsWith(monthKey);
}

function isRentLikeEntry(entry: FinanceEntry): boolean {
  if (entry.entry_type !== "income") return false;
  const text = `${entry.category ?? ""} ${entry.note ?? ""}`.toLowerCase();
  return text.includes("miet") || text.includes("pacht");
}

const workspaceConfigs: Record<string, WorkspaceConfig> = {
  dashboardFinanz: {
    eyebrow: "1. Modul | Dashboard",
    title: "Finanz-Kennzahlen",
    description: "Zentrale Übersicht aus Portfolio, Buchhaltung, Leerstand, Darlehen und Steuer. Diese Seite aggregiert nur bestehende Datenquellen.",
    basePath: "/dashboard",
    source: "Cockpit, Buchhaltung, Mieteingang, Leerstand, Darlehen",
    subpages: [
      { path: "/dashboard/finanz-kennzahlen", label: "Finanz-Kennzahlen", icon: BarChart3 },
      { path: "/dashboard/warnmeldungen", label: "Warnmeldungen", icon: Bell },
      { path: "/dashboard/aktuelle-todos", label: "Aktuelle To-dos", icon: ListChecks },
    ],
    tabs: [
      { label: "Soll/Ist-Vergleich", description: "Ist-Mieten aus Buchungen, Soll-Mieten aus Vermietungszeiträumen und Mietrückstände als Differenz." },
      { label: "Gesamteinnahmen & Cashflow", description: "Bruttomieteinnahmen, Nebenkostenvorauszahlungen und bereinigter Cashflow aus vorhandenen Buchungen." },
      { label: "Offene Posten & Forderungsmanagement", description: "Überfällige Mieten, unbezahlte Rechnungen und vorhandene Mahnstatus bündeln." },
      { label: "Leerstandskosten & Effizienz", description: "Leerstandsquote und Mietausfall über bestehende Leerstands- und Mietdaten sichtbar machen." },
      { label: "Filter & Export", description: "Objekt-, Zeitraum- und Exportkontext für steuerberaterfähige Auswertungen." },
    ],
  },
  dashboardWarnungen: {
    eyebrow: "1. Modul | Dashboard",
    title: "Warnmeldungen",
    description: "Operative Frühwarnzentrale aus bestehenden Prüf-, Buchhaltungs-, Leerstands- und Fristendaten.",
    basePath: "/dashboard",
    source: "Datenprüfung, Mieteingang, Leerstand, Mahnwesen",
    subpages: [
      { path: "/dashboard/finanz-kennzahlen", label: "Finanz-Kennzahlen", icon: BarChart3 },
      { path: "/dashboard/warnmeldungen", label: "Warnmeldungen", icon: Bell },
      { path: "/dashboard/aktuelle-todos", label: "Aktuelle To-dos", icon: ListChecks },
    ],
    tabs: [
      { label: "Zahlungsverzug & Mietrückstände", description: "Kurzzeitiger Verzug, gravierender Rückstand, Teilzahlungen und Mahn-Quick-Actions." },
      { label: "Leerstand & Vermietungsrisiko", description: "Akuter Leerstand, bevorstehender Leerstand und kritische Leerstandsdauer." },
      { label: "Konto- & Buchungsalarme", description: "Nicht zugeordnete Transaktionen und auffällige Buchungszustände." },
      { label: "Fristen & Instandhaltung", description: "Überfällige Tickets, Prüffristen, Wartung und Vertragsfristen." },
      { label: "Dringlichkeits-Filter", description: "Hohe, mittlere und informative Warnungen getrennt betrachten." },
    ],
  },
  dashboardTodos: {
    eyebrow: "1. Modul | Dashboard",
    title: "Aktuelle To-dos",
    description: "Tagesgeschäft für Mieterwechsel, Fristen, Vertragsanpassungen und technische Vorgänge.",
    basePath: "/dashboard",
    source: "Ein-/Auszug, Nebenkosten, Mahnwesen, Ticketing",
    subpages: [
      { path: "/dashboard/finanz-kennzahlen", label: "Finanz-Kennzahlen", icon: BarChart3 },
      { path: "/dashboard/warnmeldungen", label: "Warnmeldungen", icon: Bell },
      { path: "/dashboard/aktuelle-todos", label: "Aktuelle To-dos", icon: ListChecks },
    ],
    tabs: [
      { label: "Mieterwechsel & Übergaben", description: "Auszugs-To-dos, Übergabeprotokolle, Einzugs-To-dos und Kautionsmanagement." },
      { label: "Rechtliche & gesetzliche Fristen", description: "Nebenkostenabrechnung, Sicherheit, Wartung und WEG-Fristen überwachen." },
      { label: "Vertrags- & Mietanpassungen", description: "Indexmieten, Staffelmieten und befristete Verträge im Blick behalten." },
      { label: "Handwerker & Schadensabwicklung", description: "Angebotsfreigaben, Reparaturstatus und Rechnungsprüfung bündeln." },
      { label: "Organisation & Filter", description: "Zuständigkeit, Fälligkeit und Status-Tracker für die tägliche Arbeit." },
    ],
  },
  immobilienObjekte: {
    eyebrow: "2. Modul | Immobilien & Einheiten",
    title: "Objektübersicht",
    description: "Bestehende Immobilienseite als zentrale Objekt- und Finanzübersicht im neuen Modulrahmen.",
    basePath: "/immobilien",
    source: "Portfolio, Objektakten, Buchhaltung, Darlehen",
    subpages: [
      { path: "/immobilien/objektuebersicht", label: "Objektübersicht", icon: Building2 },
      { path: "/immobilien/einheiten-verwaltung", label: "Einheiten-Verwaltung", icon: FolderKanban },
      { path: "/immobilien/zaehlerstaende-verbrauch", label: "Zählerstände & Verbrauch", icon: ClipboardList },
      { path: "/immobilien/objekt-dokumente", label: "Objekt-Dokumente", icon: FileText },
    ],
    tabs: [
      { label: "Wohnimmobilien", description: "Gebäude-Stammdaten, Einheiten-Struktur, Grundstücksdaten und Gemeinschaftsflächen." },
      { label: "Gewerbeimmobilien", description: "Nutzflächen, Umsatzsteueroptionen sowie Stellplatz- und Logistik-Zuordnung." },
    ],
  },
  immobilienEinheiten: {
    eyebrow: "2. Modul | Immobilien & Einheiten",
    title: "Einheiten-Verwaltung",
    description: "Wohnungen, Garagen, Gewerbeeinheiten und Belegungshistorie auf Basis vorhandener Objekt- und Mietdaten.",
    basePath: "/immobilien",
    source: "Portfolio, Vermietungszeiträume, Leerstand",
    subpages: [
      { path: "/immobilien/objektuebersicht", label: "Objektübersicht", icon: Building2 },
      { path: "/immobilien/einheiten-verwaltung", label: "Einheiten-Verwaltung", icon: FolderKanban },
      { path: "/immobilien/zaehlerstaende-verbrauch", label: "Zählerstände & Verbrauch", icon: ClipboardList },
      { path: "/immobilien/objekt-dokumente", label: "Objekt-Dokumente", icon: FileText },
    ],
    tabs: [
      { label: "Wohnungen", description: "Einheiten-Details, Ausstattung, Zustand, Grundriss, Fotos und abrechnungsrelevante Faktoren." },
      { label: "Garagen & Stellplätze", description: "Typisierung, E-Mobilität, Schließmedien und Kopplung an Wohnungen oder Fremdvermietung." },
      { label: "Gewerbeeinheiten", description: "Nutzflächen, Nebenräume, technische Anschlüsse und umsatzsteuerliche Behandlung." },
      { label: "Status & Belegungshistorie", description: "Vermietet, reserviert, leerstehend sowie Mieter- und Mietpreishistorie." },
      { label: "Schnellauswahl & Massenbearbeitung", description: "Datenblatt, Exposé und Mietanpassungsprüfung im bestehenden Portfolio-Kontext." },
    ],
  },
  immobilienVerbrauch: {
    eyebrow: "2. Modul | Immobilien & Einheiten",
    title: "Zählerstände & Verbrauch",
    description: "Frontend-Zugang für Verbrauchs- und Zählerstandsprozesse inklusive Fotodokumentation im Objektkontext.",
    basePath: "/immobilien",
    source: "Objektakte, Nebenkosten, Dokumente",
    subpages: [
      { path: "/immobilien/objektuebersicht", label: "Objektübersicht", icon: Building2 },
      { path: "/immobilien/einheiten-verwaltung", label: "Einheiten-Verwaltung", icon: FolderKanban },
      { path: "/immobilien/zaehlerstaende-verbrauch", label: "Zählerstände & Verbrauch", icon: ClipboardList },
      { path: "/immobilien/objekt-dokumente", label: "Objekt-Dokumente", icon: FileText },
    ],
    tabs: [
      { label: "Zählerstände", description: "Erfassung je Objekt und Einheit über vorhandene Objektakten vorbereiten." },
      { label: "Fotodokumentation", description: "Smartphone-taugliche Dokumentation von Zählerständen als Objektanhang." },
      { label: "Verbrauch", description: "Verbrauchsdaten als Grundlage für Nebenkosten- und Plausibilitätsprüfungen." },
    ],
  },
  immobilienDokumente: {
    eyebrow: "2. Modul | Immobilien & Einheiten",
    title: "Objekt-Dokumente",
    description: "Digitale Objektakte für Energieausweise, Prüfberichte, Versicherungen und sonstige Objektunterlagen.",
    basePath: "/immobilien",
    source: "Dokumentenmanagement, Objektakte",
    subpages: [
      { path: "/immobilien/objektuebersicht", label: "Objektübersicht", icon: Building2 },
      { path: "/immobilien/einheiten-verwaltung", label: "Einheiten-Verwaltung", icon: FolderKanban },
      { path: "/immobilien/zaehlerstaende-verbrauch", label: "Zählerstände & Verbrauch", icon: ClipboardList },
      { path: "/immobilien/objekt-dokumente", label: "Objekt-Dokumente", icon: FileText },
    ],
    tabs: [
      { label: "Energieausweise", description: "Gültigkeit und Ablage über bestehende Objektakten prüfen." },
      { label: "Brandschutz & Prüfberichte", description: "Berichte objektbezogen strukturieren und auffindbar halten." },
      { label: "Versicherungen", description: "Policen, Laufzeiten und Nachweise im Objektkontext bündeln." },
    ],
  },
  kontakteVertraege: {
    eyebrow: "3. Modul | Kontakte & Mietverhältnisse",
    title: "Aktive Mietverträge",
    description: "Verträge, Mietzins-Struktur, Anpassungsplanung und Kautionen in einer Mieterstruktur.",
    basePath: "/kontakte",
    source: "Mieter anlegen, Vermietungszeiträume, Buchhaltung",
    subpages: [
      { path: "/kontakte/aktive-mietvertraege", label: "Aktive Mietverträge", icon: Users },
      { path: "/kontakte/mieter-eigentuemerakten", label: "Mieter-/Eigentümerakten", icon: FolderOpen },
      { path: "/kontakte/interessenten-selbstauskuenfte", label: "Interessenten", icon: UserCog },
      { path: "/kontakte/wohnungsgeberbescheinigungen-uebergabeprotokolle", label: "Übergaben & Protokolle", icon: KeyRound },
    ],
    tabs: [
      { label: "Vertragsdetails", description: "Laufzeiten, Kündigungsfristen und Verlängerungen." },
      { label: "Mietzins-Struktur", description: "Kaltmiete, Nebenkosten, Stellplatzmiete und Vertragsbestandteile." },
      { label: "Mietanpassungs-Planer", description: "Indexklauseln, Staffelmieten und Termine." },
      { label: "Kautions-Status", description: "Beträge, Bürgschaften, Verpfändungen und Kautionsbuchungen." },
    ],
  },
  kontakteAkten: {
    eyebrow: "3. Modul | Kontakte & Mietverhältnisse",
    title: "Mieter- & Eigentümerakten",
    description: "Stammdaten, SEPA, Kommunikation und Dokumente aus bestehenden Mieterinformationen.",
    basePath: "/kontakte",
    source: "Mieterstammdaten, Dokumente, Mahnwesen",
    subpages: [
      { path: "/kontakte/aktive-mietvertraege", label: "Aktive Mietverträge", icon: Users },
      { path: "/kontakte/mieter-eigentuemerakten", label: "Mieter-/Eigentümerakten", icon: FolderOpen },
      { path: "/kontakte/interessenten-selbstauskuenfte", label: "Interessenten", icon: UserCog },
      { path: "/kontakte/wohnungsgeberbescheinigungen-uebergabeprotokolle", label: "Übergaben & Protokolle", icon: KeyRound },
    ],
    tabs: [
      { label: "Stammdaten", description: "Kontaktdaten, Mitmieter und Notfallkontakte." },
      { label: "SEPA-Mandate", description: "Lastschrift-Erteilungen und Bankverbindungen." },
      { label: "Kommunikations-Historie", description: "E-Mails, Briefe und Telefonnotizen." },
      { label: "Dokumenten-Archiv", description: "Ausweise, Nachweise und Schriftverkehr." },
    ],
  },
  kontakteInteressenten: {
    eyebrow: "3. Modul | Kontakte & Mietverhältnisse",
    title: "Interessenten & Selbstauskünfte",
    description: "Bewerber-Pool, Selbstauskunft, Besichtigungsplanung und KI-Matching als CRM-Arbeitsbereich.",
    basePath: "/kontakte",
    source: "Mieteranlage, Dokumente, Kommunikation",
    subpages: [
      { path: "/kontakte/aktive-mietvertraege", label: "Aktive Mietverträge", icon: Users },
      { path: "/kontakte/mieter-eigentuemerakten", label: "Mieter-/Eigentümerakten", icon: FolderOpen },
      { path: "/kontakte/interessenten-selbstauskuenfte", label: "Interessenten", icon: UserCog },
      { path: "/kontakte/wohnungsgeberbescheinigungen-uebergabeprotokolle", label: "Übergaben & Protokolle", icon: KeyRound },
    ],
    tabs: [
      { label: "Bewerber-Pool", description: "Eingegangene Anfragen und Interessentenlisten." },
      { label: "Digitale Selbstauskunft", description: "Bonitätsprüfung und vorhandene Nachweisdokumente." },
      { label: "Besichtigungs-Planer", description: "Terminkoordination und Einladungen." },
      { label: "KI-Matching", description: "Vorauswahl nach Objektkriterien, ohne zusätzliche Datenquelle." },
    ],
  },
  kontakteUebergaben: {
    eyebrow: "3. Modul | Kontakte & Mietverhältnisse",
    title: "Wohnungsgeberbescheinigungen & Übergabeprotokolle",
    description: "Einzug, Auszug, Formulare und Fotodokumentation aus bestehenden Mieterwechselprozessen.",
    basePath: "/kontakte",
    source: "Ein-/Auszug, Mieterakten, Objektakten",
    subpages: [
      { path: "/kontakte/aktive-mietvertraege", label: "Aktive Mietverträge", icon: Users },
      { path: "/kontakte/mieter-eigentuemerakten", label: "Mieter-/Eigentümerakten", icon: FolderOpen },
      { path: "/kontakte/interessenten-selbstauskuenfte", label: "Interessenten", icon: UserCog },
      { path: "/kontakte/wohnungsgeberbescheinigungen-uebergabeprotokolle", label: "Übergaben & Protokolle", icon: KeyRound },
    ],
    tabs: [
      { label: "Meldebehörden-Formulare", description: "Wohnungsgeberbestätigung und Formularprozesse." },
      { label: "Einzugsprotokolle", description: "Zustand, Schlüssel und Zählerstände beim Einzug." },
      { label: "Auszugsprotokolle", description: "Mängel, Renovierungspflichten und Rückgabe." },
      { label: "Fotodokumentation", description: "Visuelle Beweissicherung im Übergabeprozess." },
    ],
  },
  buchhaltungBuchungen: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Buchungen",
    description: "Operative Finanzzentrale mit Bankbewegungen, offenen Posten, manueller Erfassung, Belegen und Zahlungsverkehr.",
    basePath: "/buchhaltung",
    source: "Buchhaltung, Transaktionen, Buchungsmaske",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "Bankkonten & Transaktionen", description: "Live-Feeds und vorhandene Transaktionsübersicht." },
      { label: "Offene Posten", description: "Manuelle und KI-gestützte Zahlungszuordnung." },
      { label: "Einnahmen & Ausgaben", description: "Bestehende manuelle Buchungserfassung." },
      { label: "Belegarchiv & OCR", description: "Rechnungs-Upload und Belegkontext." },
      { label: "Daueraufträge & Lastschriften", description: "SEPA-Einzüge und wiederkehrende Zahlungen." },
    ],
  },
  buchhaltungSoll: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Sollstellungen & Mietanpassungen",
    description: "Monatliche Forderungen, Mietanpassungen und Kautionsverwaltung im bestehenden Miet- und Buchhaltungskontext.",
    basePath: "/buchhaltung",
    source: "Mietverträge, Mieteingang, Kautionen",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "Monatliche Sollstellung", description: "Automatische Mietforderungen aus aktiven Verträgen." },
      { label: "Index- & Staffelmieten", description: "Berechnung und Anpassungsschreiben im Vertragskontext." },
      { label: "Kautionsverwaltung", description: "Treuhand, Raten, Zinsen und Auszahlungen." },
    ],
  },
  buchhaltungNebenkosten: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Nebenkostenabrechnung",
    description: "Pflichtseite NK-Abrechnung bleibt vollständig erhalten und wird in die neue Buchhaltungsstruktur eingeordnet.",
    basePath: "/buchhaltung",
    source: "NK-Seiten, Buchhaltung, Umlageschlüssel",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "Umlageschlüssel & Verteiler", description: "Wohnfläche, Personen und bestehende Verteilungsschlüssel." },
      { label: "Heizkosten-Integration", description: "Messdienstleister-Importe und Verbrauchsdaten als bestehender Prozess." },
      { label: "Abrechnungserstellung", description: "PDF-Erstellung und Versandprozess über vorhandene NK-Seiten." },
    ],
  },
  buchhaltungMahnwesen: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Automatisiertes Mahnwesen",
    description: "Mahnfristen, Vorlagen und Eskalation auf Grundlage bestehender offener Posten.",
    basePath: "/buchhaltung",
    source: "Mahnwesen, Mieteingang, Buchhaltung",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "Mahnstufen & Fristen", description: "Workflow-Konfiguration für Erinnerung, Mahnung und Eskalation." },
      { label: "Vorlagen-Editor", description: "Texte für Zahlungserinnerung und Mahnungen." },
      { label: "Inkasso & Rechtsübergabe", description: "Übergabe harter Fälle an Dienstleister oder Rechtsanwälte." },
    ],
  },
  buchhaltungSteuer: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Steuer-Center & Berater-Schnittstelle",
    description: "Pflichtseite Steuer bleibt erhalten und wird als strukturierter Jahresabschlussbereich eingebunden.",
    basePath: "/buchhaltung",
    source: "Steuer-Center, Buchungen, Darlehenszinsen",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "Anlage V Vorbereitung", description: "Strukturierung für Einkünfte aus Vermietung und Verpachtung." },
      { label: "Einnahmen-Aufstellung", description: "Kaltmieten, Umlagen, Garagen und steuerpflichtige Zuflüsse." },
      { label: "Werbungskosten-Erfassung", description: "Erhaltungsaufwand, Verwaltungskosten und sonstige Abzüge." },
      { label: "Grundsteuer & Abgaben", description: "Nicht umlagefähige öffentliche Lasten und Abgaben." },
    ],
  },
  buchhaltungBerichte: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Berichte & Exporte",
    description: "Pflichtseite Auswertungen bleibt erhalten und liefert Stichtagsberichte und Multi-Format-Exports.",
    basePath: "/buchhaltung",
    source: "Auswertungen, Datenprüfung, Exportlogik",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "Jahres-Mietaufstellung", description: "Stichtagsbezogene Miet- und Objektberichte." },
      { label: "Überschuss-/Verlustrechnung", description: "Grafische und tabellarische Reports." },
      { label: "Multi-Format-Export", description: "PDF, CSV und Excel über bestehende Exportlogik." },
    ],
  },
  buchhaltungPortal: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Steuerberater-Portal",
    description: "Übergabebereich für DATEV, Gast-Zugang und Beleg-Sammel-Download auf Basis vorhandener Rechte und Berichte.",
    basePath: "/buchhaltung",
    source: "Reports, Benutzerrechte, Belege",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "DATEV-Export", description: "Buchungsstapel und strukturierte Übergabe." },
      { label: "Gast-Zugang", description: "Nur-Lese-Zugang für Steuerberater über bestehende Rollen." },
      { label: "Beleg-Sammel-Download", description: "ZIP-Export für Rechnungsbelege und OCR-Daten." },
    ],
  },
  buchhaltungUst: {
    eyebrow: "4. Modul | Buchhaltung & Finanzen",
    title: "Umsatzsteuer-Optionen",
    description: "Spezialbereich für Gewerbemieten, USt.-Voranmeldung und Vorsteuer-Schlüsselung bei Mischobjekten.",
    basePath: "/buchhaltung",
    source: "Buchhaltung, Steuer, Gewerbeobjekte",
    subpages: [
      { path: "/buchhaltung/buchungen", label: "Buchungen", icon: WalletCards },
      { path: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", icon: CalendarCheck },
      { path: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkosten", icon: ClipboardList },
      { path: "/buchhaltung/automatisiertes-mahnwesen", label: "Mahnwesen", icon: Bell },
      { path: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", icon: Euro },
      { path: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", icon: BarChart3 },
      { path: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", icon: BriefcaseBusiness },
      { path: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", icon: ReceiptText },
    ],
    tabs: [
      { label: "USt.-Voranmeldung", description: "Netto-/Bruttomieten und eingenommene Umsatzsteuer." },
      { label: "Vorsteuer-Schlüsselung", description: "Abziehbare Vorsteuern bei Wohn-/Gewerbe-Mischobjekten." },
    ],
  },
  ticketSchaden: {
    eyebrow: "5. Modul | Aufgaben & Ticketsystem",
    title: "Schadenmeldungen",
    description: "Technische Mängel, Fotos und Mieter-Kommunikation als Gebäudemanagement-Arbeitsbereich.",
    basePath: "/ticketsystem",
    source: "Datenprüfung, Mieterkommunikation, Dokumente",
    subpages: [
      { path: "/ticketsystem/schadenmeldungen", label: "Schadenmeldungen", icon: FolderKanban },
      { path: "/ticketsystem/handwerker-beauftragung", label: "Handwerker-Beauftragung", icon: BriefcaseBusiness },
    ],
    tabs: [
      { label: "Kategorisierung & Priorität", description: "Wasser, Strom, Heizung und weitere Gewerke nach Dringlichkeit sortieren." },
      { label: "Foto-Dokumentation & Anhänge", description: "Schadensbilder und Dokumente direkt im Vorgang einsehen." },
      { label: "Mieter-Kommunikation", description: "Mail- und Status-Updates im Ticket-Kontext." },
    ],
  },
  ticketHandwerker: {
    eyebrow: "5. Modul | Aufgaben & Ticketsystem",
    title: "Handwerker-Beauftragung",
    description: "Dienstleister, Angebote, Aufträge und Statusverfolgung für technische Instandhaltung.",
    basePath: "/ticketsystem",
    source: "Tickets, Dienstleister, E-Mail-Schnittstellen",
    subpages: [
      { path: "/ticketsystem/schadenmeldungen", label: "Schadenmeldungen", icon: FolderKanban },
      { path: "/ticketsystem/handwerker-beauftragung", label: "Handwerker-Beauftragung", icon: BriefcaseBusiness },
    ],
    tabs: [
      { label: "Dienstleister-Verzeichnis", description: "Gewerk- und Regionen-Filter für passende Handwerker." },
      { label: "Angebotseinholung", description: "Kostenvoranschläge digital vergleichen." },
      { label: "Auftragserteilung", description: "PDF-Aufträge und E-Mail-Versand vorbereiten." },
      { label: "Statusverfolgung", description: "Termine, Ausführung und Fertigmeldung überwachen." },
    ],
  },
  einstellungenBenutzer: {
    eyebrow: "6. Modul | System-Einstellungen",
    title: "Benutzer- & Rechteverwaltung",
    description: "Administratives Zentrum für Benutzer, Rollen, Berechtigungen und Login-Sicherheit.",
    basePath: "/einstellungen",
    source: "Administrator, Rollen, Zugriffsschutz",
    subpages: [
      { path: "/einstellungen/benutzer-rechteverwaltung", label: "Benutzer & Rechte", icon: UserCog },
      { path: "/einstellungen/datenschutz-compliance", label: "Datenschutz & Compliance", icon: ShieldCheck },
    ],
    tabs: [
      { label: "Benutzerübersicht", description: "Registrierte Profile und Zugänge." },
      { label: "Rollen-Editor", description: "Admin, Verwalter, Buchhalter und Gast definieren." },
      { label: "Berechtigungs-Matrix", description: "Lese-/Schreibrechte für Objekte und Finanzen." },
      { label: "Sicherheit & Login", description: "2FA und Passwort-Richtlinien." },
    ],
  },
  einstellungenDatenschutz: {
    eyebrow: "6. Modul | System-Einstellungen",
    title: "Datenschutz & Compliance",
    description: "DSGVO-Exporte, Löschprozesse, Logbücher und Audit-Trail als geschützter Administrationsbereich.",
    basePath: "/einstellungen",
    source: "Datenschutz, Audit, Administrator",
    subpages: [
      { path: "/einstellungen/benutzer-rechteverwaltung", label: "Benutzer & Rechte", icon: UserCog },
      { path: "/einstellungen/datenschutz-compliance", label: "Datenschutz & Compliance", icon: ShieldCheck },
    ],
    tabs: [
      { label: "DSGVO-Exporte", description: "Selbstauskünfte exportieren oder nach Frist löschen." },
      { label: "Logbücher & Audit-Trail", description: "Kritische Aktionen nachvollziehbar protokollieren." },
    ],
  },
};

function LogoutButton({ showEmail = true, compact = false }: { showEmail?: boolean; compact?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  async function handleLogout() {
    try {
      await supabase.auth.signOut({ scope: "local" });
      clearAppSessionStorage();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout fehlgeschlagen:", error);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {showEmail ? (
        <span className="hidden h-[46px] items-center rounded-2xl border border-[#d8d2c7] bg-white/65 px-4 text-sm font-semibold text-slate-600 2xl:inline-flex">
          {user?.email ?? "Eingeloggt"}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleLogout}
        className={[
          "inline-flex h-[46px] items-center justify-center rounded-2xl border border-[#d8d2c7] bg-white/75 px-4 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-white",
          compact ? "flex-1" : "w-[116px]",
        ].join(" ")}
      >
        Logout
      </button>
    </div>
  );
}

function ProtectedAppShell() {
  return (
    <RequireAuthMFA>
      <AppErrorBoundary>
        <AppDataProvider>
          <AppShell />
        </AppDataProvider>
      </AppErrorBoundary>
    </RequireAuthMFA>
  );
}

function NebenkostenIndexPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Nebenkostenabrechnungen"
        title="Nebenkosten"
        description="Zentrale Auswahl fuer Wohnungs- und Tiefgaragenabrechnungen. Berechnungen und Eingaben bleiben in den bestehenden Fachseiten."
        meta={[
          { label: "Quelle", value: "Buchhaltung + NK-Seiten" },
          { label: "Modus", value: "Bestand erhalten" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <ModuleCard
          to="/nebenkosten/wohnungen"
          label="NK-Wohnungen"
          description="Nebenkostenabrechnung fuer Wohnungen mit vorhandenen Umlageschluesseln, Kostenpositionen und Ausgaben."
          icon={Building2}
          badge="Wohnungen"
        />
        <ModuleCard
          to="/nebenkosten/tiefgarage"
          label="NK-Tiefgaragen"
          description="Abrechnung fuer Tiefgaragen und Stellplaetze mit den bestehenden Tabellen und Exporten."
          icon={ClipboardList}
          badge="Garage"
        />
      </section>

      <SectionPanel
        eyebrow="Arbeitslogik"
        title="Bestehende Fachseiten bleiben die Quelle"
        description="Diese Uebersicht sortiert nur die Zugriffe. Die fachlichen Berechnungen bleiben auf den bereits geprueften NK-Seiten."
      >
        <InfoList
          items={[
            { label: "Wohnungen", value: "Abrechnung, Umlagen, PDF/Export", tone: "blue" },
            { label: "Tiefgarage", value: "Stellplaetze, Kosten, Export", tone: "amber" },
            { label: "Buchungen", value: "Kostenquelle bleibt Buchhaltung", tone: "green" },
          ]}
        />
      </SectionPanel>
    </div>
  );
}

function ModuleHubPage({
  eyebrow,
  title,
  description,
  links,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  links: ModuleLink[];
  meta?: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={eyebrow} title={title} description={description} meta={meta} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => <ModuleCard key={link.to} {...link} />)}
      </section>
    </div>
  );
}

function ModuleWorkspacePage({
  config,
  children,
}: {
  config: WorkspaceConfig;
  children?: ReactNode;
}) {
  return (
    <div className="module-workspace space-y-5">
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        meta={[
          { label: "Route", value: config.basePath },
          { label: "Quelle", value: config.source },
        ]}
      />

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {config.subpages.map((subpage) => {
            const Icon = subpage.icon;
            return (
              <NavLink
                key={subpage.path}
                to={subpage.path}
                className={({ isActive }) =>
                  [
                    "flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-black no-underline transition",
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={18}
                      className={isActive ? "text-white" : "text-slate-800"}
                    />
                    <span className={isActive ? "text-white" : "text-slate-950"}>
                      {subpage.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </section>

      <SectionPanel
        eyebrow="Tabs"
        title="Arbeitsbereiche"
        description="Die Tabs strukturieren die Fachseite nach der neuen Modulhierarchie. Die darunterliegenden Daten und Funktionen bleiben in den bestehenden Seiten."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {config.tabs.map((tab) => (
            <div
              key={tab.label}
              className="rounded-[18px] border border-slate-200 bg-slate-50 p-4"
            >
              <h3 className="text-sm font-black text-slate-950">{tab.label}</h3>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                {tab.description}
              </p>
            </div>
          ))}
        </div>
      </SectionPanel>

      <div className="module-workspace-content">
        {children ?? (
          <EmptyState
            title="Vorhandene Fachseite wird hier eingebunden"
            description="Diese Unterseite ist strukturell vorbereitet und verwendet vorhandene Datenquellen, sobald die passende Fachkomponente verfügbar ist."
          />
        )}
      </div>
    </div>
  );
}

function AdminOnlyWorkspace({
  config,
  children,
}: {
  config: WorkspaceConfig;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  if (!isAdmin) {
    return (
      <ModuleWorkspacePage config={config}>
        <EmptyState
          title="Administrationsbereich geschützt"
          description="Diese Unterseite ist nur für Admin-Benutzer freigegeben. Bestehende Zugriffsbeschränkungen bleiben aktiv."
        />
      </ModuleWorkspacePage>
    );
  }

  return <ModuleWorkspacePage config={config}>{children}</ModuleWorkspacePage>;
}

function MieterHubPage() {
  return (
    <ModuleHubPage
      eyebrow="Mietermanagement"
      title="Mieter"
      description="Zentrale Mieter-Navigation. Die Stammdaten, Verträge und Zahlungskontrollen bleiben in den bestehenden Modulen."
      meta={[
        { label: "Quelle", value: "Mieterstammdaten + Buchhaltung" },
        { label: "Pflege", value: "Mieter anlegen" },
      ]}
      links={[
        { to: "/mieter/mieteingang", label: "Zahlungen", description: "Mieteingänge aus Buchhaltung und Vermietungszeiträumen prüfen.", icon: WalletCards, badge: "Soll/Ist" },
        { to: "/mieter/stammdaten", label: "Stammdaten", description: "Mieter anlegen und vorhandene Mieterstammdaten pflegen.", icon: Users, badge: "Stamm" },
        { to: "/mieter/leerstand", label: "Leerstand", description: "Leerstände und nicht aktive Einheiten verwalten.", icon: DoorOpen, badge: "Status" },
        { to: "/mieter/ein-auszug", label: "Ein-/Auszug", description: "Übergaben, Prozesse und Historie rund um Mieterwechsel.", icon: KeyRound, badge: "Prozess" },
        { to: "/mieter/mahnwesen", label: "Mahnwesen", description: "Offene Posten und Mahnprozess aus bestehenden Daten.", icon: Bell, badge: "Offen" },
      ]}
    />
  );
}

function BuchhaltungHubPage() {
  const { user } = useAuth();
  const isReadOnly = !isAdminEmail(user?.email) && isReadonlyApprovalEmail(user?.email);
  const { entries, loading, error, getPropertyName } = useAppData();
  const currentMonthEntries = useMemo(
    () => entries.filter((entry) => isCurrentMonthEntry(entry)),
    [entries],
  );
  const income = currentMonthEntries
    .filter((entry) => entry.entry_type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = currentMonthEntries
    .filter((entry) => entry.entry_type === "expense")
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const rentIncome = currentMonthEntries
    .filter((entry) => isRentLikeEntry(entry))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const unassigned = currentMonthEntries.filter((entry) => !entry.object_id || !entry.category).length;
  const recentEntries = useMemo(
    () =>
      [...entries]
        .sort((a, b) => String(b.booking_date ?? "").localeCompare(String(a.booking_date ?? "")))
        .slice(0, 6),
    [entries],
  );
  const monthLabel = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Single Source of Truth"
        title="Buchhaltung"
        description="Arbeitscockpit für Transaktionen, Monatsbewegungen, Regeln und Auswertungen. Die Buchungen bleiben die zentrale Datenquelle der App."
      >
        <NavLink
          to="/buchhaltung/transaktionen"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white no-underline shadow-sm"
        >
          Transaktionen öffnen <ArrowRight size={16} />
        </NavLink>
      </PageHeader>

      {error ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-900">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Einnahmen ${monthLabel}`} value={formatCurrency(income)} icon={WalletCards} tone="green" />
        <KpiCard label={`Ausgaben ${monthLabel}`} value={formatCurrency(expenses)} icon={ReceiptText} tone="red" />
        <KpiCard label="Saldo" value={formatCurrency(income - expenses)} icon={BarChart3} tone={income - expenses >= 0 ? "blue" : "amber"} />
        <KpiCard label="Mieteingänge" value={formatCurrency(rentIncome)} detail={`${currentMonthEntries.length} Buchungen im Monat`} icon={CalendarCheck} tone="violet" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Arbeitsliste</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Letzte Buchungen</h2>
            </div>
            {loading ? <span className="text-sm font-bold text-slate-500">Daten werden geladen...</span> : null}
          </div>

          {recentEntries.length ? (
            <div className="mt-5 overflow-hidden rounded-[18px] border border-slate-200">
              {recentEntries.map((entry) => (
                <div
                  key={`${entry.id ?? "entry"}-${entry.booking_date}-${entry.amount}`}
                  className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[110px_1fr_140px]"
                >
                  <div className="text-sm font-black text-slate-700">{formatDate(entry.booking_date)}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">
                      {getPropertyName(entry.object_id) || entry.objekt_code || "Ohne Objekt"}
                    </div>
                    <div className="mt-1 truncate text-xs font-bold text-slate-500">
                      {entry.category || "Ohne Kategorie"} {entry.note ? `- ${entry.note}` : ""}
                    </div>
                  </div>
                  <div className={["text-left text-sm font-black md:text-right", entry.entry_type === "expense" ? "text-red-700" : "text-emerald-700"].join(" ")}>
                    {formatCurrency(entry.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="Noch keine Buchungen geladen" description="Sobald Buchhaltungsdaten verfügbar sind, erscheinen hier die neuesten Bewegungen." />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <KpiCard
            label="Zu prüfen"
            value={unassigned}
            detail="Buchungen ohne Objekt oder Kategorie im aktuellen Monat"
            icon={ShieldCheck}
            tone={unassigned ? "amber" : "green"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <ModuleCard to="/buchhaltung/transaktionen" label="Transaktionen" description="Buchhaltungsübersicht mit Einnahmen und Ausgaben prüfen." icon={WalletCards} />
            <ModuleCard to="/buchhaltung/neue-buchung" label="Neue Buchung" description={isReadOnly ? "Nur Admins können neue Buchungen erfassen." : "Buchungen über das bestehende Erfassungsmodul anlegen."} icon={PlusCircle} disabled={isReadOnly} />
            <ModuleCard to="/buchhaltung/regeln" label="Regeln" description={isReadOnly ? "Nur Admins können Regeln bearbeiten." : "Transaktionsregeln und Zuordnungen verwalten."} icon={Settings2} disabled={isReadOnly} />
            <ModuleCard to="/berichte" label="Berichte" description="Reports und Auswertungen aus vorhandenen Datenquellen." icon={BarChart3} />
          </div>
        </div>
      </section>
    </div>
  );
}

function VermoegenHubPage() {
  const { entries, loanRows, objects } = useAppData();
  const currentYear = new Date().getFullYear();
  const currentYearEntries = useMemo(
    () => entries.filter((entry) => entry.booking_date?.startsWith(`${currentYear}-`)),
    [currentYear, entries],
  );
  const yearlyIncome = currentYearEntries
    .filter((entry) => entry.entry_type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const yearlyExpenses = currentYearEntries
    .filter((entry) => entry.entry_type === "expense")
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const loanBalance = loanRows.reduce((sum, row) => sum + (row.last_balance ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Aggregierte Sicht"
        title="Vermögen"
        description="Investor- und Bankensicht aus vorhandenen Immobilien-, Buchhaltungs-, Darlehens- und Steuerdaten. Dieses Modul speichert keine eigenen Daten."
        meta={[
          { label: "Jahr", value: currentYear },
          { label: "Quelle", value: "Portfolio, Buchhaltung, Darlehen" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Immobilien" value={objects.length} icon={Building2} tone="blue" />
        <KpiCard label="Darlehen Restschuld" value={formatCurrency(loanBalance)} icon={Landmark} tone="violet" />
        <KpiCard label="Einnahmen Jahr" value={formatCurrency(yearlyIncome)} icon={WalletCards} tone="green" />
        <KpiCard label="Cashflow Jahr" value={formatCurrency(yearlyIncome - yearlyExpenses)} icon={PieChart} tone={yearlyIncome - yearlyExpenses >= 0 ? "green" : "amber"} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard to="/immobilien" label="Immobilienbestand" description="Objekte, Einheiten und Objektakten aus dem Portfolio." icon={Building2} />
        <ModuleCard to="/darlehen" label="Darlehen" description="Finanzierung, Restschuld und Zuordnung zu Immobilien." icon={Landmark} />
        <ModuleCard to="/buchhaltung" label="Cashflow" description="Zahlungsstroeme aus der bestehenden Buchhaltung." icon={WalletCards} />
        <ModuleCard to="/steuer" label="Steuer" description="Steuerliche Auswertungen aus dem bestehenden Steuercenter." icon={Euro} />
        <ModuleCard to="/berichte" label="Investment-Reports" description="Auswertungen als Grundlage fuer Investor-Informationen." icon={PieChart} />
      </section>

      <SectionPanel
        eyebrow="Investor-Logik"
        title="Keine eigene Datenhaltung"
        description="Die Vermoegenssicht ist ein Einstiegspunkt fuer Bank-, Investor- und Management-Fragen. Zahlen werden aus bestehenden Modulen gelesen."
      >
        <InfoList
          items={[
            { label: "Immobilien", value: "Portfolio und Objektakte", tone: "blue" },
            { label: "Cashflow", value: "Buchhaltung", tone: "green" },
            { label: "Finanzierung", value: "Darlehensuebersicht", tone: "violet" },
            { label: "Steuer", value: "Steuercenter", tone: "amber" },
          ]}
        />
      </SectionPanel>
    </div>
  );
}

function OrganisationHubPage({ kind }: { kind: "ticketing" | "dokumente" | "produktivitaet" | "einstellungen" | "benutzer" | "kautionen" }) {
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const configs: Record<string, ModuleHubConfig> = {
    ticketing: {
      eyebrow: "Arbeitsorganisation",
      title: "Ticketing",
      description: "Tickets und Vorgänge werden als Organisationsschicht eingeordnet. Bestehende Aufgaben- und Prüfmodule bleiben die Grundlage.",
      links: [
        { to: "/dashboard", label: "Heute wichtig", description: "Offene Vorgänge und Hinweise im Dashboard prüfen.", icon: LayoutDashboard },
        { to: "/datenpruefung", label: "Datenprüfung", description: "Bestehende Prüfseite unverändert nutzen.", icon: ShieldCheck },
        { to: "/mieter/mahnwesen", label: "Mahnwesen", description: "Zahlungsbezogene Vorgänge aus offenen Posten.", icon: Bell },
      ],
    },
    dokumente: {
      eyebrow: "Dokumentenmanagement",
      title: "Dokumentenmanagement",
      description: "Dokumente bleiben an Immobilien, Mietern, Buchungen und Verträgen verknüpft. Diese Seite bündelt die Zugänge.",
      links: [
        { to: "/immobilien", label: "Immobilien-Dokumente", description: "Objektbezogene Unterlagen über Portfolio und Objektakten.", icon: FolderOpen },
        { to: "/mieter", label: "Mieter-Dokumente", description: "Mieterbezogene Dokumente über Mieterstammdaten und Prozesse.", icon: Users },
        { to: "/buchhaltung", label: "Buchungsbelege", description: "Belege und Zahlungsinformationen über Buchhaltung.", icon: ReceiptText },
        { to: "/darlehen", label: "Darlehensunterlagen", description: "Finanzierungsdokumente über Darlehen.", icon: Landmark },
      ],
    },
    produktivitaet: {
      eyebrow: "Querschnitt",
      title: "Produktivität",
      description: "Aufgaben, Erinnerungen, Workflows und Automatisierungen werden über bestehende Module erreichbar gemacht.",
      links: [
        { to: "/dashboard", label: "Aufgaben", description: "Cockpit-Aufgaben und wichtige Hinweise.", icon: ListChecks },
        { to: "/berichte?view=automation", label: "Automatisierung", description: "Bestehende Automatisierungs- und Reporting-Zugänge.", icon: CalendarCheck },
        { to: "/ticketing", label: "Tickets", description: "Organisatorische Vorgänge aus Prüf- und Fachmodulen.", icon: FolderKanban },
      ],
    },
    einstellungen: {
      eyebrow: "System",
      title: "Einstellungen",
      description: "Konfigurationen werden nur logisch gruppiert. Vorhandene Einstellungsseiten bleiben erhalten.",
      links: [
        { to: "/buchhaltung/regeln", label: "Transaktionsregeln", description: "Regeln und Zuordnungen für Buchungen.", icon: Settings2, adminOnly: true },
        { to: "/datenpruefung", label: "Datenprüfung", description: "Qualitätssicherung der vorhandenen Daten.", icon: ShieldCheck },
        { to: "/benutzer", label: "Benutzer", description: "Benutzer- und Rollenverwaltung.", icon: UserCog, adminOnly: true },
      ],
    },
    benutzer: {
      eyebrow: "Zugriff",
      title: "Benutzer",
      description: "Benutzerübersicht für Admin und Lesezugänge. Rechteverwaltung bleibt in der bestehenden Administrator-Seite.",
      links: [
        { to: "/administrator", label: "Administrator", description: "Admin-Funktionen, Benutzer und Immobilienanlage.", icon: ShieldCheck, adminOnly: true },
        { to: "/dashboard", label: "Read-Only Übersicht", description: "Lesende Nutzer verwenden die App als Informationsquelle.", icon: BookOpenCheck },
      ],
    },
    kautionen: {
      eyebrow: "Buchhaltung",
      title: "Kautionen",
      description: "Kautionsrelevante Informationen werden über bestehende Buchungen, Mieter und Berichte eingeordnet.",
      links: [
        { to: "/buchhaltung/transaktionen", label: "Buchungen", description: "Kautionsbuchungen über bestehende Transaktionen prüfen.", icon: WalletCards },
        { to: "/mieter/stammdaten", label: "Mieter", description: "Kautionsangaben in den vorhandenen Mieterstammdaten.", icon: Users },
        { to: "/berichte", label: "Berichte", description: "Auswertungen und Nachweise aus bestehenden Reports.", icon: BarChart3 },
      ],
    },
  };

  const config = configs[kind];
  const links = config.links.filter((link) => !link.adminOnly || isAdmin);

  return (
    <div className="space-y-5">
      <ModuleHubPage {...config} links={links} />
      <SectionPanel
        eyebrow="Struktur"
        title="Logisch gruppiert, fachlich unverändert"
        description="Diese Seite bündelt vorhandene Module. Daten, Berechnungen und Erfassungslogik bleiben in den jeweiligen Fachseiten."
      >
        <InfoList
          items={[
            { label: "Datenquelle", value: "Bestehende Module", tone: "blue" },
            { label: "Aenderungen", value: isAdmin ? "Admin-Rechte aktiv" : "Nur Lesen", tone: isAdmin ? "green" : "slate" },
            { label: "Ziel", value: "Schneller Einstieg statt doppelter Logik", tone: "violet" },
          ]}
        />
      </SectionPanel>
    </div>
  );
}

function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileGroups, setOpenMobileGroups] = useState<Set<string>>(
    () => new Set(["1. 📊 Dashboard", "2. 🏢 Immobilien & Einheiten", "3. 👥 Kontakte & Mietverhältnisse", "4. 💼 Buchhaltung & Finanzen"]),
  );
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = isAdminEmail(user?.email);
  const isReadOnly = !isAdmin && isReadonlyApprovalEmail(user?.email);
  const activeAuswertungView = location.pathname === "/auswertungen"
    ? new URLSearchParams(location.search).get("view") ?? "cockpit"
    : "";

  const navItems = useMemo<ShellNavItem[]>(
    () => [
      { to: "/dashboard/finanz-kennzahlen", label: "Finanz-Kennzahlen", group: "1. 📊 Dashboard", icon: BarChart3 },
      { to: "/dashboard/warnmeldungen", label: "Warnmeldungen", group: "1. 📊 Dashboard", icon: Bell },
      { to: "/dashboard/aktuelle-todos", label: "Aktuelle To-dos", group: "1. 📊 Dashboard", icon: ListChecks },
      { to: "/immobilien/objektuebersicht", label: "Objektübersicht", group: "2. 🏢 Immobilien & Einheiten", icon: Building2 },
      { to: "/immobilien/einheiten-verwaltung", label: "Einheiten-Verwaltung", group: "2. 🏢 Immobilien & Einheiten", icon: FolderKanban },
      { to: "/immobilien/zaehlerstaende-verbrauch", label: "Zählerstände & Verbrauch", group: "2. 🏢 Immobilien & Einheiten", icon: ClipboardList },
      { to: "/immobilien/objekt-dokumente", label: "Objekt-Dokumente", group: "2. 🏢 Immobilien & Einheiten", icon: FileText },
      { to: "/kontakte/aktive-mietvertraege", label: "Aktive Mietverträge", group: "3. 👥 Kontakte & Mietverhältnisse", icon: Users },
      { to: "/kontakte/mieter-eigentuemerakten", label: "Mieter-/Eigentümerakten", group: "3. 👥 Kontakte & Mietverhältnisse", icon: FolderOpen },
      { to: "/kontakte/interessenten-selbstauskuenfte", label: "Interessenten", group: "3. 👥 Kontakte & Mietverhältnisse", icon: UserCog },
      { to: "/kontakte/wohnungsgeberbescheinigungen-uebergabeprotokolle", label: "Übergaben & Protokolle", group: "3. 👥 Kontakte & Mietverhältnisse", icon: KeyRound },
      { to: "/buchhaltung/buchungen", label: "Buchungen", group: "4. 💼 Buchhaltung & Finanzen", icon: WalletCards },
      { to: "/buchhaltung/sollstellungen-mietanpassungen", label: "Sollstellungen", group: "4. 💼 Buchhaltung & Finanzen", icon: CalendarCheck },
      { to: "/buchhaltung/nebenkostenabrechnung", label: "Nebenkostenabrechnung", group: "4. 💼 Buchhaltung & Finanzen", icon: ClipboardList },
      { to: "/buchhaltung/automatisiertes-mahnwesen", label: "Automatisiertes Mahnwesen", group: "4. 💼 Buchhaltung & Finanzen", icon: Bell },
      { to: "/buchhaltung/steuer-center-berater", label: "Steuer-Center", group: "4. 💼 Buchhaltung & Finanzen", icon: Euro },
      { to: "/buchhaltung/berichte-exporte", label: "Berichte & Exporte", group: "4. 💼 Buchhaltung & Finanzen", icon: BarChart3 },
      { to: "/buchhaltung/steuerberater-portal", label: "Steuerberater-Portal", group: "4. 💼 Buchhaltung & Finanzen", icon: BriefcaseBusiness },
      { to: "/buchhaltung/umsatzsteuer-optionen", label: "USt.-Optionen", group: "4. 💼 Buchhaltung & Finanzen", icon: ReceiptText },
      { to: "/ticketsystem/schadenmeldungen", label: "Schadenmeldungen", group: "5. 🔧 Aufgaben & Ticketsystem", icon: FolderKanban },
      { to: "/ticketsystem/handwerker-beauftragung", label: "Handwerker-Beauftragung", group: "5. 🔧 Aufgaben & Ticketsystem", icon: BriefcaseBusiness },
      ...(isAdmin ? [
        { to: "/einstellungen/benutzer-rechteverwaltung", label: "Benutzer & Rechte", group: "6. ⚙️ System-Einstellungen", icon: UserCog },
        { to: "/einstellungen/datenschutz-compliance", label: "Datenschutz & Compliance", group: "6. ⚙️ System-Einstellungen", icon: ShieldCheck },
      ] : [
        { to: "/einstellungen/benutzer-rechteverwaltung", label: "Benutzer & Rechte", group: "6. ⚙️ System-Einstellungen", icon: UserCog },
      ]),
    ],
    [isAdmin],
  );

  const navGroups = useMemo(
    () =>
      ["1. 📊 Dashboard", "2. 🏢 Immobilien & Einheiten", "3. 👥 Kontakte & Mietverhältnisse", "4. 💼 Buchhaltung & Finanzen", "5. 🔧 Aufgaben & Ticketsystem", "6. ⚙️ System-Einstellungen"].map((group) => ({
        group,
        items: navItems.filter((item) => item.group === group),
      })).filter((group) => group.items.length > 0),
    [navItems],
  );

  function toggleMobileGroup(group: string) {
    setOpenMobileGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className={["min-h-screen bg-[#f6f1e8] text-slate-950", isReadOnly ? "app-readonly" : ""].filter(Boolean).join(" ")}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[286px] flex-col border-r border-slate-800 bg-[#101827] text-white shadow-2xl xl:flex">
        <NavLink
          to="/dashboard/finanz-kennzahlen"
          className="flex items-center gap-3 border-b border-white/10 px-5 py-5 no-underline"
          title="Zum Dashboard"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white shadow-sm">
            <img src={logo} alt="Könen Immobilien" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Property App
            </div>
            <div className="mt-1 truncate text-base font-black leading-tight text-white">
              Immobilien-Verwaltung
            </div>
          </div>
        </NavLink>

        <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {navGroups.map(({ group, items }) => (
            <div key={group}>
              <div className={`mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] ${groupAccent[group] ?? "text-slate-400"}`}>
                {group}
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => sidebarNavLinkClass(isActive)}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={19}
                              className={isActive ? "text-white" : "text-slate-400 transition group-hover:text-white"}
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                      {item.to === "/auswertungen" && location.pathname === "/auswertungen" ? (
                        <div className="ml-8 mt-1 grid gap-1 border-l border-white/10 pl-3">
                          {auswertungSubNav.map((subItem) => {
                            const active = activeAuswertungView === subItem.view;
                            return (
                              <Link
                                key={subItem.view}
                                to={`/auswertungen?view=${subItem.view}`}
                                className={[
                                  "rounded-xl px-3 py-2 text-xs font-extrabold no-underline transition",
                                  active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white",
                                ].join(" ")}
                              >
                                {subItem.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-xs font-bold text-slate-300">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Angemeldet</div>
            <div className="mt-1 truncate">{user?.email ?? "Eingeloggt"}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {isReadOnly ? "Nur Lesen" : "Admin"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BackupButton />
            <LogoutButton showEmail={false} compact />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-[#e7ddcf] bg-[#f6f1e8]/88 backdrop-blur-xl xl:hidden">
        <div className="mx-auto max-w-[1760px] px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
          <div className="flex items-center justify-between gap-3 sm:gap-5">
            <NavLink
              to="/dashboard/finanz-kennzahlen"
              className="flex min-w-0 items-center gap-3"
              title="Zum Dashboard"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e3d8ca] bg-[#f3eadc] shadow-sm sm:h-14 sm:w-14">
                <img
                  src={logo}
                  alt="Könen Immobilien"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
                  Property App
                </div>
                <div className="max-w-[220px] truncate text-base font-semibold leading-tight text-slate-950 sm:max-w-none sm:text-2xl">
                  Immobilien-Finanzübersicht
                </div>
              </div>
            </NavLink>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm sm:h-12 sm:w-12"
              aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="mt-3 max-h-[calc(100vh-86px)] overflow-y-auto rounded-[24px] border border-[#e7ddcf] bg-white/90 p-3 shadow-sm xl:hidden">
              <nav className="grid gap-4">
                {navGroups.map(({ group, items }) => (
                  <div key={group} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => toggleMobileGroup(group)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      aria-expanded={openMobileGroups.has(group)}
                    >
                      <span className={`text-[11px] font-black uppercase tracking-[0.16em] ${groupAccent[group] ?? "text-slate-500"}`}>
                        {group}
                      </span>
                      <ChevronDown
                        size={18}
                        className={[
                          "text-slate-500 transition-transform",
                          openMobileGroups.has(group) ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    </button>
                    {openMobileGroups.has(group) ? (
                    <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-2 sm:grid-cols-2">
                      {items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.to} className={item.to === "/auswertungen" && location.pathname === "/auswertungen" ? "col-span-2" : ""}>
                            <NavLink
                              to={item.to}
                              end={item.end}
                              onClick={() => setMobileMenuOpen(false)}
                              className={({ isActive }) =>
                                [
                                  "flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center text-sm font-extrabold leading-tight shadow-sm transition",
                                  isActive
                                    ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                    : "border-slate-200 bg-white text-slate-900",
                                ].join(" ")
                              }
                            >
                              <Icon size={16} />
                              <span>{item.label}</span>
                            </NavLink>
                            {item.to === "/auswertungen" && location.pathname === "/auswertungen" ? (
                              <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                {auswertungSubNav.map((subItem) => {
                                  const active = activeAuswertungView === subItem.view;
                                  return (
                                    <Link
                                      key={subItem.view}
                                      to={`/auswertungen?view=${subItem.view}`}
                                      onClick={() => setMobileMenuOpen(false)}
                                      className={[
                                        "rounded-xl px-3 py-2 text-center text-xs font-extrabold no-underline transition",
                                        active ? "bg-indigo-100 text-indigo-800" : "bg-white text-slate-700",
                                      ].join(" ")}
                                    >
                                      {subItem.label}
                                    </Link>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                ))}
              </nav>

              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#e7ddcf] bg-white/80 p-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                  {user?.email ?? "Eingeloggt"}
                  <span className="ml-2 font-black text-slate-500">{isReadOnly ? "Nur Lesen" : "Admin"}</span>
                </div>
                <BackupButton />
                <LogoutButton />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1760px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 xl:ml-[286px] xl:max-w-none">
        {isReadOnly ? (
          <div className="readonly-banner">
            Nur-Lesen-Zugang: Daten und Felder sind geschützt. Änderungen sind dem Admin vorbehalten.
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/mfa" element={<MFA />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedAppShell />}>
        <Route path="/dashboard" element={<Navigate to="/dashboard/finanz-kennzahlen" replace />} />
        <Route
          path="/dashboard/finanz-kennzahlen"
          element={<ModuleWorkspacePage config={workspaceConfigs.dashboardFinanz}><Cockpit /></ModuleWorkspacePage>}
        />
        <Route
          path="/dashboard/warnmeldungen"
          element={<ModuleWorkspacePage config={workspaceConfigs.dashboardWarnungen}><Datenpruefung /></ModuleWorkspacePage>}
        />
        <Route
          path="/dashboard/aktuelle-todos"
          element={<ModuleWorkspacePage config={workspaceConfigs.dashboardTodos}><OrganisationHubPage kind="produktivitaet" /></ModuleWorkspacePage>}
        />
        <Route path="/cockpit" element={<Navigate to="/dashboard/finanz-kennzahlen" replace />} />

        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/immobilien" element={<Navigate to="/immobilien/objektuebersicht" replace />} />
        <Route path="/Immobilien" element={<Navigate to="/immobilien/objektuebersicht" replace />} />
        <Route
          path="/immobilien/objektuebersicht"
          element={<ModuleWorkspacePage config={workspaceConfigs.immobilienObjekte}><Portfolio /></ModuleWorkspacePage>}
        />
        <Route
          path="/immobilien/einheiten-verwaltung"
          element={<ModuleWorkspacePage config={workspaceConfigs.immobilienEinheiten}><Portfolio /></ModuleWorkspacePage>}
        />
        <Route
          path="/immobilien/zaehlerstaende-verbrauch"
          element={<ModuleWorkspacePage config={workspaceConfigs.immobilienVerbrauch}><NebenkostenIndexPage /></ModuleWorkspacePage>}
        />
        <Route
          path="/immobilien/objekt-dokumente"
          element={<ModuleWorkspacePage config={workspaceConfigs.immobilienDokumente}><OrganisationHubPage kind="dokumente" /></ModuleWorkspacePage>}
        />
        <Route
          path="/portfolio/:propertyId"
          element={<PortfolioPropertyLayout />}
        >
          <Route index element={<Navigate to="details" replace />} />
          <Route path="address" element={<PortfolioAddress />} />
          <Route path="details" element={<PortfolioDetails />} />
          <Route path="objektakte" element={<PortfolioObjectDetail />} />
          <Route path="darlehen" element={<PortfolioFinanceModules focus="darlehen" />} />
          <Route path="finance-pro-jahr" element={<PortfolioFinanceModules focus="finance" />} />
          <Route path="income" element={<PortfolioFinanceModules focus="income" />} />
          <Route path="capex" element={<PortfolioFinanceModules focus="capex" />} />
          <Route path="finanzen" element={<PortfolioFinance />} />
          <Route path="energie" element={<PortfolioEnergy />} />
          <Route path="vermietung" element={<PortfolioRenting />} />
        </Route>
        <Route path="/immobilien/:propertyId" element={<PortfolioPropertyLayout />}>
          <Route index element={<Navigate to="objektakte" replace />} />
          <Route path="uebersicht" element={<PortfolioObjectDetail />} />
          <Route path="einheiten" element={<PortfolioDetails />} />
          <Route path="mieter" element={<PortfolioRenting />} />
          <Route path="leerstand" element={<Leerstand />} />
          <Route path="finanzen" element={<PortfolioFinance />} />
          <Route path="dokumente" element={<PortfolioObjectDetail />} />
          <Route path="historie" element={<PortfolioObjectDetail />} />
          <Route path="einstellungen" element={<PortfolioDetails />} />
          <Route path="address" element={<PortfolioAddress />} />
          <Route path="details" element={<PortfolioDetails />} />
          <Route path="objektakte" element={<PortfolioObjectDetail />} />
          <Route path="darlehen" element={<PortfolioFinanceModules focus="darlehen" />} />
          <Route path="finance-pro-jahr" element={<PortfolioFinanceModules focus="finance" />} />
          <Route path="income" element={<PortfolioFinanceModules focus="income" />} />
          <Route path="capex" element={<PortfolioFinanceModules focus="capex" />} />
          <Route path="energie" element={<PortfolioEnergy />} />
          <Route path="vermietung" element={<PortfolioRenting />} />
        </Route>

        <Route path="/objekte" element={<Navigate to="/immobilien/objektuebersicht" replace />} />
        <Route
          path="/objekte/:propertyId"
          element={<RedirectObjectRoute section="objektakte" />}
        />
        <Route
          path="/objekte/:propertyId/monate"
          element={<RedirectObjectRoute section="finance-pro-jahr" />}
        />
        <Route
          path="/objekte/:propertyId/auswertungen"
          element={<RedirectObjectRoute section="finance-pro-jahr" />}
        />
        <Route
          path="/objekte/:propertyId/darlehen"
          element={<RedirectObjectRoute section="darlehen" />}
        />
        <Route
          path="/objekte/:propertyId/income"
          element={<RedirectObjectRoute section="income" />}
        />
        <Route
          path="/objekte/:propertyId/capex"
          element={<RedirectObjectRoute section="capex" />}
        />

        <Route path="/monate" element={<Monate />} />
        <Route path="/buchhaltung" element={<Navigate to="/buchhaltung/buchungen" replace />} />
        <Route
          path="/buchhaltung/buchungen"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungBuchungen}><BuchhaltungHubPage /></ModuleWorkspacePage>}
        />
        <Route
          path="/buchhaltung/sollstellungen-mietanpassungen"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungSoll}><Mietuebersicht /></ModuleWorkspacePage>}
        />
        <Route
          path="/buchhaltung/nebenkostenabrechnung"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungNebenkosten}><NebenkostenIndexPage /></ModuleWorkspacePage>}
        />
        <Route
          path="/buchhaltung/automatisiertes-mahnwesen"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungMahnwesen}><Mahnwesen /></ModuleWorkspacePage>}
        />
        <Route
          path="/buchhaltung/steuer-center-berater"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungSteuer}><SteuerCenter /></ModuleWorkspacePage>}
        />
        <Route
          path="/buchhaltung/berichte-exporte"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungBerichte}><Auswertung /></ModuleWorkspacePage>}
        />
        <Route
          path="/buchhaltung/steuerberater-portal"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungPortal}><OrganisationHubPage kind="benutzer" /></ModuleWorkspacePage>}
        />
        <Route
          path="/buchhaltung/umsatzsteuer-optionen"
          element={<ModuleWorkspacePage config={workspaceConfigs.buchhaltungUst}><SteuerCenter /></ModuleWorkspacePage>}
        />
        <Route path="/buchhaltung/transaktionen" element={<Monate />} />
        <Route path="/buchhaltung/einnahmen" element={<Monate />} />
        <Route path="/buchhaltung/ausgaben" element={<Monate />} />
        <Route path="/buchhaltung/neue-buchung" element={<EntryAdd />} />
        <Route path="/buchhaltung/regeln" element={<Transaktionsregeln />} />
        <Route path="/buchhaltung/mahnwesen" element={<Navigate to="/buchhaltung/automatisiertes-mahnwesen" replace />} />
        <Route path="/buchhaltung/kautionen" element={<Navigate to="/buchhaltung/sollstellungen-mietanpassungen" replace />} />
        <Route path="/buchhaltung/nebenkosten" element={<Navigate to="/buchhaltung/nebenkostenabrechnung" replace />} />
        <Route path="/buchhaltung/berichte" element={<Navigate to="/buchhaltung/berichte-exporte" replace />} />
        <Route path="/buchhaltung/export" element={<Navigate to="/buchhaltung/berichte-exporte" replace />} />
        <Route path="/steuer" element={<SteuerCenter />} />
        <Route path="/auswertungen" element={<Auswertung />} />
        <Route path="/berichte" element={<Auswertung />} />
        <Route path="/funktionsvergleich" element={<Funktionsvergleich />} />
        <Route
          path="/auswertung"
          element={<Navigate to="/auswertungen" replace />}
        />

        <Route path="/buchungen" element={<EntryAdd />} />
        <Route path="/administrator" element={<Navigate to="/einstellungen/benutzer-rechteverwaltung" replace />} />
        <Route path="/kontakte" element={<Navigate to="/kontakte/aktive-mietvertraege" replace />} />
        <Route
          path="/kontakte/aktive-mietvertraege"
          element={<ModuleWorkspacePage config={workspaceConfigs.kontakteVertraege}><MieterAnlegen /></ModuleWorkspacePage>}
        />
        <Route
          path="/kontakte/mieter-eigentuemerakten"
          element={<ModuleWorkspacePage config={workspaceConfigs.kontakteAkten}><MieterAnlegen /></ModuleWorkspacePage>}
        />
        <Route
          path="/kontakte/interessenten-selbstauskuenfte"
          element={<ModuleWorkspacePage config={workspaceConfigs.kontakteInteressenten}><MieterAnlegen /></ModuleWorkspacePage>}
        />
        <Route
          path="/kontakte/wohnungsgeberbescheinigungen-uebergabeprotokolle"
          element={<ModuleWorkspacePage config={workspaceConfigs.kontakteUebergaben}><EinAuszug /></ModuleWorkspacePage>}
        />
        <Route path="/mieter" element={<Navigate to="/kontakte/aktive-mietvertraege" replace />} />
        <Route path="/mieter/uebersicht" element={<MieterHubPage />} />
        <Route path="/mieter/stammdaten" element={<MieterAnlegen />} />
        <Route path="/mieter/vertrag" element={<MieterAnlegen />} />
        <Route path="/mieter/zahlungen" element={<Mietuebersicht />} />
        <Route path="/mieter/mieteingang" element={<Mietuebersicht />} />
        <Route path="/mieter/dokumente" element={<OrganisationHubPage kind="dokumente" />} />
        <Route path="/mieter/historie" element={<EinAuszug />} />
        <Route path="/mieter/ein-auszug" element={<EinAuszug />} />
        <Route path="/mieter/notizen" element={<MieterAnlegen />} />
        <Route path="/mieter/kommunikation" element={<Mahnwesen />} />
        <Route path="/mieter/leerstand" element={<Leerstand />} />
        <Route path="/mieter/mahnwesen" element={<Mahnwesen />} />
        <Route path="/mieteruebersicht" element={<Mietuebersicht />} />
        <Route path="/mieter-anlegen" element={<MieterAnlegen />} />
        <Route path="/leerstand" element={<Leerstand />} />
        <Route path="/mahnwesen" element={<Mahnwesen />} />
        <Route path="/ein-auszug" element={<EinAuszug />} />
        <Route path="/transaktionsregeln" element={<Transaktionsregeln />} />
        <Route
          path="/entry-add"
          element={<Navigate to="/buchungen" replace />}
        />

        <Route path="/datenpruefung" element={<Datenpruefung />} />
        <Route path="/automatisierung" element={<Navigate to="/produktivitaet" replace />} />

        <Route path="/nebenkosten" element={<NebenkostenIndexPage />} />
        <Route
          path="/nebenkosten/tiefgarage"
          element={<NebenkostenTiefgarage />}
        />
        <Route
          path="/nebenkosten/wohnungen"
          element={<NebenkostenWohnungen />}
        />

        <Route path="/darlehen" element={<Darlehensuebersicht />} />
        <Route path="/darlehen/:propertyId" element={<Darlehensuebersicht />} />
        <Route path="/darlehen/tilgungsplan" element={<Darlehensuebersicht />} />
        <Route path="/darlehen/zahlungen" element={<Darlehensuebersicht />} />
        <Route path="/darlehen/restschuld" element={<Darlehensuebersicht />} />
        <Route path="/darlehen/zinsen" element={<Darlehensuebersicht />} />
        <Route path="/darlehen/historie" element={<Darlehensuebersicht />} />
        <Route path="/darlehen/dokumente" element={<OrganisationHubPage kind="dokumente" />} />
        <Route path="/darlehen/immobilienzuordnung" element={<Darlehensuebersicht />} />
        <Route path="/darlehensübersicht" element={<Navigate to="/darlehen" replace />} />
        <Route path="/darlehensubersicht" element={<Navigate to="/darlehen" replace />} />
        <Route path="/darlehensuebersicht" element={<Navigate to="/darlehen" replace />} />
        <Route path="/darlehensuebersicht/:propertyId" element={<RedirectLoanRoute />} />

        <Route path="/kautionen" element={<Kautionen />} />
        <Route path="/vermoegen" element={<VermoegenHubPage />} />
        <Route path="/ticketsystem" element={<Navigate to="/ticketsystem/schadenmeldungen" replace />} />
        <Route
          path="/ticketsystem/schadenmeldungen"
          element={<ModuleWorkspacePage config={workspaceConfigs.ticketSchaden}><OrganisationHubPage kind="ticketing" /></ModuleWorkspacePage>}
        />
        <Route
          path="/ticketsystem/handwerker-beauftragung"
          element={<ModuleWorkspacePage config={workspaceConfigs.ticketHandwerker}><OrganisationHubPage kind="ticketing" /></ModuleWorkspacePage>}
        />
        <Route path="/ticketing" element={<Navigate to="/ticketsystem/schadenmeldungen" replace />} />
        <Route path="/dokumente" element={<OrganisationHubPage kind="dokumente" />} />
        <Route path="/produktivitaet" element={<OrganisationHubPage kind="produktivitaet" />} />
        <Route path="/benutzer" element={<Navigate to="/einstellungen/benutzer-rechteverwaltung" replace />} />
        <Route path="/einstellungen" element={<Navigate to="/einstellungen/benutzer-rechteverwaltung" replace />} />
        <Route
          path="/einstellungen/benutzer-rechteverwaltung"
          element={<AdminOnlyWorkspace config={workspaceConfigs.einstellungenBenutzer}><Administrator /></AdminOnlyWorkspace>}
        />
        <Route
          path="/einstellungen/datenschutz-compliance"
          element={<AdminOnlyWorkspace config={workspaceConfigs.einstellungenDatenschutz}><Datenschutz /></AdminOnlyWorkspace>}
        />
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
