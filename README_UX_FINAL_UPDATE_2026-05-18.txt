UX-Final-Update 2026-05-18

Umgesetzt:
1. Hauptnavigation weiter aufgeräumt: Die separate Automatisierung-Hauptseite wurde aus der oberen Navigation entfernt. Alte Links auf /automatisierung werden sauber zu /auswertungen weitergeleitet.
2. Auswertungen wurde als zentrales Auswertungscenter aufgebaut.
3. Unter Auswertungen gibt es jetzt eine Unterseiten-Navigation:
   - Finanzanalyse: bisherige Zeitraum-Auswertung mit KPIs, Diagrammen, Kostenstruktur, Objektvergleich und Top-Transaktionen.
   - Objekt-Jahresübersicht: bisherige Automatisierungs-/Prüfcenter-Funktion mit Jahreswerten, Mietcheck-Ampel, Cashflow, NK, Capex, Hausgeld/WEG und Liquiditätsverlauf je Objekt.
4. Die Funktionen aus Automatisierung wurden nicht gelöscht, sondern als wiederverwendbare Komponente eingebunden. Dadurch bleiben CSV-Export, Drucken/PDF, Mietcheck und Liquiditätsverlauf erhalten.
5. Seite Monate: Jahr-Filter ist zusätzlich im Tabellen-/Suchfilterbereich vorhanden, damit die Suche direkt mit Jahr, Typ, Kategorie und Zeilen pro Seite kombiniert werden kann.
6. MFA-TypeScript-Kompatibilität korrigiert, damit der Build mit aktuellen Supabase-Typen sauber läuft.

Geprüft:
- npm install
- npm run build erfolgreich

Hinweis:
- Vite meldet nur den üblichen Chunk-Size-Hinweis. Das ist kein Build-Fehler.
