import type { CSSProperties } from "react";

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: 24,
  },
  hero: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 28,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.05,
  },
  text: {
    margin: "14px 0 0",
    fontSize: 16,
    lineHeight: 1.7,
    color: "#475569",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#111827",
  },
  list: {
    margin: "16px 0 0",
    paddingLeft: 18,
    color: "#334155",
    lineHeight: 1.7,
    fontSize: 14,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    marginTop: 16,
  },
};

export default function NebenkostenWohnungen() {
  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Nebenkostenabrechnungen für Wohnungen</h1>
        <p style={styles.text}>
          Diese Seite ist bereits vorbereitet. Sobald du mir die nächste Vorlage gibst, baue ich hier die gleiche Logik wie bei den Tiefgaragenstellplätzen auf – inklusive Eingabemaske, automatischer Berechnung und Onepager für Mieter.
        </p>
        <div style={styles.badge}>Vorbereitete Platzhalter-Seite</div>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Geplante Bausteine</h2>
          <ul style={styles.list}>
            <li>Abrechnungslogik nach deiner Wohnungs-Vorlage</li>
            <li>Jahresbezogene Datensätze und automatische Verteilung</li>
            <li>Onepager / PDF-Ausgabe für Mieter</li>
          </ul>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Bereits vorbereitet</h2>
          <ul style={styles.list}>
            <li>Eigene Route und eigener Menüpunkt über das Dashboard</li>
            <li>Platz für Kopf-, Kosten- und Verteilungstabellen</li>
            <li>Saubere Trennung von TG und Wohnungsabrechnungen</li>
          </ul>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Nächster Schritt</h2>
          <ul style={styles.list}>
            <li>Vorlage für Wohnungen senden</li>
            <li>Gewünschte Kostenarten und Verteilerschlüssel definieren</li>
            <li>Danach dieselbe Automatik wie auf der TG-Seite aktivieren</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
