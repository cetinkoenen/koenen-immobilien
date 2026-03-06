import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    async function handleAuthCallback() {
      try {
        const { error } = await supabase.auth.getSession();

        if (error) {
          console.error("[AuthCallback] getSession error", error);
          navigate("/login", {
            replace: true,
            state: {
              error: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
            },
          });
          return;
        }

        if (!isActive) return;

        navigate("/", { replace: true });
      } catch (error) {
        console.error("[AuthCallback] unexpected error", error);

        if (!isActive) return;

        navigate("/login", {
          replace: true,
          state: {
            error: "Beim Auth-Callback ist ein Fehler aufgetreten.",
          },
        });
      }
    }

    void handleAuthCallback();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f9fafb",
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
        Anmeldung wird abgeschlossen...
      </div>
    </div>
  );
}