import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileArchive,
  FileText,
  Image,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { PageHeader, SectionPanel } from "@/components/ui/professional";
import logo from "@/assets/koenen-brand-logo.webp";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type AiStatus = "idle" | "running" | "ready" | "blocked";

type AiChapterStatus = {
  chapter: string;
  status: "Bereit" | "Prüfen" | "Offen";
  note: string;
};

type AiReport = {
  generatedAt: string;
  statusLabel: string;
  summary: string;
  risks: string[];
  nextSteps: string[];
  chapterStatus: AiChapterStatus[];
  bankFazit: string;
};

type DocumentCoverage = "direct" | "package" | "missing";

type RequiredDocument = {
  label: string;
  examples: string;
  keywords: string[];
};

const requiredDocuments: RequiredDocument[] = [
  {
    label: "Exposé / Objektbeschreibung",
    examples: "Adresse, Wohnfläche, Kaufpreis, Miete, Bilder",
    keywords: ["expose", "exposé", "objekt", "verkauf", "angebot", "investment", "analyse"],
  },
  {
    label: "Grundrisse / Bauzeichnungen",
    examples: "Wohnungsgrundriss, Aufteilungsplan, Schnitt, Lageplan",
    keywords: ["grundriss", "zeichnung", "plan", "lageplan", "aufteil"],
  },
  {
    label: "Teilungserklärung / WEG-Unterlagen",
    examples: "Teilungserklärung, Gemeinschaftsordnung, Protokolle",
    keywords: ["teilung", "weg", "protokoll", "gemeinschaft"],
  },
  {
    label: "Energieausweis",
    examples: "Bedarfsausweis oder Verbrauchsausweis",
    keywords: ["energie", "verbrauchsausweis", "bedarfsausweis"],
  },
  {
    label: "Mietvertrag / Mieterliste",
    examples: "Mietvertrag, Miethöhe, Laufzeit, Nebenkosten",
    keywords: ["miet", "vertrag", "mieter"],
  },
  {
    label: "Wirtschaftsplan / Hausgeld",
    examples: "Hausgeld, Rücklage, umlagefähige Kosten",
    keywords: ["wirtschaftsplan", "hausgeld", "rücklage", "ruecklage"],
  },
  {
    label: "Finanzierungsdaten",
    examples: "Eigenkapital, Zins, Tilgung, Kaufnebenkosten",
    keywords: ["finanz", "zins", "tilgung", "darlehen", "bank", "investment", "analyse"],
  },
];

const reportChapters = [
  "Executive Summary und Objektübersicht",
  "Standort- und Marktanalyse",
  "Objektbilder, Grundrisse und Bauzeichnungen",
  "Dokumentenprüfung: Teilungserklärung, Energieausweis, Mietvertrag",
  "Wirtschaftsplan und Hausgeldanalyse",
  "Rendite-, Cashflow- und Finanzierungsanalyse",
  "WEG-Analyse und Risikoanalyse",
  "Kaufempfehlung und Bankfazit",
];

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 KB";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugifyFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "investment-bericht"
  );
}

function matchesDocument(file: UploadedFile, document: RequiredDocument) {
  const text = `${file.name} ${file.type}`.toLowerCase();
  return document.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function isZipPackage(file: UploadedFile) {
  const text = `${file.name} ${file.type}`.toLowerCase();
  return text.endsWith(".zip") || text.includes("zip") || text.includes("compressed");
}

function coverageWeight(coverage: DocumentCoverage) {
  if (coverage === "direct") return 1;
  if (coverage === "package") return 0.6;
  return 0;
}

function createFileId(file: File) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${file.name}-${file.size}-${file.lastModified}-${randomPart}`;
}

export default function InvestmentBericht() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [objectName, setObjectName] = useState("Neue Investition");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [equity, setEquity] = useState("");
  const [targetRent, setTargetRent] = useState("");
  const [location, setLocation] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiReport, setAiReport] = useState<AiReport | null>(null);

  const hasZipPackage = useMemo(() => files.some(isZipPackage), [files]);

  const coveredDocuments = useMemo(
    () =>
      requiredDocuments.map((document) => {
        const directMatch = files.some((file) => matchesDocument(file, document));
        const coverage: DocumentCoverage = directMatch ? "direct" : hasZipPackage ? "package" : "missing";
        return {
          ...document,
          covered: coverage !== "missing",
          coverage,
        };
      }),
    [files, hasZipPackage],
  );

  const readiness = Math.round(
    (coveredDocuments.reduce((sum, document) => sum + coverageWeight(document.coverage), 0) /
      coveredDocuments.length) *
      100,
  );

  const mailBody = encodeURIComponent(
    `Hallo,\n\nanbei/folgend bereite ich eine erste Finanzierungsprüfung für ${objectName || "eine neue Investition"} vor.\n\nBitte prüfen Sie auf Basis des Investmentberichts grob die mögliche Finanzierung, Beleihung, Eigenkapitalanforderung und Konditionsindikation.\n\nUnterlagen und Bericht werden separat übermittelt.\n\nViele Grüße`,
  );

  const aiReportText = useMemo(() => {
    if (!aiReport) return "";
    return [
      `${aiReport.statusLabel} - ${objectName || "Neue Investition"}`,
      `Erstellt: ${aiReport.generatedAt}`,
      "",
      "Executive Summary",
      aiReport.summary,
      "",
      "Kapitelstatus",
      ...aiReport.chapterStatus.map((item, index) => `${index + 1}. ${item.chapter}: ${item.status} - ${item.note}`),
      "",
      "Risiken / offene Prüfpositionen",
      ...aiReport.risks.map((risk) => `- ${risk}`),
      "",
      "Nächste Schritte",
      ...aiReport.nextSteps.map((step) => `- ${step}`),
      "",
      "Bankfazit",
      aiReport.bankFazit,
    ].join("\n");
  }, [aiReport, objectName]);

  async function copyAiReport() {
    if (!aiReportText) return;
    try {
      await navigator.clipboard.writeText(aiReportText);
      setCopyStatus("KI-Erstbewertung kopiert");
    } catch {
      setCopyStatus("Kopieren nicht möglich");
    }
  }

  const reportDocumentHtml = useMemo(() => {
    if (!aiReport) return "";
    const safeObjectName = escapeHtml(objectName || "Neue Investition");
    const safeLocation = escapeHtml(location || "noch offen");
    const safePurchasePrice = escapeHtml(purchasePrice || "noch offen");
    const safeEquity = escapeHtml(equity || "noch offen");
    const safeTargetRent = escapeHtml(targetRent || "noch offen");
    const fileRows = files.length
      ? files
          .map(
            (file) =>
              `<tr><td>${escapeHtml(file.name)}</td><td>${escapeHtml(formatFileSize(file.size))}</td><td>${escapeHtml(file.type || "Datei")}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="3">Keine Unterlagen gelistet.</td></tr>`;
    const chapterRows = aiReport.chapterStatus
      .map(
        (item, index) =>
          `<tr><td>${index + 1}</td><td>${escapeHtml(item.chapter)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.note)}</td></tr>`,
      )
      .join("");
    const riskItems = aiReport.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");
    const stepItems = aiReport.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Investmentbericht ${safeObjectName}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; line-height: 1.45; }
    .cover { border: 1px solid #dbe3ef; border-radius: 18px; padding: 28px; margin-bottom: 28px; }
    .logo { width: 88px; height: 88px; object-fit: cover; border-radius: 16px; border: 1px solid #dbe3ef; }
    .eyebrow { color: #2563eb; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 22px; }
    h1 { font-size: 30px; margin: 8px 0 12px; }
    h2 { font-size: 20px; margin: 26px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    h3 { font-size: 15px; margin: 14px 0 6px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
    .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #f8fafc; }
    .label { color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .value { margin-top: 4px; font-weight: 800; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; font-size: 12px; }
    th { background: #f1f5f9; color: #334155; }
    .status { display: inline-block; border-radius: 999px; background: #ecfdf5; color: #047857; padding: 4px 10px; font-weight: 800; }
    .warning { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px; }
    .footer { margin-top: 34px; color: #64748b; font-size: 11px; }
  </style>
</head>
<body>
  <section class="cover">
    <img class="logo" src="${logo}" alt="Koenen Immobilien Logo" />
    <div class="eyebrow">Koenen Investment- und Finanzierungsanalyse</div>
    <h1>${safeObjectName}</h1>
    <p><span class="status">${escapeHtml(aiReport.statusLabel)}</span></p>
    <p>${escapeHtml(aiReport.summary)}</p>
    <div class="meta">
      <div class="box"><div class="label">Standort</div><div class="value">${safeLocation}</div></div>
      <div class="box"><div class="label">Kaufpreis</div><div class="value">${safePurchasePrice}</div></div>
      <div class="box"><div class="label">Eigenkapital</div><div class="value">${safeEquity}</div></div>
      <div class="box"><div class="label">Soll-/Zielmiete</div><div class="value">${safeTargetRent}</div></div>
      <div class="box"><div class="label">Berichtsdatum</div><div class="value">${escapeHtml(aiReport.generatedAt)}</div></div>
      <div class="box"><div class="label">Berichtsreife</div><div class="value">${readiness}%</div></div>
    </div>
  </section>

  <h2>1. Executive Summary und Objektübersicht</h2>
  <p>${escapeHtml(aiReport.summary)}</p>

  <h2>2. Standort- und Marktanalyse</h2>
  <p>Standort: <strong>${safeLocation}</strong>. Marktvergleich und Mikrolage sollten im nächsten Prüfschritt ergänzt werden.</p>

  <h2>3. Objektbilder, Grundrisse und Bauzeichnungen</h2>
  <p>Vorliegende Dateien werden nachfolgend dokumentiert. Bilder, Grundrisse und Bauzeichnungen sind im finalen Bericht einzeln zuzuordnen.</p>

  <h2>4. Dokumentenprüfung</h2>
  <table>
    <thead><tr><th>Datei</th><th>Größe</th><th>Typ</th></tr></thead>
    <tbody>${fileRows}</tbody>
  </table>

  <h2>5. Wirtschaftsplan und Hausgeldanalyse</h2>
  <p>Wirtschaftsplan, Hausgeld, Rücklage und umlagefähige Kosten sind gegen die Unterlagen zu prüfen.</p>

  <h2>6. Rendite-, Cashflow- und Finanzierungsanalyse</h2>
  <div class="meta">
    <div class="box"><div class="label">Kaufpreis</div><div class="value">${safePurchasePrice}</div></div>
    <div class="box"><div class="label">Eigenkapital</div><div class="value">${safeEquity}</div></div>
    <div class="box"><div class="label">Soll-/Zielmiete</div><div class="value">${safeTargetRent}</div></div>
    <div class="box"><div class="label">Bewertungsstand</div><div class="value">${readiness}%</div></div>
  </div>

  <h2>7. WEG-Analyse und Risikoanalyse</h2>
  <div class="warning">
    <h3>Risiken / offene Prüfpositionen</h3>
    <ul>${riskItems}</ul>
  </div>

  <h2>8. Kaufempfehlung und Bankfazit</h2>
  <p><strong>${escapeHtml(aiReport.bankFazit)}</strong></p>
  <h3>Nächste Schritte</h3>
  <ul>${stepItems}</ul>

  <h2>Kapitelstatus</h2>
  <table>
    <thead><tr><th>#</th><th>Kapitel</th><th>Status</th><th>Hinweis</th></tr></thead>
    <tbody>${chapterRows}</tbody>
  </table>

  <p class="footer">Automatisch erstellt in der Koenen Immobilien App. Dieser Bericht ist eine strukturierte Erstbewertung und ersetzt keine rechtliche, technische oder steuerliche Detailprüfung.</p>
</body>
</html>`;
  }, [aiReport, equity, files, location, objectName, purchasePrice, readiness, targetRent]);

  function downloadWordReport() {
    if (!reportDocumentHtml) return;
    const blob = new Blob(["\ufeff", reportDocumentHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugifyFileName(objectName)}-investmentbericht.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function createPdfReport() {
    if (!reportDocumentHtml) return;
    const reportWindow = window.open("", "_blank", "width=980,height=1200");
    if (!reportWindow) {
      setCopyStatus("PDF-Fenster konnte nicht geöffnet werden");
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(reportDocumentHtml);
    reportWindow.document.close();
    reportWindow.setTimeout(() => {
      reportWindow.focus();
      reportWindow.print();
    }, 300);
  }

  function removeFile(fileId: string) {
    setFiles((current) => current.filter((file) => file.id !== fileId));
    setAiStatus("idle");
    setAiReport(null);
  }

  function clearFiles() {
    setFiles([]);
    setAiStatus("idle");
    setAiReport(null);
  }

  function startAiEvaluation() {
    if (!files.length) {
      setAiStatus("blocked");
      setAiReport({
        generatedAt: new Date().toLocaleString("de-DE"),
        statusLabel: "Unterlagen fehlen",
        summary:
          "Für eine KI-Erstbewertung müssen zuerst Exposé, ZIP/PDF-Unterlagen oder Finanzierungsdaten ausgewählt werden.",
        risks: ["Keine Unterlagen ausgewählt. Eine belastbare Bewertung ist aktuell nicht möglich."],
        nextSteps: ["Unterlagen hochladen", "Objektstammdaten prüfen", "KI-Bewertung erneut starten"],
        chapterStatus: reportChapters.map((chapter) => ({
          chapter,
          status: "Offen",
          note: "Noch keine Unterlagen vorhanden.",
        })),
        bankFazit: "Noch kein Bankfazit möglich, weil keine Unterlagenbasis vorhanden ist.",
      });
      return;
    }

    setAiStatus("running");
    setCopyStatus("");

    window.setTimeout(() => {
      const missingDocuments = coveredDocuments.filter((document) => document.coverage === "missing");
      const packageDocuments = coveredDocuments.filter((document) => document.coverage === "package");
      const hasFinanceInputs = Boolean(purchasePrice || equity || targetRent);
      const completenessLabel =
        readiness >= 85 ? "gut vorbereitet" : readiness >= 55 ? "Unterlagenpaket vorhanden" : "noch unvollständig";

      const risks = [
        ...missingDocuments.map((document) => `${document.label} fehlt oder ist anhand der Dateinamen nicht erkennbar.`),
        ...packageDocuments.map(
          (document) =>
            `${document.label} ist vermutlich im ZIP-Unterlagenpaket enthalten, muss aber inhaltlich noch geprüft werden.`,
        ),
        !hasFinanceInputs
          ? "Kaufpreis, Eigenkapital oder Zielmiete sind noch nicht vollständig gepflegt; Rendite und Finanzierung bleiben Annahmen."
          : "",
        hasZipPackage
          ? "ZIP-Datei erkannt: Für eine echte Inhaltsprüfung muss der spätere Backend-Dienst die ZIP-Datei entpacken und die enthaltenen Dokumente auslesen."
          : "",
      ].filter(Boolean);

      const nextSteps = [
        missingDocuments.length
          ? `Fehlende Unterlagen nachreichen: ${missingDocuments.map((document) => document.label).join(", ")}.`
          : packageDocuments.length
            ? "ZIP-Unterlagenpaket entpacken bzw. per Backend analysieren, damit die enthaltenen Dokumente kapitelgenau geprüft werden."
          : "Unterlagenbasis ist für den Erstbericht vollständig genug; Inhalte im nächsten Schritt fachlich prüfen.",
        "Bankfähigen DOCX-Bericht mit klaren Annahmen, offenen Punkten und Kaufempfehlung erstellen.",
        "Nach finaler Prüfung Bericht, Exposé, Wirtschaftsplan, Mietvertrag und Energieausweis an Bank/Finanzberater senden.",
      ];

      const chapterStatus: AiChapterStatus[] = reportChapters.map((chapter) => {
        const lowerChapter = chapter.toLowerCase();
        const matchingDocument = coveredDocuments.find((document) =>
          document.keywords.some((keyword) => lowerChapter.includes(keyword.toLowerCase())),
        );

        if (chapter.includes("Executive")) {
          return {
            chapter,
            status: files.length ? "Bereit" : "Offen",
            note: `${files.length} Unterlage(n) und Objektstammdaten liegen für die Kurzbewertung vor.`,
          };
        }

        if (chapter.includes("Rendite") || chapter.includes("Finanzierungsanalyse")) {
          return {
            chapter,
            status: hasFinanceInputs ? "Prüfen" : "Offen",
            note: hasFinanceInputs
              ? "Finanzierungsannahmen sind vorhanden, müssen aber rechnerisch validiert werden."
              : "Kaufpreis, Eigenkapital und Zielmiete ergänzen.",
          };
        }

        if (chapter.includes("Standort")) {
          return {
            chapter,
            status: location ? "Prüfen" : "Offen",
            note: location ? "Standort ist gepflegt; Marktvergleich ergänzen." : "Standort/Adresse ergänzen.",
          };
        }

        return {
          chapter,
          status: matchingDocument?.covered ? "Prüfen" : "Offen",
          note: matchingDocument?.coverage === "direct"
            ? "Passende Unterlagen erkannt; Inhalte im Bericht prüfen."
            : matchingDocument?.coverage === "package"
              ? "ZIP-Unterlagenpaket erkannt; Inhalte müssen für dieses Kapitel entpackt und geprüft werden."
            : "Benötigte Unterlagen fehlen oder sind nicht eindeutig benannt.",
        };
      });

      setAiReport({
        generatedAt: new Date().toLocaleString("de-DE"),
        statusLabel: `KI-Erstbewertung: ${completenessLabel}`,
        summary: `Die Unterlagenbasis für ${objectName || "die neue Investition"} ist zu ${readiness}% abgedeckt. ${hasZipPackage ? "Ein ZIP-Unterlagenpaket wurde erkannt und wird als vorhandene, aber noch nicht inhaltlich geprüfte Unterlagenbasis bewertet." : "Die App bewertet die erkennbaren Dateinamen und Objektstammdaten."} Daraus kann die App sofort eine strukturierte Erstbewertung, Kapitelstatus, offene Prüfpositionen und ein konservatives Bankfazit vorbereiten. Eine vollständige Dokumenteninhaltsanalyse benötigt die sichere ChatGPT/OpenAI-Backend-Anbindung.`,
        risks: risks.length ? risks : ["Keine wesentlichen Unterlagenlücken anhand der Dateinamen erkannt."],
        nextSteps,
        chapterStatus,
        bankFazit:
          readiness >= 85 && hasFinanceInputs
            ? "Grundsätzlich bankfähig vorbereitbar. Vor Versand sollten Rendite, Cashflow, WEG-Risiken und Dokumenteninhalte final geprüft werden."
            : hasZipPackage && hasFinanceInputs
              ? "Als Vorprüfung nutzbar. Für ein bankfähiges Ergebnis müssen die ZIP-Inhalte noch automatisch oder manuell dokumentengenau ausgewertet werden."
              : "Noch nicht final bankfähig. Erst fehlende Unterlagen und Finanzierungsannahmen ergänzen, dann DOCX-Bericht erzeugen.",
      });
      setAiStatus("ready");
    }, 650);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Investment"
        title="Investment-Bericht"
        description="KI-gestützter Arbeitsbereich für neue Immobilienkäufe: Unterlagen sammeln, Berichtskapitel vorbereiten, ChatGPT-Prüfprompt erstellen und Bank-/Finanzberaterpaket vorbereiten."
        meta={[
          { label: "Output", value: "DOCX-Bericht Kapitel 1-8" },
          { label: "Ziel", value: "Bank- und Finanzierungsprüfung" },
        ]}
      >
        <button
          type="button"
          onClick={startAiEvaluation}
          disabled={aiStatus === "running"}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {aiStatus === "running" ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          KI-Bewertung starten
        </button>
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
              <img src={logo} alt="Koenen Immobilien Logo" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Deckblatt</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Koenen Investment- und Finanzierungsanalyse</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Das Deckblatt soll Logo, Objektadresse, Kaufpreis, Bearbeitungsdatum, Berichtsstatus und Empfängergruppe enthalten. Die finale DOCX-Erstellung erfolgt über ChatGPT oder später über eine direkte Backend-Automation.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Objekt / Adresse
              <input value={objectName} onChange={(event) => setObjectName(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none focus:border-slate-400" />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Standort
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="z.B. Innenstadt, Stadtteil, PLZ" className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none focus:border-slate-400" />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Kaufpreis
              <input value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} placeholder="z.B. 305.000 EUR" className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none focus:border-slate-400" />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Eigenkapital
              <input value={equity} onChange={(event) => setEquity(event.target.value)} placeholder="z.B. 60.000 EUR" className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none focus:border-slate-400" />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700 md:col-span-2">
              Soll-/Zielmiete
              <input value={targetRent} onChange={(event) => setTargetRent(event.target.value)} placeholder="z.B. 1.250 EUR kalt monatlich" className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none focus:border-slate-400" />
            </label>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Berichtsreife</p>
            <div className="mt-3 text-4xl font-black text-emerald-900">{readiness}%</div>
            <p className="mt-2 text-sm font-bold leading-6 text-emerald-800">
              Dokumentenabdeckung auf Basis der Dateinamen. ZIP-Pakete zählen als vorhandene, aber noch zu prüfende Unterlagenbasis.
            </p>
            <button
              type="button"
              onClick={startAiEvaluation}
              disabled={aiStatus === "running"}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiStatus === "running" ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              KI-Bewertung starten
            </button>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Bankpaket</p>
            <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700">
              <div className="flex items-center gap-2"><ShieldCheck size={17} /> konservative Annahmen</div>
              <div className="flex items-center gap-2"><Banknote size={17} /> Finanzierungssicht</div>
              <div className="flex items-center gap-2"><Mail size={17} /> Berater-Versand vorbereiten</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionPanel
          eyebrow="Unterlagen"
          title="Dokumente hochladen"
          description="Wähle Exposé, PDF-Unterlagen, Bilder, Grundrisse und Finanzierungsdaten aus. In diesem Schritt werden Dateien lokal im Browser gelistet; die Übertragung zu ChatGPT erfolgt bewusst erst durch dich."
        >
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-slate-400 hover:bg-white">
            <Upload size={28} className="text-slate-700" />
            <span className="mt-3 text-base font-black text-slate-950">Unterlagen auswählen</span>
            <span className="mt-1 text-sm font-semibold text-slate-600">PDF, DOCX, XLSX, JPG, PNG oder ZIP</span>
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []).map((file) => ({
                  id: createFileId(file),
                  name: file.name,
                  size: file.size,
                  type: file.type,
                }));
                setFiles((current) => [...current, ...selected]);
                setAiStatus("idle");
                setAiReport(null);
                event.target.value = "";
              }}
            />
          </label>

          {files.length ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearFiles}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700"
              >
                <Trash2 size={15} />
                Alle Dateien löschen
              </button>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {files.length ? files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={18} className="shrink-0 text-slate-500" />
                  <span className="truncate text-sm font-black text-slate-900">{file.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-black text-slate-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    aria-label={`${file.name} löschen`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-600">
                Noch keine Unterlagen ausgewählt.
              </div>
            )}
          </div>
        </SectionPanel>

        <SectionPanel
          eyebrow="Checkliste"
          title="Dokumentenprüfung"
          description="Die Checkliste zeigt, welche Quellen für einen bankfähigen Erstbericht typischerweise notwendig sind."
        >
          <div className="grid gap-3">
            {coveredDocuments.map((document) => (
              <div key={document.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <CheckCircle2 className={
                  document.coverage === "direct"
                    ? "mt-0.5 shrink-0 text-emerald-600"
                    : document.coverage === "package"
                      ? "mt-0.5 shrink-0 text-amber-500"
                      : "mt-0.5 shrink-0 text-slate-300"
                } size={20} />
                <div>
                  <div className="text-sm font-black text-slate-950">{document.label}</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{document.examples}</div>
                  {document.coverage === "package" ? (
                    <div className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
                      Im ZIP-Paket prüfen
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </section>

      <SectionPanel
        eyebrow="KI-Erstbewertung"
        title="Direkte Bewertung in der App"
        description="Mit einem Klick erstellt die App sofort eine strukturierte Vorbewertung ohne zusätzliches ChatGPT-Fenster. Die vollständige Inhaltsanalyse der Dokumente benötigt später eine sichere Backend-KI-Anbindung."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={startAiEvaluation}
            disabled={aiStatus === "running"}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiStatus === "running" ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            KI-Bewertung starten
          </button>
          {aiReportText ? (
            <button
              type="button"
              onClick={() => void copyAiReport()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm"
            >
              <Copy size={18} />
              Ergebnis kopieren
            </button>
          ) : null}
          {aiReport ? (
            <>
              <button
                type="button"
                onClick={downloadWordReport}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm"
              >
                <Download size={18} />
                Word herunterladen
              </button>
              <button
                type="button"
                onClick={createPdfReport}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm"
              >
                <FileText size={18} />
                PDF erstellen
              </button>
            </>
          ) : null}
          {copyStatus ? <span className="self-center text-sm font-black text-emerald-700">{copyStatus}</span> : null}
        </div>

        {aiStatus === "running" ? (
          <div className="mt-5 rounded-[22px] border border-blue-100 bg-blue-50 p-5 text-sm font-bold text-blue-800">
            Unterlagen werden bewertet und Kapitelstatus wird vorbereitet...
          </div>
        ) : null}

        {aiReport ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{aiReport.statusLabel}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{aiReport.summary}</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Bankfazit</div>
                <p className="mt-2 text-sm font-black leading-6 text-slate-950">{aiReport.bankFazit}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Risiken / offene Punkte</div>
                <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-amber-900">
                  {aiReport.risks.map((risk) => <li key={risk}>- {risk}</li>)}
                </ul>
              </div>
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Nächste Schritte</div>
                <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-emerald-900">
                  {aiReport.nextSteps.map((step) => <li key={step}>- {step}</li>)}
                </ul>
              </div>
            </div>

            <div className="xl:col-span-2">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {aiReport.chapterStatus.map((item, index) => (
                  <div key={item.chapter} className="rounded-[20px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-white">{index + 1}</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${
                        item.status === "Bereit"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.status === "Prüfen"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-black leading-5 text-slate-950">{item.chapter}</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </SectionPanel>

      <SectionPanel
        eyebrow="DOCX"
        title="Berichtskapitel"
        description="Diese Kapitelstruktur wird als Zielstruktur für den KI-Bericht verwendet."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {reportChapters.map((chapter, index) => (
            <div key={chapter} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                {index + 1}
              </div>
              <h3 className="mt-4 text-sm font-black leading-5 text-slate-950">{chapter}</h3>
            </div>
          ))}
        </div>
      </SectionPanel>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <SectionPanel
          eyebrow="Export"
          title="Bericht herunterladen"
          description="Sobald eine KI-Erstbewertung erstellt wurde, kannst du den Bericht direkt als Word-Datei herunterladen oder über den Browser als PDF speichern."
        >
          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3 text-sm font-black text-slate-950"><Download size={18} /> Word-Bericht</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Erstellt ein Word-kompatibles Dokument mit Deckblatt, Kapitel 1-8, Risiken, nächsten Schritten und Bankfazit.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3 text-sm font-black text-slate-950"><FileText size={18} /> PDF-Bericht</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Öffnet die druckoptimierte Berichtsversion. Im Druckdialog kannst du “Als PDF sichern” auswählen.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={downloadWordReport}
              disabled={!aiReport}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} />
              Word herunterladen
            </button>
            <button
              type="button"
              onClick={createPdfReport}
              disabled={!aiReport}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText size={18} />
              PDF erstellen
            </button>
          </div>
          {!aiReport ? (
            <p className="mt-4 text-sm font-bold text-slate-500">Bitte zuerst “KI-Bewertung starten”, dann wird der Download aktiviert.</p>
          ) : null}
        </SectionPanel>

        <SectionPanel
          eyebrow="Weitergabe"
          title="Bank und Finanzberater"
          description="Nach Erstellung des DOCX/PDF-Berichts kannst du ihn zusammen mit Unterlagen an Bank oder Finanzberater senden."
        >
          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3 text-sm font-black text-slate-950"><FileArchive size={18} /> Beraterpaket</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Bericht, Exposé, Grundriss, Mietvertrag, Wirtschaftsplan, Energieausweis und Finanzierungsannahmen bündeln.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3 text-sm font-black text-slate-950"><ClipboardCheck size={18} /> Offene Punkte</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Fehlende Unterlagen, rechtliche Risiken und Annahmen im Bericht als Prüfliste aufführen.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3 text-sm font-black text-slate-950"><Image size={18} /> Visuals</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Objektbilder, Lage, Grundrisse und Bauzeichnungen in Kapitel 3 aufnehmen.</p>
            </div>
          </div>
          <a
            href={`mailto:?subject=${encodeURIComponent(`Finanzierungsprüfung ${objectName || "Immobilieninvestment"}`)}&body=${mailBody}`}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 no-underline shadow-sm"
          >
            <Mail size={18} />
            E-Mail an Bank/Finanzberater vorbereiten
          </a>
        </SectionPanel>
      </section>
    </div>
  );
}
