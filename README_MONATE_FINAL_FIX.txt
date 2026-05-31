Gezielter Fix für src/pages/Monate.tsx

Änderung:
- Monate lädt finance_entry jetzt ohne serverseitigen Datumsfilter.
- Monatsfilterung erfolgt ausschließlich clientseitig über booking_date YYYY-MM.
- Fallbacks auf v_finance_entry_norm, v_income_entries und v_expense_entries bleiben erhalten.

Nicht geändert:
- Portfolio
- Darlehen
- Mieterübersicht
- Buchungen-Seite
- Datenbankstruktur

Test:
- TypeScript typecheck erfolgreich.
- Vollständiger Vite-Build im Container wegen fehlender optionaler Rollup-Abhängigkeit im vorhandenen node_modules nicht ausführbar.
