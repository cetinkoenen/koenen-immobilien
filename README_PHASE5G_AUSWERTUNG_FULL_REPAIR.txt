Phase 5G · Auswertung Full Repair

Diese ZIP enthält eine Supabase-Migration, die die Auswertungs-Unterseiten wieder auf eine konsistente Objekt- und Finanzdatenbasis bringt.

Ausführen:
1. SQL aus supabase/migrations/20260519173000_phase5g_auswertung_full_repair.sql im Supabase SQL Editor ausführen.
2. Danach in der App hart neu laden.
3. Prüfen:
   select * from public.v_object_dropdown;
   select * from public.get_property_finance_master(2026);
   select * from public.get_koenen_data_quality_checks(2026);

Erwartung:
- v_object_dropdown enthält nur 6 Objekte und wieder die Spalte objekt_code.
- Backend 5B, Single Source 3A, Stabilität 3B, Automatisierung 2B, Archiv 2C und Objekt-Jahresübersicht bekommen wieder konsistente Werte.
- Bestehende Aufgaben/Dokumente/Audit-Zeilen werden auf die echten Property-IDs umgehängt.
