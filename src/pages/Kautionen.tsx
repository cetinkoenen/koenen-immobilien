import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, KeyRound, RefreshCw, Search, ShieldAlert, WalletCards } from "lucide-react";

import { EmptyState, KpiCard, PageHeader, SectionPanel } from "@/components/ui/professional";
import { useAppData } from "@/state/AppDataContext";
import { loadDepositOverview, type DepositOverviewRow, type DepositStatus } from "@/services/depositService";

type StatusFilter = "all" | DepositStatus;

const STATUS_LABELS: Record<DepositStatus, string> = {
  settled: "Erhalten",
  open: "Offen",
  overpaid: "Überzahlt",
  returned: "Zurückbezahlt",
  none: "Nicht erfasst",
};

const STATUS_CLASSES: Record<DepositStatus, string> = {
  settled: "border-emerald-200 bg-emerald-50 text-emerald-800",
  open: "border-amber-200 bg-amber-50 text-amber-800",
  overpaid: "border-sky-200 bg-sky-50 text-sky-800",
  returned: "border-slate-200 bg-slate-100 text-slate-700",
  none: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

function euro(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateLabel(value: string | null): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE");
}

function statusTone(status: DepositStatus): "green" | "amber" | "red" | "blue" | "slate" {
  if (status === "settled") return "green";
  if (status === "open") return "amber";
  if (status === "overpaid") return "blue";
  if (status === "returned") return "slate";
  return "slate";
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function exportCsv(rows: DepositOverviewRow[]) {
  const header = [
    "Immobilie",
    "Mieter",
    "Status",
    "Soll-Kaution",
    "Erhalten",
    "Zurueckbezahlt",
    "Saldo",
    "Offen",
    "Letzte Bewegung",
  ];
  const body = rows.map((row) => [
    row.propertyName,
    row.tenantName ?? "",
    STATUS_LABELS[row.status],
    row.expectedDeposit.toFixed(2),
    row.receivedDeposit.toFixed(2),
    row.returnedDeposit.toFixed(2),
    row.balance.toFixed(2),
    row.openAmount.toFixed(2),
    row.lastMovementDate ?? "",
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kautionen-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: DepositStatus }) {
  return (
    <span className={`inline-flex min-h-8 items-center justify-center rounded-full border px-3 text-xs font-black ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function DepositRow({ row }: { row: DepositOverviewRow }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1.7fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{row.objectCode ?? "Immobilie"}</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{row.propertyName}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{row.tenantName ?? "Kein aktiver Mieter hinterlegt"}</p>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Vertrag</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {dateLabel(row.contractStart)} bis {dateLabel(row.contractEnd)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Letzte Bewegung</p>
              <p className="mt-1 text-sm font-black text-slate-950">{dateLabel(row.lastMovementDate)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiMini label="Soll" value={euro(row.expectedDeposit)} />
          <KpiMini label="Erhalten" value={euro(row.receivedDeposit)} tone="green" />
          <KpiMini label="Zurück" value={euro(row.returnedDeposit)} tone="slate" />
          <KpiMini label="Saldo" value={euro(row.balance)} tone={row.balance >= 0 ? "blue" : "red"} />
          <KpiMini label="Offen" value={euro(row.openAmount)} tone={row.openAmount > 0 ? "amber" : "green"} />
        </div>
      </div>

      {row.entries.length ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          {row.entries.slice(0, 4).map((entry) => (
            <div key={entry.id} className="grid gap-3 border-b border-slate-100 p-3 text-sm last:border-b-0 md:grid-cols-[120px_150px_1fr_140px]">
              <div className="font-black text-slate-700">{dateLabel(entry.bookingDate)}</div>
              <div className="inline-flex items-center gap-2 font-black text-slate-700">
                {entry.direction === "received" ? <ArrowDownLeft size={16} className="text-emerald-600" /> : <ArrowUpRight size={16} className="text-slate-500" />}
                {entry.direction === "received" ? "Erhalten" : "Zurückbezahlt"}
              </div>
              <div className="min-w-0 truncate font-semibold text-slate-500">
                {entry.category || "Kaution"} {entry.note ? `- ${entry.note}` : ""}
              </div>
              <div className="font-black text-slate-950 md:text-right">{euro(entry.amount)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function KpiMini({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return (
    <div className={`rounded-2xl border p-3 ${classes[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 whitespace-nowrap text-lg font-black">{value}</p>
    </div>
  );
}

export default function Kautionen() {
  const { objects, loading: appLoading } = useAppData();
  const [rows, setRows] = useState<DepositOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const nextRows = await loadDepositOverview(objects);
      setRows(nextRows);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Kautionen konnten nicht geladen werden.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (appLoading) return undefined;
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appLoading, objects.length]);

  const filteredRows = useMemo(() => {
    const needle = normalize(query);
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return normalize(`${row.propertyName} ${row.objectCode ?? ""} ${row.tenantName ?? ""}`).includes(needle);
    });
  }, [query, rows, statusFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.expected += row.expectedDeposit;
        acc.received += row.receivedDeposit;
        acc.returned += row.returnedDeposit;
        acc.balance += row.balance;
        acc.open += row.openAmount;
        acc.openCount += row.status === "open" ? 1 : 0;
        acc.settledCount += row.status === "settled" ? 1 : 0;
        return acc;
      },
      { expected: 0, received: 0, returned: 0, balance: 0, open: 0, openCount: 0, settledCount: 0 },
    );
  }, [filteredRows]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Kautionsübersicht"
        title="Kautionen"
        description="Finanzielle Kautionssituation pro Immobilie: Soll-Kaution aus Mietverträgen, erhaltene und zurückbezahlte Kautionen aus Buchungen."
        meta={[
          { label: "Quelle", value: "Mieterstammdaten + Buchhaltung" },
          { label: "Objekte", value: filteredRows.length },
        ]}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 shadow-sm"
          >
            <RefreshCw size={17} /> Aktualisieren
          </button>
          <button
            type="button"
            onClick={() => exportCsv(filteredRows)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm"
          >
            <Download size={17} /> CSV
          </button>
        </div>
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Soll-Kaution" value={euro(totals.expected)} icon={KeyRound} tone="blue" />
        <KpiCard label="Erhalten" value={euro(totals.received)} icon={ArrowDownLeft} tone="green" />
        <KpiCard label="Zurückbezahlt" value={euro(totals.returned)} icon={ArrowUpRight} tone="slate" />
        <KpiCard label="Kautionssaldo" value={euro(totals.balance)} icon={WalletCards} tone={totals.balance >= 0 ? "violet" : "red"} />
        <KpiCard label="Offen" value={euro(totals.open)} detail={`${totals.openCount} Objekt(e)`} icon={ShieldAlert} tone={totals.open > 0 ? "amber" : "green"} />
      </section>

      <SectionPanel eyebrow="Filter" title="Kautionen prüfen">
        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-bold text-slate-950 outline-none focus:border-slate-400"
              placeholder="Immobilie, Objektcode oder Mieter suchen"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-950 outline-none focus:border-slate-400"
          >
            <option value="all">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </SectionPanel>

      {error ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-5 text-sm font-black text-red-900">
          Fehler beim Laden: {error}
        </div>
      ) : null}

      {loading || appLoading ? (
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 text-sm font-black text-slate-600 shadow-sm">
          Kautionsdaten werden geladen...
        </div>
      ) : filteredRows.length ? (
        <section className="grid gap-4">
          {filteredRows.map((row) => <DepositRow key={row.propertyId} row={row} />)}
        </section>
      ) : (
        <EmptyState title="Keine Kautionen gefunden" description="Für die gewählte Suche wurden keine Kautionsdaten gefunden." />
      )}

      <SectionPanel
        eyebrow="Erkennung"
        title="Wie die Kaution berechnet wird"
        description="Soll-Kaution kommt aus Mieter anlegen / Mietvertrag. Bewegungen werden aus Buchungen erkannt, wenn Kategorie oder Notiz Kaution, Mietsicherheit oder Sicherheitseinlage enthält."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <KpiMini label="Status erhalten" value={`${totals.settledCount} Objekt(e)`} tone="green" />
          <KpiMini label="Status offen" value={`${totals.openCount} Objekt(e)`} tone="amber" />
          <KpiMini label="Filterliste" value={`${filteredRows.length} Objekt(e)`} tone={statusTone(totals.open > 0 ? "open" : "settled")} />
        </div>
      </SectionPanel>
    </div>
  );
}
