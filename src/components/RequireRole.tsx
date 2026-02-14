// src/components/RequireRole.tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useActiveAccount } from "../roles/useActiveAccount";
import { useMyRole, type Role } from "../roles/useMyRole";

/**
 * RequireRole
 * ----------
 * - Guardt Routes nach Rollen (viewer < admin < owner).
 * - Lädt zuerst activeAccount, dann Rolle für diesen Account.
 *
 * Debug:
 * - Setze DEBUG = true, um Console-Logs zu sehen.
 *
 * Verhalten bei Deny:
 * - REDIRECT_ON_DENY = true  => redirect zu /unauthorized (empfohlen für Produktion)
 * - REDIRECT_ON_DENY = false => zeigt eine Message (gut fürs Debugging)
 */
const ROLE_ORDER: Record<Role, number> = { viewer: 1, admin: 2, owner: 3 };

// ✅ Produktion: false
const DEBUG = false;

// ✅ Produktion: true
const REDIRECT_ON_DENY = true;

type Props = {
  minRole: Role;
  children: ReactNode;
  loadingFallback?: ReactNode;
};

function Box({
  title,
  children,
  tone = "danger",
}: {
  title: string;
  children: ReactNode;
  tone?: "danger" | "warn";
}) {
  const styles =
    tone === "danger"
      ? {
          border: "1px solid #fecaca",
          background: "#fff1f2",
          color: "#7f1d1d",
        }
      : {
          border: "1px solid #fde68a",
          background: "#fffbeb",
          color: "#7c2d12",
        };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ ...styles, padding: 14, borderRadius: 14, fontSize: 13, fontWeight: 800, whiteSpace: "pre-wrap" }}>
        <div style={{ fontWeight: 950, marginBottom: 8 }}>{title}</div>
        <div style={{ fontWeight: 800 }}>{children}</div>
      </div>
    </div>
  );
}

export default function RequireRole({ minRole, children, loadingFallback }: Props) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const { accountId, loading: accLoading, error: accErr } = useActiveAccount();

  const shouldLoadRole = Boolean(user?.id) && Boolean(accountId) && !authLoading && !accLoading;
  const { role, loading: roleLoading, error: roleErr } = useMyRole(shouldLoadRole ? accountId! : null);

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[RequireRole]", {
      path: location.pathname,
      minRole,
      authLoading,
      accLoading,
      roleLoading,
      user: Boolean(user),
      accountId,
      role,
      accErr: accErr ?? null,
      roleErr: roleErr ?? null,
      shouldLoadRole,
    });
  }

  // 1) Loading (nur wenn sinnvoll)
  const isLoading = authLoading || accLoading || (shouldLoadRole && roleLoading);
  if (isLoading) {
    return <>{loadingFallback ?? <div style={{ padding: 32, fontWeight: 800 }}>Berechtigungen werden geprüft…</div>}</>;
  }

  // 2) Nicht eingeloggt
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 3) Kein Account gefunden / Fehler beim Laden
  if (accErr) {
    if (REDIRECT_ON_DENY) return <Navigate to="/unauthorized" replace state={{ from: location.pathname, reason: accErr }} />;
    return (
      <Box title="Account konnte nicht geladen werden" tone="danger">
        {accErr}
      </Box>
    );
  }

  if (!accountId) {
    if (REDIRECT_ON_DENY)
      return <Navigate to="/unauthorized" replace state={{ from: location.pathname, reason: "no_account" }} />;
    return (
      <Box title="Kein Account gefunden" tone="warn">
        Der Benutzer ist keinem Account zugeordnet.
        {"\n"}
        Bitte in <code>account_members</code> prüfen.
      </Box>
    );
  }

  // 4) Rolle nicht gefunden / Fehler beim Laden
  if (roleErr) {
    if (REDIRECT_ON_DENY) return <Navigate to="/unauthorized" replace state={{ from: location.pathname, reason: roleErr }} />;
    return (
      <Box title="Rolle konnte nicht geladen werden" tone="danger">
        {roleErr}
      </Box>
    );
  }

  if (!role) {
    // Das ist absichtlich NICHT viewer-default:
    // => entweder kein Membership-Eintrag oder RLS blockiert.
    if (REDIRECT_ON_DENY)
      return <Navigate to="/unauthorized" replace state={{ from: location.pathname, reason: "no_role" }} />;
    return (
      <Box title="Keine Rolle gefunden" tone="warn">
        Der Benutzer hat in diesem Account keine Rolle (oder Zugriff wird durch RLS blockiert).
        {"\n"}
        Bitte <code>account_members</code> prüfen (user_id + account_id).
      </Box>
    );
  }

  // 5) Rollenvergleich
  if (ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
    if (REDIRECT_ON_DENY)
      return (
        <Navigate
          to="/unauthorized"
          replace
          state={{ from: location.pathname, reason: "insufficient_role", minRole, role }}
        />
      );

    return (
      <Box title="Keine Berechtigung" tone="warn">
        Benötigt: <code>{minRole}</code>
        {"\n"}
        Deine Rolle: <code>{role}</code>
      </Box>
    );
  }

  // ✅ Allowed
  return <>{children}</>;
}
