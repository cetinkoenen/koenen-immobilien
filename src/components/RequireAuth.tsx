// src/components/RequireAuth.tsx
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type Props = {
  /**
   * Render-Prop:
   * Kinder bekommen garantiert eine NICHT-null Session.
   */
  children: (session: Session) => ReactNode;

  /**
   * Optional: eigener Loader
   */
  loadingFallback?: ReactNode;
};

export default function RequireAuth({ children, loadingFallback }: Props) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1) Initiale Session laden
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("getSession error in RequireAuth:", error);
        if (!mounted) return;
        setSession(data.session);
      } catch (e) {
        console.error("getSession failed in RequireAuth:", e);
        if (!mounted) return;
        setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // 2) Session-Änderungen abonnieren
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

  // Nur guarden – Layout (Header/Nav) macht dein ProtectedLayout
  return <>{children(session)}</>;
}
