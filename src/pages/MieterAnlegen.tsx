import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Building2, CheckCircle2, Save, UserPlus } from "lucide-react";

import {
  createTenantWithContract,
  listTenantProfiles,
  type TenantProfile,
} from "../services/tenantService";
import { useAppData } from "../state/AppDataContext";

type FormState = {
  tenantNumber: string;
  salutation: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  postalCode: string;
  city: string;
  bankName: string;
  iban: string;
  propertyId: string;
  unitLabel: string;
  rentType: string;
  coldRent: string;
  operatingCosts: string;
  totalRent: string;
  depositAmount: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const emptyForm: FormState = {
  tenantNumber: "",
  salutation: "Herr/Frau",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  mobile: "",
  street: "",
  postalCode: "",
  city: "",
  bankName: "",
  iban: "",
  propertyId: "",
  unitLabel: "",
  rentType: "Hauptmiete",
  coldRent: "",
  operatingCosts: "",
  totalRent: "",
  depositAmount: "",
  startDate: "",
  endDate: "",
  notes: "",
};

function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTenantName(tenant: TenantProfile): string {
  const personalName = [tenant.first_name, tenant.last_name].filter(Boolean).join(" ").trim();
  return tenant.company_name || personalName || tenant.tenant_number || "Unbenannter Mieter";
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE").format(date);
}

export default function MieterAnlegen() {
  const appData = useAppData();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [recentTenants, setRecentTenants] = useState<TenantProfile[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProperty = useMemo(
    () => appData.objects.find((object) => object.id === form.propertyId),
    [appData.objects, form.propertyId],
  );

  const canSave = Boolean(form.lastName.trim() || form.companyName.trim()) && !saving;

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function loadRecentTenants() {
    setLoadingRecent(true);
    try {
      const rows = await listTenantProfiles(8);
      setRecentTenants(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(
        `Mieterstammdaten sind noch nicht bereit. Bitte Migration tenant_profiles/tenant_contracts anwenden. (${message})`,
      );
    } finally {
      setLoadingRecent(false);
    }
  }

  useEffect(() => {
    // Initialer Supabase-Ladevorgang fuer die Seitenleiste.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecentTenants();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (!canSave) {
      setError("Bitte mindestens Nachname oder Firma eintragen.");
      return;
    }

    setSaving(true);

    try {
      const result = await createTenantWithContract(
        {
          tenantNumber: form.tenantNumber,
          salutation: form.salutation,
          firstName: form.firstName,
          lastName: form.lastName,
          companyName: form.companyName,
          email: form.email,
          phone: form.phone,
          mobile: form.mobile,
          street: form.street,
          postalCode: form.postalCode,
          city: form.city,
          bankName: form.bankName,
          iban: form.iban,
          notes: form.notes,
          status: "active",
        },
        {
          propertyId: form.propertyId,
          objectCode: selectedProperty?.code ?? form.propertyId,
          unitLabel: form.unitLabel,
          rentType: form.rentType,
          coldRent: parseMoneyInput(form.coldRent),
          operatingCosts: parseMoneyInput(form.operatingCosts),
          totalRent: parseMoneyInput(form.totalRent),
          depositAmount: parseMoneyInput(form.depositAmount),
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.endDate ? "ended" : "active",
          notes: form.notes,
        },
      );

      setStatus(
        result.contract
          ? "Mieter und Mietverhaeltnis wurden gespeichert."
          : "Mieter wurde gespeichert.",
      );
      setForm(emptyForm);
      await loadRecentTenants();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`Speichern fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1460px] space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-indigo-700">
              <UserPlus size={15} />
              Mieter-Stammdaten
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Mieter anlegen
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Neue Mieterdaten werden in einer eigenen Stammdatenquelle gespeichert.
              Bestehende Buchungen, Darlehen, Charts und Portfolio-Berechnungen werden dabei nicht veraendert.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Sicherer Start: neue Tabellen, keine Aenderung an `finance_entry`.
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle title="Person / Kontakt" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Mieternummer" name="tenantNumber" value={form.tenantNumber} onChange={updateField} />
              <SelectField
                label="Anrede"
                name="salutation"
                value={form.salutation}
                onChange={updateField}
                options={["Herr/Frau", "Herr", "Frau", "Firma", "Familie"]}
              />
              <Field label="Vorname" name="firstName" value={form.firstName} onChange={updateField} />
              <Field label="Nachname" name="lastName" value={form.lastName} onChange={updateField} />
              <Field label="Firma / Familie" name="companyName" value={form.companyName} onChange={updateField} />
              <Field label="E-Mail" name="email" type="email" value={form.email} onChange={updateField} />
              <Field label="Telefon" name="phone" value={form.phone} onChange={updateField} />
              <Field label="Mobil" name="mobile" value={form.mobile} onChange={updateField} />
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle title="Adresse / Bank" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Strasse" name="street" value={form.street} onChange={updateField} className="xl:col-span-2" />
              <Field label="PLZ" name="postalCode" value={form.postalCode} onChange={updateField} />
              <Field label="Ort" name="city" value={form.city} onChange={updateField} />
              <Field label="Bank" name="bankName" value={form.bankName} onChange={updateField} className="xl:col-span-2" />
              <Field label="IBAN" name="iban" value={form.iban} onChange={updateField} className="xl:col-span-2" />
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle title="Mietverhaeltnis" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-sm font-bold text-slate-700 xl:col-span-2">
                Objekt
                <select
                  name="propertyId"
                  value={form.propertyId}
                  onChange={updateField}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-indigo-400"
                >
                  <option value="">Noch keinem Objekt zuordnen</option>
                  {appData.objects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Einheit / Stellplatz" name="unitLabel" value={form.unitLabel} onChange={updateField} />
              <SelectField
                label="Art"
                name="rentType"
                value={form.rentType}
                onChange={updateField}
                options={["Hauptmiete", "Garage", "Tiefgarage", "Stellplatz", "Gewerbe", "Sonstiges"]}
              />
              <Field label="Kaltmiete" name="coldRent" value={form.coldRent} onChange={updateField} inputMode="decimal" />
              <Field label="Nebenkosten" name="operatingCosts" value={form.operatingCosts} onChange={updateField} inputMode="decimal" />
              <Field label="Gesamtmiete" name="totalRent" value={form.totalRent} onChange={updateField} inputMode="decimal" />
              <Field label="Kaution" name="depositAmount" value={form.depositAmount} onChange={updateField} inputMode="decimal" />
              <Field label="Beginn" name="startDate" type="date" value={form.startDate} onChange={updateField} />
              <Field label="Ende" name="endDate" type="date" value={form.endDate} onChange={updateField} />
            </div>

            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
              Notizen
              <textarea
                name="notes"
                value={form.notes}
                onChange={updateField}
                rows={4}
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-950 outline-none focus:border-indigo-400"
              />
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={!canSave}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save size={17} />
                {saving ? "Speichern..." : "Speichern"}
              </button>
              {status ? (
                <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <CheckCircle2 size={17} />
                  {status}
                </span>
              ) : null}
              {error ? <span className="text-sm font-bold text-red-700">{error}</span> : null}
            </div>
          </section>
        </form>

        <aside className="space-y-5">
          <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle title="Zuletzt angelegt" compact />
            {loadingRecent ? (
              <p className="text-sm font-semibold text-slate-500">Lade Mieterdaten...</p>
            ) : recentTenants.length ? (
              <div className="space-y-3">
                {recentTenants.map((tenant) => (
                  <div key={tenant.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-sm font-black text-slate-950">{formatTenantName(tenant)}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {tenant.email || tenant.phone || tenant.mobile || "Keine Kontaktdaten"}
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-400">
                      Aktualisiert {formatDate(tenant.updated_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Noch keine neuen Mieter-Stammdaten vorhanden.
              </p>
            )}
          </section>

          <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <div className="flex items-center gap-2 font-black">
              <Building2 size={17} />
              Daten-Schutz
            </div>
            <p className="mt-2">
              Diese Seite schreibt nur in die neuen Mieter-Tabellen. Alte Mieterdaten in Portfolio,
              Mieteruebersicht und Vermietung bleiben zunaechst unveraendert sichtbar.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ title, compact = false }: { title: string; compact?: boolean }) {
  return (
    <h2 className={`${compact ? "mb-3 text-base" : "mb-4 text-lg"} font-black text-slate-950`}>
      {title}
    </h2>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  inputMode,
  className = "",
}: {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  inputMode?: "decimal";
  className?: string;
}) {
  return (
    <label className={`grid gap-2 text-sm font-bold text-slate-700 ${className}`}>
      {label}
      <input
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        inputMode={inputMode}
        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-indigo-400"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-indigo-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
