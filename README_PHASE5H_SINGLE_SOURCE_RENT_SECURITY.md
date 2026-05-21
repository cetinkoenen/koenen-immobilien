# Phase 5H – Vereinfachung, Sicherheit und einheitliche Mietlogik

## Umgesetzt

1. **Einheitliche Mietmonatslogik im Frontend**
   - Zahlungen mit Miet-/Pachtbezug ab dem 25. eines Monats werden im AppDataContext als Miete für den Folgemonat gezählt.
   - Dadurch verwenden Mieterübersicht, Monatsauswertungen und AppDataContext dieselbe Hausverwaltungslogik.

2. **Cache-Bereinigung vereinheitlicht**
   - Neue zentrale Datei: `src/lib/appCache.ts`.
   - Neuer Cache-Key: `koenen:app-data-cache:v7`.
   - Alte Cache-Keys v2 bis v6 werden bei Änderungen automatisch entfernt.
   - Buchungen in `EntryAdd.tsx` und `Monate.tsx` löschen jetzt sauber den zentralen App-Cache.

3. **Login sicherer gemacht**
   - Registrierung aus der Login-Seite entfernt.
   - Die App zeigt jetzt klar, dass es sich um einen privaten Verwaltungszugang handelt.
   - Login bleibt weiterhin über Supabase Auth/MFA geschützt.

4. **SQL-Migration ergänzt**
   - Neue Migration: `supabase/migrations/20260521073000_single_source_rent_month_rule.sql`.
   - Aktualisiert `v_mieteingaenge_monat` so, dass die 25.-des-Monats-Regel auch im Backend gilt.
   - Erfasst Miet- und Pachtbezug über Kategorie und Notiz.

## Prüfung

- `npm run typecheck` erfolgreich.
- `npm run build` erfolgreich nach sauberer Neuinstallation der Dependencies.

## Hinweis

Die SQL-Migration muss noch in Supabase ausgeführt werden, damit die Backend-View dieselbe Mietlogik verwendet wie das Frontend.
