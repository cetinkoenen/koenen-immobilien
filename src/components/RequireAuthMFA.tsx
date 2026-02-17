// src/components/RequireAuthMFA.tsx
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type Props = { children: ReactNode };
type AAL = "aal1" | "aal2" | null;

type GateState = {
  loading: boolean;
  session: Session | null;
  aal: AAL;
  err?: string;
  lastSyncAt?: number;
};

function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`Auth timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

function formatTime(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "—";
  }
}

/**
 * Determine "from" target:
 * - we keep it as a string path (recommended)
 * - fallback: "/portfolio"
 */
function getFrom(location: any): string {
  const raw = location?.state?.from;

  // if previous code set from as string
  if (typeof raw === "string" && raw.startsWith("/")) return raw;

  // if previous code set from as { pathname: ... }
  const p = raw?.pathname;
  if (typeof p === "string" && p.startsWith("/")) return p;

  return "/portfolio";
}

export default function RequireAuthMFA({ children }: Props) {
  const location = useLocation() as any;
  const pathname = (location?.pathname ?? "/") as string;

  // Show debug UI only in DEV when explicitly enabled
  const showDebug = import.meta.env.DEV && import.meta.env.VITE_DEBUG_UI === "1";

  const [st, setSt] = useState<GateState>({
    loading: true,
    session: null,
    aal: null,
    err: undefined,
    lastSyncAt: undefined,
  });

  const debugText = useMemo(() => {
    const s = st.session ? "yes" : "no";
    const aal = st.aal ?? "(null)";
    const err = st.err ? ` | err=${st.err}` : "";
    const t = formatTime(st.lastSyncAt);
    return `DEBUG RequireAuthMFA | path=${pathname} | session=${s} | AAL=${aal} | sync=${t}${err}`;
  }, [pathname, st.aal, st.err, st.lastSyncAt, st.session]);

  const DebugBar = showDebug ? (
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
      {debugText}
    </div>
  ) : null;

  useEffect(() => {
    let cancelled = false;

    async function syncAuth(reason: string) {
      try {
        // Always start sync in a controlled way
        setSt((prev) => ({
          ...prev,
          loading: true,
          err: undefined,
        }));

        // 1) session
        const { data: sData, error: sErr } = await withTimeout(
          supabase.auth.getSession(),
          8000
        );
        if (sErr) throw sErr;

        const session = sData?.session ?? null;

        // 2) AAL (only if session exists)
        let aal: AAL = null;
        if (session) {
          const { data: aData, error: aErr } = await withTimeout(
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
            8000
          );
          if (aErr) throw aErr;

          const lvl = aData?.currentLevel;
          aal = lvl === "aal1" || lvl === "aal2" ? lvl : null;
        }

        if (cancelled) return;

        setSt({
          loading: false,
          session,
          aal,
          err: undefined,
          lastSyncAt: Date.now(),
        });
      } catch (e: any) {
        if (cancelled) return;

        const msg =
          e?.message ??
          e?.error_description ??
          (typeof e === "string" ? e : JSON.stringify(e));

        // IMPORTANT: stop loading even on errors
        setSt((prev) => ({
          ...prev,
          loading: false,
          err: msg,
          lastSyncAt: Date.now(),
        }));

        // Optional: log to console for production debugging
        // eslint-disable-next-line no-console
        console.error("RequireAuthMFA sync error:", reason, msg, e);
      }
    }

    // initial sync
    void syncAuth("initial");

    // subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event) => {
      void syncAuth("onAuthStateChange");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Friendly loading screen
  if (st.loading) {
    return (
      <div>
        {DebugBar}
        <div style={{ padding: 16 }}>Lädt Auth…</div>
      </div>
    );
  }

  const from = getFrom(location);

  /**
   * Routing rules:
   * - /login: if no session => show children (login page). if session but not aal2 => redirect /mfa. if aal2 => redirect to from
   * - /mfa:   if no session => redirect /login. if aal2 => redirect to from. else show children (mfa page)
   * - protected: if no session => redirect /login. if not aal2 => redirect /mfa. else show children
   */

  // If there is an auth error, still allow navigation to login
  // (Most apps prefer not to hard-block the user on auth sync errors)
  if (st.err && pathname !== "/login") {
    // You can change this behavior if you want:
    // e.g. show an error page instead of redirecting
    // For now: let protected logic below decide (will route to /login if no session)
  }

  // /login behavior
  if (pathname === "/login") {
    if (!st.session) {
      return (
        <div>
          {DebugBar}
          {children}
        </div>
      );
    }
    if (st.aal !== "aal2") {
      return (
        <div>
          {DebugBar}
          <Navigate to="/mfa" replace state={{ from }} />
        </div>
      );
    }
    return (
      <div>
        {DebugBar}
        <Navigate to={from} replace />
      </div>
    );
  }

  // /mfa behavior
  if (pathname === "/mfa") {
    if (!st.session) {
      return (
        <div>
          {DebugBar}
          <Navigate to="/login" replace state={{ from }} />
        </div>
      );
    }
    if (st.aal === "aal2") {
      return (
        <div>
          {DebugBar}
          <Navigate to={from} replace />
        </div>
      );
    }
    return (
      <div>
        {DebugBar}
        {children}
      </div>
    );
  }

  // Protected area
  if (!st.session) {
    return (
      <div>
        {DebugBar}
        <Navigate to="/login" replace state={{ from: pathname }} />
      </div>
    );
  }

  if (st.aal !== "aal2") {
    return (
      <div>
        {DebugBar}
        <Navigate to="/mfa" replace state={{ from: pathname }} />
      </div>
    );
  }

  return (
    <div>
      {DebugBar}
      {children}
    </div>
  );
}
