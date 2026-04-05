import { useState, type FormEvent, useEffect } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

function getFromPath(locationState: unknown): string {
  const from = (locationState as { from?: { pathname?: string } | string } | null)?.from;

  if (typeof from === "string" && from.startsWith("/")) {
    return from;
  }

  if (
    typeof from === "object" &&
    from !== null &&
    typeof from.pathname === "string" &&
    from.pathname.startsWith("/")
  ) {
    return from.pathname;
  }

  return "/objekte";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: authLoading, session } = useAuth();

  const from = getFromPath(location.state);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [checkingMfa, setCheckingMfa] = useState(true);

  async function getAalLevel(): Promise<"aal1" | "aal2" | null> {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) throw error;

    if (data?.currentLevel === "aal1" || data?.currentLevel === "aal2") {
      return data.currentLevel;
    }

    return null;
  }

  async function routeAfterLogin() {
    const level = await getAalLevel();

    if (level === "aal2") {
      navigate(from, { replace: true });
      return;
    }

    navigate("/mfa", { replace: true, state: { from } });
  }

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      if (authLoading) return;

      if (!session) {
        if (active) setCheckingMfa(false);
        return;
      }

      try {
        const level = await getAalLevel();

        if (!active) return;

        if (level === "aal2") {
          navigate(from, { replace: true });
          return;
        }

        navigate("/mfa", { replace: true, state: { from } });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "MFA-Prüfung fehlgeschlagen.");
      } finally {
        if (active) setCheckingMfa(false);
      }
    }

    void checkExistingSession();

    return () => {
      active = false;
    };
  }, [authLoading, session, navigate, from]);

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      await routeAfterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp() {
    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.session) {
        await routeAfterLogin();
        return;
      }

      setInfo(
        "Registrierung erfolgreich. Bitte prüfe ggf. deine E-Mails und logge dich danach ein."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForceLogout() {
    setError("");
    setInfo("");

    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      setInfo("Session wurde zurückgesetzt. Du solltest jetzt die Login-Seite sehen.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout fehlgeschlagen.");
    }
  }

  if (authLoading || checkingMfa) {
    return <div style={{ padding: "2rem" }}>Lade…</div>;
  }

  if (!authLoading && session) {
    return <Navigate to="/mfa" replace state={{ from }} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 20,
          background: "#ffffff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Login</h1>

        <p style={{ marginTop: 8, color: "#6b7280", lineHeight: 1.5 }}>
          Bitte mit deiner Supabase-E-Mail anmelden oder registrieren.
        </p>

        {error ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#991b1b",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        ) : null}

        {info ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: "#ecfeff",
              border: "1px solid #a5f3fc",
              color: "#155e75",
              fontWeight: 700,
            }}
          >
            {info}
          </div>
        ) : null}

        <form
          onSubmit={handleSignIn}
          style={{ marginTop: 16, display: "grid", gap: 12 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
              E-Mail
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="name@beispiel.de"
              required
              disabled={submitting || authLoading}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: 14,
                background: "#ffffff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
              Passwort
            </span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={submitting || authLoading}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: 14,
                background: "#ffffff",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting || authLoading}
            style={{
              marginTop: 4,
              padding: "11px 12px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 14,
              cursor: submitting || authLoading ? "default" : "pointer",
              opacity: submitting || authLoading ? 0.7 : 1,
            }}
          >
            {submitting ? "Einloggen…" : "Einloggen"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSignUp}
          disabled={submitting || authLoading}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "11px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#111827",
            fontWeight: 700,
            fontSize: 14,
            cursor: submitting || authLoading ? "default" : "pointer",
            opacity: submitting || authLoading ? 0.7 : 1,
          }}
        >
          {submitting ? "Bitte warten…" : "Registrieren"}
        </button>

        <button
          type="button"
          onClick={handleForceLogout}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "11px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            color: "#374151",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Session zurücksetzen
        </button>
      </div>
    </div>
  );
}