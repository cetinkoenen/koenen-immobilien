// src/App.tsx
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";

import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { supabase } from "./lib/supabaseClient";

/* =========================
   Theme (CI / Design)
========================= */
const THEME = {
  bg: "#ffffff",
  surface: "#ffffff",
  surfaceMuted: "#f9fafb",
  text: "#111827",
  muted: "rgba(17,24,39,0.6)",
  border: "#e5e7eb",
  activeBg: "#111827",
  activeText: "#ffffff",
  activeBorder: "#111827",
  focusRing: "rgba(17,24,39,0.15)",
  shadow: "0 18px 40px rgba(0,0,0,0.10)"
};

const MOBILE_BREAKPOINT = 860;

/* =========================
   Lazy Pages
========================= */
const Login = React.lazy(() => import("./pages/Login"));
const Uebersicht = React.lazy(() => import("./pages/Uebersicht"));
const Monate = React.lazy(() => import("./pages/monate"));
const Auswertung = React.lazy(() => import("./pages/Auswertung"));
const CategoryAdminPage = React.lazy(() => import("./pages/CategoryAdminPage"));
const EntryAdd = React.lazy(() => import("./pages/EntryAdd"));
const Objekte = React.lazy(() => import("./pages/Objekte"));
const ObjektDetail = React.lazy(() => import("./pages/ObjektDetail"));
const Portfolio = React.lazy(() => import("./pages/Portfolio"));
const Exports = React.lazy(() => import("./pages/Exports"));

const PortfolioPropertyLayout = React.lazy(() => import("./pages/portfolio/PortfolioPropertyLayout"));
const PortfolioAddress = React.lazy(() => import("./pages/portfolio/PortfolioAddress"));
const PortfolioDetails = React.lazy(() => import("./pages/portfolio/PortfolioDetails"));
const PortfolioFinance = React.lazy(() => import("./pages/portfolio/PortfolioFinance"));
const PortfolioEnergy = React.lazy(() => import("./pages/portfolio/PortfolioEnergy"));
const PortfolioRenting = React.lazy(() => import("./pages/portfolio/PortfolioRenting"));

const LoanEntryAdd = React.lazy(() => import("./pages/LoanEntryAdd"));
const LoanImport = React.lazy(() => import("./pages/LoanImport"));

function PageFallback() {
  return <div style={{ padding: 24 }}>Lädt…</div>;
}

/* =========================
   Error Boundary (per route)
========================= */
type RouteErrorBoundaryState = { hasError: boolean; error?: unknown };

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode; name?: string },
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error("Route crashed:", this.props.name ?? "unknown", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          padding: 16,
          border: `1px solid ${THEME.border}`,
          borderRadius: 14,
          background: THEME.surface,
          boxShadow: THEME.shadow
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
          Seite ist abgestürzt{this.props.name ? `: ${this.props.name}` : ""}.
        </div>
        <div style={{ color: THEME.muted, fontSize: 13 }}>
          Öffne die Konsole (F12) für Details.
        </div>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: THEME.surfaceMuted,
            borderRadius: 12,
            overflow: "auto",
            fontSize: 12
          }}
        >
          {String(this.state.error)}
        </pre>
      </div>
    );
  }
}

/* =========================
   Utils
========================= */
function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const getWidth = () => (typeof window !== "undefined" ? window.innerWidth : breakpoint + 1);
  const [isMobile, setIsMobile] = useState(() => getWidth() < breakpoint);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function normalizeUuid(raw: unknown) {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  return isUuid(v) ? v : "";
}

/* =========================
   Legacy Redirect Wrapper
========================= */
function LegacyObjekteRedirect({ target }: { target: (id: string) => string }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const safeId = normalizeUuid(id ?? "");
    if (!safeId) {
      navigate("/darlehensuebersicht", {
        replace: true,
        state: { ...(location.state as any), legacy_redirect_error: "invalid_id" }
      });
      return;
    }
    navigate(target(safeId), { replace: true, state: location.state });
    // bewusst OHNE location.state in deps: verhindert unnötige Re-Runs durch state-Referenzen
  }, [id, navigate, target, location]);

  return null;
}

/* =========================
   Portfolio URL Normalizer
   - old: /portfolio/:id
   - new: /portfolio/:portfolioId
========================= */
function LegacyPortfolioRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const safe = normalizeUuid(id ?? "");
    if (!safe) {
      navigate("/portfolio", {
        replace: true,
        state: { ...(location.state as any), legacy_portfolio_redirect_error: "invalid_id" }
      });
      return;
    }
    // Default Tab: address
    navigate(`/portfolio/${encodeURIComponent(safe)}/address`, { replace: true, state: location.state });
  }, [id, navigate, location]);

  return null;
}

/* =========================
   Portfolio Guard
   Verhindert "Core-ID in URL":
   prüft, ob portfolio_properties.id existiert.
========================= */
function RequirePortfolioProperty({ children }: { children: React.ReactNode }) {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState<{ loading: boolean; ok: boolean; err?: string }>({
    loading: true,
    ok: false
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      const safe = normalizeUuid(portfolioId ?? "");
      if (!safe) {
        if (alive) setState({ loading: false, ok: false, err: "Ungültige Portfolio-ID (keine UUID)." });
        return;
      }

      try {
        // Prüfen: existiert diese ID in portfolio_properties?
        const { data, error } = await supabase
          .from("portfolio_properties")
          .select("id")
          .eq("id", safe)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          if (alive)
            setState({
              loading: false,
              ok: false,
              err:
                "Diese ID ist keine Portfolio-Property-ID. " +
                "Vermutlich wurde eine Core-Property-ID (properties.id) in die URL navigiert."
            });
          return;
        }

        if (alive) setState({ loading: false, ok: true });
      } catch (e: any) {
        if (!alive) return;
        const msg = e?.message ?? e?.details ?? String(e);
        setState({ loading: false, ok: false, err: msg });
      }
    })();

    return () => {
      alive = false;
    };
  }, [portfolioId]);

  if (state.loading) return <div style={{ padding: 16 }}>Lädt…</div>;

  if (!state.ok) {
    return (
      <div
        style={{
          padding: 16,
          border: `1px solid ${THEME.border}`,
          borderRadius: 14,
          background: THEME.surface,
          boxShadow: THEME.shadow
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Portfolio-Link ungültig</div>
        <div style={{ fontSize: 13, color: THEME.muted, whiteSpace: "pre-wrap" }}>{state.err}</div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/portfolio", { replace: true, state: location.state })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${THEME.border}`,
              background: THEME.surface,
              fontWeight: 900,
              cursor: "pointer"
            }}
          >
            Zurück zum Portfolio
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/* =========================
   Protected Layout
========================= */
function ProtectedLayout({ session, onLogout }: { session: Session; onLogout: () => Promise<void> }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const navItems = useMemo(
    () => [
      { to: "/portfolio", label: "Portfolio" },
      { to: "/exports", label: "Exports" },
      { to: "/darlehensuebersicht", label: "Darlehensübersicht" },
      { to: "/uebersicht", label: "Übersicht" },
      { to: "/auswertung", label: "Auswertung" },
      { to: "/monate", label: "Monate" },
      { to: "/neu", label: "+ Buchung" },
      { to: "/categories", label: "Kategorien" }
    ],
    []
  );

  useEffect(() => {
    function closeOnOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  function navStyle({ isActive }: { isActive: boolean }) {
    return {
      padding: "9px 14px",
      borderRadius: 14,
      textDecoration: "none",
      border: `1px solid ${isActive ? THEME.activeBorder : THEME.border}`,
      fontWeight: 800,
      background: isActive ? THEME.activeBg : THEME.surface,
      color: isActive ? THEME.activeText : THEME.text,
      boxShadow: isActive ? `0 10px 24px ${THEME.focusRing}` : "none",
      transition: "all 120ms ease",
      whiteSpace: "nowrap"
    } as const;
  }

  const handleLogout = useCallback(async () => {
    await onLogout();
    setUserOpen(false);
  }, [onLogout]);

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, color: THEME.text }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: THEME.surface,
          borderBottom: `1px solid ${THEME.border}`
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 16
          }}
        >
          <div
            onClick={() => navigate("/portfolio")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              userSelect: "none",
              minWidth: 240
            }}
          >
            <img
              src="/logo/koenen.png"
              alt="Könen Immobilien"
              style={{ height: 40, width: "auto", display: "block", objectFit: "contain" }}
            />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>Könen Immobilien</div>
              <div style={{ fontSize: 12, color: THEME.muted }}>Admin Dashboard</div>
            </div>
          </div>

          {!isMobile && (
            <nav style={{ display: "flex", gap: 10, marginLeft: 10, flexWrap: "wrap" }}>
              {navItems.map((n) => (
                <NavLink key={n.to} to={n.to} style={navStyle}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && (
              <button
                onClick={() => setMobileOpen((v) => !v)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${THEME.border}`,
                  background: THEME.surface,
                  fontWeight: 900,
                  cursor: "pointer"
                }}
              >
                {mobileOpen ? "✕" : "☰"}
              </button>
            )}

            <div ref={userMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setUserOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 14,
                  border: `1px solid ${THEME.border}`,
                  background: THEME.surface,
                  cursor: "pointer"
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    background: THEME.surfaceMuted,
                    border: `1px solid ${THEME.border}`
                  }}
                >
                  {(session.user.email ?? "U").slice(0, 1).toUpperCase()}
                </div>
                <span style={{ fontSize: 12 }}>▾</span>
              </button>

              {userOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 10px)",
                    width: 240,
                    background: THEME.surface,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 14,
                    boxShadow: THEME.shadow,
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderBottom: `1px solid ${THEME.border}`,
                      fontSize: 12,
                      color: THEME.muted,
                      wordBreak: "break-word"
                    }}
                  >
                    {session.user.email}
                  </div>

                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      background: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isMobile && mobileOpen && (
          <div
            style={{
              padding: "10px 16px 16px",
              borderTop: `1px solid ${THEME.border}`,
              background: THEME.surface,
              display: "grid",
              gap: 10
            }}
          >
            {navItems.map((n) => (
              <NavLink key={n.to} to={n.to} style={navStyle} onClick={() => setMobileOpen(false)}>
                {n.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main style={{ padding: 16 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <footer
        style={{
          marginTop: 32,
          padding: "14px 16px",
          borderTop: `1px solid ${THEME.border}`,
          background: THEME.surface,
          fontSize: 12,
          color: THEME.muted,
          textAlign: "center"
        }}
      >
        © {new Date().getFullYear()} Könen Immobilien
      </footer>
    </div>
  );
}

/* =========================
   App Root
========================= */
export default function App() {
  // Optional: einmaliger Auth-Debug beim App-Start (hilft bei RLS/auth.uid() Problemen)
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        console.log("[AUTH DEBUG] session:", session);
        console.log("[AUTH DEBUG] user:", user);
      } catch (e) {
        console.error("[AUTH DEBUG] failed:", e);
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const wrap = useCallback(
    (name: string, el: React.ReactElement) => (
      <RouteErrorBoundary name={name}>{el}</RouteErrorBoundary>
    ),
    []
  );

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={wrap("Login", <Login />)} />

        <Route
          element={
            <RequireAuth>
              {(session) => <ProtectedLayout session={session} onLogout={logout} />}
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/portfolio" replace />} />

          <Route path="/portfolio" element={wrap("Portfolio", <Portfolio />)} />

          {/* ✅ NEW canonical route */}
          <Route
            path="/portfolio/:portfolioId"
            element={wrap(
              "Portfolio Layout",
              <RequirePortfolioProperty>
                <PortfolioPropertyLayout />
              </RequirePortfolioProperty>
            )}
          >
            <Route index element={<Navigate to="address" replace />} />
            <Route path="address" element={wrap("Portfolio Address", <PortfolioAddress />)} />
            <Route path="details" element={wrap("Portfolio Details", <PortfolioDetails />)} />
            <Route path="finance" element={wrap("Portfolio Finance", <PortfolioFinance />)} />
            <Route path="energy" element={wrap("Portfolio Energy", <PortfolioEnergy />)} />
            <Route path="renting" element={wrap("Portfolio Renting", <PortfolioRenting />)} />
          </Route>

          {/* ✅ Legacy support: old /portfolio/:id -> redirect to canonical */}
          <Route path="/portfolio/:id/address" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/details" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/finance" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/energy" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/renting" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id" element={<LegacyPortfolioRedirect />} />

          <Route path="/uebersicht" element={wrap("Übersicht", <Uebersicht />)} />
          <Route path="/auswertung" element={wrap("Auswertung", <Auswertung />)} />
          <Route path="/monate" element={wrap("Monate", <Monate />)} />
          <Route path="/neu" element={wrap("Neue Buchung", <EntryAdd />)} />
          <Route path="/categories" element={wrap("Kategorien", <CategoryAdminPage />)} />

          <Route path="/darlehensuebersicht" element={wrap("Darlehensübersicht", <Objekte />)} />
          <Route path="/darlehensuebersicht/:id" element={wrap("Objekt Detail", <ObjektDetail />)} />
          <Route
            path="/darlehensuebersicht/:id/loan/new"
            element={wrap("Loan Entry", <LoanEntryAdd />)}
          />

          
          <Route
            path="/darlehensuebersicht/:id/loan/:loanId/edit"
            element={wrap("Loan Entry Edit", <LoanEntryAdd />)}
          />

          {/* Legacy redirects */}
          <Route path="/objekte" element={<Navigate to="/darlehensuebersicht" replace />} />
          <Route
            path="/objekte/:id"
            element={
              <LegacyObjekteRedirect
                target={(id) =>
                  isUuid(id)
                    ? "/darlehensuebersicht/" + encodeURIComponent(id)
                    : "/darlehensuebersicht"
                }
              />
            }
          />
          <Route
            path="/objekte/:id/loan/new"
            element={
              <LegacyObjekteRedirect
                target={(id) =>
                  isUuid(id)
                    ? "/darlehensuebersicht/" + encodeURIComponent(id) + "/loan/new"
                    : "/darlehensuebersicht"
                }
              />
            }
          />

          <Route path="/loan-import" element={wrap("Loan Import", <LoanImport />)} />

          <Route
            path="/exports"
            element={wrap(
              "Exports",
              <RequireRole minRole="admin">
                <Exports />
              </RequireRole>
            )}
          />

          <Route path="*" element={<Navigate to="/portfolio" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
