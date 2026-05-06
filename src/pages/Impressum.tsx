export default function Impressum() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>Impressum</h1>

        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          Cetin Könen und Nihal Könen<br />
          [Adresse ergänzen]<br />
          Deutschland
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: info.koenen@gmail.com<br />
          Telefon: +49 174 70 10 216
        </p>

        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          Cetin Könen und Nihal Könen<br />
          [Adresse ergänzen]
        </p>

        <h2>Haftung für Inhalte</h2>
        <p>
          Die Inhalte dieser Webseite wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit
          und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr.
        </p>

        <h2>Haftung für Links</h2>
        <p>
          Diese Webseite kann Links zu externen Webseiten enthalten. Auf deren Inhalte haben wir keinen Einfluss.
          Für fremde Inhalte übernehmen wir keine Gewähr.
        </p>

        <h2>Urheberrecht</h2>
        <p>
          Die auf dieser Webseite erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht.
        </p>

        <p style={styles.note}>
          Bitte vor Veröffentlichung Adresse und ggf. Rechtsform/USt-ID ergänzen. Diese Vorlage ersetzt keine anwaltliche Prüfung.
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
    maxWidth: 860,
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
