import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from ?? "/portfolio";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // After successful password auth, continue to MFA step.
      // MFA page should redirect back to `from` after AAL2 is reached.
      navigate("/mfa", { replace: true, state: { from } });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 44, margin: "0 0 12px" }}>Login</h1>

      <form onSubmit={onSubmit} style={{ maxWidth: 420, display: "grid", gap: 10 }}>
        <input
          type="email"
          autoComplete="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
        />

        <input
          type="password"
          autoComplete="current-password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#eee" : "#111",
            color: loading ? "#111" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Einloggen…" : "Login"}
        </button>

        {error && (
          <div style={{ color: "crimson", fontWeight: 700, whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Nach dem Login geht’s zu <code>/mfa</code>.
        </div>
      </form>
    </div>
  );
}
