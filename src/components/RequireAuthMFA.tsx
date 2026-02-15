import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type Props = { children: ReactNode };

type GateState = {
  loading: boolean;
  session: Session | null;
  aal: "aal1" | "aal2" | null;
  err?: string;
  lastSyncAt?: number;
};

function getFrom(loc: any): string {
  const raw = loc?.state?.from;
  if (typeof raw === "string" && raw.startsWith("/")) return raw;
  const p = raw?.pathname;
  if (typeof p === "string" && p.startsWith("/")) return p;
  return "/portfolio";
}

export default function RequireAuthMFA({ children }: Props) {
  const location = useLocation() as any;
  const pathname = location.pathname as string;

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
    const err = st.err ? ` | err: ${st.err}` : "";
    const t = st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleTimeString() : "—";
    return `DEBUG RequireAuthMFA | path=${pathname} | session=${s} | AAL=${aal} | sync=${t}${err}`;
  }, [pathname, st.aal, st.err, st.lastSyncAt, st.session]);

  async function sync() {
    try {
      const { data: sData, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;

      const session = sData.session ?? null;

      let aal: "aal1" | "aal2" | null = null;
      if (session) {
        const { data: aData, error: aErr } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aErr) throw aErr;

        const lvl = aData?.currentLevel;
        aal = lvl === "aal1" || lvl === "aal2" ? lvl : null;
      }

      setSt({
        loading: false,
        session,
        aal,
        err: undefined,
        lastSyncAt: Date.now(),
      });
    } catch (e: any) {
      setSt((prev) => ({
        ...prev,
        loading: false,
        err: e?.message ?? e?.error_description ?? String(e),
        lastSyncAt: Date.now(),
      }));
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await sync();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      if (!alive) return;
      await sync();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const DebugBar = (
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
  );

  if (st.loading) {
    return (
      <div>
        {DebugBar}
        <div style={{ padding: 16 }}>Lädt Auth…</div>
      </div>
    );
  }

  // ---------- Special routing logic for /login + /mfa ----------
  const from = getFrom(location);

  // /login behavior:
  // - no session -> allow login page
  // - session + not aal2 -> force /mfa
  // - session + aal2 -> go to from (or default)
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

  // /mfa behavior:
  // - no session -> send to login
  // - aal2 -> done, go to from
  // - aal1 -> allow MFA page
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

  // ---------- Protected area ----------
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
