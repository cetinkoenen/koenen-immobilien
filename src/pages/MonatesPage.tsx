import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type MonatRow = {
  id: string; // UUID
  name?: string | null;
  monat?: string | null;
  month?: string | null;
  created_at?: string | null;
};

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; table: string; rows: MonatRow[] };

function env(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") {
  const v = import.meta.env[name] as string | undefined;
  return v?.trim() ? v.trim() : undefined;
}

async function findFirstExistingTable(
  supabase: SupabaseClient,
  candidates: string[]
): Promise<string> {
  // Try each candidate with a tiny select. If table doesn't exist, PostgREST returns an error.
  for (const t of candidates) {
    const { error } = await supabase.from(t).select("*").limit(1);
    if (!error) return t;
  }

  // If all failed, return first candidate (for better error message later)
  return candidates[0];
}

export default function Monate() {
  const supabaseUrl = env("VITE_SUPABASE_URL");
  const supabaseKey = env("VITE_SUPABASE_ANON_KEY");

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
  }, [supabaseUrl, supabaseKey]);

  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    const run = async () => {
      if (!supabase) return;

      setState({ status: "loading" });

      try {
        // Common table names we’ve seen in your project debugging:
        const table = await findFirstExistingTable(supabase, [
          "monate",
          "monates",
          "months",
          "monat",
        ]);

        const { data, error } = await supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          const msg =
            `Supabase Fehler bei Tabelle "${table}": ${error.message}` +
            (error.code ? ` | code=${error.code}` : "") +
            (error.details ? ` | details=${error.details}` : "") +
            (error.hint ? ` | hint=${error.hint}` : "");
          setState({ status: "error", message: msg });
          return;
        }

        setState({ status: "ready", table, rows: (data ?? []) as MonatRow[] });
      } catch (e: any) {
        setState({
          status: "error",
          message: `Thrown: ${e?.name ?? "Error"}: ${e?.message ?? String(e)}`,
        });
      }
    };

    run();
  }, [supabase]);

  const card: React.CSSProperties = {
    margin: "12px 0",
    padding: 14,
    border: "1px solid #ddd",
    borderRadius: 12,
    maxWidth: 900,
  };

  return (
    <div style={{ padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 44, margin: "0 0 10px" }}>Monate</h1>

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>ENV</div>
        <div>VITE_SUPABASE_URL: {supabaseUrl ? "✅ gesetzt" : "❌ fehlt"}</div>
        <div>VITE_SUPABASE_ANON_KEY: {supabaseKey ? "✅ gesetzt" : "❌ fehlt"}</div>
        {!supabase && (
          <div style={{ marginTop: 10, color: "crimson", fontWeight: 700 }}>
            Supabase ENV fehlt → bitte .env prüfen und Vite neu starten.
          </div>
        )}
      </div>

      <div style={card}>
        {state.status === "idle" && <div>Bereit.</div>}
        {state.status === "loading" && <div>Lade Monate…</div>}
        {state.status === "error" && (
          <div style={{ color: "crimson", fontWeight: 700, whiteSpace: "pre-wrap" }}>
            {state.message}
            <div style={{ marginTop: 10, color: "#333", fontWeight: 400 }}>
              Hinweise:
              <ul>
                <li>
                  Wenn da steht <code>schema cache</code> / <code>does not exist</code> → Tabelle heißt anders.
                </li>
                <li>
                  Wenn 0 Rows ohne Fehler → RLS filtert alles weg (SELECT-Policy checken).
                </li>
              </ul>
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              Quelle: Tabelle <code>{state.table}</code> ({state.rows.length} rows)
            </div>

            {state.rows.length === 0 ? (
              <p>Keine Monate vorhanden (oder RLS filtert).</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {state.rows.map((r) => {
                  const label =
                    r.name ?? r.monat ?? r.month ?? "(kein Name-Feld gefunden)";
                  return (
                    <li
                      key={r.id}
                      style={{
                        padding: "10px 0",
                        borderTop: "1px solid #eee",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{label}</div>
                        <div style={{ opacity: 0.7, fontSize: 13 }}>
                          id: {r.id}
                          {r.created_at ? ` • ${new Date(r.created_at).toLocaleString()}` : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
