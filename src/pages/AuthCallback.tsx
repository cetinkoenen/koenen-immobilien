import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// Supabase Client (Vite env!)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Signing you in...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // PKCE Flow (Recommended)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            setError(error.message);
            setMessage("Authentication failed.");
            return;
          }
        }

        // Fallback: Check if session exists
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          setError("No active session found.");
          setMessage("Login failed.");
          return;
        }

        // Success → Redirect to home
        navigate("/", { replace: true });

      } catch (err: any) {
        setError(err.message || "Unknown error");
        setMessage("Something went wrong.");
      }
    };

    handleAuth();
  }, [navigate]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>{message}</h2>
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}