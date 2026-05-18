Update: Objekt-Finanzmodule wiederhergestellt

Umgesetzt:
- Die früher unter "Objekte" sichtbaren Bereiche sind jetzt unter Portfolio -> jeweilige Immobilie wieder direkt als eigene Buttons/Unterseiten sichtbar:
  - Objektakte gesamt
  - Darlehensübersicht / Edit
  - Finance pro Jahr
  - Income
  - Capex
- Die bestehenden Komponenten, Datenquellen und Berechnungen wurden nicht ersetzt, sondern nur wieder sauber in die neue Portfolio-Navigation eingebunden.
- Zusätzlich wurde unter Auswertungen ein Bereich "Objekt-Finanzmodule" ergänzt. Dort sind alle Portfolio-Immobilien mit Direktbuttons zu Darlehensübersicht/Edit, Finance pro Jahr, Income und Capex aufgelistet.
- Alte /objekte/:propertyId-Routen leiten weiterhin sauber auf Portfolio weiter.

Prüfung:
- npm install erfolgreich
- npm run build erfolgreich
