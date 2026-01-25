// src/pages/EntryAdd.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";


type DropdownRow = {
  value: string; // object_id (uuid)
  objekt_code: string;
  label: string; // "Objekt X – Straße"
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseNumberInput(raw: string): number {
  const normalized = raw.replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export default function EntryAdd() {
  const [objects, setObjects] = useState<DropdownRow[]>([]);
  const [objectId, setObjectId] = useState<string>(""); // object_id als String (UUID)
  const [objektCodePreview, setObjektCodePreview] = useState<string>("");

  const [kind, setKind] = useState<"income" | "expense">("income");
  const [bookingDate, setBookingDate] = useState(() => toISODate(new Date()));
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const amountNumber = useMemo(() => parseNumberInput(amount), [amount]);

  useEffect(() => {
    let alive = true;

    (async () => {
      // ✅ Dropdown kommt aus v_object_dropdown:
      // - enthält ALLE Objekte (auch ohne Buchungen)
      // - enthält label "Objekt X – Straße"
      // - value = object_id (UUID) für finance_entry.object_id
      const { data, error } = await supabase
        .from("v_object_dropdown")
        .select("value,objekt_code,label")
        .order("label", { ascending: true });

      if (!alive) return;

      if (error) {
        setMsg(`❌ Fehler Objekt-Dropdown laden: ${error.message}`);
        setObjects([]);
        return;
      }

      const list = (data ?? []).filter((x: any) => x?.value && x?.objekt_code && x?.label) as DropdownRow[];
      setObjects(list);

      // Default: erstes Objekt
      if (!objectId && list.length > 0) {
        setObjectId(String(list[0].value));
        setObjektCodePreview(list[0].objekt_code);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSelectObject(newId: string) {
    setObjectId(newId);
    const obj = objects.find((o) => String(o.value) === String(newId));
    setObjektCodePreview(obj ? obj.objekt_code : "");
  }

  async function save() {
    setMsg(null);

    if (!objectId) return setMsg("❌ Bitte Objekt auswählen.");
    if (!bookingDate) return setMsg("❌ Bitte Datum auswählen.");
    if (!amount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      return setMsg("❌ Bitte einen gültigen Betrag > 0 eingeben.");
    }

    setSaving(true);
    try {
      const payload = {
        object_id: objectId,
        objekt_code: objektCodePreview || null, // ✅ damit in v_finance_entry_norm nicht NULL ist
        entry_type: kind,
        booking_date: bookingDate,
        amount: amountNumber,
        category: category.trim() || null,
        note: note.trim() || null,
      };

      const { error } = await supabase.from("finance_entry").insert(payload);
      if (error) throw error;

      setMsg("✅ Gespeichert! (Jetzt in Übersicht/Monate/Auswertung neu laden)");
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
    <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Buchung erfassen</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Neue Einnahme oder Ausgabe hinzufügen (neue Funktion – bestehendes bleibt stabil).
        </div>
      </div>

      {msg && (
        <div
          style={{
            border: msg.startsWith("❌") ? "1px solid #fecaca" : "1px solid #e5e7eb",
            background: msg.startsWith("❌") ? "#fff1f2" : "#f9fafb",
            color: msg.startsWith("❌") ? "#7f1d1d" : "inherit",
            padding: 12,
            borderRadius: 12,
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Objekt
          <select
            value={objectId}
            onChange={(e) => onSelectObject(e.target.value)}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontWeight: 800,
              background: "white",
            }}
          >
            {objects.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.65 }}>
            Objekt-Code: <b>{objektCodePreview || "—"}</b>
          </div>
        </label>

        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Typ
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "income" | "expense")}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontWeight: 800,
              background: "white",
            }}
          >
            <option value="income">Einnahme</option>
            <option value="expense">Ausgabe</option>
          </select>
        </label>

        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Datum
          <input
            type="date"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontWeight: 800,
            }}
          />
        </label>

        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Betrag (EUR)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="z.B. 123,45"
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontWeight: 800,
            }}
          />
        </label>

        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Kategorie
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="z.B. Miete / Strom / Reparatur"
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontWeight: 800,
            }}
          />
        </label>

        <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
          Notiz
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional"
            style={{
              marginTop: 6,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontWeight: 800,
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => void save()}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: saving ? "#f3f4f6" : "white",
            fontWeight: 900,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>

        <button
          onClick={() => {
            setAmount("");
            setCategory("");
            setNote("");
            setMsg(null);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Leeren
        </button>
      </div>
    </div>
  );
}
