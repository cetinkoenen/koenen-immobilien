# Buchungen Datensicherheit Fix

Geändert wurden nur Buchungs-Sicherheitsstellen:

- `src/pages/Monate.tsx`
  - Löschen/Sammel-Löschen ist jetzt Soft-Delete (`is_deleted = true`, `deleted_at = now`) statt echtes `DELETE`.

- `src/services/financeConsistencyEngine.ts`
  - Duplikatprüfung berücksichtigt jetzt auch das Notizfeld. Gleiche Beträge/Kategorien mit unterschiedlicher Notiz werden nicht mehr automatisch als Dublette gemeldet.

- `src/state/AppDataContext.tsx`
- `src/pages/Mietuebersicht.tsx`
- `src/features/entries/useMonthlyEntries.ts`
- `src/features/entries/EntryForm.tsx`
  - Gelöschte/Papierkorb-Buchungen werden aus normalen Auswertungen ausgeblendet.

- `sql/2026_finance_entry_data_safety.sql`
  - Supabase SQL-Sicherheitslayer: `is_deleted`, `deleted_at`, Audit/History-Tabelle, Trigger, Views und RLS-Policies.

Nach Deploy unbedingt die SQL-Datei einmal im Supabase SQL Editor ausführen.

Test:
- `npm run typecheck` erfolgreich.
- `npm run build` konnte im Container wegen fehlender optionaler Rollup-Abhängigkeit im vorhandenen `node_modules` nicht vollständig laufen (`@rollup/rollup-linux-x64-gnu`). Das ist ein bekanntes npm optional-dependency Problem und kein TypeScript-Fehler.
