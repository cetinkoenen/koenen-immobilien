import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, FileWarning, RefreshCw, WalletCards } from "lucide-react";
import { NavLink } from "react-router-dom";

import {
  loadCockpitSnapshot,
  type CockpitSnapshot,
  type OpenPostStatus,
} from "../services/professionalCockpitService";

function eur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function dateDE(value: string | null): string {
  if (!value) return "ohne Datum";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("de-DE").format(date);
}

function statusLabel(status: OpenPostStatus): string {
  if (status === "paid") return "Bezahlt";
  if (status === "partial") return "Teilweise";
  if (status === "vacant") return "Leerstand";
  return "Offen";
}

function statusClass(status: OpenPostStatus): string {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "vacant") return "border-zinc-200 bg-zinc-100 text-zinc-700";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

export default function Cockpit() {
  const [snapshot, setSnapshot] = useState<CockpitSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await loadCockpitSnapshot();
      setSnapshot(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const riskyPosts = useMemo(
    () => (snapshot?.openPosts ?? []).filter((row) => row.status === "missing" || row.status === "partial"),
    [snapshot],
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-700">
              <WalletCards size={15} />
              Verwaltungs-Cockpit
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Professioneller Monatsüberblick</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Erwartete Mieten, Zahlungseingänge, Leerstände, Aufgaben und Dokumenthinweise werden hier zusammengeführt. Buchungen bleiben die Ist-Quelle; Sollwerte kommen aus Mietverträgen.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Neu laden
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          Cockpit konnte nicht geladen werden: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-black text-slate-500 shadow-sm">
          Cockpit wird geladen...
        </div>
      ) : snapshot ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric title="Monat" value={snapshot.periodLabel} sub={`Fälligkeit ${dateDE(snapshot.dueDate)}`} />
            <Metric title="Sollmiete" value={eur(snapshot.expectedTotal)} sub="ohne Leerstände" />
            <Metric title="Bezahlt" value={eur(snapshot.paidTotal)} sub={`${snapshot.paidCount} vollständig bezahlt`} tone="green" />
            <Metric title="Offen" value={eur(snapshot.openTotal)} sub={`${snapshot.missingCount} offen · ${snapshot.partialCount} teilweise`} tone={snapshot.openTotal > 0 ? "red" : "green"} />
            <Metric title="Leerstand" value={String(snapshot.vacantCount)} sub="aktuell dokumentiert" tone="gray" />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
            <div className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Offene Posten</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Soll-Ist-Abgleich aus Mietverträgen und Buchungen.</p>
                </div>
                <NavLink to="/mieteruebersicht" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">
                  Mieter prüfen <ArrowRight size={15} />
                </NavLink>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Objekt / Einheit</th>
                      <th className="px-4 py-3">Mieter</th>
                      <th className="px-4 py-3 text-right">Soll</th>
                      <th className="px-4 py-3 text-right">Bezahlt</th>
                      <th className="px-4 py-3 text-right">Offen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.openPosts.length ? (
                      snapshot.openPosts.map((row) => (
                        <tr key={row.contractId} className="border-b border-slate-100">
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(row.status)}`}>
                              {statusLabel(row.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-black text-slate-950">{row.objectLabel}</div>
                            <div className="mt-1 text-xs font-bold text-slate-500">{row.unitLabel || row.objectCode || "Einheit"}</div>
                          </td>
                          <td className="px-4 py-4 font-bold text-slate-700">{row.tenantName}</td>
                          <td className="px-4 py-4 text-right font-black text-slate-900">{row.status === "vacant" ? "—" : eur(row.expectedAmount)}</td>
                          <td className="px-4 py-4 text-right font-black text-emerald-700">{eur(row.paidAmount)}</td>
                          <td className="px-4 py-4 text-right font-black text-rose-700">{row.status === "vacant" ? "Leerstand" : eur(row.openAmount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-sm font-bold text-slate-500">Keine Sollstellungen aus Mietverträgen gefunden.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="space-y-5">
              <InfoPanel
                icon={<AlertTriangle size={18} />}
                title="Heute wichtig"
                rows={
                  riskyPosts.length
                    ? riskyPosts.slice(0, 5).map((row) => `${row.objectLabel}: ${eur(row.openAmount)} offen`)
                    : ["Keine kritischen offenen Mieten im aktuellen Monat."]
                }
              />
              <InfoPanel
                icon={<Bell size={18} />}
                title="Aufgaben"
                rows={
                  snapshot.tasks.length
                    ? snapshot.tasks.map((task) => `${task.title}${task.dueDate ? ` · ${dateDE(task.dueDate)}` : ""}`)
                    : ["Keine offenen Aufgaben gefunden."]
                }
              />
              <InfoPanel
                icon={<FileWarning size={18} />}
                title="Dokumente"
                rows={
                  snapshot.documentIssues.length
                    ? snapshot.documentIssues.map((doc) => `${doc.propertyName}: ${doc.detail}`)
                    : ["Keine fehlenden/ablaufenden Dokumente gemeldet."]
                }
              />
            </aside>
          </section>

          <section className="rounded-[22px] border border-indigo-100 bg-indigo-50 p-5 text-sm leading-6 text-indigo-950">
            <div className="flex items-center gap-2 font-black">
              <CheckCircle2 size={18} />
              Nächster Ausbau
            </div>
            <p className="mt-2 max-w-5xl">
              Auf dieser Grundlage können als nächstes Mahnungen, Transaktionsregeln, Ein-/Auszug-Prozesse und Dokumentpflichten produktiv ergänzt werden, ohne die bestehenden Buchungen oder Auswertungen umzubauen.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({ title, value, sub, tone = "slate" }: { title: string; value: string; sub: string; tone?: "slate" | "green" | "red" | "gray" }) {
  const valueClass = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-rose-700" : tone === "gray" ? "text-zinc-700" : "text-slate-950";
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{title}</div>
      <div className={`mt-3 text-2xl font-black ${valueClass}`}>{value}</div>
      <div className="mt-2 text-xs font-bold text-slate-500">{sub}</div>
    </div>
  );
}

function InfoPanel({ icon, title, rows }: { icon: ReactNode; title: string; rows: string[] }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
        {icon}
        {title}
      </h2>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={`${title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
            {row}
          </div>
        ))}
      </div>
    </section>
  );
}
