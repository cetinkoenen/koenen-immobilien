Nebenkosten-Modul – Update 2026-05-17

Umgesetzt:
1. Objektabhängige Ergebnisdarstellung:
   - Bei Mieter-Direktvertrag für Heizung/Gas werden Heizkosten-, Warmwasser- und CO2-Karten im Ergebnis ausgeblendet.
   - Für Elsasser, Fürther und Lilienthaler wird stattdessen ein Hinweis angezeigt: Heizung/Gas läuft direkt über den Mieter.
   - Colmarer behält die Heizkosten-/CO2-Anlage.

2. Druck/PDF verbessert:
   - Bei Direktvertrag-Objekten wird keine Heizkosten-/CO2-Anlage mehr gedruckt.
   - Bei Colmarer wird die Heizkosten-/CO2-Anlage weiterhin als Anlage erzeugt.
   - Druck enthält weiterhin Kostenarten, Anteilsberechnung, Vorauszahlungen, Saldo und Anlagen.

3. Export verbessert:
   - TXT-Export enthält bei Direktvertrag-Objekten keine CO2-Berechnung mehr.
   - Colmarer exportiert weiterhin Heizkosten-/CO2-Dokumentation.

4. Plausibilitätsprüfung erweitert:
   - Warnung, wenn bei Direktvertrag-Objekten trotzdem Heizkosten/CO2-Werte vorhanden sind.
   - Warnung, wenn bei Vermieter-Heizkostenabrechnung keine Heizkostenposition eingetragen ist.
   - Hinweis zu Thermenwartung/Schornsteinfeger bei Direktvertrag-Objekten.

5. Buchungsimport vorbereitet:
   - Neuer Button „Buchungen importieren“ bei Kostenarten.
   - Die App liest Buchungen aus finance_entry für Objekt + Abrechnungszeitraum.
   - Automatische Vorschlagslogik für umlagefähige Kostenarten.
   - Nicht umlagefähige Kosten wie Reparaturen, Rücklage, Verwalter, Bankgebühren, Darlehen werden ausgeschlossen.
   - Bei Direktvertrag-Objekten werden Gas/Heizkosten automatisch ausgeschlossen.
   - Importierte Kosten werden als Vorschläge hinzugefügt und müssen geprüft werden.

Wichtig:
- Nach dem Import bitte die Kostenarten immer prüfen.
- Die Vorschlagslogik ersetzt keine rechtliche Prüfung, sondern beschleunigt die Dateneingabe.
