import { useEffect, useState } from "react";

type CookieChoice = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
};

const STORAGE_KEY = "koenen_cookie_consent_v1";

export function getCookieConsent(): CookieChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookieChoice) : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return Boolean(getCookieConsent()?.analytics);
}

export function openCookieSettings() {
  window.dispatchEvent(new Event("open-cookie-settings"));
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const saved = getCookieConsent();
    if (!saved) {
      setVisible(true);
      return;
    }
    setAnalytics(saved.analytics);
    setMarketing(saved.marketing);

    const open = () => {
      setVisible(true);
      setSettingsOpen(true);
    };

    window.addEventListener("open-cookie-settings", open);
    return () => window.removeEventListener("open-cookie-settings", open);
  }, []);

  const save = (choice: { analytics: boolean; marketing: boolean }) => {
    const payload: CookieChoice = {
      necessary: true,
      analytics: choice.analytics,
      marketing: choice.marketing,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setAnalytics(choice.analytics);
    setMarketing(choice.marketing);
    setVisible(false);
    setSettingsOpen(false);

    window.dispatchEvent(new CustomEvent("cookie-consent-updated", { detail: payload }));
  };

  if (!visible) return null;

  return (
    <>
      <div style={styles.banner} role="dialog" aria-label="Cookie Hinweis">
        <div style={styles.text}>
          Diese Webseite verwendet notwendige Cookies. Optionale Cookies helfen uns, die Nutzung zu verbessern.
          <a href="/datenschutz" style={styles.link}> Datenschutzerklärung</a>
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.secondaryButton} onClick={() => save({ analytics: false, marketing: false })}>
            Ablehnen
          </button>
          <button type="button" style={styles.secondaryButton} onClick={() => setSettingsOpen(true)}>
            Einstellungen
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => save({ analytics: true, marketing: true })}>
            Akzeptieren
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal} role="dialog" aria-label="Cookie Einstellungen">
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Cookie-Einstellungen</h2>
              <button type="button" style={styles.closeButton} onClick={() => setSettingsOpen(false)}>×</button>
            </div>

            <p style={styles.modalText}>
              Sie können selbst entscheiden, welche optionalen Cookies verwendet werden dürfen.
              Notwendige Cookies sind für Login, Sicherheit und Grundfunktionen erforderlich.
            </p>

            <CookieRow
              title="Notwendige Cookies"
              description="Erforderlich für Betrieb, Sicherheit und Login."
              checked
              disabled
              onChange={() => {}}
            />

            <CookieRow
              title="Analyse-Cookies"
              description="Helfen, die Nutzung der Webseite zu verstehen und zu verbessern."
              checked={analytics}
              onChange={setAnalytics}
            />

            <CookieRow
              title="Marketing-Cookies"
              description="Derzeit nicht aktiv. Vorbereitung für mögliche spätere Dienste."
              checked={marketing}
              onChange={setMarketing}
            />

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => save({ analytics: false, marketing: false })}>
                Alle ablehnen
              </button>
              <button type="button" style={styles.secondaryButton} onClick={() => save({ analytics, marketing })}>
                Auswahl speichern
              </button>
              <button type="button" style={styles.primaryButton} onClick={() => save({ analytics: true, marketing: true })}>
                Alle akzeptieren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CookieRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={styles.cookieRow}>
      <span>
        <strong>{title}</strong>
        <span style={styles.cookieDescription}>{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: "fixed",
    left: "50%",
    bottom: 12,
    transform: "translateX(-50%)",
    width: "min(92vw, 620px)",
    background: "#26313f",
    color: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.22)",
    padding: "10px 12px",
    zIndex: 9999,
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
    lineHeight: 1.35,
  },
  text: {
    flex: 1,
    minWidth: 220,
  },
  link: {
    color: "#dbeafe",
    textDecoration: "underline",
    whiteSpace: "nowrap",
  },
  actions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    border: 0,
    borderRadius: 8,
    padding: "7px 10px",
    background: "#d9c7a3",
    color: "#10233a",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 8,
    padding: "7px 10px",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontWeight: 650,
    cursor: "pointer",
    fontSize: 12,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "min(92vw, 520px)",
    background: "#fffaf2",
    color: "#10233a",
    borderRadius: 18,
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
    padding: 18,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
  },
  closeButton: {
    border: 0,
    background: "transparent",
    fontSize: 28,
    cursor: "pointer",
    lineHeight: 1,
  },
  modalText: {
    fontSize: 13,
    color: "#48566a",
    lineHeight: 1.45,
    margin: "10px 0 14px",
  },
  cookieRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    border: "1px solid #eadfcc",
    background: "#ffffff",
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 8,
    fontSize: 13,
  },
  cookieDescription: {
    display: "block",
    color: "#657389",
    fontSize: 12,
    marginTop: 3,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
};
