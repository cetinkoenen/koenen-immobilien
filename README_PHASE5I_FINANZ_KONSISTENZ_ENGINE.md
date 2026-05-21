# Phase 5I – Finanz-Konsistenz-Engine

## Ziel
Diese Phase macht die App stabiler, ohne sie komplizierter zu machen. Die Datenprüfung erkennt jetzt automatisch typische Fehlerquellen zwischen Buchungen, Miete, Jahreswerten, Portfolio und Darlehen.

## Umgesetzt

### 1. Neue zentrale Konsistenz-Engine
Neue Datei:

```text
src/services/financeConsistencyEngine.ts
```

Die Engine prüft:

- mögliche doppelte Buchungen
- Buchungen ohne Datum
- Buchungen mit unbekannter Objekt-ID
- fehlende Mieteingänge für vergangene/aktuelle Monate
- zukünftige Monate bleiben neutral und werden nicht rot markiert
- Abweichungen zwischen Jahres-View und Buchungen
- steigende Darlehenssalden im Ledger
- Abweichungen zwischen Portfolio-Restschuld und Darlehensdashboard

### 2. Datenprüfung erweitert
Geänderte Datei:

```text
src/pages/Datenpruefung.tsx
```

Neue Sektion:

```text
Phase 5I · Finanz-Konsistenz-Engine
```

Anzeige:

- Score in Prozent
- Anzahl kritischer Hinweise
- Anzahl Warnungen
- Status stabil/prüfen
- konkrete Hinweise mit nächstem Schritt

### 3. Keine neue Supabase-Migration erforderlich
Diese Phase ist bewusst frontendseitig umgesetzt. Es muss keine SQL-Migration ausgeführt werden.

## Build-Prüfung

Erfolgreich geprüft:

```bash
npm run typecheck
npm run build
```

Beide laufen erfolgreich.

## Hinweise
Der Vite-Build meldet weiterhin nur die bekannte Bundle-Size-Warnung. Das ist kein Funktionsfehler.
