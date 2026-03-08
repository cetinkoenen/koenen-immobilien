import type { CSSProperties } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import Auswertung from "./pages/Auswertung";
import EntryAdd from "./pages/EntryAdd";
import Monate from "./pages/Monate";
import ObjektDetail from "./pages/ObjektDetail";
import Objekte from "./pages/Objekte";
import Portfolio from "./pages/Portfolio";

import PortfolioAddress from "./pages/portfolio/PortfolioAddress";
import PortfolioDetails from "./pages/portfolio/PortfolioDetails";
import PortfolioEnergy from "./pages/portfolio/PortfolioEnergy";
import PortfolioFinance from "./pages/portfolio/PortfolioFinance";
import PortfolioPropertyLayout from "./pages/portfolio/PortfolioPropertyLayout";
import PortfolioRenting from "./pages/portfolio/PortfolioRenting";

function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Seite nicht gefunden
        </h1>

        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            color: "#6b7280",
            fontSize: 16,
            lineHeight: 1.5,
          }}
        >
          Die angeforderte Route existiert nicht.
        </p>
      </div>
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
    border: isActive ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
    background: isActive ? "#eef2ff" : "#ffffff",
    color: isActive ? "#3730a3" : "#111827",
    whiteSpace: "nowrap",
  };
}

function AppNavigation() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(248,250,252,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 17,
            letterSpacing: "-0.02em",
            color: "#111827",
            marginRight: 8,
          }}
        >
          Immobilien-Dashboard
        </div>

        <nav
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <NavLink to="/objekte" style={({ isActive }) => navLinkStyle(isActive)}>
            Objekte
          </NavLink>

          <NavLink to="/portfolio" style={({ isActive }) => navLinkStyle(isActive)}>
            Portfolio
          </NavLink>

          <NavLink to="/monate" style={({ isActive }) => navLinkStyle(isActive)}>
            Monate
          </NavLink>

          <NavLink to="/auswertung" style={({ isActive }) => navLinkStyle(isActive)}>
            Auswertung
          </NavLink>

          <NavLink to="/entry-add" style={({ isActive }) => navLinkStyle(isActive)}>
            Buchung
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <AppNavigation />

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/objekte" replace />} />

          <Route path="/objekte" element={<Objekte />} />
          <Route path="/objekte/:propertyId" element={<ObjektDetail />} />

          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/portfolio/:propertyId" element={<PortfolioPropertyLayout />}>
            <Route index element={<Navigate to="address" replace />} />
            <Route path="address" element={<PortfolioAddress />} />
            <Route path="details" element={<PortfolioDetails />} />
            <Route path="finanzen" element={<PortfolioFinance />} />
            <Route path="energie" element={<PortfolioEnergy />} />
            <Route path="vermietung" element={<PortfolioRenting />} />
          </Route>

          <Route path="/monate" element={<Monate />} />
          <Route path="/auswertung" element={<Auswertung />} />
          <Route path="/entry-add" element={<EntryAdd />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}