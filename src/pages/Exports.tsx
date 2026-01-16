import { useMemo } from "react";
import { useActiveAccount } from "../roles/useActiveAccount";
import { useMyRole } from "../roles/useMyRole";

export default function Exports() {
  const { loading: accLoading, accountId, error: accErr } = useActiveAccount();
  const { loading: roleLoading, role, error: roleErr } = useMyRole(accountId);

  const canExport = useMemo(() => role === "admin" || role === "owner", [role]);

  if (accLoading || roleLoading) return <div style={{ padding: 16 }}>Lädt…</div>;
  if (accErr) return <div style={{ padding: 16 }}>Account-Error: {accErr}</div>;
  if (roleErr) return <div style={{ padding: 16 }}>Role-Error: {roleErr}</div>;
  if (!accountId) return <div style={{ padding: 16 }}>Kein Account gefunden.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Exports</h2>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Account: <code>{accountId}</code> · Rolle: <b>{role}</b>
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button
          disabled={!canExport}
          onClick={() => alert("Excel Export kommt als nächster Schritt (xlsx).")}
          style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}
        >
          Excel Export
        </button>

        <button
          disabled={!canExport}
          onClick={() => alert("PDF Export kommt als nächster Schritt.")}
          style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}
        >
          PDF Export
        </button>

        <button
          disabled={!canExport}
          onClick={() => alert("Steuerübersicht kommt als nächster Schritt.")}
          style={{ padding: "10px 12px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}
        >
          Steuerübersicht
        </button>
      </div>

      {!canExport && (
        <div style={{ marginTop: 12 }}>
          Du bist nicht berechtigt, Exports zu erstellen.
        </div>
      )}
    </div>
  );
}
