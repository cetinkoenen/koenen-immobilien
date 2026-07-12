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
const Mietuebersicht = lazy(() => import("./pages/Mietuebersicht"));
const MieterAnlegen = lazy(() => import("./pages/MieterAnlegen"));
const Leerstand = lazy(() => import("./pages/Leerstand"));
const Mahnwesen = lazy(() => import("./pages/Mahnwesen"));
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

const groupAccent: Record<string, string> = {
  Administrator: "text-rose-300",
  Dashboard: "text-sky-300",
  Immobilien: "text-cyan-300",
  Mieter: "text-emerald-300",
  Buchhaltung: "text-violet-300",
  Nebenkosten: "text-amber-300",
  Finanzierung: "text-blue-300",
  Organisation: "text-teal-300",
  Berichte: "text-indigo-300",
  System: "text-slate-300",
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
    () => new Set(["Dashboard", "Immobilien", "Mieter", "Buchhaltung"]),
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
      ...(isAdmin ? [{ to: "/administrator", label: "Administrator", group: "Administrator", icon: ShieldCheck }] : []),
      { to: "/dashboard", label: "Dashboard", group: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/immobilien", label: "Immobilien", group: "Immobilien", icon: Building2 },
      { to: "/mieter", label: "Mieter", group: "Mieter", icon: Users, end: true },
      { to: "/mieter/mieteingang", label: "Mieteingang", group: "Mieter", icon: WalletCards },
      { to: "/mieter/leerstand", label: "Leerstand", group: "Mieter", icon: DoorOpen },
      { to: "/mieter/ein-auszug", label: "Ein/Auszug", group: "Mieter", icon: KeyRound },
      { to: "/buchhaltung", label: "Buchhaltung", group: "Buchhaltung", icon: WalletCards, end: true },
      { to: "/buchhaltung/transaktionen", label: "Transaktionen", group: "Buchhaltung", icon: ReceiptText },
      ...(!isReadOnly ? [
        { to: "/buchhaltung/neue-buchung", label: "Neue Buchung", group: "Buchhaltung", icon: PlusCircle },
        { to: "/buchhaltung/regeln", label: "Regeln", group: "Buchhaltung", icon: Settings2 },
      ] : []),
      { to: "/nebenkosten", label: "Nebenkosten", group: "Nebenkosten", icon: ClipboardList },
      { to: "/kautionen", label: "Kautionen", group: "Nebenkosten", icon: KeyRound },
      { to: "/darlehen", label: "Darlehen", group: "Finanzierung", icon: Landmark },
      { to: "/vermoegen", label: "Vermögen", group: "Finanzierung", icon: BriefcaseBusiness },
      { to: "/ticketing", label: "Ticketing", group: "Organisation", icon: FolderKanban },
      { to: "/dokumente", label: "Dokumente", group: "Organisation", icon: FileText },
      { to: "/produktivitaet", label: "Produktivität", group: "Organisation", icon: ListChecks },
      { to: "/berichte", label: "Berichte", group: "Berichte", icon: BarChart3 },
      { to: "/funktionsvergleich", label: "Funktionsvergleich", group: "Berichte", icon: ClipboardList },
      { to: "/steuer", label: "Steuer", group: "Berichte", icon: Euro },
      { to: "/datenpruefung", label: "Datenprüfung", group: "Berichte", icon: ShieldCheck },
      ...(isAdmin ? [{ to: "/benutzer", label: "Benutzer", group: "System", icon: UserCog }] : []),
      { to: "/einstellungen", label: "Einstellungen", group: "System", icon: Settings2 },
    ],
    [isAdmin, isReadOnly],
  );

  const navGroups = useMemo(
    () =>
      ["Administrator", "Dashboard", "Immobilien", "Mieter", "Buchhaltung", "Nebenkosten", "Finanzierung", "Organisation", "Berichte", "System"].map((group) => ({
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
          to="/dashboard"
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
              to="/dashboard"
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
        <Route
          path="/dashboard"
          element={<Cockpit />}
        />
        <Route path="/cockpit" element={<Navigate to="/dashboard" replace />} />

        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/immobilien" element={<Portfolio />} />
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

        <Route path="/objekte" element={<Navigate to="/portfolio" replace />} />
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
        <Route path="/buchhaltung" element={<BuchhaltungHubPage />} />
        <Route path="/buchhaltung/transaktionen" element={<Monate />} />
        <Route path="/buchhaltung/einnahmen" element={<Monate />} />
        <Route path="/buchhaltung/ausgaben" element={<Monate />} />
        <Route path="/buchhaltung/neue-buchung" element={<EntryAdd />} />
        <Route path="/buchhaltung/regeln" element={<Transaktionsregeln />} />
        <Route path="/buchhaltung/mahnwesen" element={<Mahnwesen />} />
        <Route path="/buchhaltung/kautionen" element={<OrganisationHubPage kind="kautionen" />} />
        <Route path="/buchhaltung/nebenkosten" element={<Navigate to="/nebenkosten" replace />} />
        <Route path="/buchhaltung/berichte" element={<Navigate to="/berichte" replace />} />
        <Route path="/buchhaltung/export" element={<Navigate to="/berichte" replace />} />
        <Route path="/steuer" element={<SteuerCenter />} />
        <Route path="/auswertungen" element={<Auswertung />} />
        <Route path="/berichte" element={<Auswertung />} />
        <Route path="/funktionsvergleich" element={<Funktionsvergleich />} />
        <Route
          path="/auswertung"
          element={<Navigate to="/auswertungen" replace />}
        />

        <Route path="/buchungen" element={<EntryAdd />} />
        <Route path="/administrator" element={<Administrator />} />
        <Route path="/mieter" element={<MieterHubPage />} />
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

        <Route path="/kautionen" element={<OrganisationHubPage kind="kautionen" />} />
        <Route path="/vermoegen" element={<VermoegenHubPage />} />
        <Route path="/ticketing" element={<OrganisationHubPage kind="ticketing" />} />
        <Route path="/dokumente" element={<OrganisationHubPage kind="dokumente" />} />
        <Route path="/produktivitaet" element={<OrganisationHubPage kind="produktivitaet" />} />
        <Route path="/benutzer" element={<OrganisationHubPage kind="benutzer" />} />
        <Route path="/einstellungen" element={<OrganisationHubPage kind="einstellungen" />} />
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
