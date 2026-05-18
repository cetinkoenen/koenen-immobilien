Update 2026-05-18 – Darlehensverlauf pro Objekt + Vergrößerung

Umgesetzt:
- Darlehensverlauf in den Objekt-Finanzmodulen robuster pro Immobilie zugeordnet.
- Neben property_loan_ledger werden Dashboard-/Portfolio-Dashboard-Werte als Fallback genutzt, damit z.B. Lilienthaler Str. nicht leer bleibt, wenn die Ledger-ID anders verknüpft ist.
- Zuordnung berücksichtigt core_property_id, portfolio_properties.id und bereinigten Objektnamen.
- Klick auf den Darlehensverlauf öffnet eine vergrößerte Detailansicht als Overlay.
- Test-/Trigger-/RLS-Objekte bleiben in der Objektliste ausgeblendet.

Geänderte Datei:
- src/pages/Auswertung.tsx

Prüfung:
- npm install erfolgreich
- npm run build erfolgreich
