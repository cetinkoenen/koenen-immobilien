// src/App.tsx
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import RequireAuthMFA from "./components/RequireAuthMFA";
import Navbar from "./components/ui/Navbar";

// Public pages
import Login from "./pages/Login";
import MFA from "./pages/MFA";

// Protected pages
import Monate from "./pages/monate";
import MonatesPage from "./pages/MonatesPage";

import Portfolio from "./pages/Portfolio";
import Uebersicht from "./pages/Uebersicht";
import Objekte from "./pages/Objekte";
import ObjektDetail from "./pages/ObjektDetail";

import PropertyDashboard from "./pages/PropertyDashboard";
import LoanImport from "./pages/LoanImport";
import LoanEntryAdd from "./pages/LoanEntryAdd";

import EntryAdd from "./pages/EntryAdd";
import Exports from "./pages/Exports";
import Auswertung from "./pages/Auswertung";
import CategoryAdminPage from "./pages/CategoryAdminPage";
import TestRentChart from "./pages/TestRentChart";

// Portfolio nested pages
import PortfolioPropertyLayout from "./pages/portfolio/PortfolioPropertyLayout";
import PortfolioDetails from "./pages/portfolio/PortfolioDetails";
import PortfolioAddress from "./pages/portfolio/PortfolioAddress";
import PortfolioEnergy from "./pages/portfolio/PortfolioEnergy";
import PortfolioRenting from "./pages/portfolio/PortfolioRenting";
import PortfolioFinance from "./pages/portfolio/PortfolioFinance";

/**
 * Debug marker:
 * Show only in DEV and only if explicitly enabled via VITE_DEBUG_UI=1
 */
function DevBuildMarker() {
  const loc = useLocation();
  const show = import.meta.env.DEV && import.meta.env.VITE_DEBUG_UI === "1";
  if (!show) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        padding: "8px 10px",
        background: "crimson",
        color: "white",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: "0.01em",
      }}
    >
      BUILD MARKER: DEV — {loc.pathname}
    </div>
  );
}

function AppShell() {
  return (
    <div>
      <DevBuildMarker />
      <Outlet />
    </div>
  );
}

function PublicLayout() {
  return <Outlet />;
}

function ProtectedLayout() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: 24 }}>
        <Outlet />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0, fontSize: 18 }}>Seite nicht gefunden</h1>
      <p style={{ opacity: 0.75 }}>Die Route existiert nicht.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* =======================
            PUBLIC ROUTES
           ======================= */}
        <Route element={<PublicLayout />}>
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
        </Route>

        {/* =======================
            PROTECTED ROUTES
           ======================= */}
        <Route
          element={
            <RequireAuthMFA>
              <ProtectedLayout />
            </RequireAuthMFA>
          }
        >
          {/* Default entry */}
          <Route index element={<Navigate to="/monate" replace />} />

          {/* Core */}
          <Route path="/monate" element={<Monate />} />
          <Route path="/monates" element={<MonatesPage />} />

          {/* Portfolio overview */}
          <Route path="/portfolio" element={<Portfolio />} />

          {/* Portfolio object detail + tabs */}
          <Route path="/portfolio/:propertyId" element={<PortfolioPropertyLayout />}>
            {/* Standard tab */}
            <Route index element={<Navigate to="details" replace />} />

            {/* Details */}
            <Route path="details" element={<PortfolioDetails />} />
            <Route path="detail" element={<Navigate to="../details" replace />} />

            {/* Address (DE/EN) */}
            <Route path="adresse" element={<PortfolioAddress />} />
            <Route path="address" element={<PortfolioAddress />} />

            {/* Energy (DE/EN) */}
            <Route path="energie" element={<PortfolioEnergy />} />
            <Route path="energy" element={<PortfolioEnergy />} />

            {/* Renting (DE/EN) */}
            <Route path="vermietung" element={<PortfolioRenting />} />
            <Route path="renting" element={<PortfolioRenting />} />
            <Route path="miete" element={<Navigate to="../vermietung" replace />} />

            {/* Finance (DE/EN) */}
            <Route path="finanzen" element={<PortfolioFinance />} />
            <Route path="finance" element={<PortfolioFinance />} />
            <Route path="finanz" element={<Navigate to="../finanzen" replace />} />

            {/* Catch-all inside portfolio details */}
            <Route path="*" element={<Navigate to="details" replace />} />
          </Route>

          {/* Other pages */}
          <Route path="/uebersicht" element={<Uebersicht />} />
          <Route path="/objekte" element={<Objekte />} />
          <Route path="/objekte/:propertyId" element={<ObjektDetail />} />

          <Route path="/property-dashboard" element={<PropertyDashboard />} />
          <Route path="/loan-import" element={<LoanImport />} />
          <Route path="/loan-entry-add" element={<LoanEntryAdd />} />
          <Route path="/entry-add" element={<EntryAdd />} />

          <Route path="/exports" element={<Exports />} />
          <Route path="/auswertung" element={<Auswertung />} />
          <Route path="/admin/categories" element={<CategoryAdminPage />} />

          <Route path="/test-rent-chart" element={<TestRentChart />} />
        </Route>

        {/* GLOBAL CATCH-ALL */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
