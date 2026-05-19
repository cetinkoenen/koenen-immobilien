import { useMemo, useState, type CSSProperties } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ArrowRight, Building2, Menu, X } from "lucide-react";

import EntryAdd from "./pages/EntryAdd";
import Monate from "./pages/Monate";
import Portfolio from "./pages/Portfolio";
import Auswertung from "./pages/Auswertung";
import NebenkostenTiefgarage from "./pages/NebenkostenTiefgarage";
import NebenkostenWohnungen from "./pages/NebenkostenWohnungen";
import Mietuebersicht from "./pages/Mietuebersicht";
import Datenpruefung from "./pages/Datenpruefung";
import PortfolioAddress from "./pages/portfolio/PortfolioAddress";
import PortfolioDetails from "./pages/portfolio/PortfolioDetails";
import PortfolioEnergy from "./pages/portfolio/PortfolioEnergy";
import PortfolioFinance from "./pages/portfolio/PortfolioFinance";
import PortfolioPropertyLayout from "./pages/portfolio/PortfolioPropertyLayout";
import PortfolioRenting from "./pages/portfolio/PortfolioRenting";
import PortfolioObjectDetail from "./pages/portfolio/PortfolioObjectDetail";
import PortfolioFinanceModules from "./pages/portfolio/PortfolioFinanceModules";
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

function navLinkStyle(isActive: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 136,
    height: 46,
    padding: "0 18px",
    borderRadius: 16,
    textDecoration: "none",
    fontWeight: 850,
    fontSize: 14,
    lineHeight: 1,
    letterSpacing: "-0.01em",
    transition:
      "background 140ms ease, border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease",
    border: isActive ? "1px solid #c8c7ff" : "1px solid #d8d2c7",
    background: isActive ? "#eef0ff" : "rgba(255,255,255,0.78)",
    color: isActive ? "#3730a3" : "#111827",
    whiteSpace: "nowrap",
    boxShadow: isActive
      ? "0 3px 9px rgba(71, 85, 105, 0.12)"
      : "0 2px 6px rgba(71, 85, 105, 0.10)",
  };
}


function RedirectObjectRoute({ section = "objektakte" }: { section?: string }) {
  const { propertyId } = useParams<{ propertyId: string }>();
  return <Navigate to={propertyId ? `/portfolio/${encodeURIComponent(propertyId)}/${section}` : "/portfolio"} replace />;
}

function LogoutButton() {
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
      <span className="hidden h-[46px] items-center rounded-2xl border border-[#d8d2c7] bg-white/65 px-4 text-sm font-semibold text-slate-600 2xl:inline-flex">
        {user?.email ?? "Eingeloggt"}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex h-[46px] w-[116px] items-center justify-center rounded-2xl border border-[#d8d2c7] bg-white/75 px-4 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-white"
      >
        Logout
      </button>
    </div>
  );
}

function ProtectedAppShell() {
  return (
    <RequireAuthMFA>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
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

  const navItems = useMemo<Array<{ to: string; label: string; end?: boolean }>>(
    () => [
      { to: "/portfolio", label: "Portfolio" },
      { to: "/monate", label: "Monate" },
      { to: "/auswertungen", label: "Auswertungen" },
      { to: "/buchungen", label: "Buchungen" },
      { to: "/mieteruebersicht", label: "Mieterübersicht" },
      { to: "/nebenkosten", label: "NK-Abrechnungen" },
      { to: "/datenpruefung", label: "Datenprüfung" },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-[#e7ddcf] bg-[#f6f1e8]/88 backdrop-blur-xl">
        <div className="mx-auto max-w-[1760px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-5">
            <NavLink
              to="/"
              className="flex min-w-0 items-center gap-3"
              title="Zur Hauptseite"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e3d8ca] bg-[#f3eadc] shadow-sm">
                <img
                  src={logo}
                  alt="Könen Immobilien"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Property App
                </div>
                <div className="text-lg font-semibold leading-tight text-slate-950 sm:text-2xl">
                  Immobilien-Finanzübersicht
                </div>
              </div>
            </NavLink>

            <div className="hidden min-w-0 flex-1 items-center justify-end gap-5 xl:flex">
              <nav className="flex max-w-[820px] flex-wrap justify-center gap-2.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    style={({ isActive }) => navLinkStyle(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <BackupButton />
              <LogoutButton />
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm xl:hidden"
              aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="mt-4 rounded-[24px] border border-[#e7ddcf] bg-white/76 p-3 shadow-sm xl:hidden">
              <nav className="grid gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        "rounded-2xl border px-4 py-3 text-base font-extrabold shadow-sm transition",
                        isActive
                          ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 bg-white text-slate-900",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
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

      <main className="mx-auto max-w-[1760px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/mfa" element={<MFA />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedAppShell />}>
        <Route
          path="/dashboard"
          element={<Navigate to="/portfolio" replace />}
        />

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
        <Route path="/auswertungen" element={<Auswertung />} />
        <Route
          path="/auswertung"
          element={<Navigate to="/auswertungen" replace />}
        />

        <Route path="/buchungen" element={<EntryAdd />} />
        <Route path="/mieteruebersicht" element={<Mietuebersicht />} />
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

        <Route path="/darlehen" element={<Navigate to="/portfolio" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
