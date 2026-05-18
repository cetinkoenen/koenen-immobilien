Update 2026-05-18 – Restschuld / Single Source of Truth

Umgesetzt:
1. Datenprüfung verwendet für die Gesamtsumme Restschuld jetzt exakt dieselbe AppData-/Portfolio-Quelle wie Portfolio → Objektübersicht.
2. Die Datenprüfung baut ihre Objektliste primär aus app.portfolioRows auf und ergänzt v_object_dropdown nur noch als Alias. Dadurch werden keine zusätzlichen/alten Objekte in die Restschuld-Gesamtsumme eingerechnet.
3. AppDataContext überschreibt Portfolio-Werte konsequent mit dem letzten property_loan_ledger-Wert.
4. Dabei wird jetzt nicht nur property_id, sondern auch portfolio_property_id geprüft. Damit werden Fälle abgefangen, in denen Portfolio und Darlehensledger unterschiedliche IDs referenzieren.
5. npm run build erfolgreich geprüft.

Betroffene Dateien:
- src/state/AppDataContext.tsx
- src/pages/Datenpruefung.tsx
