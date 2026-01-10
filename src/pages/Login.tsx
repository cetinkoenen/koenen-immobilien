import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      navigate("/monate", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setInfo(
        "Registrierung erfolgreich. Du kannst dich jetzt mit deinen Daten einloggen."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>Login</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Bitte mit deiner Supabase Auth E-Mail anmelden oder registrieren.
        </p>

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              background: "#fff1f2",
              color: "#991b1b",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {info && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              background: "#ecfeff",
              color: "#155e75",
              fontWeight: 700,
            }}
          >
            {info}
          </div>
        )}

        <form
          onSubmit={signIn}
          style={{ marginTop: 14, display: "grid", gap: 10 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>E-Mail</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="info@..."
              required
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Passwort</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "black",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Login…" : "Einloggen"}
          </button>
        </form>

        {/* REGISTRIEREN */}
        <button
          onClick={signUp}
          disabled={loading}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Bitte warten…" : "Registrieren"}
        </button>
      </div>
    </div>
  );
}
