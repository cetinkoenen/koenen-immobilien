import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, FileUp, PlusCircle, Route, Trash2 } from "lucide-react";

import {
  calculateMileageAmount,
  deleteMileageTrip,
  MILEAGE_TRIP_REASONS,
  openMileageReceipt,
  saveMileageTrip,
  uploadMileageReceipt,
  type MileageTripReason,
  type MileageTripRow,
} from "../services/mileageTripService";
import { parseLocaleNumber } from "../utils/numberParser";

type MileageTripBookProps = {
  propertyId: string;
  portfolioPropertyId?: string | null;
  propertyLabel: string;
  propertyAddress: string;
  trips: MileageTripRow[];
  loading?: boolean;
  isAdmin: boolean;
  onChanged: () => Promise<void> | void;
};

type MileageForm = {
  datum: string;
  grund: MileageTripReason;
  start_adresse: string;
  zieladresse: string;
  distanz_km: string;
  hin_und_rueckfahrt: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

function eur(value: number) {
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function dateDE(value: string) {
  if (!value) return "–";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export function MileageTripBook({
  propertyId,
  portfolioPropertyId,
  propertyLabel,
  propertyAddress,
  trips,
  loading,
  isAdmin,
  onChanged,
}: MileageTripBookProps) {
  const [form, setForm] = useState<MileageForm>({
    datum: today(),
    grund: "Kontrollfahrt",
    start_adresse: "",
    zieladresse: propertyAddress,
    distanz_km: "",
    hin_und_rueckfahrt: true,
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const calculatedAmount = useMemo(
    () => calculateMileageAmount(form.distanz_km, form.hin_und_rueckfahrt),
    [form.distanz_km, form.hin_und_rueckfahrt],
  );
  const totalAmount = useMemo(() => trips.reduce((sum, trip) => sum + trip.berechneter_betrag, 0), [trips]);
  const totalDistance = useMemo(
    () => trips.reduce((sum, trip) => sum + trip.distanz_km * (trip.hin_und_rueckfahrt ? 2 : 1), 0),
    [trips],
  );

  function update<K extends keyof MileageForm>(key: K, value: MileageForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || saving) return;
    const distance = parseLocaleNumber(form.distanz_km, 0);
    if (!form.datum || !form.start_adresse.trim() || !form.zieladresse.trim() || distance <= 0) {
      setStatus("Bitte Datum, Start, Ziel und Distanz vollständig erfassen.");
      return;
    }

    setSaving(true);
    setStatus("Speichert Fahrt...");
    try {
      const belegUrl = receiptFile ? await uploadMileageReceipt(propertyId, receiptFile) : null;
      await saveMileageTrip({
        property_id: propertyId,
        portfolio_property_id: portfolioPropertyId ?? null,
        property_label: propertyLabel,
        datum: form.datum,
        grund: form.grund,
        start_adresse: form.start_adresse,
        zieladresse: form.zieladresse,
        distanz_km: distance,
        hin_und_rueckfahrt: form.hin_und_rueckfahrt,
        beleg_url: belegUrl,
      });
      setForm({
        datum: today(),
        grund: "Kontrollfahrt",
        start_adresse: form.start_adresse,
        zieladresse: propertyAddress,
        distanz_km: "",
        hin_und_rueckfahrt: true,
      });
      setReceiptFile(null);
      await onChanged();
      setStatus("Fahrt gespeichert und für Anlage V vorbereitet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Fahrt konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return;
    const confirmed = window.confirm("Diese Fahrt wirklich löschen?");
    if (!confirmed) return;
    setStatus("Löscht Fahrt...");
    try {
      await deleteMileageTrip(id);
      await onChanged();
      setStatus("Fahrt gelöscht.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Fahrt konnte nicht gelöscht werden.");
    }
  }

  return (
    <section id="fahrtenbuch" className="rounded-[18px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#255f6f]">
            <Route size={19} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Fahrtkosten-Rechner</p>
            <h2 className="text-xl font-black text-slate-950">Fahrtenbuch</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
              Fahrten werden mit 0,30 EUR pro Kilometer berechnet und automatisch dem Steuerjahr zugeordnet.
            </p>
          </div>
        </div>
        <div className="grid gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Summe Werbungskosten</span>
          <strong className="text-xl font-black text-emerald-800">{eur(totalAmount)}</strong>
          <span className="text-xs font-bold text-emerald-700">{totalDistance.toLocaleString("de-DE")} km abgerechnet</span>
        </div>
      </div>

      <div className="grid gap-5 bg-slate-50/70 p-5 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <PlusCircle size={18} className="text-[#255f6f]" />
            <h3 className="text-base font-black text-slate-950">Neue Fahrt hinzufügen</h3>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Datum
              <input
                type="date"
                value={form.datum}
                disabled={!isAdmin}
                onChange={(event) => update("datum", event.target.value)}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Grund
              <select
                value={form.grund}
                disabled={!isAdmin}
                onChange={(event) => update("grund", event.target.value as MileageTripReason)}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {MILEAGE_TRIP_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Start-Adresse
              <input
                value={form.start_adresse}
                disabled={!isAdmin}
                onChange={(event) => update("start_adresse", event.target.value)}
                placeholder="z. B. Zuhause / Büro"
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Ziel-Adresse
              <input
                value={form.zieladresse}
                disabled={!isAdmin}
                onChange={(event) => update("zieladresse", event.target.value)}
                placeholder="Objektadresse"
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-black text-slate-700">
                Einfache Strecke in km
                <input
                  inputMode="decimal"
                  value={form.distanz_km}
                  disabled={!isAdmin}
                  onChange={(event) => update("distanz_km", event.target.value)}
                  placeholder="z. B. 18,5"
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700">
                <input
                  type="checkbox"
                  checked={form.hin_und_rueckfahrt}
                  disabled={!isAdmin}
                  onChange={(event) => update("hin_und_rueckfahrt", event.target.checked)}
                  className="h-4 w-4"
                />
                Hin/Rück
              </label>
            </div>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              Beleg / Foto optional
              <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-sm font-bold text-slate-500">
                <FileUp size={16} />
                <input
                  type="file"
                  disabled={!isAdmin}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setReceiptFile(event.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              </span>
            </label>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">Berechneter Betrag</p>
              <p className="mt-1 text-xl font-black text-blue-900">{eur(calculatedAmount)}</p>
            </div>
            <button
              type="submit"
              disabled={!isAdmin || saving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#255f6f] px-4 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {saving ? "Speichert..." : "Fahrt speichern"}
            </button>
            {status ? <p className="text-sm font-bold text-slate-500">{status}</p> : null}
          </div>
        </form>

        <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-base font-black text-slate-950">Fahrten für diese Immobilie</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">Neueste Fahrt zuerst, mit Belegnachweis für das Finanzamt.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Grund</th>
                  <th className="px-4 py-3">Strecke</th>
                  <th className="px-4 py-3">km</th>
                  <th className="px-4 py-3">Betrag</th>
                  <th className="px-4 py-3">Beleg</th>
                  <th className="px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 font-black text-slate-950">{dateDE(trip.datum)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{trip.grund}</td>
                    <td className="px-4 py-3 font-bold text-slate-500">
                      <span className="block text-slate-700">{trip.start_adresse}</span>
                      <span className="block">→ {trip.zieladresse}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">
                      {(trip.distanz_km * (trip.hin_und_rueckfahrt ? 2 : 1)).toLocaleString("de-DE")}
                      <span className="block text-xs text-slate-500">{trip.hin_und_rueckfahrt ? "Hin/Rück" : "Einfach"}</span>
                    </td>
                    <td className="px-4 py-3 font-black text-emerald-700">{eur(trip.berechneter_betrag)}</td>
                    <td className="px-4 py-3">
                      {trip.beleg_url ? (
                        <button type="button" onClick={() => void openMileageReceipt(trip.beleg_url ?? "")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                          <Download size={14} /> Öffnen
                        </button>
                      ) : (
                        <span className="font-bold text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => void handleDelete(trip.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Trash2 size={14} /> Löschen
                      </button>
                    </td>
                  </tr>
                ))}
                {!trips.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                      {loading ? "Fahrten werden geladen..." : "Noch keine Fahrten für diese Immobilie erfasst."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
