// src/App.tsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import RequireAuthMFA from "./components/RequireAuthMFA";

/* =========================
   Lazy Pages
========================= */
const Login = React.lazy(() => import("./pages/Login"));
const MFA = React.lazy(() => import("./pages/MFA"));
const Portfolio = React.lazy(() => import("./pages/Portfolio"));

const PortfolioPropertyLayout = React.lazy(() => import("./pages/portfolio/PortfolioPropertyLayout"));
const PortfolioAddress = React.lazy(() => import("./pages/portfolio/PortfolioAddress"));
const PortfolioDetails = React.lazy(() => import("./pages/portfolio/PortfolioDetails"));
const PortfolioFinance = React.lazy(() => import("./pages/portfolio/PortfolioFinance"));
const PortfolioEnergy = React.lazy(() => import("./pages/portfolio/PortfolioEnergy"));
const PortfolioRenting = React.lazy(() => import("./pages/portfolio/PortfolioRenting"));

/* =========================
   Fallback
========================= */
function PageFallback() {
  return <div style={{ padding: 24 }}>Lädt…</div>;
}

/* =========================
   Protected Layout
   - contains the Outlet for nested protected routes
   - optional DEV banner behind env flag
========================= */
function ProtectedLayout() {
  const showDebug = import.meta.env.DEV && import.meta.env.VITE_DEBUG_UI === "1";

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {showDebug && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 9998,
            padding: 12,
            background: "crimson",
            color: "white",
            fontWeight: 900,
          }}
        >
          BUILD MARKER: {String(import.meta.env.MODE).toUpperCase()} — protected
        </div>
      )}

      <div style={{ padding: 24 }}>
        <Outlet />
      </div>
    </div>
  );
}

/* =========================
   App Routing
========================= */
export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/mfa" element={<MFA />} />

        {/* Protected: Guard wraps layout, layout provides Outlet */}
        <Route
          element={
            <RequireAuthMFA>
              <ProtectedLayout />
            </RequireAuthMFA>
          }
        >
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/portfolio/:propertyId" element={<PortfolioPropertyLayout />}>
            <Route index element={<Navigate to="address" replace />} />
            <Route path="address" element={<PortfolioAddress />} />
            <Route path="details" element={<PortfolioDetails />} />
            <Route path="finanzen" element={<PortfolioFinance />} />
            <Route path="energie" element={<PortfolioEnergy />} />
            <Route path="vermietung" element={<PortfolioRenting />} />
          </Route>
        </Route>

        {/* Default + Catch-all */}
        <Route path="/" element={<Navigate to="/portfolio" replace />} />
        <Route path="*" element={<Navigate to="/portfolio" replace />} />
      </Routes>
    </Suspense>
  );
}
