// src/App.tsx
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";

import RequireAuthMFA from "./components/RequireAuthMFA";
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
  shadow: "0 18px 40px rgba(0,0,0,0.10)",
};

const MOBILE_BREAKPOINT = 860;

/* =========================
   Lazy Pages
========================= */
const Login = React.lazy(() => import("./pages/Login"));
const MFA = React.lazy(() => import("./pages/MFA"));

const Uebersicht = React.lazy(() => import("./pages/Uebersicht"));
const Monate = React.lazy(() => import("./pages/monate"));
const Auswertung = React.lazy(() => import("./pages/Auswertung"));
const CategoryAdminPage = React.lazy(() => import("./pages/CategoryAdminPage"));
const EntryAdd = React.lazy(() => import("./pages/EntryAdd"));

const Portfolio = React.lazy(() => import("./pages/Portfolio"));
const Exports = React.lazy(() => import("./pages/Exports"));
const TestRentChart = React.lazy(() => import("./pages/TestRentChart"));


const PortfolioPropertyLayout = React.lazy(() => import("./pages/portfolio/PortfolioPropertyLayout"));
const PortfolioAddress = React.lazy(() => import("./pages/portfolio/PortfolioAddress"));
const PortfolioDetails = React.lazy(() => import("./pages/portfolio/PortfolioDetails"));
const PortfolioFinance = React.lazy(() => import("./pages/portfolio/PortfolioFinance"));
const PortfolioEnergy = React.lazy(() => import("./pages/portfolio/PortfolioEnergy"));
const PortfolioRenting = React.lazy(() => import("./pages/portfolio/PortfolioRenting"));

const ObjektDetail = React.lazy(() => import("./pages/ObjektDetail"));
const LoanEntryAdd = React.lazy(() => import("./pages/LoanEntryAdd"));
const LoanImport = React.lazy(() => import("./pages/LoanImport"));

// ✅ DIE Seite für /darlehensuebersicht
const PropertyLoanOverview = React.lazy(() => import("./pages/PropertyDashboard"));

/* =========================
   Small UI helpers
========================= */
function PageFallback() {
  return <div style={{ padding: 24 }}>Lädt…</div>;
}

function Unauthorized() {
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Keine Berechtigung</h2>
      <p>Du hast nicht die nötigen Rechte, um diese Seite zu sehen.</p>
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        padding: 16,
        border: `1px solid ${THEME.border}`,
        borderRadius: 14,
        background: THEME.surface,
        boxShadow: THEME.shadow,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Route nicht gefunden</div>
      <div style={{ fontSize: 13, color: THEME.muted }}>Diese URL ist in der App nicht registriert.</div>
      <div style={{ marginTop: 12 }}>
        <NavLink to="/portfolio" style={{ fontWeight: 900 }}>
          Zurück zum Portfolio
        </NavLink>
      </div>
    </div>
  );
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
          boxShadow: THEME.shadow,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
          Seite ist abgestürzt{this.props.name ? `: ${this.props.name}` : ""}.
        </div>
        <div style={{ color: THEME.muted, fontSize: 13 }}>Öffne die Konsole (F12) für Details.</div>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: THEME.surfaceMuted,
            borderRadius: 12,
            overflow: "auto",
            fontSize: 12,
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
   Legacy Redirect Wrapper (Objekte)
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
        state: { ...(location.state as any), legacy_redirect_error: "invalid_id" },
      });
      return;
    }
    navigate(target(safeId), { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, target]);

  return null;
}

/* =========================
   Portfolio Redirect (Legacy)
========================= */
function LegacyPortfolioRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let alive = true;

    (async () => {
      const safe = normalizeUuid(id ?? "");
      if (!safe) {
        navigate("/portfolio", {
          replace: true,
          state: { ...(location.state as any), legacy_portfolio_redirect_error: "invalid_id" },
        });
        return;
      }

      try {
        const { data, error } = await supabase.from("portfolio_properties").select("id").eq("id", safe).maybeSingle();
        if (!alive) return;
        if (error) throw error;

        if (!data) {
          navigate("/portfolio", {
            replace: true,
            state: {
              ...(location.state as any),
              legacy_portfolio_redirect_error: "not_a_portfolio_id",
              legacy_portfolio_bad_id: safe,
            },
          });
          return;
        }

        navigate(`/portfolio/${encodeURIComponent(safe)}/address`, { replace: true, state: location.state });
      } catch (e: any) {
        if (!alive) return;
        const msg = e?.message ?? e?.details ?? String(e);
        navigate("/portfolio", {
          replace: true,
          state: { ...(location.state as any), legacy_portfolio_redirect_error: msg },
        });
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  return null;
}

/* =========================
   Portfolio Guard
========================= */
function RequirePortfolioProperty({ children }: { children: React.ReactNode }) {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState<{ loading: boolean; ok: boolean; err?: string }>({
    loading: true,
    ok: false,
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
        const { data, error } = await supabase.from("portfolio_properties").select("id").eq("id", safe).maybeSingle();
        if (error) throw error;

        if (!data) {
          if (alive) {
            setState({
              loading: false,
              ok: false,
              err:
                "Diese ID ist keine Portfolio-Property-ID.\n" +
                "Vermutlich wurde eine Core-Property-ID (properties.id) in die URL navigiert oder ein alter Bookmark benutzt.\n" +
                `ID: ${safe}`,
            });
          }
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
          boxShadow: THEME.shadow,
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
              cursor: "pointer",
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
function ProtectedLayout({ onLogout }: { onLogout: () => Promise<void> }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [session, setSession] = useState<Session | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!alive) return;
      setSession(s ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const navItems = useMemo(
    () => [
      { to: "/portfolio", label: "Portfolio" },
      { to: "/exports", label: "Exports" },
      { to: "/darlehensuebersicht", label: "Darlehensübersicht" },
      { to: "/uebersicht", label: "Übersicht" },
      { to: "/auswertung", label: "Auswertung" },
      { to: "/monate", label: "Monate" },
      { to: "/neu", label: "+ Buchung" },
      { to: "/categories", label: "Kategorien" },
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
      whiteSpace: "nowrap",
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
          borderBottom: `1px solid ${THEME.border}`,
        }}
      >
        <div style={{ padding: 10, background: "crimson", color: "white", fontWeight: 900 }}>
          BUILD MARKER: DEV-LOCAL-5173 — {location.pathname}
        </div>

        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 16,
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
              minWidth: 240,
            }}
          >
            <img src="/logo/koenen.png" alt="Könen Immobilien" style={{ height: 40, width: "auto", display: "block" }} />
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
                  cursor: "pointer",
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
                  cursor: "pointer",
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
                    border: `1px solid ${THEME.border}`,
                  }}
                >
                  {(session?.user.email ?? "U").slice(0, 1).toUpperCase()}
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
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderBottom: `1px solid ${THEME.border}`,
                      fontSize: 12,
                      color: THEME.muted,
                      wordBreak: "break-word",
                    }}
                  >
                    {session?.user.email ?? "—"}
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
                      textAlign: "left",
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
              gap: 10,
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
          textAlign: "center",
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
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        console.log("[AUTH DEBUG] session:", data.session);
        console.log("[AUTH DEBUG] user:", data.session?.user ?? null);
      } catch (e) {
        console.error("[AUTH DEBUG] failed:", e);
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const wrap = useCallback(
    (name: string, el: React.ReactElement) => <RouteErrorBoundary name={name}>{el}</RouteErrorBoundary>,
    []
  );

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public routes */}
        <Route path="/test-rent" element={wrap("TestRentChart", <TestRentChart />)} />

        <Route path="/login" element={wrap("Login", <Login />)} />
        <Route path="/mfa" element={wrap("MFA", <MFA />)} />
        <Route path="/unauthorized" element={wrap("Unauthorized", <Unauthorized />)} />

        {/* Protected routes */}
        <Route
          element={
            <RequireAuthMFA>
              <ProtectedLayout onLogout={logout} />
            </RequireAuthMFA>
          }
        >
          <Route path="/" element={<Navigate to="/portfolio" replace />} />

          <Route path="/portfolio" element={wrap("Portfolio", <Portfolio />)} />

          <Route
            path="/exports"
            element={wrap(
              "Exports",
              <RequireRole minRole="admin">
                <Exports />
              </RequireRole>
            )}
          />

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

          {/* Legacy portfolio routes */}
          <Route path="/portfolio/:id/address" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/details" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/finance" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/energy" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id/renting" element={<LegacyPortfolioRedirect />} />
          <Route path="/portfolio/:id" element={<LegacyPortfolioRedirect />} />

          {/* Other */}
          <Route path="/uebersicht" element={wrap("Übersicht", <Uebersicht />)} />
          <Route path="/auswertung" element={wrap("Auswertung", <Auswertung />)} />
          <Route path="/monate" element={wrap("Monate", <Monate />)} />
          <Route path="/neu" element={wrap("Neue Buchung", <EntryAdd />)} />

          {/* Admin */}
          <Route
            path="/categories"
            element={wrap(
              "Kategorien",
              <RequireRole minRole="admin">
                <CategoryAdminPage />
              </RequireRole>
            )}
          />

          {/* Loans */}
          <Route path="/darlehensuebersicht" element={wrap("Darlehensübersicht", <PropertyLoanOverview />)} />
          <Route path="/darlehensuebersicht/:id" element={wrap("Objekt Detail", <ObjektDetail />)} />
          <Route path="/darlehensuebersicht/:id/loan/new" element={wrap("Loan Entry", <LoanEntryAdd />)} />

          {/* Legacy Objekte routes */}
          <Route path="/objekte" element={<Navigate to="/darlehensuebersicht" replace />} />
          <Route
            path="/objekte/:id"
            element={<LegacyObjekteRedirect target={(id) => `/darlehensuebersicht/${encodeURIComponent(id)}`} />}
          />
          <Route
            path="/objekte/:id/loan/new"
            element={<LegacyObjekteRedirect target={(id) => `/darlehensuebersicht/${encodeURIComponent(id)}/loan/new`} />}
          />

          <Route path="/loan-import" element={wrap("Loan Import", <LoanImport />)} />

          <Route path="*" element={wrap("NotFound", <NotFound />)} />
        </Route>
      </Routes>
    </Suspense>
  );
}
