import type { CSSProperties } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import PropertyDetailPage from "./features/property-detail/PropertyDetailPage";
import EntryAdd from "./pages/EntryAdd";
import Monate from "./pages/Monate";
import Objekte from "./pages/Objekte";
import Portfolio from "./pages/Portfolio";
import Auswertung from "./pages/Auswertung";
import NebenkostenTiefgarage from "./pages/NebenkostenTiefgarage";
import NebenkostenWohnungen from "./pages/NebenkostenWohnungen";
import PortfolioAddress from "./pages/portfolio/PortfolioAddress";
import PortfolioDetails from "./pages/portfolio/PortfolioDetails";
import PortfolioEnergy from "./pages/portfolio/PortfolioEnergy";
import PortfolioFinance from "./pages/portfolio/PortfolioFinance";
import PortfolioPropertyLayout from "./pages/portfolio/PortfolioPropertyLayout";
import PortfolioRenting from "./pages/portfolio/PortfolioRenting";
import Login from "./pages/Login";
import MFA from "./pages/MFA";
import AuthCallback from "./pages/AuthCallback";
import RequireAuthMFA from "./components/RequireAuthMFA";
import { useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabaseClient";
import { clearAppSessionStorage } from "./lib/security";

function NotFoundPage() {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-rose-900">Seite nicht gefunden</h1>
      <p className="mt-2 text-rose-700">Die aufgerufene Route existiert nicht.</p>
    </div>
  );
}

function navLinkStyle(isActive: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    transition: "all 120ms ease",
    border: isActive ? "1px solid #c7d2fe" : "1px solid #cbd5e1",
    background: isActive ? "#eef2ff" : "#ffffff",
    color: isActive ? "#3730a3" : "#111827",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  };
}

function quickLinkStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  };
}

function PropertyContextNotice() {
  const location = useLocation();
  const { propertyId } = useParams<{ propertyId: string }>();

  const activeSection = location.pathname.endsWith("/monate")
    ? "Monate"
    : location.pathname.endsWith("/auswertungen")
      ? "Auswertungen"
      : "Objektdetail";

  const shortId = !propertyId
    ? "–"
    : propertyId.length <= 14
      ? propertyId
      : `${propertyId.slice(0, 8)}…${propertyId.slice(-4)}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
      <span className="font-medium">Objekt:</span> <span className="font-mono">{shortId}</span>
      <span className="mx-2 text-slate-400">•</span>
      <span className="font-medium">Bereich:</span> {activeSection}
    </div>
  );
}

function PropertyDetailRoute(props: { mode?: "detail" | "monate" | "auswertungen" }) {
  return (
    <div className="space-y-4">
      <PropertyContextNotice />
      <PropertyDetailPage mode={props.mode ?? "detail"} />
    </div>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  const { user } = useAuth();

  async function handleLogout() {
    try {
      await supabase.auth.signOut({ scope: "local" });
      clearAppSessionStorage();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout fehlgeschlagen:", error);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 md:inline-flex">
        {user?.email ?? "Eingeloggt"}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-slate-50"
      >
        Logout
      </button>
    </div>
  );
}

function ProtectedAppShell() {
  return (
    <RequireAuthMFA>
      <AppShell />
    </RequireAuthMFA>
  );
}

function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-10 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Portfolio Dashboard</h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Wähle ein Objekt aus der Objektliste oder öffne direkt die neuen Abrechnungsseiten aus
          dem Dashboard.
        </p>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-10 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Schnellzugriff</h2>
        <div className="mt-8 flex flex-wrap gap-4">
          <NavLink to="/objekte" style={quickLinkStyle()}>
            Objekte öffnen
          </NavLink>
          <NavLink to="/portfolio" style={quickLinkStyle()}>
            Portfolio öffnen
          </NavLink>
          <NavLink to="/buchungen" style={quickLinkStyle()}>
            Buchung erfassen
          </NavLink>
          <NavLink to="/nebenkosten/tiefgarage" style={quickLinkStyle()}>
            Nebenkostenabrechnung für die TG
          </NavLink>
          <NavLink to="/nebenkosten/wohnungen" style={quickLinkStyle()}>
            Nebenkostenabrechnung für die Wohnungen
          </NavLink>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-10 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Neu ergänzt</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Nebenkosten TG
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Jahresbezogene Eingabemaske mit automatischer Berechnung und Onepager für den Mieter.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">
              Wohnungen
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Platzhalter-Seite für die nächste Vorlage – Route und Aufbau sind bereits
              vorbereitet.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AppShell() {
  const navItems = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/portfolio", label: "Portfolio" },
    { to: "/objekte", label: "Objekte" },
    { to: "/monate", label: "Monate" },
    { to: "/auswertungen", label: "Auswertungen" },
    { to: "/buchungen", label: "Buchungen" },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Property App
            </div>
            <div className="text-lg font-semibold text-slate-950">
              Immobilien-Finanzübersicht
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex flex-wrap items-center gap-2">
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
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RequireAuthMFA>
            <Login />
          </RequireAuthMFA>
        }
      />
      <Route
        path="/mfa"
        element={
          <RequireAuthMFA>
            <MFA />
          </RequireAuthMFA>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedAppShell />}>
        <Route path="/" element={<DashboardPage />} />

        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/portfolio/:propertyId" element={<PortfolioPropertyLayout />}>
          <Route index element={<Navigate to="address" replace />} />
          <Route path="address" element={<PortfolioAddress />} />
          <Route path="details" element={<PortfolioDetails />} />
          <Route path="finanzen" element={<PortfolioFinance />} />
          <Route path="energie" element={<PortfolioEnergy />} />
          <Route path="vermietung" element={<PortfolioRenting />} />
        </Route>

        <Route path="/objekte" element={<Objekte />} />
        <Route path="/objekte/:propertyId" element={<PropertyDetailRoute mode="detail" />} />
        <Route path="/objekte/:propertyId/monate" element={<PropertyDetailRoute mode="monate" />} />
        <Route
          path="/objekte/:propertyId/auswertungen"
          element={<PropertyDetailRoute mode="auswertungen" />}
        />

        <Route path="/monate" element={<Monate />} />
        <Route path="/auswertungen" element={<Auswertung />} />
        <Route path="/auswertung" element={<Navigate to="/auswertungen" replace />} />

        <Route path="/buchungen" element={<EntryAdd />} />
        <Route path="/entry-add" element={<Navigate to="/buchungen" replace />} />

        <Route path="/nebenkosten/tiefgarage" element={<NebenkostenTiefgarage />} />
        <Route path="/nebenkosten/wohnungen" element={<NebenkostenWohnungen />} />

        <Route path="/darlehen" element={<Navigate to="/objekte" replace />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}