import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { emitFinanceEntryChanged } from "../state/AppDataContext";

type DropdownRow = {
  value: string; // object_id (uuid)
  objekt_code: string;
  label: string; // "Objekt X – Straße"
};

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseNumberInput(raw: string): number {
  const normalized = raw.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function panelStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  };
}

function fieldLabelStyle(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.75,
    display: "block",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    marginTop: 6,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    fontWeight: 800,
    background: "#ffffff",
  };
}

export default function EntryAdd() {
  const [objects, setObjects] = useState<DropdownRow[]>([]);
  const [objectId, setObjectId] = useState<string>("");
  const [objektCodePreview, setObjektCodePreview] = useState<string>("");

  const [kind, setKind] = useState<"income" | "expense">("income");
  const [bookingDate, setBookingDate] = useState<string>(() => toISODate(new Date()));
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [saving, setSaving] = useState<boolean>(false);
  const [loadingObjects, setLoadingObjects] = useState<boolean>(true);
  const [msg, setMsg] = useState<string | null>(null);

  const amountNumber = useMemo(() => parseNumberInput(amount), [amount]);

  useEffect(() => {
    let alive = true;

    async function loadObjects() {
      setLoadingObjects(true);

      const { data, error } = await supabase
        .from("v_object_dropdown")
        .select("value,objekt_code,label")
        .order("label", { ascending: true });

      if (!alive) return;

      if (error) {
        setMsg(`❌ Fehler beim Laden der Objektliste: ${error.message}`);
        setObjects([]);
        setLoadingObjects(false);
        return;
      }

      const list = (data ?? []).filter(
        (x: any) => x?.value && x?.objekt_code && x?.label
      ) as DropdownRow[];

      setObjects(list);

      if (!objectId && list.length > 0) {
        setObjectId(String(list[0].value));
        setObjektCodePreview(list[0].objekt_code);
      }

      setLoadingObjects(false);
    }

    void loadObjects();

    return () => {
      alive = false;
    };
  }, [objectId]);

  function onSelectObject(newId: string) {
    setObjectId(newId);
    const selected = objects.find((o) => String(o.value) === String(newId));
    setObjektCodePreview(selected ? selected.objekt_code : "");
  }

  function resetForm() {
    setAmount("");
    setCategory("");
    setNote("");
    setMsg(null);
  }

  async function save() {
    setMsg(null);

    if (!objectId) {
      setMsg("❌ Bitte ein Objekt auswählen.");
      return;
    }

    if (!bookingDate) {
      setMsg("❌ Bitte ein Datum auswählen.");
      return;
    }

    if (!amount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMsg("❌ Bitte einen gültigen Betrag größer als 0 eingeben.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        object_id: objectId,
        objekt_code: objektCodePreview || null,
        entry_type: kind,
        booking_date: bookingDate,
        amount: amountNumber,
        category: category.trim() || null,
        note: note.trim() || null,
      };

      const { error } = await supabase.from("finance_entry").insert(payload);

      if (error) {
        throw error;
      }

      window.localStorage.removeItem("koenen:app-data-cache:v2");
      emitFinanceEntryChanged();
      setMsg("✅ Buchung erfolgreich gespeichert. Mieterübersicht und Auswertungen werden aktualisiert.");
      setAmount("");
      setCategory("");
      setNote("");
    } catch (e: any) {
      setMsg(`❌ Speichern fehlgeschlagen: ${e?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24,
        display: "grid",
        gap: 18,
      }}
    >
      <header>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 950,
            letterSpacing: "-0.03em",
            color: "#111827",
          }}
        >
          Buchung erfassen
        </h1>

        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 15 }}>
          Neue Einnahme oder Ausgabe für ein Objekt anlegen
        </div>
      </header>

      {msg && (
        <div
          style={{
            border: msg.startsWith("❌") ? "1px solid #fecaca" : "1px solid #d1fae5",
            background: msg.startsWith("❌") ? "#fff1f2" : "#ecfdf5",
            color: msg.startsWith("❌") ? "#7f1d1d" : "#065f46",
            padding: 12,
            borderRadius: 12,
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </div>
      )}

      <section
        style={{
          ...panelStyle(),
          padding: 18,
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          <label style={fieldLabelStyle()}>
            Objekt
            <select
              value={objectId}
              onChange={(e) => onSelectObject(e.target.value)}
              style={inputStyle()}
              disabled={loadingObjects || objects.length === 0}
            >
              {objects.length === 0 ? (
                <option value="">Keine Objekte gefunden</option>
              ) : (
                objects.map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>
                    {o.label}
                  </option>
                ))
              )}
            </select>

            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.65 }}>
              Objekt-Code: <b>{objektCodePreview || "—"}</b>
            </div>
          </label>

          <label style={fieldLabelStyle()}>
            Typ
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "income" | "expense")}
              style={inputStyle()}
            >
              <option value="income">Einnahme</option>
              <option value="expense">Ausgabe</option>
            </select>
          </label>

          <label style={fieldLabelStyle()}>
            Datum
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              style={inputStyle()}
            />
          </label>

          <label style={fieldLabelStyle()}>
            Betrag (EUR)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="z. B. 123,45"
              style={inputStyle()}
            />
          </label>

          <label style={fieldLabelStyle()}>
            Kategorie
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z. B. Miete / Strom / Reparatur"
              style={inputStyle()}
            />
          </label>

          <label style={fieldLabelStyle()}>
            Notiz
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="optional"
              style={inputStyle()}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Leeren
          </button>
        </div>
      </section>
    </div>
  );
}