import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Pencil, Play, RefreshCw, Save, SlidersHorizontal, Trash2, X } from "lucide-react";

import {
  applyRulePreview,
  createTransactionRule,
  deleteTransactionRule,
  formatRuleAmount,
  listRuleCandidateEntries,
  listTransactionRules,
  previewRuleMatches,
  updateTransactionRule,
  updateTransactionRuleActive,
  type RuleEntryType,
  type RulePreviewRow,
  type TransactionRule,
} from "../services/transactionRuleService";

type RuleForm = {
  name: string;
  matchText: string;
  entryType: "" | RuleEntryType;
  category: string;
  taxRelevant: "keep" | "yes" | "no";
  objectCode: string;
  priority: string;
  notes: string;
};

const initialForm: RuleForm = {
  name: "",
  matchText: "",
  entryType: "",
  category: "",
  taxRelevant: "keep",
  objectCode: "",
  priority: "100",
  notes: "",
};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function entryTypeLabel(type: RuleEntryType | null): string {
  if (type === "income") return "Einnahme";
  if (type === "expense") return "Ausgabe";
  return "nicht ändern";
}

function taxLabel(value: boolean | null): string {
  if (value === true) return "Ja";
  if (value === false) return "Nein";
  return "nicht ändern";
}

export default function Transaktionsregeln() {
  const currentYear = new Date().getFullYear();
  const [rules, setRules] = useState<TransactionRule[]>([]);
  const [preview, setPreview] = useState<RulePreviewRow[]>([]);
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [form, setForm] = useState<RuleForm>(initialForm);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules]);
  const previewTotal = useMemo(() => preview.length, [preview]);

  async function loadRules() {
    setLoading(true);
    setError(null);
    try {
      setRules(await listTransactionRules(true));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Regeln konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function checkRules() {
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const entries = await listRuleCandidateEntries(from, to);
      const rows = previewRuleMatches(rules, entries);
      setPreview(rows);
      setMessage(`${rows.length} Buchungen mit passenden Regeländerungen gefunden.`);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Buchungen konnten nicht geprüft werden.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRules();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const taxRelevant =
        form.taxRelevant === "yes" ? true : form.taxRelevant === "no" ? false : null;
      const payload = {
        name: form.name,
        matchText: form.matchText,
        entryType: form.entryType || null,
        category: form.category,
        taxRelevant,
        objectCode: form.objectCode,
        priority: Number(form.priority || 100),
        isActive: editingRuleId ? rules.find((rule) => rule.id === editingRuleId)?.is_active : true,
        notes: form.notes,
      };

      if (editingRuleId) {
        await updateTransactionRule(editingRuleId, payload);
      } else {
        await createTransactionRule(payload);
      }

      setForm(initialForm);
      setEditingRuleId(null);
      setPreview([]);
      setMessage(editingRuleId ? "Regel wurde aktualisiert." : "Regel wurde gespeichert.");
      await loadRules();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Regel konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  function editRule(rule: TransactionRule) {
    setEditingRuleId(rule.id);
    setForm({
      name: rule.name ?? "",
      matchText: rule.match_text ?? "",
      entryType: rule.entry_type ?? "",
      category: rule.category ?? "",
      taxRelevant: rule.tax_relevant === true ? "yes" : rule.tax_relevant === false ? "no" : "keep",
      objectCode: rule.object_code ?? "",
      priority: String(rule.priority ?? 100),
      notes: rule.notes ?? "",
    });
    setMessage(`Regel "${rule.name}" wird bearbeitet.`);
    setError(null);
  }

  function cancelEdit() {
    setEditingRuleId(null);
    setForm(initialForm);
    setMessage(null);
    setError(null);
  }

  async function removeRule(rule: TransactionRule) {
    const confirmed = window.confirm(`Regel "${rule.name}" wirklich löschen? Diese Aktion löscht nur die Regel, nicht die Buchungen.`);
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    try {
      await deleteTransactionRule(rule.id);
      if (editingRuleId === rule.id) cancelEdit();
      setRules((current) => current.filter((item) => item.id !== rule.id));
      setPreview((current) => current.filter((row) => row.rule.id !== rule.id));
      setMessage("Regel wurde gelöscht. Buchungen bleiben unverändert.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Regel konnte nicht gelöscht werden.");
    }
  }

  async function toggleRule(rule: TransactionRule) {
    setError(null);
    try {
      const updated = await updateTransactionRuleActive(rule.id, !rule.is_active);
      setRules((current) => current.map((item) => (item.id === rule.id ? updated : item)));
      setPreview([]);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Regelstatus konnte nicht geändert werden.");
    }
  }

  async function applyPreview() {
    if (preview.length === 0) return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const count = await applyRulePreview(preview);
      setPreview([]);
      setMessage(`${count} Buchungen wurden aktualisiert. Buchhaltung, Steuer und Auswertungen laden diese Daten neu.`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Regeln konnten nicht angewendet werden.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
              <SlidersHorizontal size={16} />
              Buchungsautomatik
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
              Transaktionsregeln
            </h1>
            <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              Regeln erkennen wiederkehrende Buchungstexte und schlagen Kategorie, Typ und Steuerrelevanz vor.
              Änderungen werden erst nach deiner Bestätigung auf vorhandene Buchungen geschrieben.
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Aktive Regeln</div>
              <div className="mt-2 text-2xl font-black text-slate-950">{activeCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Treffer</div>
              <div className="mt-2 text-2xl font-black text-slate-950">{previewTotal}</div>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
        <form onSubmit={submitRule} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-950">{editingRuleId ? "Regel bearbeiten" : "Neue Regel"}</h2>
            {editingRuleId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
              >
                <X size={15} />
                Abbrechen
              </button>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-black text-slate-700">Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="z. B. Hausgeld WEG"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Suchtext in Kategorie/Notiz</span>
              <input
                value={form.matchText}
                onChange={(event) => setForm((current) => ({ ...current, matchText: event.target.value }))}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="z. B. hausgeld, miete, zinsen"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-black text-slate-700">Typ setzen</span>
                <select
                  value={form.entryType}
                  onChange={(event) => setForm((current) => ({ ...current, entryType: event.target.value as "" | RuleEntryType }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="">Nicht ändern</option>
                  <option value="income">Einnahme</option>
                  <option value="expense">Ausgabe</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Steuerrelevant</span>
                <select
                  value={form.taxRelevant}
                  onChange={(event) => setForm((current) => ({ ...current, taxRelevant: event.target.value as RuleForm["taxRelevant"] }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="keep">Nicht ändern</option>
                  <option value="yes">Ja</option>
                  <option value="no">Nein</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Kategorie setzen</span>
              <input
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="z. B. Hausgeld, Zinsen, Kaltmiete"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-black text-slate-700">Objekt-Code optional</span>
                <input
                  value={form.objectCode}
                  onChange={(event) => setForm((current) => ({ ...current, objectCode: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  placeholder="Nur dieses Objekt"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Priorität</span>
                <input
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  placeholder="100"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-black text-slate-700">Notiz</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="Interne Erklärung zur Regel"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {editingRuleId ? "Änderungen speichern" : "Regel speichern"}
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-end md:justify-between md:p-6">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Regeln prüfen</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Zeitraum auswählen, Treffer prüfen und danach gezielt anwenden.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 md:max-w-xl md:grid-cols-[1fr_1fr_auto]">
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-bold"
              />
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => void checkRules()}
                disabled={checking || loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 shadow-sm disabled:opacity-60"
              >
                {checking ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                Prüfen
              </button>
            </div>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-950">Gespeicherte Regeln</h3>
                <button
                  type="button"
                  onClick={() => void loadRules()}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800"
                >
                  <RefreshCw size={15} />
                  Neu laden
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                    Regeln werden geladen...
                  </div>
                ) : rules.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                    Noch keine Regeln vorhanden.
                  </div>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-slate-950">{rule.name}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">Suchtext: {rule.match_text}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleRule(rule)}
                          className={`rounded-full border px-3 py-1 text-xs font-black ${
                            rule.is_active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          {rule.is_active ? "Aktiv" : "Inaktiv"}
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-3">
                        <span>Typ: {entryTypeLabel(rule.entry_type)}</span>
                        <span>Kategorie: {rule.category || "nicht ändern"}</span>
                        <span>Steuer: {taxLabel(rule.tax_relevant)}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => editRule(rule)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm"
                        >
                          <Pencil size={15} />
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeRule(rule)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-800 shadow-sm"
                        >
                          <Trash2 size={15} />
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-950">Treffer-Vorschau</h3>
                <button
                  type="button"
                  onClick={() => void applyPreview()}
                  disabled={preview.length === 0 || applying}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-50"
                >
                  {applying ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Anwenden
                </button>
              </div>
              <div className="mt-4 max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {preview.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                    Noch keine Treffer geprüft.
                  </div>
                ) : (
                  preview.map((row) => (
                    <div key={row.entry.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-slate-950">{row.entry.category || "Ohne Kategorie"}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">{row.entry.note || "Ohne Notiz"}</div>
                        </div>
                        <div className="text-right text-xs font-black text-slate-700">
                          {formatRuleAmount(row.entry.amount)}
                          <div className="mt-1 text-slate-500">{formatDate(row.entry.booking_date)}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-black text-indigo-800">Regel: {row.rule.name}</div>
                      <ul className="mt-2 space-y-1 text-xs font-bold text-slate-700">
                        {row.changes.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
