import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Building2, Filter, Save, Trash2 } from "lucide-react";

import { useAppData } from "../state/AppDataContext";
import {
  archiveVacancy,
  createVacancy,
  effectiveVacancyStartDate,
  effectiveVacancyStatusForRange,
  isVacancyEffectivelyActiveInRange,
  listVacancies,
  type UnitVacancy,
  type VacancyStatus,
} from "../services/vacancyService";

type FormState = {
  propertyId: string;
  unitLabel: string;
  startDate: string;
  endDate: string;
  reason: string;
  notes: string;
};

type StatusFilter = VacancyStatus | "all";

const todayIso = new Date().toISOString().slice(0, 10);

const emptyForm: FormState = {
  propertyId: "",
  unitLabel: "",
  startDate: todayIso,
  endDate: "",
  reason: "",
  notes: "",
};

function formatDate(value: string | null): string {
  if (!value) return "offen";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("de-DE").format(date);
}

function statusLabel(status: VacancyStatus): string {
  if (status === "planned") return "Geplant";
  if (status === "ended") return "Beendet";
  return "Aktiv";
}

function statusClass(status: VacancyStatus): string {
  if (status === "planned") return "bg-blue-50 text-blue-800 border-blue-100";
  if (status === "ended") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-zinc-100 text-zinc-800 border-zinc-200";
}

export default function Leerstand() {
  const appData = useAppData();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [rows, setRows] = useState<UnitVacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const selectedProperty = useMemo(
    () => appData.objects.find((object) => object.id === form.propertyId),
    [appData.objects, form.propertyId],
  );

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const data = await listVacancies({ status: statusFilter, propertyId: propertyFilter === "all" ? undefined : propertyFilter });
      setRows(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(`Leerstände konnten nicht geladen werden: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, [propertyFilter, statusFilter]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!form.propertyId) {
      setError("Bitte eine Immobilie auswählen.");
      return;
    }

    setSaving(true);
    try {
      await createVacancy({
        propertyId: form.propertyId,
        objectCode: selectedProperty?.code ?? null,
        objectLabel: selectedProperty?.label ?? null,
        unitLabel: form.unitLabel,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        notes: form.notes,
        status: form.endDate && form.endDate < todayIso ? "ended" : "active",
      });
      setForm(emptyForm);
      setStatus("Leerstand wurde gespeichert.");
      window.dispatchEvent(new Event("koenen:vacancy-changed"));
      await loadRows();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`Speichern fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    const confirmed = window.confirm("Diesen Leerstand archivieren?");
    if (!confirmed) return;
    setError(null);
    try {
      await archiveVacancy(id);
      window.dispatchEvent(new Event("koenen:vacancy-changed"));
      await loadRows();
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : String(archiveError);
      setError(`Archivieren fehlgeschlagen: ${message}`);
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return rows;
    return rows.filter((row) =>
      `${row.object_label ?? ""} ${row.object_code ?? ""} ${row.unit_label ?? ""} ${row.reason ?? ""} ${row.notes ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [rows, search]);

  const currentMonth = useMemo(() => {
    const start = new Date();
    const from = new Date(start.getFullYear(), start.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(start.getFullYear(), start.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to };
  }, []);

  const activeCount = filteredRows.filter((row) => isVacancyEffectivelyActiveInRange(row, currentMonth.from, currentMonth.to)).length;

  return (
    <div className="mx-auto max-w-[1480px] space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-700">
              <Building2 size={15} />
              Leerstandmanagement
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Leerstand verwalten</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Manuelle Leerstände werden hier gespeichert. Beendete Mietzeiträume werden in der Mieterprüfung zusätzlich automatisch als leerstandsrelevant erkannt.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-800">
            Aktive Leerstände: {activeCount}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Leerstand eintragen</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Immobilie
              <select name="propertyId" value={form.propertyId} onChange={updateField} className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-950">
                <option value="">Bitte auswählen</option>
                {appData.objects.map((object) => (
                  <option key={object.id} value={object.id}>{object.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Einheit / Stellplatz
              <input name="unitLabel" value={form.unitLabel} onChange={updateField} placeholder="z. B. Wohnung, P250, Garage" className="h-11 rounded-xl border border-slate-300 px-3 font-semibold text-slate-950" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Beginn
                <input name="startDate" type="date" value={form.startDate} onChange={updateField} className="h-11 rounded-xl border border-slate-300 px-3 font-semibold text-slate-950" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Ende
                <input name="endDate" type="date" value={form.endDate} onChange={updateField} className="h-11 rounded-xl border border-slate-300 px-3 font-semibold text-slate-950" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Grund
              <input name="reason" value={form.reason} onChange={updateField} placeholder="z. B. Kündigung, Renovierung, Neuvermietung offen" className="h-11 rounded-xl border border-slate-300 px-3 font-semibold text-slate-950" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Notiz
              <textarea name="notes" value={form.notes} onChange={updateField} rows={4} className="rounded-xl border border-slate-300 px-3 py-3 font-medium text-slate-950" />
            </label>
          </div>
          <button type="submit" disabled={saving} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:bg-slate-300">
            <Save size={17} />
            {saving ? "Speichert..." : "Leerstand speichern"}
          </button>
          {status ? <div className="mt-3 text-sm font-bold text-emerald-700">{status}</div> : null}
          {error ? <div className="mt-3 text-sm font-bold text-red-700">{error}</div> : null}
        </form>

        <section className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Übersicht leerstehender Einheiten</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Filter nach Immobilie, Status und Suchtext.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-black text-slate-600">
                  <span className="inline-flex items-center gap-1"><Filter size={13} /> Immobilie</span>
                  <select value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} className="h-10 rounded-xl border border-slate-300 bg-white px-3 font-bold">
                    <option value="all">Alle</option>
                    {appData.objects.map((object) => <option key={object.id} value={object.id}>{object.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-black text-slate-600">
                  Status
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-10 rounded-xl border border-slate-300 bg-white px-3 font-bold">
                    <option value="all">Alle</option>
                    <option value="active">Aktiv</option>
                    <option value="planned">Geplant</option>
                    <option value="ended">Beendet</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-black text-slate-600">
                  Suche
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Einheit, Grund, Notiz" className="h-10 rounded-xl border border-slate-300 px-3 font-bold" />
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Immobilie</th>
                  <th className="px-4 py-3">Einheit</th>
                  <th className="px-4 py-3">Zeitraum</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Grund</th>
                  <th className="px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-5 font-bold text-slate-500">Leerstände werden geladen...</td></tr>
                ) : filteredRows.length ? (
                  filteredRows.map((row) => {
                    const effectiveStatus = effectiveVacancyStatusForRange(row, currentMonth.from, currentMonth.to);
                    const effectiveStart = effectiveVacancyStartDate(row);
                    return (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-4 py-4 font-black text-slate-950">{row.object_label || row.object_code || row.property_id}</td>
                        <td className="px-4 py-4 font-bold text-slate-700">{row.unit_label || "Gesamte Immobilie"}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{formatDate(effectiveStart)} bis {effectiveStatus === "active" ? "offen" : formatDate(row.end_date)}</td>
                        <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(effectiveStatus)}`}>{statusLabel(effectiveStatus)}</span></td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-600">{row.reason || row.notes || "—"}</td>
                        <td className="px-4 py-4">
                          <button type="button" onClick={() => void handleArchive(row.id)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                            <Trash2 size={14} />
                            Archivieren
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={6} className="px-4 py-5 font-bold text-slate-500">Keine Leerstände für die aktuelle Auswahl.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
