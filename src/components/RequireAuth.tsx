import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { useEffect, useState } from "react";

type Props = {
  children: ReactNode;
  loadingFallback?: ReactNode;
};

export default function RequireAuth({ children, loadingFallback }: Props) {
  const { loading, session } = useAuth();
  const location = useLocation();
  const [aalLoading, setAalLoading] = useState(true);
  const [aal2, setAal2] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAal() {
      if (loading) return;

      if (!session) {
        if (active) {
          setAal2(false);
          setAalLoading(false);
        }
        return;
      }

      try {
        const { data, error } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (error) throw error;

        if (!active) return;

        setAal2(data?.currentLevel === "aal2");
      } catch {
        if (!active) return;
        setAal2(false);
      } finally {
        if (active) setAalLoading(false);
      }
    }

    void checkAal();

    return () => {
      active = false;
    };
  }, [loading, session]);

  if (loading || aalLoading) {
    return <>{loadingFallback ?? <div style={{ padding: "2rem" }}>Lade…</div>}</>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!aal2) {
    return <Navigate to="/mfa" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}