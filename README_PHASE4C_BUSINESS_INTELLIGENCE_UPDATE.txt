Phase 4C – Business Intelligence / Portfolioanalyse

Umgesetzt:
- Neuer Tab in Auswertungen: "Business Intelligence 4C"
- Portfolio-KPI-Cockpit: Portfolio-Cashflow, Restschuld gesamt, Capex gesamt, Maximalrisiko
- Objekt-Ranking nach Rendite, Cashflow und Risiko
- Vergleichsdiagramm je Objekt: Cashflow, Capex, Einnahmen
- Automatische Handlungsempfehlungen je Objekt
- Risiko-Score je Immobilie auf Basis von Cashflow, Restschuld, Einnahmen, Capex-Anteil und Datenhinweisen
- Ampellogik für Portfolio-Status und Objekt-Risiko

Geprüft:
- npm run typecheck erfolgreich
- Vollständiger Vite-Build im Container nicht ausführbar wegen Node 18/Rollup optional dependency; lokal bitte mit Node 20.19+ ausführen.
