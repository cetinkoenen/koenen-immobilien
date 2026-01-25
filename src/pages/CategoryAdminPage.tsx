import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type Category = {
  id: string; // UUID
  name: string;
  created_at: string;
};

export default function CategoryAdminPage() {

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setError(
          `Supabase: ${error.message}` +
            (error.code ? ` | code=${error.code}` : "") +
            (error.details ? ` | details=${error.details}` : "") +
            (error.hint ? ` | hint=${error.hint}` : "")
        );
      } else {
        setCategories((data ?? []) as Category[]);
      }
    } catch (e: any) {
      setError(`Thrown: ${e?.name ?? "Error"}: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const addCategory = async () => {
    if (!supabase) return;
    const name = newName.trim();
    if (!name) {
      setError("Bitte einen Namen eingeben.");
      return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name })
        .select("id,name,created_at")
        .single();

      if (error) {
        setError(
          `Supabase: ${error.message}` +
            (error.code ? ` | code=${error.code}` : "") +
            (error.details ? ` | details=${error.details}` : "") +
            (error.hint ? ` | hint=${error.hint}` : "")
        );
      } else if (data) {
        setCategories((prev) => [data as Category, ...prev]);
        setNewName("");
        setInfo("Kategorie hinzugefügt.");
      }
    } catch (e: any) {
      setError(`Thrown: ${e?.name ?? "Error"}: ${e?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!supabase) return;

    const ok = window.confirm("Kategorie wirklich löschen?");
    if (!ok) return;

    setError(null);
    setInfo(null);

    // optimistic UI
    const prev = categories;
    setCategories((p) => p.filter((c) => c.id !== id));

    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) {
        setCategories(prev); // rollback
        setError(
          `Supabase: ${error.message}` +
            (error.code ? ` | code=${error.code}` : "") +
            (error.details ? ` | details=${error.details}` : "") +
            (error.hint ? ` | hint=${error.hint}` : "")
        );
      } else {
        setInfo("Kategorie gelöscht.");
      }
    } catch (e: any) {
      setCategories(prev); // rollback
      setError(`Thrown: ${e?.name ?? "Error"}: ${e?.message ?? String(e)}`);
    }
  };

  const card: React.CSSProperties = {
    margin: "12px 0",
    padding: 14,
    border: "1px solid #ddd",
    borderRadius: 12,
    maxWidth: 900,
  };

  return (
    <div style={{ padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 46, margin: "0 0 12px" }}>Category Admin</h1>

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>ENV</div>
        {!supabase && (
          <div style={{ marginTop: 8, color: "crimson", fontWeight: 700 }}>
            Supabase ENV fehlt. Prüfe deine <code>.env</code> im Projekt-Root und starte Vite neu.
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Neue Kategorie</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="z. B. Garagen & Stellplätze"
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
              minWidth: 280,
              flex: "1 1 280px",
            }}
          />
          <button
            onClick={addCategory}
            disabled={!supabase || saving}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: saving ? "#eee" : "#111",
              color: saving ? "#111" : "#fff",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Speichern…" : "Hinzufügen"}
          </button>

          <button
            onClick={load}
            disabled={!supabase || loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Laden…" : "Neu laden"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "crimson", fontWeight: 700, whiteSpace: "pre-wrap" }}>
            Fehler: {error}
          </div>
        )}
        {info && <div style={{ marginTop: 12, color: "green", fontWeight: 700 }}>{info}</div>}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>
          Kategorien {loading ? "(lädt…)" : `(${categories.length})`}
        </div>

        {!loading && categories.length === 0 ? (
          <div>Keine Kategorien vorhanden.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {categories.map((c) => (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: "1px solid #eee",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    {new Date(c.created_at).toLocaleString()} • {c.id}
                  </div>
                </div>

                <button
                  onClick={() => deleteCategory(c.id)}
                  disabled={!supabase}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #c00",
                    background: "#fff",
                    color: "#c00",
                    cursor: "pointer",
                  }}
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
