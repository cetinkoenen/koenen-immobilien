// src/pages/portfolio/PortfolioRenting.tsx
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { normalizeUuid } from "../../lib/ids";

type PortfolioOutletContext = {
  corePropertyId?: string | null;
};

type Props = {
  /**
   * Optional: wenn PortfolioRenting direkt gerendert wird (z.B. in Tabs),
   * kann propertyId übergeben werden.
   * Wenn nicht gesetzt, wird corePropertyId aus dem OutletContext genutzt.
   */
  propertyId?: string;
};

type RentalRow = {
  id: string;
  property_id: string;

  // intern (bei euch z.B. "MONTHLY") – wir zeigen es NICHT in der UI
  rent_type: string | null;

  // Warmmiete (Kalt + Nebenkosten) – wird automatisch berechnet/gespeichert
  rent_monthly: number | null;

  // getrennte Felder
  kaltmiete_laut_mietvertrag: number | null;
  nebenkosten: number | null;

  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD

  notes: string | null;

  created_at: string;
  updated_at: string;
};

type RentalFormState = {
  id?: string; // edit

  kaltmiete: string;
  nebenkosten: string;

  start_date: string;
  end_date: string; // "" = open ended
};

function toNullableNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const normalized = v.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatNullableNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(n);
}

function prettyDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString();
}

function dayKey(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  return Math.floor(d.getTime() / 86400000);
}

function rangesOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null
): boolean {
  const aS = dayKey(aStart);
  const aE = aEnd ? dayKey(aEnd) : Number.POSITIVE_INFINITY;
  const bS = dayKey(bStart);
  const bE = bEnd ? dayKey(bEnd) : Number.POSITIVE_INFINITY;
  return aS <= bE && bS <= aE;
}

function CoreLinkMissingBox() {
  return (
    <div
      style={{
        border: "1px solid #fecaca",
        background: "#fff1f2",
        color: "#7f1d1d",
        padding: 12,
        borderRadius: 12,
        whiteSpace: "pre-wrap",
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      Dieses Portfolio-Objekt hat keine Verknüpfung zu properties (core_property_id ist leer).
      {"\n"}
      Lösung: In portfolio_properties eine Spalte core_property_id pflegen, die auf properties.id zeigt.
    </div>
  );
}

export default function PortfolioRenting({ propertyId }: Props) {
  const { corePropertyId } = useOutletContext<PortfolioOutletContext>();

  const resolvedId = propertyId ?? corePropertyId ?? "";

  const safeCorePropertyId = useMemo(() => {
    return normalizeUuid(String(resolvedId ?? "").trim());
  }, [resolvedId]);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<RentalRow[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [form, setForm] = useState<RentalFormState>({
    kaltmiete: "",
    nebenkosten: "",
    start_date: "",
    end_date: "",
  });

  const requestSeq = useRef(0);

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);
  const canOpenCreate = useMemo(
    () => !busy && !loading && Boolean(safeCorePropertyId),
    [busy, loading, safeCorePropertyId]
  );

  // ✅ Warmmiete (Kalt + NK) automatisch berechnen
  const warmmietePreview = useMemo(() => {
    const k = toNullableNumber(form.kaltmiete);
    const n = toNullableNumber(form.nebenkosten);
    if (k === null && n === null) return "";
    if (!form.kaltmiete.trim() && !form.nebenkosten.trim()) return "";
    return String((k ?? 0) + (n ?? 0));
  }, [form.kaltmiete, form.nebenkosten]);

  async function loadRenting() {
    if (!safeCorePropertyId) return;

    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("portfolio_property_rentals")
      .select(
        [
          "id",
          "property_id",
          "rent_type",
          "rent_monthly",
          "kaltmiete_laut_mietvertrag",
          "nebenkosten",
          "start_date",
          "end_date",
          "notes",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("property_id", safeCorePropertyId)
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (seq !== requestSeq.current) return;

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as RentalRow[]);
    setLoading(false);
  }

  useEffect(() => {
    // Reset between properties
    setRows([]);
    setError(null);
    setLoading(false);
    setBusy(false);
    setIsFormOpen(false);
    setForm({ kaltmiete: "", nebenkosten: "", start_date: "", end_date: "" });

    if (!safeCorePropertyId) return;
    void loadRenting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCorePropertyId]);

  function resetForm() {
    setForm({ kaltmiete: "", nebenkosten: "", start_date: "", end_date: "" });
  }

  function openCreate() {
    if (!safeCorePropertyId) return;
    resetForm();
    setIsFormOpen(true);
  }

  function openEdit(r: RentalRow) {
    setForm({
      id: r.id,
      kaltmiete: formatNullableNumber(r.kaltmiete_laut_mietvertrag),
      nebenkosten: formatNullableNumber(r.nebenkosten),
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    resetForm();
  }

  function validate(): string | null {
    if (!safeCorePropertyId) {
      return "Dieses Portfolio-Objekt hat keine Verknüpfung zu properties (core_property_id ist leer).";
    }

    if (!form.start_date.trim()) return "Bitte ein Anfangsdatum setzen.";

    const start = form.start_date.trim();
    const end = form.end_date.trim() || "";

    if (end && start > end) return "Anfangsdatum darf nicht nach Enddatum liegen.";

    const kRaw = form.kaltmiete.trim();
    if (kRaw && toNullableNumber(kRaw) === null) {
      return "Kaltmiete muss eine Zahl sein (z.B. 800 oder 800.50).";
    }

    const nRaw = form.nebenkosten.trim();
    if (nRaw && toNullableNumber(nRaw) === null) {
      return "Nebenkosten müssen eine Zahl sein (z.B. 200 oder 200.00).";
    }

    const newStart = start;
    const newEnd = end || null;

    const conflicting = rows.find((r) => {
      if (!r.start_date) return false;
      if (form.id && r.id === form.id) return false;
      return rangesOverlap(newStart, newEnd, r.start_date, r.end_date);
    });

    if (conflicting) {
      return `Zeitraum überschneidet sich mit bestehendem Eintrag (${conflicting.start_date} bis ${
        conflicting.end_date ?? "offen"
      }).`;
    }

    return null;
  }

  async function onSave() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    if (!safeCorePropertyId) return;

    setBusy(true);
    setError(null);

    const kaltmieteNum = toNullableNumber(form.kaltmiete);
    const nebenkostenNum = toNullableNumber(form.nebenkosten);

    // Warmmiete = Kalt + NK (wenn beide leer => null speichern)
    const hasAny = Boolean(form.kaltmiete.trim() || form.nebenkosten.trim());
    const warmmieteNum = hasAny ? (kaltmieteNum ?? 0) + (nebenkostenNum ?? 0) : null;

    const payload = {
      property_id: safeCorePropertyId,

      // intern beibehalten (UI zeigt es nicht)
      rent_type: "MONTHLY" as string | null,

      // Warmmiete
      rent_monthly: warmmieteNum,

      // getrennte Felder
      kaltmiete_laut_mietvertrag: kaltmieteNum,
      nebenkosten: nebenkostenNum,

      start_date: form.start_date.trim() || null,
      end_date: form.end_date.trim() || null,
      notes: null as string | null,
    };

    if (isEditing && form.id) {
      const { error } = await supabase
        .from("portfolio_property_rentals")
        .update(payload)
        .eq("id", form.id)
        .eq("property_id", safeCorePropertyId);

      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
    } else {
      const { error } = await supabase.from("portfolio_property_rentals").insert(payload);
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    closeForm();
    await loadRenting();
  }

  async function onDelete(rowId: string) {
    if (!safeCorePropertyId) return;

    const ok = window.confirm("Diesen Vermietungszeitraum wirklich löschen?");
    if (!ok) return;

    setBusy(true);
    setError(null);

    const { error } = await supabase
      .from("portfolio_property_rentals")
      .delete()
      .eq("id", rowId)
      .eq("property_id", safeCorePropertyId);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    await loadRenting();
  }

  if (!safeCorePropertyId) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Vermietung</div>
        {error ? (
          <div style={errorBox}>
            <strong>Fehler:</strong> {error}
          </div>
        ) : (
          <CoreLinkMissingBox />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>Vermietung</div>

      <div style={card}>
        <p style={{ margin: 0, opacity: 0.75 }}>
          Vermietungszeiträume protokollieren (alt + neu). Überschneidungen werden verhindert.
        </p>

        {error && (
          <div style={errorBox}>
            <strong>Fehler:</strong> {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>Vermietungszeiträume</div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={loadRenting} disabled={busy || loading} style={btnSecondary(busy || loading)}>
              Neu laden
            </button>

            <button onClick={openCreate} disabled={!canOpenCreate} style={btnPrimary(!canOpenCreate)}>
              + Neuer Zeitraum
            </button>
          </div>
        </div>

        {loading && <div>Lade Vermietung…</div>}

        {isFormOpen && (
          <div style={innerCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <strong>{isEditing ? "Zeitraum bearbeiten" : "Neuer Vermietungszeitraum"}</strong>

              <button onClick={closeForm} disabled={busy} style={btnSecondary(busy)}>
                Schließen
              </button>
            </div>

            {/* ✅ Maske: Kaltmiete + Nebenkosten (Typ entfernt) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={label}>
                <span>Miete (Kaltmiete)</span>
                <input
                  value={form.kaltmiete}
                  onChange={(e) => setForm((s) => ({ ...s, kaltmiete: e.target.value }))}
                  inputMode="decimal"
                  placeholder="z.B. 800"
                  disabled={busy}
                  style={input}
                />
                {form.kaltmiete.trim() && toNullableNumber(form.kaltmiete) === null && (
                  <small style={smallError}>Bitte eine gültige Zahl eingeben.</small>
                )}
              </label>

              <label style={label}>
                <span>Nebenkosten</span>
                <input
                  value={form.nebenkosten}
                  onChange={(e) => setForm((s) => ({ ...s, nebenkosten: e.target.value }))}
                  inputMode="decimal"
                  placeholder="z.B. 200"
                  disabled={busy}
                  style={input}
                />
                {form.nebenkosten.trim() && toNullableNumber(form.nebenkosten) === null && (
                  <small style={smallError}>Bitte eine gültige Zahl eingeben.</small>
                )}
              </label>

              <label style={label}>
                <span>Miete (Kalt + Nebenkosten) – automatisch</span>
                <input value={warmmietePreview} disabled style={{ ...input, background: "#f9fafb" }} />
                <small style={{ opacity: 0.65 }}>Wird automatisch gespeichert.</small>
              </label>

              <label style={label}>
                <span>Anfangsdatum</span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
                  disabled={busy}
                  style={input}
                />
              </label>

              <label style={label}>
                <span>Enddatum</span>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
                  disabled={busy}
                  style={input}
                />
                <small style={{ opacity: 0.65 }}>Leer lassen = läuft noch.</small>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={onSave} disabled={busy} style={btnPrimary(busy)}>
                {busy ? "Speichere…" : isEditing ? "Änderungen speichern" : "Zeitraum hinzufügen"}
              </button>
            </div>
          </div>
        )}

        {/* ✅ Tabelle: zeigt Warmmiete (Kalt + NK) */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={th}>Miete (Kalt + NK)</th>
                <th style={th}>Anfangsdatum</th>
                <th style={th}>Enddatum</th>
                <th style={th}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={td} colSpan={4}>
                    Noch keine Vermietungszeiträume.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  // Anzeige: bevorzugt rent_monthly (Warmmiete), sonst berechnen
                  const warm =
                    r.rent_monthly ??
                    (r.kaltmiete_laut_mietvertrag ?? 0) + (r.nebenkosten ?? 0);

                  return (
                    <tr key={r.id}>
                      <td style={td}>{Number.isFinite(warm as number) ? warm : "—"}</td>
                      <td style={td}>{prettyDate(r.start_date)}</td>
                      <td style={td}>{prettyDate(r.end_date)}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => openEdit(r)} disabled={busy} style={smallActionBtn}>
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => onDelete(r.id)}
                          disabled={busy}
                          style={{ ...smallActionBtn, marginLeft: 8 }}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Hinweis: Wenn du nach dem Update noch „Typ“ siehst, läuft noch ein alter Build/Cache.
          Bitte Dev-Server neu starten und Hard Reload machen.
        </div>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
  background: "white",
  display: "grid",
  gap: 14,
};

const innerCard: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "white",
  display: "grid",
  gap: 12,
};

const errorBox: CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,0,0,0.35)",
  background: "rgba(255,0,0,0.06)",
};

const label: CSSProperties = { display: "grid", gap: 6 };

const input: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};

const smallError: CSSProperties = { color: "rgba(220,38,38,0.9)" };

const th: CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 800,
};

const td: CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};

function btnSecondary(disabled: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function btnPrimary(disabled: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#111827",
    color: "white",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

const smallActionBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
  fontWeight: 600,
  cursor: "pointer",
};
