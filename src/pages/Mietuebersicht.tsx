import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppData, type FinanceEntry } from "../state/AppDataContext";
import {
  emptyPropertyExtra,
  fetchPropertyExtras,
  loadLocalTenantExtras,
  mergeLocalSources,
  migrateLocalExtrasToSupabase,
  writeLocalTenantExtras,
  type PropertyExtraInfo,
} from "../services/propertyExtraService";

type TenantInfo = Pick<PropertyExtraInfo, "firstName" | "lastName" | "phone" | "email">;
type OverviewRow = { objectId: string; tenantKey: string; label: string; unitLabel?: string; referenceLabel?: string; paidAmount: number; lastBookingDate: string | null; status: "paid" | "missing" };

const emptyTenant: TenantInfo = { firstName: "", lastName: "", phone: "", email: "" };

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstWeekEnd = new Date(now.getFullYear(), now.getMonth(), 7);
  return {
    label: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(start),
    start: toIso(start),
    firstWeekEnd: toIso(firstWeekEnd),
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("de-DE").format(date);
}


function normalizeReferenceText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replace(/[ä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bookingReferenceText(booking: FinanceEntry): string {
  return `${booking.category ?? ""} ${booking.note ?? ""} ${booking.objekt_code ?? ""}`;
}

type UnitDefinition = { ref: string; title: string; matcher: (booking: FinanceEntry) => boolean };

function getUnitDefinitions(objectLabel: string): UnitDefinition[] {
  const normalizedLabel = normalizeReferenceText(objectLabel);

  if (normalizedLabel.includes("further") || normalizedLabel.includes("fuerther")) {
    return [
      {
        ref: "wohnung",
        title: "Wohnung",
        matcher: (booking) => !normalizeReferenceText(bookingReferenceText(booking)).includes("garage"),
      },
      {
        ref: "garage",
        title: "Garage",
        matcher: (booking) => normalizeReferenceText(bookingReferenceText(booking)).includes("garage"),
      },
    ];
  }

  if (normalizedLabel.includes("rosenstein")) {
    const garages = [
      { ref: "P250 - E008440000121", title: "Garage 1" },
      { ref: "P253 - E008440000122", title: "Garage 2" },
      { ref: "P254 - E008440000123", title: "Garage 3" },
    ];

    return garages.map((garage) => ({
      ref: garage.ref,
      title: garage.title,
      matcher: (booking: FinanceEntry) => bookingReferenceText(booking).toLowerCase().includes(garage.ref.toLowerCase()),
    }));
  }

  return [{ ref: "hauptmiete", title: "Miete", matcher: () => true }];
}

function toTenantInfo(extra: Partial<PropertyExtraInfo> | undefined): TenantInfo {
  return {
    firstName: extra?.firstName ?? "",
    lastName: extra?.lastName ?? "",
    phone: extra?.phone ?? "",
    email: extra?.email ?? "",
  };
}

function loadStoredTenants(): Record<string, TenantInfo> {
  const extras = loadLocalTenantExtras();
  return Object.fromEntries(Object.entries(extras).map(([key, value]) => [key, toTenantInfo(value)]));
}

function DonutChart({ paid, missing }: { paid: number; missing: number }) {
  const total = paid + missing;
  const paidPercent = total > 0 ? Math.round((paid / total) * 100) : 0;
  return (
    <div className="tenant-donut-wrap">
      <div className="tenant-donut" style={{ background: `conic-gradient(#22c55e 0 ${paidPercent}%, #ef4444 ${paidPercent}% 100%)` }}>
        <div>{paidPercent}%</div>
      </div>
      <span>Mieteingänge</span>
    </div>
  );
}

export default function Mietuebersicht() {
  const month = useMemo(() => currentMonthRange(), []);
  const appData = useAppData();
  const [tenantInfo, setTenantInfo] = useState<Record<string, TenantInfo>>(() => loadStoredTenants());
  const [, setFullExtras] = useState<Record<string, PropertyExtraInfo>>(() => mergeLocalSources());
  const [status, setStatus] = useState<Record<string, string>>({});

  const sourceObjects = useMemo(() => {
    if (appData.objects.length) return appData.objects.map((object) => ({ id: object.id, label: object.label }));
    return appData.portfolioRows.map((row) => ({ id: row.property_id, label: row.property_name }));
  }, [appData.objects, appData.portfolioRows]);

  useEffect(() => {
    const ids = sourceObjects.map((object) => object.id).filter(Boolean);
    if (!ids.length) return;

    let cancelled = false;

    async function loadSavedTenants() {
      const local = mergeLocalSources();
      try {
        const remote = await fetchPropertyExtras(ids);
        if (cancelled) return;

        const mergedExtras: Record<string, PropertyExtraInfo> = {};
        const mergedTenants: Record<string, TenantInfo> = {};

        for (const id of ids) {
          mergedExtras[id] = { ...emptyPropertyExtra, ...(local[id] ?? {}), ...(remote[id] ?? {}) };
          mergedTenants[id] = toTenantInfo(mergedExtras[id]);
        }

        setFullExtras((prev) => ({ ...prev, ...mergedExtras }));
        setTenantInfo((prev) => ({ ...prev, ...mergedTenants }));
        writeLocalTenantExtras({ ...local, ...mergedExtras });
        setStatus((prev) => ({ ...prev, __global: "Mieterdaten aus Supabase geladen." }));

        void migrateLocalExtrasToSupabase(ids, local, remote).catch((error) => {
          console.warn("Lokale Mieterdaten konnten nicht automatisch übernommen werden:", error);
        });
      } catch (error: any) {
        if (cancelled) return;
        const tenants = Object.fromEntries(Object.entries(local).map(([id, value]) => [id, toTenantInfo(value)]));
        setFullExtras((prev) => ({ ...local, ...prev }));
        setTenantInfo((prev) => ({ ...tenants, ...prev }));
        setStatus((prev) => ({
          ...prev,
          __global: "Supabase-Speichertabelle nicht erreichbar. Lokale Mieterdaten bleiben sichtbar.",
        }));
        console.warn("Mietuebersicht extra load failed:", error);
      }
    }

    void loadSavedTenants();
    return () => {
      cancelled = true;
    };
  }, [sourceObjects]);

  const rows = useMemo<OverviewRow[]>(
    () =>
      sourceObjects.flatMap((object) => {
        const rentBookings = appData.getRentEntriesForProperty(object.id, month.start, month.firstWeekEnd);
        const units = getUnitDefinitions(object.label);

        return units.map((unit) => {
          const unitBookings = rentBookings.filter(unit.matcher);
          const paidAmount = unitBookings.reduce((sum, booking) => sum + booking.amount, 0);
          const sortedDates = unitBookings.map((booking) => booking.booking_date).filter(Boolean).sort() as string[];
          const tenantKey = units.length > 1 ? `${object.id}::${unit.ref}` : object.id;

          return {
            objectId: object.id,
            tenantKey,
            label: object.label,
            unitLabel: units.length > 1 ? unit.title : undefined,
            referenceLabel: units.length > 1 ? unit.ref : undefined,
            paidAmount,
            lastBookingDate: sortedDates.length ? sortedDates[sortedDates.length - 1] : null,
            status: paidAmount > 0 ? "paid" : "missing",
          };
        });
      }),
    [sourceObjects, appData, month.start, month.firstWeekEnd]
  );

  const stats = useMemo(() => {
    const paid = rows.filter((row) => row.status === "paid").length;
    const missing = rows.length - paid;
    return { paid, missing, total: rows.length, amount: rows.reduce((sum, row) => sum + row.paidAmount, 0) };
  }, [rows]);

  return (
    <div className="tenant-page">
      <header className="tenant-hero">
        <h1>Mieterübersicht</h1>
        <p>Alle Mieteingänge kommen direkt aus der Seite Buchungen. Die Mieterdaten werden automatisch aus Portfolio → Mieterübersicht übernommen.</p>
        <div className="tenant-actions">
          <NavLink to="/buchungen">Buchung / Mieteingang erfassen</NavLink>
          <NavLink to="/nebenkosten/wohnungen">Nebenkosten Wohnungen</NavLink>
          <NavLink to="/nebenkosten/tiefgarage">Nebenkosten TG</NavLink>
        </div>
        {status.__global ? <div className="tenant-message" style={{ marginTop: 12 }}>{status.__global}</div> : null}
      </header>

      <section className="tenant-layout">
        <main className="tenant-card">
          <div className="tenant-card-head">
            <div>
              <h2>Mieteingänge {month.label}</h2>
              <p>Prüfung: 01. bis 07. des Monats</p>
            </div>
            <strong>{formatCurrency(stats.amount)}</strong>
          </div>

          {appData.error && <div className="tenant-message error">Fehler beim Laden: {appData.error}</div>}
          {appData.loading && <div className="tenant-message">Mieterübersicht wird geladen…</div>}

          {!appData.loading && rows.length > 0 && (
            <div className="tenant-list">
              {rows.map((row) => {
                const tenant = tenantInfo[row.objectId] ?? emptyTenant;
                const missing = row.status === "missing";
                return (
                  <article key={row.tenantKey} className={`tenant-row ${missing ? "is-missing" : "is-paid"}`}>
                    <div className="tenant-row-top">
                      <div className="tenant-status"><span>{missing ? "FEHLT" : "BEZAHLT"}</span></div>
                      <div className="tenant-unit"><small>Einheit</small><b>{row.label}</b>{row.unitLabel ? <em style={{ display: "block", marginTop: 4, color: "#0f172a", fontStyle: "normal", fontWeight: 900 }}>{row.unitLabel}</em> : null}{row.referenceLabel && row.referenceLabel !== row.unitLabel ? <small style={{ display: "block", marginTop: 3 }}>Betreff-Referenz: {row.referenceLabel}</small> : null}</div>
                      <div className="tenant-amount"><small>Mieteingang</small><b>{formatCurrency(row.paidAmount)}</b></div>
                      <div className="tenant-date"><small>Letzter Eingang</small><b>{formatDate(row.lastBookingDate)}</b></div>
                    </div>
                    <div className="tenant-fields">
                      <input value={tenant.firstName} placeholder="Name" readOnly disabled title="Wird automatisch aus Portfolio → Mieterübersicht übernommen" />
                      <input value={tenant.lastName} placeholder="Nachname" readOnly disabled title="Wird automatisch aus Portfolio → Mieterübersicht übernommen" />
                      <input value={tenant.phone} placeholder="Telefon" readOnly disabled title="Wird automatisch aus Portfolio → Mieterübersicht übernommen" />
                      <input value={tenant.email} placeholder="E-Mail" type="email" readOnly disabled title="Wird automatisch aus Portfolio → Mieterübersicht übernommen" />
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                      <small>Automatisch aus Portfolio übernommen · nicht auf dieser Seite editierbar</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!appData.loading && rows.length === 0 && <div className="tenant-message">Keine Objekte gefunden.</div>}
        </main>

        <aside className="tenant-summary">
          <h2>Zusammenfassung</h2>
          <DonutChart paid={stats.paid} missing={stats.missing} />
          <div className="tenant-summary-lines">
            <div><span>Bezahlt</span><b>{stats.paid}</b></div>
            <div className="red"><span>Fehlt</span><b>{stats.missing}</b></div>
            <div><span>Gesamt</span><b>{stats.total}</b></div>
          </div>
        </aside>
      </section>
    </div>
  );
}
