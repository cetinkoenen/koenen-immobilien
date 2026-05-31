Gezielter Fix fuer src/pages/Monate.tsx

Problem:
- finance_entry ist nach Restore wieder gefuellt und Portfolio zeigt Werte.
- Monate blieb leer.

Aenderung:
- Die Monate-Seite laedt finance_entry nun jahresweise und filtert den Monat clientseitig.
- Dadurch werden Probleme mit PostgREST-Date-Filtern, View-Typen oder Zeitzonen vermieden.
- Fallback-Reihenfolge: finance_entry -> v_finance_entry_norm -> v_income_entries/v_expense_entries.
- Papierkorb/Restore/Backup-Funktionen bleiben erhalten.
- Andere Seiten wurden nicht geaendert.

Test:
- TypeScript typecheck erfolgreich.
- Vite build konnte im Container wegen fehlender optionaler Rollup-Abhaengigkeit im node_modules nicht abgeschlossen werden; das ist ein bekanntes npm optional dependency Problem, kein TypeScript-Fehler.
