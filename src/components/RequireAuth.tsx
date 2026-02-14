// src/components/RequireAuth.tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "../auth/AuthProvider";

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
  const { loading, session } = useAuth();

  if (loading) {
    return <>{loadingFallback ?? <div style={{ padding: "2rem" }}>Lade…</div>}</>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Nur guarden – Layout (Header/Nav) macht dein ProtectedLayout
  return <>{children(session)}</>;
}
