# Buchungen-Datensicherung Update – 31.05.2026

Dieses Update ändert bewusst nur die Buchungs-Datensicherheit.

## Geändert

1. `finance_entry` wird durch eine Supabase-Migration geschützt:
   - jede neue Buchung wird in `finance_entry_audit` protokolliert,
   - jede Änderung wird mit altem und neuem Wert protokolliert,
   - Hard-Deletes aus `finance_entry` werden blockiert.

2. Die Monate-Seite löscht Buchungen nicht mehr direkt.
   - Stattdessen erscheint ein Hinweis, dass Buchungen geschützt sind.
   - Korrekturen sollen über Bearbeiten oder Gegenbuchung erfolgen.

3. Die automatische Konsistenzprüfung meldet Buchungen nur noch als mögliche Dublette, wenn auch die Notiz identisch ist.
   - Gleicher Betrag und gleiche Kategorie mit unterschiedlicher Notiz wird nicht mehr als Dublette bewertet.

## Nicht geändert

- Portfolio
- Darlehen
- Mieterübersicht
- Auswertung
- Aufgaben
- Dokumente
- Exposé
- Navigation/Layout

## Wichtig

Die Migration `supabase/migrations/20260531190000_finance_entry_data_protection.sql` muss in Supabase ausgeführt werden, damit der Datenbankschutz aktiv ist.
