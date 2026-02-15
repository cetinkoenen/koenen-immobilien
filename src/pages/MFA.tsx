import { supabase } from "@/lib/supabaseClient";
// src/pages/MFA.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type TotpEnroll = {
  factorId: string;
  qr?: string; // svg string or data url
  uri?: string; // otpauth://...
};

type Stage = "setup" | "verify";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getFrom(loc: any): string {
  const raw = loc?.state?.from;

  // Case 1: from is string like "/portfolio"
  if (typeof raw === "string" && raw.startsWith("/")) return raw;

  // Case 2: from is a location object: { pathname: "/portfolio", ... }
  const p = raw?.pathname;
  if (typeof p === "string" && p.startsWith("/")) return p;

  return "/portfolio";
}

export default function MFA() {
  const navigate = useNavigate();
  const location = useLocation() as any;

  const from = useMemo(() => getFrom(location), [location]);

  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("verify");

  const [enroll, setEnroll] = useState<TotpEnroll | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const qrIsSvg = typeof enroll?.qr === "string" && enroll.qr.trim().startsWith("<svg");

  async function ensureLoggedIn(): Promise<boolean> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (!data.session) {
      navigate("/login", { replace: true, state: { from } });
      return false;
    }
    return true;
  }

  async function getAalLevel(): Promise<"aal1" | "aal2" | null> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    const lvl = data?.currentLevel;
    if (lvl === "aal1" || lvl === "aal2") return lvl;
    return null;
  }

  async function redirectIfAal2(): Promise<boolean> {
    const lvl = await getAalLevel();
    if (lvl === "aal2") {
      navigate(from, { replace: true });
      return true;
    }
    return false;
  }

  async function refreshAndWaitForAal2(): Promise<boolean> {
    // Refresh helps a lot after verify
    const { error: rErr } = await supabase.auth.refreshSession();
    if (rErr) {
      // not fatal; we'll still poll AAL
      console.warn("[MFA] refreshSession error:", rErr);
    }

    // Poll a few times (total ~1.2s)
    for (let i = 0; i < 4; i++) {
      const lvl = await getAalLevel();
      if (lvl === "aal2") return true;
      await sleep(300);
    }
    return false;
  }

  async function startChallenge(factorId: string) {
    setError(null);
    setChallengeId(null);

    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) throw chErr;

    const chId = (ch as any)?.id ?? (ch as any)?.challengeId;
    if (!chId) throw new Error("MFA challenge: challengeId fehlt.");

    setChallengeId(chId);
  }

  async function enrollTotpAndChallenge() {
    setError(null);
    setEnroll(null);
    setChallengeId(null);

    const { data: enrolled, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator",
    });
    if (enrollErr) throw enrollErr;

    const factorId =
      (enrolled as any)?.id ??
      (enrolled as any)?.factorId ??
      (enrolled as any)?.data?.id ??
      (enrolled as any)?.data?.factorId;

    const totpObj =
      (enrolled as any)?.totp ??
      (enrolled as any)?.data?.totp ??
      (enrolled as any)?.data;

    const qr =
      totpObj?.qr_code ??
      totpObj?.qrCode ??
      totpObj?.qr_svg ??
      totpObj?.qr_svg_data ??
      totpObj?.qr;

    const uri = totpObj?.uri ?? totpObj?.otpauth_url ?? totpObj?.otpauthUrl;

    if (!factorId) throw new Error("MFA enroll: factorId fehlt (Supabase response unerwartet).");

    setEnroll({ factorId, qr, uri });
    await startChallenge(factorId);
  }

  async function loadAndDecide() {
    // If already aal2, leave
    const done = await redirectIfAal2();
    if (done) return;

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;

    const totp = (data?.totp ?? []) as any[];
    const hasTotp = totp.length > 0;

    if (hasTotp) {
      const factorId = totp[0].id as string;
      setStage("verify");
      setHint("Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.");
      setEnroll({ factorId });
      await startChallenge(factorId);
    } else {
      setStage("setup");
      setHint("Richte 2FA ein: QR-Code scannen und danach den 6-stelligen Code eingeben.");
      await enrollTotpAndChallenge();
    }
  }

  async function onVerify() {
    setBusy(true);
    setError(null);

    try {
      const ok = await ensureLoggedIn();
      if (!ok) return;

      if (!enroll?.factorId) throw new Error("factorId fehlt.");
      if (!challengeId) throw new Error("challengeId fehlt.");

      const clean = code.replace(/\s/g, "");
      if (!/^\d{6}$/.test(clean)) {
        setError("Bitte gib einen 6-stelligen Code ein.");
        return;
      }

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId,
        code: clean,
      });

      if (vErr) {
        // Often challenge expired -> re-challenge
        setError(vErr.message ?? "Verifizierung fehlgeschlagen.");
        try {
          await startChallenge(enroll.factorId);
        } catch {
          // ignore
        }
        return;
      }

      const becameAal2 = await refreshAndWaitForAal2();
      if (!becameAal2) {
        setError(
          "MFA wurde bestätigt, aber AAL2 ist noch nicht sichtbar. Bitte „Neu laden“ drücken oder kurz warten und erneut versuchen."
        );
        return;
      }

      navigate(from, { replace: true });
    } catch (e: any) {
      setError(e?.message ?? e?.error_description ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReload() {
    setBusy(true);
    setError(null);
    setCode("");
    try {
      const ok = await ensureLoggedIn();
      if (!ok) return;
      await loadAndDecide();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    setError(null);
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const ok = await ensureLoggedIn();
        if (!ok || !alive) return;

        await loadAndDecide();
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Lädt…</div>;

  const showQr = stage === "setup";

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Zwei-Faktor-Login (2FA)</h2>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Ziel: Ohne bestätigte Authenticator-App (AAL2) kein Zugriff auf die App.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onReload}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            Neu laden
          </button>

          <button
            onClick={onLogout}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {hint && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            fontSize: 13,
          }}
        >
          {hint}
        </div>
      )}

      {showQr && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Setup: QR-Code scannen</div>

          {enroll?.qr ? (
            qrIsSvg ? (
              <div dangerouslySetInnerHTML={{ __html: enroll.qr }} />
            ) : (
              <img
                alt="TOTP QR Code"
                src={
                  enroll.qr.startsWith("data:")
                    ? enroll.qr
                    : `data:image/svg+xml;utf8,${encodeURIComponent(enroll.qr)}`
                }
                style={{ width: 220, height: 220, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
            )
          ) : (
            <div style={{ opacity: 0.7, fontSize: 13 }}>QR wird geladen…</div>
          )}

          {enroll?.uri && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8, wordBreak: "break-all" }}>
              <div style={{ fontWeight: 800 }}>Backup-Link (otpauth):</div>
              <code>{enroll.uri}</code>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "white",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          {stage === "setup" ? "Code bestätigen" : "Code eingeben"}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 16,
              letterSpacing: "0.2em",
              width: 160,
              outline: "none",
            }}
          />

          <button
            onClick={onVerify}
            disabled={busy || !challengeId || !enroll?.factorId}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              opacity: busy || !challengeId || !enroll?.factorId ? 0.6 : 1,
            }}
          >
            {busy ? "Prüfe…" : "Bestätigen"}
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Tipp: Wenn der Code abgelehnt wird, prüfe Uhrzeit/Zeitzone am Handy (Automatisch stellen).
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 4 }}>Fehler</div>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
