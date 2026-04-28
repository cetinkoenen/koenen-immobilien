import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppData } from "../state/AppDataContext";

type TenantInfo = { firstName: string; lastName: string; phone: string; email: string };
type OverviewRow = { objectId: string; label: string; paidAmount: number; lastBookingDate: string | null; status: "paid" | "missing" };
const STORAGE_KEY = "koenen:mieteruebersicht:tenant-info:v3";
const emptyTenant: TenantInfo = { firstName: "", lastName: "", phone: "", email: "" };
function toIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function currentMonthRange() { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const firstWeekEnd = new Date(now.getFullYear(), now.getMonth(), 7); return { label: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(start), start: toIso(start), firstWeekEnd: toIso(firstWeekEnd) }; }
function formatCurrency(value: number) { return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value); }
function formatDate(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("de-DE").format(date); }
function loadStoredTenants(): Record<string, TenantInfo> { try { const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("koenen:mieteruebersicht:tenant-info:v2"); return raw ? JSON.parse(raw) as Record<string, TenantInfo> : {}; } catch { return {}; } }
function DonutChart({ paid, missing }: { paid: number; missing: number }) { const total = paid + missing; const paidPercent = total > 0 ? Math.round((paid / total) * 100) : 0; return <div className="tenant-donut-wrap"><div className="tenant-donut" style={{ background: `conic-gradient(#22c55e 0 ${paidPercent}%, #ef4444 ${paidPercent}% 100%)` }}><div>{paidPercent}%</div></div><span>Mieteingänge</span></div>; }

export default function Mietuebersicht() {
  const month = useMemo(() => currentMonthRange(), []);
  const appData = useAppData();
  const [tenantInfo, setTenantInfo] = useState<Record<string, TenantInfo>>(() => loadStoredTenants());

  const sourceObjects = useMemo(() => {
    if (appData.objects.length) return appData.objects.map((object) => ({ id: object.id, label: object.label }));
    return appData.portfolioRows.map((row) => ({ id: row.property_id, label: row.property_name }));
  }, [appData.objects, appData.portfolioRows]);

  const rows = useMemo<OverviewRow[]>(() => sourceObjects.map((object) => {
    const rentBookings = appData.getRentEntriesForProperty(object.id, month.start, month.firstWeekEnd);
    const paidAmount = rentBookings.reduce((sum, booking) => sum + booking.amount, 0);
    const sortedDates = rentBookings.map((booking) => booking.booking_date).filter(Boolean).sort() as string[];
    return { objectId: object.id, label: object.label, paidAmount, lastBookingDate: sortedDates.length ? sortedDates[sortedDates.length - 1] : null, status: paidAmount > 0 ? "paid" : "missing" };
  }), [sourceObjects, appData, month.start, month.firstWeekEnd]);

  const stats = useMemo(() => { const paid = rows.filter((row) => row.status === "paid").length; const missing = rows.length - paid; return { paid, missing, total: rows.length, amount: rows.reduce((sum, row) => sum + row.paidAmount, 0) }; }, [rows]);
  function updateTenant(objectId: string, field: keyof TenantInfo, value: string) { setTenantInfo((prev) => { const next = { ...prev, [objectId]: { ...(prev[objectId] ?? emptyTenant), [field]: value } }; window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; }); }

  return <div className="tenant-page"><header className="tenant-hero"><h1>Mieterübersicht</h1><p>Alle Mieteingänge kommen direkt aus der Seite Buchungen. Wenn du dort eine Miete speicherst, wird diese Übersicht automatisch aktualisiert.</p><div className="tenant-actions"><NavLink to="/buchungen">Buchung / Mieteingang erfassen</NavLink><NavLink to="/nebenkosten/wohnungen">Nebenkosten Wohnungen</NavLink><NavLink to="/nebenkosten/tiefgarage">Nebenkosten TG</NavLink></div></header><section className="tenant-layout"><main className="tenant-card"><div className="tenant-card-head"><div><h2>Mieteingänge {month.label}</h2><p>Prüfung: 01. bis 07. des Monats</p></div><strong>{formatCurrency(stats.amount)}</strong></div>{appData.error && <div className="tenant-message error">Fehler beim Laden: {appData.error}</div>}{appData.loading && <div className="tenant-message">Mieterübersicht wird geladen…</div>}{!appData.loading && rows.length > 0 && <div className="tenant-list">{rows.map((row) => { const tenant = tenantInfo[row.objectId] ?? emptyTenant; const missing = row.status === "missing"; return <article key={row.objectId} className={`tenant-row ${missing ? "is-missing" : "is-paid"}`}><div className="tenant-row-top"><div className="tenant-status"><span>{missing ? "FEHLT" : "BEZAHLT"}</span></div><div className="tenant-unit"><small>Einheit</small><b>{row.label}</b></div><div className="tenant-amount"><small>Mieteingang</small><b>{formatCurrency(row.paidAmount)}</b></div><div className="tenant-date"><small>Letzter Eingang</small><b>{formatDate(row.lastBookingDate)}</b></div></div><div className="tenant-fields"><input value={tenant.firstName} onChange={(e) => updateTenant(row.objectId, "firstName", e.target.value)} placeholder="Name" /><input value={tenant.lastName} onChange={(e) => updateTenant(row.objectId, "lastName", e.target.value)} placeholder="Nachname" /><input value={tenant.phone} onChange={(e) => updateTenant(row.objectId, "phone", e.target.value)} placeholder="Telefon" /><input value={tenant.email} onChange={(e) => updateTenant(row.objectId, "email", e.target.value)} placeholder="E-Mail" type="email" /></div></article>; })}</div>}{!appData.loading && rows.length === 0 && <div className="tenant-message">Keine Objekte gefunden.</div>}</main><aside className="tenant-summary"><h2>Zusammenfassung</h2><DonutChart paid={stats.paid} missing={stats.missing} /><div className="tenant-summary-lines"><div><span>Bezahlt</span><b>{stats.paid}</b></div><div className="red"><span>Fehlt</span><b>{stats.missing}</b></div><div><span>Gesamt</span><b>{stats.total}</b></div></div></aside></section></div>;
}
