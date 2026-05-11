// src/components/RequireAuthMFA.tsx
import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type Props = { children: ReactNode };

type GateState = {
  loading: boolean;
  session: Session | null;
  err?: string;
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

export default function RequireAuthMFA({ children }: Props) {
  const location = useLocation();
  const [st, setSt] = useState<GateState>({
    loading: true,
    session: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function syncAuth() {
      try {
        setSt((prev) => ({
          ...prev,
          loading: true,
          err: undefined,
        }));

        const { data, error } = await withTimeout(supabase.auth.getSession(), 8000);
        if (error) throw error;

        if (cancelled) return;

        setSt({
          loading: false,
          session: data?.session ?? null,
          err: undefined,
        });
      } catch (e: any) {
        if (cancelled) return;

        const msg =
          e?.message ??
          e?.error_description ??
          (typeof e === "string" ? e : JSON.stringify(e));

        setSt((prev) => ({
          ...prev,
          loading: false,
          err: msg,
        }));

        // eslint-disable-next-line no-console
        console.error("RequireAuthMFA sync error:", msg, e);
      }
    }

    void syncAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncAuth();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (st.loading) {
    return <div style={{ padding: 16 }}>Lädt Auth…</div>;
  }

  if (!st.session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
