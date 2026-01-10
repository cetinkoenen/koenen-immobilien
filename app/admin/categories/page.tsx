"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Row = {
  category_key: string;
  de: string | null;
  en: string | null;
  missing_translation: boolean;
};

type Draft = {
  de: string;
  en: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error?: string;
};

export default function CategoriesAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const dirtyCount = useMemo(
    () => Object.values(drafts).filter((d) => d.dirty).length,
    [drafts]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyMissing && !r.missing_translation) return false;
      if (!q) return true;

      const d = drafts[r.category_key];
      const de = (d?.de ?? r.de ?? "").toLowerCase();
      const en = (d?.en ?? r.en ?? "").toLowerCase();

      return (
        r.category_key.toLowerCase().includes(q) ||
        de.includes(q) ||
        en.includes(q)
      );
    });
  }, [rows, drafts, query, onlyMissing]);

  function setDraft(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      return { ...prev, [key]: { ...cur, ...patch } };
    });
  }

  async function load() {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await supabase.from("v_category_admin").select("*");
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Row[];
    setRows(list);

    const nextDrafts: Record<string, Draft> = {};
    for (const r of list) {
      nextDrafts[r.category_key] = {
        de: r.de ?? "",
        en: r.en ?? "",
        dirty: false,
        saving: false,
        saved: false,
      };
    }
    setDrafts(nextDrafts);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveOne(categoryKey: string) {
    const d = drafts[categoryKey];
    if (!d) return;

    setDraft(categoryKey, { saving: true, error: undefined, saved: false });

    const { error } = await supabase.rpc("upsert_i18n_category", {
      p_category: categoryKey,
      p_de: d.de,
      p_en: d.en,
    });

    if (error) {
      setDraft(categoryKey, { saving: false, error: error.message, saved: false });
      return;
    }

    setDraft(categoryKey, { saving: false, dirty: false, saved: true });

    // Reload rows so "missing_translation" updates immediately
    await load();
  }

  async function saveAllDirty() {
    const keys = Object.entries(drafts)
      .filter(([, d]) => d.dirty && !d.saving)
      .map(([k]) => k);

    for (const k of keys) {
      // sequential to keep it simple
      // eslint-disable-next-line no-await-in-loop
      await saveOne(k);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Category Admin (DE/EN)</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Quelle: <code>finance_entry.category</code> • Pflege: <code>i18n_category</code>
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen (Key, DE, EN)…"
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          nur fehlende
        </label>

        <button
          onClick={saveAllDirty}
          disabled={dirtyCount === 0}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: dirtyCount === 0 ? "not-allowed" : "pointer",
            background: dirtyCount === 0 ? "#f6f6f6" : "white",
          }}
        >
          Save all ({dirtyCount})
        </button>

        <button
          onClick={load}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: "pointer",
            background: "white",
          }}
        >
          Refresh
        </button>
      </div>

      {loading && <div>Loading…</div>}

      {loadError && (
        <div style={{ padding: 12, background: "#ffecec", border: "1px solid #ffb3b3", borderRadius: 12 }}>
          <strong>Load error:</strong> {loadError}
          <div style={{ marginTop: 8, color: "#555" }}>
            Check: View <code>v_category_admin</code> existiert? RPC <code>upsert_i18n_category</code> existiert?
          </div>
        </div>
      )}

      {!loading && !loadError && (
        <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 0.6fr 0.9fr",
              background: "#fafafa",
              padding: 12,
              fontWeight: 600,
            }}
          >
            <div>category_key</div>
            <div>DE</div>
            <div>EN</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {filtered.map((r) => {
            const d = drafts[r.category_key];

            return (
              <div
                key={r.category_key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 1fr 0.6fr 0.9fr",
                  padding: 12,
                  borderTop: "1px solid #f0f0f0",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {r.category_key}
                </div>

                <input
                  value={d?.de ?? ""}
                  onChange={(e) =>
                    setDraft(r.category_key, { de: e.target.value, dirty: true, saved: false })
                  }
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                  placeholder="Deutsch…"
                />

                <input
                  value={d?.en ?? ""}
                  onChange={(e) =>
                    setDraft(r.category_key, { en: e.target.value, dirty: true, saved: false })
                  }
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                  placeholder="English…"
                />

                <div style={{ fontSize: 13 }}>
                  {d?.saving ? (
                    <span>saving…</span>
                  ) : d?.error ? (
                    <span style={{ color: "#b00020" }}>error</span>
                  ) : d?.saved ? (
                    <span style={{ color: "#0a7d2a" }}>saved</span>
                  ) : r.missing_translation ? (
                    <span style={{ color: "#b36b00" }}>missing</span>
                  ) : (
                    <span style={{ color: "#555" }}>ok</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => saveOne(r.category_key)}
                    disabled={!d || d.saving || (!d.dirty && !r.missing_translation)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      cursor: !d || d.saving || (!d.dirty && !r.missing_translation) ? "not-allowed" : "pointer",
                      background: "white",
                    }}
                  >
                    Save
                  </button>
                </div>

                {d?.error && (
                  <div style={{ gridColumn: "1 / -1", marginTop: 6, color: "#b00020", fontSize: 13 }}>
                    {d.error}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && <div style={{ padding: 16, color: "#666" }}>Keine Treffer.</div>}
        </div>
      )}
    </div>
  );
}
