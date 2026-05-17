# NK-Buchungsimport mit Supabase-Speicherung

Diese Version speichert die automatische Zuordnung echter `finance_entry`-Buchungen zusätzlich in Supabase.

## Neu

- Tabelle `finance_entry_billing_metadata`
- Import merkt sich pro Buchung:
  - umlagefähig ja/nein
  - NK-Kostenart
  - Umlageschlüssel
  - Abrechnungszeitraum
  - Importstatus / Prüfstatus
  - Grund, warum eine Buchung nicht übernommen wurde
- Wenn die Tabelle noch nicht existiert, funktioniert der Import weiter, zeigt aber einen Hinweis.

## Supabase-Schritt

Vor Deployment im Supabase SQL Editor ausführen:

```sql
-- Datei: supabase/migrations/20260517_nk_billing_metadata.sql
```

Danach Vercel deployen.
