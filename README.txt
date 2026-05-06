Einbau:
1. App.tsx nach src/App.tsx kopieren/ersetzen.
2. CookieConsent.tsx nach src/components/CookieConsent.tsx kopieren/ersetzen.
3. npm run build ausführen.

Premium DSGVO:
- kleiner Cookie-Banner unten
- Akzeptieren / Ablehnen / Einstellungen
- Kategorien: notwendig, Analyse, Marketing
- Widerruf möglich über window.dispatchEvent(new Event("open-cookie-settings")) oder Datenschutzseite
- Consent-Hooks: hasAnalyticsConsent(), hasMarketingConsent()
