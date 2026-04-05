import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) return;

        if (error || !data.session) {
          console.error("[AuthCallback] session error:", error);
          navigate("/login", {
            replace: true,
            state: {
              error: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
            },
          });
          return;
        }

        navigate("/objekte", { replace: true });
      } catch (err) {
        console.error("[AuthCallback] unexpected error:", err);

        if (!active) return;

        navigate("/login", {
          replace: true,
          state: {
            error: "Beim Auth-Callback ist ein Fehler aufgetreten.",
          },
        });
      }
    }

    void handleCallback();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          padding: 24,
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        Anmeldung wird abgeschlossen…
      </div>
    </div>
  );
}