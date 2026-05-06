export default function Datenschutz() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>Datenschutzerklärung</h1>

        <p>
          Diese Datenschutzerklärung informiert über die Verarbeitung personenbezogener Daten auf dieser Webseite.
          Bitte ergänzen und prüfen Sie die Angaben vor Veröffentlichung individuell.
        </p>

        <h2>1. Verantwortlicher</h2>
        <p>
          Cetin Könen und Nihal Könen<br />
          [Adresse ergänzen]<br />
          E-Mail: info.koenen@gmail.com<br />
          Telefon: +49 174 70 10 216
        </p>

        <h2>2. Zugriffsdaten / Hosting</h2>
        <p>
          Diese Webseite wird über Vercel bereitgestellt. Beim Aufruf der Webseite können technisch notwendige
          Zugriffsdaten verarbeitet werden, z. B. IP-Adresse, Datum und Uhrzeit des Abrufs, Browserinformationen
          und angefragte Seiten. Die Verarbeitung erfolgt zur sicheren und stabilen Bereitstellung der Webseite.
        </p>

        <h2>3. Cookies und ähnliche Technologien</h2>
        <p>
          Wir verwenden notwendige Cookies bzw. lokale Speichertechnologien, die für Grundfunktionen, Sicherheit
          und Login erforderlich sind. Optionale Analyse- oder Marketing-Cookies werden nur nach Ihrer Einwilligung
          verwendet.
        </p>

        <h2>4. Kontaktaufnahme</h2>
        <p>
          Wenn Sie uns per E-Mail oder Telefon kontaktieren, verarbeiten wir Ihre Angaben zur Bearbeitung Ihrer Anfrage.
        </p>

        <h2>5. Interner Bereich / Login</h2>
        <p>
          Der interne Bereich ist geschützt. Für Anmeldung, Sicherheit und Zugriffskontrolle können technisch notwendige
          Daten verarbeitet werden.
        </p>

        <h2>6. Rechtsgrundlagen</h2>
        <p>
          Die Verarbeitung erfolgt je nach Zweck insbesondere auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO
          (Vertrag/Anbahnung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherem Betrieb)
          und Art. 6 Abs. 1 lit. a DSGVO (Einwilligung bei optionalen Cookies).
        </p>

        <h2>7. Ihre Rechte</h2>
        <p>
          Sie haben nach Maßgabe der gesetzlichen Voraussetzungen Rechte auf Auskunft, Berichtigung, Löschung,
          Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Erteilte Einwilligungen können
          jederzeit widerrufen werden.
        </p>

        <h2>8. Beschwerderecht</h2>
        <p>
          Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.
        </p>

        <p style={styles.note}>
          Hinweis: Diese Vorlage ersetzt keine anwaltliche Prüfung. Bitte Adresse, Anbieter und tatsächlich eingesetzte
          Dienste final ergänzen.
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "48px 18px",
    background: "linear-gradient(135deg, #f4efe6, #fffaf2)",
    color: "#10233a",
  },
  card: {
    maxWidth: 920,
    margin: "0 auto",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid #eadfcc",
    borderRadius: 24,
    padding: "28px 32px",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
    lineHeight: 1.65,
  },
  note: {
    marginTop: 28,
    fontSize: 13,
    color: "#7a5d2f",
  },
};
