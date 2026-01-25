import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useActiveAccount } from "../roles/useActiveAccount";
import { useMyRole } from "../roles/useMyRole";

type Role = "viewer" | "user" | "admin" | "owner";

function roleRank(role: Role | null | undefined) {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "user":
      return 2;
    case "viewer":
      return 1;
    default:
      return 0;
  }
}

export default function RequireRole({
  minRole,
  children
}: {
  minRole: Role;
  children: React.ReactNode;
}) {
  const location = useLocation();

  const { loading: accLoading, accountId, error: accErr } = useActiveAccount();
  const { loading: roleLoading, role, error: roleErr } = useMyRole(accountId);

  if (accLoading || roleLoading) return <div style={{ padding: 16 }}>Lädt…</div>;

  if (accErr || roleErr || !accountId) {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
  }

  if (roleRank(role as Role) < roleRank(minRole)) {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
