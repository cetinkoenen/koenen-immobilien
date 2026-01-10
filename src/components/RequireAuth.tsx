// src/components/RequireAuth.tsx
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import Navbar from "./ui/Navbar";

type Props = {
  /**
   * Render-Prop:
   * Kinder bekommen garantiert eine NICHT-null Session.
   */
  children: (session: Session) => ReactNode;

  /**
   * Optional: eigener Loader-Text
   */
  loadingFallback?: ReactNode;
};

export default function RequireAuth({ children, loadingFallback }: Props) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch((e) => {
        console.error("getSession failed in RequireAuth:", e);
        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <>{loadingFallback ?? <div style={{ padding: "2rem" }}>Lade…</div>}</>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Navbar />
      <div style={{ padding: "0 16px 24px" }}>{children(session)}</div>
    </>
  );
}
