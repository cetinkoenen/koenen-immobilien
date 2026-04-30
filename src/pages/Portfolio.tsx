import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { portfolioGalleryItems, type PortfolioGalleryItem } from "../data/portfolioGallery";
import { useAppData, type PortfolioLoanRow } from "../state/AppDataContext";
import { loadAllPropertyExtras, savePropertyExtra, writeLocalPropertyExtras, type PropertyExtraInfo } from "../services/propertyExtraService";

type ExtraInfo = PropertyExtraInfo;

type ExposeInfo = {
  fileName: string;
  dataUrl: string;
  uploadedAt: string;
};

type ExposePreview = {
  row: PortfolioLoanRow;
  extra: ExtraInfo;
  image?: PortfolioGalleryItem;
};

const STORAGE_KEY = "koenen:portfolio:object-overview-extra:v4";
const EXPOSE_STORAGE_KEY = "koenen:portfolio:exposes:v1";

const emptyExtra: ExtraInfo = {
  livingArea: "",
  rooms: "",
  coldRent: "",
  operatingCosts: "",
  totalRent: "",
  marketValue: "",
  equipment: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100);
}

function parseMoney(value: string): number {
  if (!value) return 0;
  const normalized = value.replace(/€/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadExtra(): Record<string, ExtraInfo> {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("koenen:portfolio:object-overview-extra:v3") ??
      window.localStorage.getItem("koenen:portfolio:object-overview-extra:v2");
    const parsed = raw ? (JSON.parse(raw) as Record<string, Partial<ExtraInfo>>) : {};
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, { ...emptyExtra, ...value }]));
  } catch {
    return {};
  }
}

function loadExposes(): Record<string, ExposeInfo> {
  try {
    const raw = window.localStorage.getItem(EXPOSE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ExposeInfo>) : {};
  } catch {
    return {};
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replaceAll("ß", "ss").replace(/[ä]/g, "a").replace(/[ö]/g, "o").replace(/[ü]/g, "u").replace(/[^a-z0-9]+/g, " ").trim();
}

function getImage(name: string): PortfolioGalleryItem | undefined {
  const normalized = normalizeText(name);
  return portfolioGalleryItems.find((item) => item.matchTerms.some((term) => normalized.includes(normalizeText(term))));
}

function currentYear() {
  return new Date().getFullYear();
}

function InfoPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  return <div className={`portfolio-data-pill ${tone}`}><span>{label}</span><b>{value}</b></div>;
}

function SaveExtraBar({
  propertyId,
  dirty,
  status,
  onSave,
}: {
  propertyId: string;
  dirty: boolean;
  status?: string;
  onSave: (propertyId: string) => Promise<void>;
}) {
  return (
    <div className="portfolio-save-row" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
      <button
        type="button"
        onClick={() => void onSave(propertyId)}
        style={{
          border: "1px solid #0f172a",
          borderRadius: 14,
          background: dirty ? "#0f172a" : "#ffffff",
          color: dirty ? "#ffffff" : "#0f172a",
          padding: "10px 16px",
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: dirty ? "0 8px 18px rgba(15, 23, 42, 0.16)" : "none",
        }}
      >
        {dirty ? "Änderungen speichern" : "Speichern"}
      </button>
      {status ? <small style={{ color: status.includes("Fehler") ? "#b91c1c" : "#475569", fontWeight: 700 }}>{status}</small> : null}
    </div>
  );
}

function safeRatio(value: number, base: number) {
  if (!base) return 0;
  return (value / base) * 100;
}

export default function Portfolio() {
  const navigate = useNavigate();
  const appData = useAppData();
  const [extraInfo, setExtraInfo] = useState<Record<string, ExtraInfo>>(() => loadExtra());
  const [dirtyExtras, setDirtyExtras] = useState<Record<string, boolean>>({});
  const [extraStatus, setExtraStatus] = useState<Record<string, string>>({});
  const [exposes, setExposes] = useState<Record<string, ExposeInfo>>(() => loadExposes());
  const [selectedImage, setSelectedImage] = useState<PortfolioGalleryItem | null>(null);
  const [exposePreview, setExposePreview] = useState<ExposePreview | null>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const year = currentYear();

  const rows = appData.portfolioRows;

  useEffect(() => {
    let cancelled = false;

    async function loadRemoteExtras() {
      const remote = await loadAllPropertyExtras();
      if (cancelled || Object.keys(remote).length === 0) return;

      setExtraInfo((prev) => {
        const next = { ...prev, ...remote };
        writeLocalPropertyExtras(next);
        return next;
      });
    }

    void loadRemoteExtras();

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    const extra = extraInfo[row.property_id] ?? emptyExtra;
    const financeSummary = appData.getYearlyFinanceSummary(row.property_id, year);
    const income = financeSummary?.einnahmen ?? appData.getIncomeEntriesForProperty(row.property_id, year).reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = financeSummary?.ausgaben ?? appData.getExpenseEntriesForProperty(row.property_id, year).reduce((sum, entry) => sum + entry.amount, 0);
    const net = income - expenses;
    const value = parseMoney(extra.marketValue) || row.last_balance || 0;
    return {
      lastBalance: acc.lastBalance + row.last_balance,
      principalTotal: acc.principalTotal + row.principal_total,
      interestTotal: acc.interestTotal + row.interest_total,
      income: acc.income + income,
      expenses: acc.expenses + expenses,
      cashflow: acc.cashflow + net,
      portfolioValue: acc.portfolioValue + value,
    };
  }, { lastBalance: 0, principalTotal: 0, interestTotal: 0, income: 0, expenses: 0, cashflow: 0, portfolioValue: 0 }), [rows, appData, year, extraInfo]);

  const averageRepaidPercent = useMemo(() => (rows.length ? rows.reduce((sum, row) => sum + row.repaid_percent, 0) / rows.length : 0), [rows]);
  const netYield = safeRatio(totals.cashflow, totals.portfolioValue);
  const grossYield = safeRatio(totals.income, totals.portfolioValue);

  function openSection(row: PortfolioLoanRow, section: string) {
    if (!row.portfolio_property_id) {
      window.alert(`Für "${row.property_name}" fehlt die portfolio_property_id.`);
      return;
    }
    navigate(`/portfolio/${encodeURIComponent(row.portfolio_property_id)}/${section}`);
  }

  function updateExtra(propertyId: string, field: keyof ExtraInfo, value: string) {
    setExtraInfo((prev) => {
      const next = { ...prev, [propertyId]: { ...(prev[propertyId] ?? emptyExtra), [field]: value } };
      writeLocalPropertyExtras(next);
      return next;
    });
    setDirtyExtras((prev) => ({ ...prev, [propertyId]: true }));
    setExtraStatus((prev) => ({ ...prev, [propertyId]: "Ungespeicherte Änderungen" }));
  }

  async function saveExtra(propertyId: string) {
    const extra = extraInfo[propertyId] ?? emptyExtra;
    setExtraStatus((prev) => ({ ...prev, [propertyId]: "Speichert…" }));

    try {
      await savePropertyExtra(propertyId, extra);
      setDirtyExtras((prev) => ({ ...prev, [propertyId]: false }));
      setExtraStatus((prev) => ({ ...prev, [propertyId]: "Gespeichert" }));
    } catch (error) {
      console.error(error);
      setExtraStatus((prev) => ({
        ...prev,
        [propertyId]: "Fehler beim Speichern. Bitte Supabase-Verbindung und SQL-Tabelle prüfen.",
      }));
    }
  }

  function openUpload(propertyId: string) {
    setUploadTarget(propertyId);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  function handleExposeUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const propertyId = uploadTarget;
    event.target.value = "";
    if (!file || !propertyId) return;
    if (file.type !== "application/pdf") {
      window.alert("Bitte nur PDF-Dateien als Exposé hochladen.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const next = { ...exposes, [propertyId]: { fileName: file.name, dataUrl, uploadedAt: new Date().toISOString() } };
      setExposes(next);
      window.localStorage.setItem(EXPOSE_STORAGE_KEY, JSON.stringify(next));
      window.alert("Exposé wurde gespeichert und ist jetzt bei dieser Immobilie abrufbar.");
    };
    reader.onerror = () => window.alert("Exposé konnte nicht gelesen werden.");
    reader.readAsDataURL(file);
  }

  function downloadGeneratedExpose(row: PortfolioLoanRow, extra: ExtraInfo) {
    const image = getImage(row.property_name);
    setExposePreview({ row, extra, image });
    window.setTimeout(() => window.print(), 120);
  }

  if (appData.loading) return <div className="portfolio-page"><div className="portfolio-state">Portfolio wird geladen…</div></div>;
  if (appData.error) return <div className="portfolio-page"><div className="portfolio-state error">Fehler beim Laden des Portfolios: {appData.error}</div></div>;

  return <div className="portfolio-page portfolio-page-v11">
    <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden-file-input" onChange={handleExposeUpload} />

    <header className="portfolio-hero compact polished">
      <div>
        <h1>Objektübersicht</h1>
        <p>Live-Dashboard mit Buchungen als zentrale Datenquelle: Cashflow, Rendite, Mieten, Nebenkosten, Darlehen und Exposés pro Immobilie.</p>
      </div>
    </header>

    <section className="portfolio-kpis refined">
      <div><span>Objekte</span><b>{rows.length}</b></div>
      <div><span>Cashflow {year}</span><b className={totals.cashflow >= 0 ? "positive" : "negative"}>{formatCurrency(totals.cashflow)}</b></div>
      <div><span>Brutto-Rendite</span><b>{formatPercent(grossYield)}</b></div>
      <div><span>Netto-Rendite</span><b>{formatPercent(netYield)}</b></div>
      <div><span>Restschuld gesamt</span><b>{formatCurrency(totals.lastBalance)}</b></div>
      <div><span>Ø Rückzahlungsstand</span><b>{formatPercent(averageRepaidPercent)}</b></div>
    </section>

    <section className="portfolio-cashflow-panel">
      <div>
        <span className="panel-label">Cashflow & Rendite</span>
        <h2>{formatCurrency(totals.cashflow)} Netto-Cashflow im Jahr {year}</h2>
        <p>Einnahmen und Ausgaben kommen automatisch aus den Buchungen. Die Rendite nutzt den eingetragenen Objektwert; wenn kein Wert gepflegt ist, wird ersatzweise die Restschuld als Bezugsgröße verwendet.</p>
      </div>
      <div className="cashflow-bars" aria-label="Cashflow Übersicht">
        <div><span>Einnahmen</span><i style={{ width: `${Math.min(100, safeRatio(totals.income, Math.max(totals.income, totals.expenses, 1)))}%` }} /><b>{formatCurrency(totals.income)}</b></div>
        <div><span>Ausgaben</span><i style={{ width: `${Math.min(100, safeRatio(totals.expenses, Math.max(totals.income, totals.expenses, 1)))}%` }} /><b>{formatCurrency(totals.expenses)}</b></div>
        <div><span>Objektwerte</span><i style={{ width: "100%" }} /><b>{formatCurrency(totals.portfolioValue)}</b></div>
      </div>
    </section>

    {rows.length === 0 && <div className="portfolio-state">Keine Portfolio-Objekte gefunden.</div>}

    <section className="portfolio-object-list refined-list">{rows.map((row) => {
      const extra = extraInfo[row.property_id] ?? emptyExtra;
      const image = getImage(row.property_name);
      const uploadedExpose = exposes[row.property_id];
      const progress = Math.max(0, Math.min(100, row.repaid_percent));
      const financeSummary = appData.getYearlyFinanceSummary(row.property_id, year);
      const income = financeSummary?.einnahmen ?? appData.getIncomeEntriesForProperty(row.property_id, year).reduce((sum, entry) => sum + entry.amount, 0);
      const expenses = financeSummary?.ausgaben ?? appData.getExpenseEntriesForProperty(row.property_id, year).reduce((sum, entry) => sum + entry.amount, 0);
      const rentIncome = financeSummary?.mieteingaenge ?? appData.getRentEntriesForProperty(row.property_id, `${year}-01-01`, `${year}-12-31`).reduce((sum, entry) => sum + entry.amount, 0);
      const nebenkosten = appData.getNebenkostenExpenses(row.property_id, year).reduce((sum, entry) => sum + entry.amount, 0);
      const net = income - expenses;
      const value = parseMoney(extra.marketValue) || row.last_balance || 0;
      const objectYield = safeRatio(net, value);
      const grossObjectYield = safeRatio(income, value);

      return <article className="portfolio-object-card refined-card" key={row.property_id}>
        <div className="portfolio-object-main">
          <div className="portfolio-object-head refined-head">
            <button type="button" className="portfolio-object-media small clickable" onClick={() => image && setSelectedImage(image)} aria-label={image ? `${image.title} vergrößern` : "Kein Objektbild vorhanden"}>
              {image ? <img src={image.imageUrl} alt={image.title} /> : <div className="portfolio-image-placeholder">Objektbild</div>}
            </button>
            <div className="portfolio-object-titlebar">
              <div><h2>{row.property_name}</h2><small>Property-ID: {row.property_id}</small></div>
              <span className="portfolio-badge">{row.repayment_label ?? "Läuft"}</span>
            </div>
            <div className="portfolio-actions top compact-actions">
              <button type="button" onClick={() => openSection(row, "finanzen")}>Finanzen</button>
              <button type="button" onClick={() => openSection(row, "energie")}>Energie</button>
              <button type="button" onClick={() => openSection(row, "vermietung")}>Vermietung</button>
              <button type="button" className="expose-main-button" onClick={() => setExposePreview({ row, extra, image })}>Exposé</button>
            </div>
          </div>

          <div className="portfolio-dashboard-grid refined-dashboard">
            <div className="portfolio-mini-card"><span>Restschuld</span><b>{formatCurrency(row.last_balance)}</b></div>
            <div className="portfolio-mini-card"><span>Cashflow {year}</span><b className={net >= 0 ? "positive" : "negative"}>{formatCurrency(net)}</b></div>
            <div className="portfolio-mini-card"><span>Netto-Rendite</span><b>{formatPercent(objectYield)}</b></div>
            <div className="portfolio-mini-card"><span>Rückzahlung</span><b>{formatPercent(row.repaid_percent)}</b><div className="portfolio-progress"><i style={{ width: `${progress}%` }} /></div></div>
          </div>

          <div className="portfolio-live-grid">
            <InfoPill label={`Einnahmen ${year}`} value={formatCurrency(income)} tone="good" />
            <InfoPill label={`Ausgaben ${year}`} value={formatCurrency(expenses)} tone={expenses > income ? "bad" : "neutral"} />
            <InfoPill label={`Mieten ${year}`} value={formatCurrency(rentIncome)} />
            <InfoPill label="NK aus Buchungen" value={formatCurrency(nebenkosten)} />
            <InfoPill label="Brutto-Rendite" value={formatPercent(grossObjectYield)} />
          </div>

          <div className="portfolio-info-grid refined-info">
            <section className="portfolio-edit-box"><h3>Eckdaten</h3><div className="portfolio-input-grid three"><label>Wohnfläche<input value={extra.livingArea} onChange={(e) => updateExtra(row.property_id, "livingArea", e.target.value)} placeholder="z.B. 150 m²" /></label><label>Zimmer<input value={extra.rooms} onChange={(e) => updateExtra(row.property_id, "rooms", e.target.value)} placeholder="z.B. 4" /></label><label>Objektwert<input value={extra.marketValue} onChange={(e) => updateExtra(row.property_id, "marketValue", e.target.value)} placeholder="z.B. 350.000 €" /></label></div><SaveExtraBar propertyId={row.property_id} dirty={!!dirtyExtras[row.property_id]} status={extraStatus[row.property_id]} onSave={saveExtra} /></section>
            <section className="portfolio-edit-box"><h3>Ausstattung</h3><label>Ausstattung / Merkmale<input value={extra.equipment} onChange={(e) => updateExtra(row.property_id, "equipment", e.target.value)} placeholder="Einbauküche, Keller, Balkon …" /></label><SaveExtraBar propertyId={row.property_id} dirty={!!dirtyExtras[row.property_id]} status={extraStatus[row.property_id]} onSave={saveExtra} /></section>
            <section className="portfolio-edit-box expose-box"><h3>Exposé</h3><div className="expose-actions"><button type="button" onClick={() => setExposePreview({ row, extra, image })}>Ansehen</button><button type="button" onClick={() => downloadGeneratedExpose(row, extra)}>PDF erstellen</button><button type="button" onClick={() => openUpload(row.property_id)}>PDF hochladen</button>{uploadedExpose ? <a href={uploadedExpose.dataUrl} download={uploadedExpose.fileName}>Download</a> : null}</div>{uploadedExpose ? <small>Aktuell: {uploadedExpose.fileName}</small> : <small>Noch kein PDF hochgeladen. Du kannst trotzdem ein Exposé aus den aktuellen Daten erstellen.</small>}</section>
            <section className="portfolio-edit-box wide"><h3>Mieterübersicht</h3><div className="portfolio-input-grid four"><label>Name<input value={extra.firstName} onChange={(e) => updateExtra(row.property_id, "firstName", e.target.value)} placeholder="Name" /></label><label>Nachname<input value={extra.lastName} onChange={(e) => updateExtra(row.property_id, "lastName", e.target.value)} placeholder="Nachname" /></label><label>Telefon<input value={extra.phone} onChange={(e) => updateExtra(row.property_id, "phone", e.target.value)} placeholder="Telefon" /></label><label>E-Mail<input value={extra.email} onChange={(e) => updateExtra(row.property_id, "email", e.target.value)} placeholder="E-Mail" type="email" /></label></div><div className="portfolio-input-grid three rent"><label>Kaltmiete<input value={extra.coldRent} onChange={(e) => updateExtra(row.property_id, "coldRent", e.target.value)} placeholder="z.B. 1.000,00 €" /></label><label>Betriebskosten / Nebenkosten<input value={extra.operatingCosts} onChange={(e) => updateExtra(row.property_id, "operatingCosts", e.target.value)} placeholder="z.B. 370,00 €" /></label><label>Gesamtmiete<input value={extra.totalRent} onChange={(e) => updateExtra(row.property_id, "totalRent", e.target.value)} placeholder="z.B. 1.370,00 €" /></label></div><SaveExtraBar propertyId={row.property_id} dirty={!!dirtyExtras[row.property_id]} status={extraStatus[row.property_id]} onSave={saveExtra} /></section>
          </div>
        </div>
      </article>;
    })}</section>

    {selectedImage ? <div className="portfolio-image-modal" role="dialog" aria-modal="true" onClick={() => setSelectedImage(null)}><div className="portfolio-image-modal-card" onClick={(event) => event.stopPropagation()}><button type="button" className="portfolio-image-modal-close" onClick={() => setSelectedImage(null)}>×</button><img src={selectedImage.imageUrl} alt={selectedImage.title} /><div className="portfolio-image-modal-caption"><strong>{selectedImage.title}</strong><span>{selectedImage.subtitle}</span></div></div></div> : null}

    {exposePreview ? <div className="expose-modal" role="dialog" aria-modal="true" onClick={() => setExposePreview(null)}><div className="expose-modal-card" onClick={(event) => event.stopPropagation()}><div className="expose-toolbar"><button type="button" onClick={() => setExposePreview(null)}>Schließen</button><button type="button" onClick={() => window.print()}>Als PDF speichern / drucken</button>{exposes[exposePreview.row.property_id] ? <a href={exposes[exposePreview.row.property_id].dataUrl} download={exposes[exposePreview.row.property_id].fileName}>Hochgeladenes PDF herunterladen</a> : null}</div><div className="expose-print-sheet"><div className="expose-cover">{exposePreview.image ? <img src={exposePreview.image.imageUrl} alt={exposePreview.image.title} /> : null}<div><span>Immobilien-Exposé</span><h1>{exposePreview.row.property_name}</h1><p>{exposePreview.image?.subtitle ?? ""}</p></div></div><div className="expose-facts"><div><span>Wohnfläche</span><b>{exposePreview.extra.livingArea || "–"}</b></div><div><span>Zimmer</span><b>{exposePreview.extra.rooms || "–"}</b></div><div><span>Kaltmiete</span><b>{exposePreview.extra.coldRent || "–"}</b></div><div><span>Nebenkosten</span><b>{exposePreview.extra.operatingCosts || "–"}</b></div><div><span>Gesamtmiete</span><b>{exposePreview.extra.totalRent || "–"}</b></div><div><span>Objektwert</span><b>{exposePreview.extra.marketValue || "–"}</b></div></div><section><h2>Ausstattung</h2><p>{exposePreview.extra.equipment || "Keine Ausstattung hinterlegt."}</p></section><section><h2>Finanzen</h2><p>Restschuld: <strong>{formatCurrency(exposePreview.row.last_balance)}</strong> · Tilgung gesamt: <strong>{formatCurrency(exposePreview.row.principal_total)}</strong> · Zinsen gesamt: <strong>{formatCurrency(exposePreview.row.interest_total)}</strong></p></section><section><h2>Kontakt / Mieter</h2><p>{[exposePreview.extra.firstName, exposePreview.extra.lastName].filter(Boolean).join(" ") || "–"}<br />{exposePreview.extra.phone || ""}<br />{exposePreview.extra.email || ""}</p></section></div></div></div> : null}
  </div>;
}
