// src/components/RequireAuthMFA.tsx
import React, { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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

function safeFrom(location: any): string {
  // supports either state.from as string or location object
  const raw = location?.state?.from;
  if (typeof raw === "string" && raw.startsWith("/")) return raw;

  const p = raw?.pathname;
  if (typeof p === "string" && p.startsWith("/")) return p;

  // fallback
  return "/portfolio";
}

function formatTime(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "—";
  }
}

export default function RequireAuthMFA({ children }: Props) {
  const location = useLocation() as any;
  const pathname = (location?.pathname ?? "/") as string;

  // Toggle debug UI via .env.local: VITE_DEBUG_UI=1 (and only in DEV)
  const showDebug = import.meta.env.DEV && import.meta.env.VITE_DEBUG_UI === "1";

  const [st, setSt] = useState<GateState>({
    loading: true,
    session: null,
    aal: null,
    err: undefined,
    lastSyncAt: undefined,
  });

  /**
   * Concurrency + staleness guards:
   * - seq increases for each sync trigger
   * - only latest seq is allowed to commit state
   * - syncing prevents parallel storms from multiple triggers firing together
   */
  const seq = useRef(0);
  const syncing = useRef(false);
  const mountedRef = useRef(true);

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

  async function syncOnce() {
    if (syncing.current) return;
    syncing.current = true;

    const mySeq = ++seq.current;
    const isStale = () => mySeq !== seq.current || !mountedRef.current;

    try {
      // 1) session
      const { data: sData, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;

      const session = sData?.session ?? null;

      // 2) aal (only if session exists)
      let aal: AAL = null;
      if (session) {
        const { data: aData, error: aErr } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aErr) throw aErr;

        const lvl = aData?.currentLevel;
        aal = lvl === "aal1" || lvl === "aal2" ? lvl : null;
      }

      if (isStale()) return;

      setSt({
        loading: false,
        session,
        aal,
        err: undefined,
        lastSyncAt: Date.now(),
      });
    } catch (e: any) {
      if (isStale()) return;

      const msg =
        e?.message ??
        e?.error_description ??
        (typeof e === "string" ? e : JSON.stringify(e));

      setSt((prev) => ({
        ...prev,
        loading: false,
        err: msg,
        lastSyncAt: Date.now(),
      }));
    } finally {
      // release lock only if still latest
      if (mySeq === seq.current) syncing.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    // initial sync
    void syncOnce();

    // subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncOnce();
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();

      // invalidate pending async commits
      seq.current += 1;
      // unlock to avoid deadlock on remount
      syncing.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Friendly loading screen (with optional debug bar)
  if (st.loading) {
    return (
      <div>
        {DebugBar}
        <div style={{ padding: 16 }}>Lädt Auth…</div>
      </div>
    );
  }

  const from = safeFrom(location);

  /**
   * Routing rules:
   * - /login: if no session => show children (login page). if session but not aal2 => redirect /mfa. if aal2 => redirect to from
   * - /mfa:   if no session => redirect /login. if aal2 => redirect to from. else show children (mfa page)
   * - protected: if no session => redirect /login. if not aal2 => redirect /mfa. else show children
   */

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
        <Navigate to="/login" replace state={{ from: location }} />
      </div>
    );
  }

  if (st.aal !== "aal2") {
    return (
      <div>
        {DebugBar}
        <Navigate to="/mfa" replace state={{ from: location }} />
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
