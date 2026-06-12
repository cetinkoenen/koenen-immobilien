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
  Building2,
  DoorOpen,
  Euro,
  Gauge,
  KeyRound,
  Landmark,
  Menu,
  PlusCircle,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UserPlus,
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
import { supabase } from "./lib/supabaseClient";
import { clearAppSessionStorage } from "./lib/security";
import logo from "./assets/koenen-brand-logo.webp";
import { AppDataProvider } from "./state/AppDataContext";
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
const NebenkostenTiefgarage = lazy(() => import("./pages/NebenkostenTiefgarage"));
const NebenkostenWohnungen = lazy(() => import("./pages/NebenkostenWohnungen"));
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

const groupAccent: Record<string, string> = {
  Überblick: "text-sky-300",
  Finanzen: "text-violet-300",
  Mieter: "text-emerald-300",
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
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-500">
          Nebenkostenabrechnungen
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          NK-Abrechnungen
        </h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Wähle die passende Abrechnungsseite. Die bestehenden Inhalte,
          Berechnungen und Funktionen bleiben unverändert.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <NavLink
          to="/nebenkosten/wohnungen"
          className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Building2 size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-black">NK-Wohnungen</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Nebenkostenabrechnung für Wohnungen mit den vorhandenen Eingaben,
            Umlageschlüsseln und Berechnungen.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white">
            Öffnen <ArrowRight size={16} />
          </span>
        </NavLink>

        <NavLink
          to="/nebenkosten/tiefgarage"
          className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Building2 size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-black">NK-Tiefgaragen</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Nebenkostenabrechnung für Tiefgaragen/Stellplätze mit den bisherigen
            Funktionen und Ausgaben.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white">
            Öffnen <ArrowRight size={16} />
          </span>
        </NavLink>
      </section>
    </div>
  );
}

function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const activeAuswertungView = location.pathname === "/auswertungen"
    ? new URLSearchParams(location.search).get("view") ?? "cockpit"
    : "";

  const navItems = useMemo<Array<{ to: string; label: string; group: string; icon: LucideIcon; end?: boolean }>>(
    () => [
      { to: "/cockpit", label: "Cockpit", group: "Überblick", icon: Gauge },
      { to: "/portfolio", label: "Portfolio", group: "Überblick", icon: Building2 },
      { to: "/buchhaltung", label: "Buchhaltung", group: "Finanzen", icon: WalletCards },
      { to: "/buchungen", label: "Neue Buchung", group: "Finanzen", icon: PlusCircle },
      { to: "/transaktionsregeln", label: "Regeln", group: "Finanzen", icon: Settings2 },
      { to: "/steuer", label: "Steuer", group: "Finanzen", icon: Euro },
      { to: "/auswertungen", label: "Auswertungen", group: "Finanzen", icon: BarChart3 },
      { to: "/mieteruebersicht", label: "Mieteingang", group: "Mieter", icon: Users },
      { to: "/mieter-anlegen", label: "Mieter anlegen", group: "Mieter", icon: UserPlus },
      { to: "/leerstand", label: "Leerstand", group: "Mieter", icon: DoorOpen },
      { to: "/ein-auszug", label: "Ein/Auszug", group: "Mieter", icon: KeyRound },
      { to: "/mahnwesen", label: "Mahnwesen", group: "Mieter", icon: Bell },
      { to: "/darlehensuebersicht", label: "Darlehen", group: "Verwaltung", icon: Landmark },
      { to: "/nebenkosten", label: "NK-Abrechnungen", group: "Verwaltung", icon: ReceiptText },
      { to: "/datenpruefung", label: "Datenprüfung", group: "Verwaltung", icon: ShieldCheck },
    ],
    [],
  );

  const navGroups = useMemo(
    () =>
      ["Überblick", "Finanzen", "Mieter", "Verwaltung"].map((group) => ({
        group,
        items: navItems.filter((item) => item.group === group),
      })),
    [navItems],
  );

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[286px] flex-col border-r border-slate-800 bg-[#101827] text-white shadow-2xl xl:flex">
        <NavLink
          to="/cockpit"
          className="flex items-center gap-3 border-b border-white/10 px-5 py-5 no-underline"
          title="Zum Cockpit"
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
              to="/"
              className="flex min-w-0 items-center gap-3"
              title="Zur Hauptseite"
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
                  <div key={group} className="grid gap-2">
                    <div className="px-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                      {group}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                  </div>
                ))}
              </nav>

              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#e7ddcf] bg-white/80 p-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                  {user?.email ?? "Eingeloggt"}
                </div>
                <BackupButton />
                <LogoutButton />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1760px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 xl:ml-[286px] xl:max-w-none">
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
        <Route path="/cockpit" element={<Cockpit />} />

        <Route path="/portfolio" element={<Portfolio />} />
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
        <Route path="/buchhaltung" element={<Monate />} />
        <Route path="/steuer" element={<SteuerCenter />} />
        <Route path="/auswertungen" element={<Auswertung />} />
        <Route
          path="/auswertung"
          element={<Navigate to="/auswertungen" replace />}
        />

        <Route path="/buchungen" element={<EntryAdd />} />
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
        <Route path="/automatisierung" element={<Navigate to="/auswertungen" replace />} />

        <Route path="/nebenkosten" element={<NebenkostenIndexPage />} />
        <Route
          path="/nebenkosten/tiefgarage"
          element={<NebenkostenTiefgarage />}
        />
        <Route
          path="/nebenkosten/wohnungen"
          element={<NebenkostenWohnungen />}
        />

        <Route path="/darlehen" element={<Navigate to="/darlehensuebersicht" replace />} />
        <Route path="/darlehensübersicht" element={<Navigate to="/darlehensuebersicht" replace />} />
        <Route path="/darlehensubersicht" element={<Navigate to="/darlehensuebersicht" replace />} />
        <Route path="/darlehensuebersicht" element={<Darlehensuebersicht />} />
        <Route path="/darlehensuebersicht/:propertyId" element={<Darlehensuebersicht />} />
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
