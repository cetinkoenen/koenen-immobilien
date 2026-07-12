# Security Linter Follow-up

## Supabase Auth

Der Database-Advisor-Hinweis `auth_leaked_password_protection` kann nicht per SQL-Migration behoben werden.

Erforderlicher Dashboard-Schritt:

1. Supabase Dashboard oeffnen.
2. Auth > Security > Password Security oeffnen.
3. Leaked Password Protection aktivieren.
4. Passwortregeln pruefen und speichern.

Supabase dokumentiert diese Option in den Auth-Sicherheitseinstellungen. Die Funktion ist planabhaengig und verhindert neue oder geaenderte Passwoerter, die in bekannten Leak-Listen vorkommen.
