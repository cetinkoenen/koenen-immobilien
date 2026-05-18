# Phase 5D – Frontend auf Backend-Finanzmaster umgestellt

Dieses Update bindet die in Phase 5C angelegte Supabase-Finance-Master-View/RPCs im Frontend an.

## Umgesetzt

- Neuer Hook `useBackendFinanceMaster(year)` lädt:
  - `get_property_finance_master(p_year)`
  - `get_property_finance_consistency(p_year)`
- `Auswertung.tsx` nutzt bevorzugt Backend-Finanzmaster-Werte für:
  - Single Source Center
  - Business Intelligence
  - Stabilitätscenter
- `Datenpruefung.tsx` nutzt bevorzugt Backend-Finanzmaster-Werte für:
  - Restschuld gesamt
  - Master-Objekte
  - kritische Hinweise
  - Cashflow
- `Portfolio.tsx` nutzt bevorzugt Backend-Finanzmaster-Werte für Einnahmen/Ausgaben/Mieteinnahmen.
- Frontend-Fallback bleibt erhalten, falls RPCs/Views nicht erreichbar sind.
- Button in Auswertung zum Refresh der Finance-Master-Materialized-Views ergänzt.

## Prüfung

- `npm run typecheck`: erfolgreich
- `npm run build`: im Container nicht vollständig möglich wegen Node 18/Rollup optional dependency. Lokal bitte mit Node 20.19+ prüfen.
