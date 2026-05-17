import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Calculator, CheckCircle2, FileText, Home, Lock, Pencil, Plus, Printer, Trash2, UserSquare2, Warehouse } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAppData, type FinanceEntry as AppFinanceEntry } from "../state/AppDataContext";

type AllocationType = "allocationKey" | "persons" | "directAmount" | "heatingDirect";

type ObjectOption = { objekt_code: string; label: string };
type ApartmentRow = { id: string; label: string; tenantName: string; area: number; allocationKey: number; persons: number; occupancyMonths: number; advancePayments: number; co2LandlordDeductionKalo: number; active: boolean };
type CostRow = { id: string; label: string; amount: number; allocation: AllocationType; totalKey: number; apartmentKey: number; directAmount: number; prorateByOccupancy: boolean; note: string };
type HeatingSettings = { totalHeatingCost: number; totalWarmWaterCost: number; totalCo2Cost: number; totalConsumptionKwh: number; emissionFactor: number; heatedArea: number };
type BuildingMeta = { propertyCode: string; propertyLabel: string; billingYear: number; periodFrom: string; periodTo: string; landlordName: string; landlordAddress: string; attachmentReferences: string; locked: boolean };
type BillingWorkspace = { meta: BuildingMeta; apartments: ApartmentRow[]; costs: CostRow[]; heating: HeatingSettings; selectedApartmentId: string | null };
type BillingRecord = { id: string; name: string; workspace: BillingWorkspace };
type BillingCollection = { version: 2; selectedBillingId: string | null; billings: BillingRecord[] };
type Co2StageResult = { stage: number; tenantPercent: number; landlordPercent: number };

function createId() { return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function roundMoney(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }
function parseGermanNumber(value: string) { const n = Number(value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function formatCurrency(value: number) { return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0); }
function formatNumber(value: number, decimals = 2) { return Number.isFinite(value) ? value.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : ""; }
function formatFlex(value: number) { return Number.isFinite(value) ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : ""; }
function formatDate(value: string) { const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("de-DE").format(d); }
function safeFilename(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "NK-Abrechnung"; }
function downloadText(filename: string, content: string) { const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function allocationLabel(t: AllocationType) { return t === "allocationKey" ? "Umlageschlüssel" : t === "persons" ? "Personen/Tage" : t === "directAmount" ? "Direktbetrag" : "KALO-Direktbetrag"; }
function getCo2Stage(co2PerSqm: number): Co2StageResult { if (co2PerSqm < 12) return { stage: 1, tenantPercent: 100, landlordPercent: 0 }; if (co2PerSqm < 17) return { stage: 2, tenantPercent: 90, landlordPercent: 10 }; if (co2PerSqm < 22) return { stage: 3, tenantPercent: 80, landlordPercent: 20 }; if (co2PerSqm < 27) return { stage: 4, tenantPercent: 70, landlordPercent: 30 }; if (co2PerSqm < 32) return { stage: 5, tenantPercent: 60, landlordPercent: 40 }; if (co2PerSqm < 37) return { stage: 6, tenantPercent: 50, landlordPercent: 50 }; if (co2PerSqm < 42) return { stage: 7, tenantPercent: 40, landlordPercent: 60 }; if (co2PerSqm < 47) return { stage: 8, tenantPercent: 30, landlordPercent: 70 }; if (co2PerSqm < 52) return { stage: 9, tenantPercent: 20, landlordPercent: 80 }; return { stage: 10, tenantPercent: 5, landlordPercent: 95 }; }
function isGarage(o: ObjectOption) { const t = `${o.objekt_code} ${o.label}`.toLowerCase(); return t.includes("garage") || t.includes("garagen") || t.includes("tg") || t.includes("tiefgarage"); }

const DEFAULT_COSTS: Array<Omit<CostRow, "id">> = [
  { label: "Wasser / Kanal", amount: 4357.3, allocation: "allocationKey", totalKey: 9911, apartmentKey: 365, directAmount: 0, prorateByOccupancy: true, note: "Colmarer 2025: erst Jahresanteil laut Hausverwaltung 160,47 € (= 4.357,30 × 365 / 9.911), dann bei 7 Monaten 160,47 / 12 × 7 = 93,61 €." },
  { label: "Heiz- und Warmwasserkosten", amount: 23175.9, allocation: "heatingDirect", totalKey: 0, apartmentKey: 0, directAmount: 474.25, prorateByOccupancy: false, note: "KALO-Direktbetrag hier eintragen. Erste Periode 474,25 €, zweite Periode 353,44 €. Keine zusätzliche Wärmeversorgung anlegen." },
  { label: "Straßenreinigung", amount: 2119.29, allocation: "allocationKey", totalKey: 10000, apartmentKey: 170.99, directAmount: 0, prorateByOccupancy: false, note: "MEA gesamt" },
  { label: "Müllabfuhr", amount: 3338.39, allocation: "allocationKey", totalKey: 9911, apartmentKey: 365, directAmount: 0, prorateByOccupancy: true, note: "Colmarer 2025: Jahresanteil 122,95 € (= 3.338,39 × 365 / 9.911), bei 7 Monaten 71,72 €." },
  { label: "Gebäudereinigung", amount: 7699.48, allocation: "allocationKey", totalKey: 9613.01, apartmentKey: 170.99, directAmount: 0, prorateByOccupancy: false, note: "MEA ohne Garagen" },
  { label: "Gartenpflege", amount: 3768.12, allocation: "allocationKey", totalKey: 10000, apartmentKey: 170.99, directAmount: 0, prorateByOccupancy: false, note: "MEA gesamt" },
  { label: "Allgemeinstrom", amount: 696.01, allocation: "allocationKey", totalKey: 9911, apartmentKey: 365, directAmount: 0, prorateByOccupancy: true, note: "Colmarer 2025: Jahresanteil 25,63 € (= 696,01 × 365 / 9.911), bei 7 Monaten 14,95 €." },
  { label: "Haftpflichtversicherung", amount: 449.88, allocation: "allocationKey", totalKey: 10000, apartmentKey: 170.99, directAmount: 0, prorateByOccupancy: false, note: "MEA gesamt" },
  { label: "Gebäudeversicherung", amount: 10970.93, allocation: "allocationKey", totalKey: 10000, apartmentKey: 170.99, directAmount: 0, prorateByOccupancy: false, note: "MEA gesamt" },
  { label: "Glasbruchschadenversicherung", amount: 340.74, allocation: "allocationKey", totalKey: 10000, apartmentKey: 170.99, directAmount: 0, prorateByOccupancy: false, note: "MEA gesamt" },
  { label: "Wartung Pumpen / Hebeanlage", amount: 201.11, allocation: "allocationKey", totalKey: 10000, apartmentKey: 170.99, directAmount: 0, prorateByOccupancy: false, note: "MEA gesamt" },
  { label: "Grundsteuer", amount: 321.6, allocation: "directAmount", totalKey: 0, apartmentKey: 0, directAmount: 321.6, prorateByOccupancy: false, note: "Direkt laut Bescheid / eigener Ansatz" },
  { label: "Dachrinnenreinigung", amount: 0, allocation: "directAmount", totalKey: 0, apartmentKey: 0, directAmount: 0, prorateByOccupancy: false, note: "Nur eintragen, wenn Kosten vorhanden" },
];

function createDefaultWorkspace(year: number, object?: ObjectOption): BillingWorkspace {
  const id = createId();
  return { meta: { propertyCode: object?.objekt_code ?? "", propertyLabel: object?.label ?? "Bitte Objekt wählen", billingYear: year, periodFrom: `${year}-01-01`, periodTo: `${year}-12-31`, landlordName: "", landlordAddress: "", attachmentReferences: "Hausverwaltungsabrechnung\nKALO-Heizkostenabrechnung / CO₂-Anlage\nGrundsteuerbescheid / Versicherungsnachweise / Rechnungen", locked: false }, apartments: [{ id, label: "Wohnung 1", tenantName: "", area: 33.79, allocationKey: 170.99, persons: 1, occupancyMonths: 12, advancePayments: 0, co2LandlordDeductionKalo: 0, active: true }], costs: DEFAULT_COSTS.map((c) => ({ ...c, id: createId() })), heating: { totalHeatingCost: 22968.84, totalWarmWaterCost: 0, totalCo2Cost: 2178.06, totalConsumptionKwh: 181071, emissionFactor: 0.2664, heatedArea: 2079.38 }, selectedApartmentId: id };
}


type BillingPreset = {
  key: string;
  title: string;
  description: string;
  heatingMode: "LANDLORD_BILLS_HEATING" | "TENANT_DIRECT_CONTRACT";
  totalArea?: number;
  usableArea?: number;
  defaultPeriodFrom?: string;
  defaultPeriodTo?: string;
  apartment: Omit<ApartmentRow, "id" | "active">;
  costs: Array<Omit<CostRow, "id">>;
  attachments: string;
  note: string;
  heating?: HeatingSettings;
};

function containsAny(source: string, words: string[]) {
  const normalized = source.toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function makeCost(label: string, amount: number, allocation: AllocationType, totalKey: number, apartmentKey: number, directAmount: number, note: string, prorateByOccupancy = false): Omit<CostRow, "id"> {
  return { label, amount, allocation, totalKey, apartmentKey, directAmount, prorateByOccupancy, note };
}

function getBillingPreset(object: ObjectOption | null | undefined, year: number): BillingPreset | null {
  const text = `${object?.objekt_code ?? ""} ${object?.label ?? ""}`.toLowerCase();

  if (containsAny(text, ["elsasser", "elsässer"])) {
    return {
      key: "elsasser",
      title: "Elsasser Str. 52 · kalte NK · Wasser nach Techem-Verbrauch",
      description: "Heizung/Gas läuft direkt über den Mieter. Die App rechnet nur kalte Betriebskosten und Wasser/Abwasser nach Techem-Direktbetrag ab.",
      heatingMode: "TENANT_DIRECT_CONTRACT",
      totalArea: 422,
      usableArea: 506.4,
      defaultPeriodFrom: `${year}-11-01`,
      defaultPeriodTo: `${year + 1}-10-31`,
      apartment: { label: "WE 3 · Hochparterre vorne", tenantName: "", area: 39, allocationKey: 100, persons: 1, occupancyMonths: 12, advancePayments: 120 * 12, co2LandlordDeductionKalo: 0 },
      costs: [
        makeCost("Gebäudeversicherung", 371.54, "directAmount", 0, 0, 371.54, "WEG-Abrechnung 2024/2025: umlagefähiger Anteil WE 3; mietvertraglich als Versicherung umlagefähig."),
        makeCost("Haftpflichtversicherung", 11.44, "directAmount", 0, 0, 11.44, "WEG-Abrechnung 2024/2025: umlagefähiger Anteil WE 3."),
        makeCost("Straßenreinigung", 38.65, "directAmount", 0, 0, 38.65, "WEG-Abrechnung 2024/2025: umlagefähiger Anteil WE 3; §35a-relevant möglich."),
        makeCost("Wasser / Abwasser Techem", 328.57, "directAmount", 0, 0, 328.57, "Techem-Kaltwasserabrechnung: Verbrauch Wohnung 47,400 m³; Direktbetrag 328,57 €."),
        makeCost("Gartenwasser", 14.72, "directAmount", 0, 0, 14.72, "WEG-Abrechnung 2024/2025: umlagefähiger Anteil WE 3."),
        makeCost("Hausstrom / Allgemeinstrom", 17.86, "directAmount", 0, 0, 17.86, "WEG-Abrechnung 2024/2025: umlagefähiger Anteil WE 3."),
        makeCost("Schornsteinfeger", 0, "directAmount", 0, 0, 0, "Umlagefähig, wenn Rechnung vorhanden; Betrag eintragen."),
        makeCost("Thermenwartung", 0, "directAmount", 0, 0, 0, "Umlagefähig laut Mietvertragslogik, wenn Rechnung vorhanden; Heizung/Gas selbst läuft direkt über Mieter."),
      ],
      attachments: "Hausgeldabrechnung Elsasser Str. 52 01.11.2024–31.10.2025\nTechem Kaltwasserabrechnung\nMietvertragliche Betriebskostenklausel\nBelege Schornsteinfeger/Thermenwartung, falls vorhanden",
      note: "Nicht umlagefähig und deshalb nicht als Kostenposition ansetzen: Reparaturen, Verwaltergebühren, Bankgebühren, Rücklage, Gas/Heizkosten des Mieters.",
    };
  }

  if (text.includes("fürther") || text.includes("fuerther") || text.includes("further")) {
    return {
      key: "fuerther",
      title: "Fürther Str. 70–74 · Personentage / je Wohnung / MEA",
      description: "Heizung/Gas läuft direkt über den Mieter. Müll und Wasser laufen nach Personentagen, mehrere Kostenarten je Wohnung, Versicherungen/Sonstige nach MEA.",
      heatingMode: "TENANT_DIRECT_CONTRACT",
      totalArea: 829,
      usableArea: 994.8,
      defaultPeriodFrom: `${year}-01-01`,
      defaultPeriodTo: `${year}-12-31`,
      apartment: { label: "Wohnung Nr. 7", tenantName: "", area: 45, allocationKey: 524, persons: 1, occupancyMonths: 12, advancePayments: 110 * 12, co2LandlordDeductionKalo: 0 },
      costs: [
        makeCost("Versicherungen", 7173.60, "allocationKey", 10000, 524, 0, "Miteigentumsanteil 524/10000; umlagefähig laut WEG-Abrechnung und Mietvertrag."),
        makeCost("Gebäudereinigung", 4010.64, "allocationKey", 14, 1, 0, "Umlageschlüssel je Wohnung: 1 von 14 Wohnungen."),
        makeCost("Gehwegreinigung", 702.07, "allocationKey", 14, 1, 0, "Umlageschlüssel je Wohnung: 1 von 14 Wohnungen."),
        makeCost("Gartenpflege", 1100.80, "allocationKey", 14, 1, 0, "Umlageschlüssel je Wohnung: 1 von 14 Wohnungen."),
        makeCost("Müllabfuhr", 4638.28, "persons", 8249.64, 366, 0, "Personentage: Wohnung Nr. 7 = 1 Person ganzjährig = 366 Personentage."),
        makeCost("Wasser", 4694.21, "persons", 8249.64, 366, 0, "Personentage: Wohnung Nr. 7 = 1 Person ganzjährig = 366 Personentage."),
        makeCost("Sonstige Kosten", 193.85, "allocationKey", 10000, 524, 0, "Miteigentumsanteil 524/10000; nur umlagefähige sonstige Betriebskosten ansetzen."),
        makeCost("Allgemeinstrom", 288.37, "allocationKey", 14, 1, 0, "Umlageschlüssel je Wohnung: 1 von 14 Wohnungen."),
        makeCost("Schornsteinfeger", 0, "directAmount", 0, 0, 0, "Umlagefähig laut Mietvertrag, wenn Rechnung vorhanden; Betrag eintragen."),
        makeCost("Thermenwartung", 0, "directAmount", 0, 0, 0, "Umlagefähig laut Mietvertrag, wenn Rechnung vorhanden; Gas/Heizung selbst direkt über Mieter."),
      ],
      attachments: "WEG-Abrechnung Fürther Str. 70–74 2024\nWirtschaftsplan/Protokoll 2025\nMietvertragliche Betriebskostenklausel\nBelege Schornsteinfeger/Thermenwartung, falls vorhanden",
      note: "Nicht umlagefähig: Rücklage, Instandhaltung, Reparaturen, Verwalterhonorar, MwSt Verwalterhonorar, Gas/Heizkosten des Mieters.",
    };
  }

  if (text.includes("lilienthaler")) {
    return {
      key: "lilienthaler",
      title: "Lilienthaler Str. 54 · Einfamilienhaus · Direkt 100 %",
      description: "Das komplette Einfamilienhaus ist vermietet. Umlagefähige Kosten werden direkt zu 100 % auf den Mieter angesetzt. Gas/Heizung läuft direkt über den Mieter; Thermenwartung bleibt umlagefähig.",
      heatingMode: "TENANT_DIRECT_CONTRACT",
      totalArea: 113,
      usableArea: 113,
      defaultPeriodFrom: `${year}-01-01`,
      defaultPeriodTo: `${year}-12-31`,
      apartment: { label: "Einfamilienhaus", tenantName: "Maria Weich und Timur Cengiz", area: 113, allocationKey: 100, persons: 3, occupancyMonths: 12, advancePayments: 98 * 12, co2LandlordDeductionKalo: 0 },
      costs: [
        makeCost("Grundsteuer", 360.72, "directAmount", 0, 0, 360.72, "Direkt laut Bescheid; Einfamilienhaus vollständig vermietet."),
        makeCost("Abfallgebühren", 200.02, "directAmount", 0, 0, 200.02, "Direkt laut Bescheid; Einfamilienhaus vollständig vermietet."),
        makeCost("Nachforderung Abfallgebühren", 73.26, "directAmount", 0, 0, 73.26, "Direkt laut Nachforderungsbescheid."),
        makeCost("Versicherung", 438.84, "directAmount", 0, 0, 438.84, "Direkt laut Versicherungsbeleg; umlagefähig laut Mietvertrag/BetrKV."),
        makeCost("Wartung Therme", 208.25, "directAmount", 0, 0, 208.25, "Thermenwartung ist umlagefähig; Gas/Heizkosten selbst trägt der Mieter direkt beim Versorger."),
        makeCost("Schornsteinfeger", 0, "directAmount", 0, 0, 0, "Umlagefähig, wenn Kosten vorhanden; Betrag eintragen."),
        makeCost("Dachrinnenreinigung", 0, "directAmount", 0, 0, 0, "Umlagefähig laut Mietvertragsklausel, wenn Kosten vorhanden."),
        makeCost("E-Check / Prüfung elektrische Anlagen", 0, "directAmount", 0, 0, 0, "Umlagefähig laut Mietvertragsklausel, wenn Kosten vorhanden."),
      ],
      attachments: "Nebenkostenabrechnung Lilienthaler Str. 54 2025\nGrundsteuerbescheid\nAbfallgebührenbescheid und Nachforderung\nVersicherungsbelege\nRechnung Wartung Therme\nMietvertragliche Betriebskostenklausel",
      note: "Kaltmiete 1.492,00 €. Keine Garage/Stellplatz. Nicht abrechnen: Gas/Heizkosten des Mieters; diese laufen direkt über Versorger.",
    };
  }

  if (text.includes("colmarer")) {
    return {
      key: "colmarer",
      title: "Colmarer Str. · vollständig strukturierte NK inkl. Heizkosten/CO₂",
      description: "Colmarer ist die einzige hinterlegte Immobilie mit aktiver Vermieter-Heizkostenabrechnung. KALO-Heizkosten, CO₂-Stufe, 70/30-Aufteilung und die zwei 2025-Teilabrechnungen werden automatisch vorbelegt.",
      heatingMode: "LANDLORD_BILLS_HEATING",
      totalArea: 2079.38,
      usableArea: 2079.38,
      defaultPeriodFrom: `${year}-01-01`,
      defaultPeriodTo: `${year}-12-31`,
      apartment: { label: "Wohnung", tenantName: "", area: 33.79, allocationKey: 170.99, persons: 1, occupancyMonths: 12, advancePayments: 0, co2LandlordDeductionKalo: 13.49 },
      costs: DEFAULT_COSTS,
      heating: { totalHeatingCost: 22968.84, totalWarmWaterCost: 0, totalCo2Cost: 2178.06, totalConsumptionKwh: 181071, emissionFactor: 0.2664, heatedArea: 2079.38 },
      attachments: "Hausgeld-/Nebenkostenabrechnung Colmarer Str.\nKALO-Heizkostenabrechnung / CO₂-Anlage\nGrundsteuerbescheid / Versicherungsnachweise / Rechnungen",
      note: "Hinterlegt: Wohnung 33,79 m², MEA 170,99, Wasser/Müll/Allgemeinstrom nach 365/9.911 mit zeitanteiliger 7-Monats-Korrektur, beheizte Fläche 2.079,38 m², Gesamtverbrauch 181.071 kWh, Emissionsfaktor 0,2664 kg/kWh, CO₂-Kosten 2.178,06 €, Stufe 4 = 70 % Mieter / 30 % Vermieter.",
    };
  }

  return null;
}

function applyBillingPresetToWorkspace(source: BillingWorkspace, preset: BillingPreset, year: number, object?: ObjectOption): BillingWorkspace {
  const apartmentId = source.selectedApartmentId || source.apartments[0]?.id || createId();
  const keepTenantName = source.apartments[0]?.tenantName?.trim();
  const apartment: ApartmentRow = {
    id: apartmentId,
    ...preset.apartment,
    tenantName: keepTenantName || preset.apartment.tenantName,
    active: true,
  };

  return {
    ...source,
    meta: {
      ...source.meta,
      propertyCode: object?.objekt_code ?? source.meta.propertyCode,
      propertyLabel: object?.label ?? source.meta.propertyLabel,
      billingYear: year,
      periodFrom: preset.defaultPeriodFrom ?? source.meta.periodFrom,
      periodTo: preset.defaultPeriodTo ?? source.meta.periodTo,
      attachmentReferences: preset.attachments,
    },
    apartments: [apartment],
    selectedApartmentId: apartment.id,
    costs: preset.costs.map((cost) => ({ ...cost, id: createId() })),
    heating: preset.heatingMode === "TENANT_DIRECT_CONTRACT"
      ? { totalHeatingCost: 0, totalWarmWaterCost: 0, totalCo2Cost: 0, totalConsumptionKwh: 0, emissionFactor: 0, heatedArea: 0 }
      : (preset.heating ?? source.heating),
  };
}


function workspaceLooksLikePresetIsMissing(workspace: BillingWorkspace, preset: BillingPreset | null) {
  if (!preset) return false;
  const first = workspace.apartments[0];
  const firstPresetLabel = normalizeForMatch(preset.apartment.label);
  const firstLabel = normalizeForMatch(first?.label ?? "");
  const hasPresetApartment = firstLabel && (firstLabel.includes(firstPresetLabel) || firstPresetLabel.includes(firstLabel));
  const hasPresetCost = preset.costs.some((presetCost) => workspace.costs.some((row) => normalizeForMatch(row.label) === normalizeForMatch(presetCost.label)));
  return !hasPresetApartment || !hasPresetCost;
}

function applyPresetDefaultsBeforeImport(source: BillingWorkspace, preset: BillingPreset | null, year: number, object?: ObjectOption) {
  if (!preset || !workspaceLooksLikePresetIsMissing(source, preset)) return source;
  const applied = applyBillingPresetToWorkspace(source, preset, year, object);
  const oldFirst = source.apartments[0];
  const newFirst = applied.apartments[0];
  applied.apartments[0] = {
    ...newFirst,
    tenantName: oldFirst?.tenantName?.trim() || newFirst.tenantName,
    advancePayments: oldFirst && oldFirst.advancePayments > 0 ? oldFirst.advancePayments : newFirst.advancePayments,
    occupancyMonths: oldFirst && oldFirst.occupancyMonths > 0 ? oldFirst.occupancyMonths : newFirst.occupancyMonths,
  };
  return applied;
}

function mergeImportedItemsIntoCosts(source: BillingWorkspace, items: ImportedBillingItem[], selectedYear: number) {
  const nextCosts = [...source.costs];
  for (const item of items) {
    const idx = nextCosts.findIndex((row) => {
      const rowLabel = normalizeForMatch(row.label);
      const itemLabel = normalizeForMatch(item.label);
      return rowLabel === itemLabel || rowLabel.includes(itemLabel) || itemLabel.includes(rowLabel);
    });
    const importedNote = `Aus echten Buchungen importiert (${selectedYear}). ${item.reason}`;
    const amount = roundMoney(item.amount);
    const directAmount = item.allocation === "directAmount" || item.allocation === "heatingDirect" ? amount : 0;
    if (idx >= 0) {
      const existing = nextCosts[idx];
      nextCosts[idx] = {
        ...existing,
        amount,
        allocation: item.allocation,
        totalKey: item.totalKey || existing.totalKey,
        apartmentKey: item.apartmentKey || existing.apartmentKey,
        directAmount: item.allocation === "directAmount" || item.allocation === "heatingDirect" ? amount : existing.directAmount,
        prorateByOccupancy: item.prorateByOccupancy,
        note: existing.note?.includes("Aus echten Buchungen importiert") ? importedNote : `${existing.note ? `${existing.note} · ` : ""}${importedNote}`,
      };
    } else {
      nextCosts.push({
        id: createId(),
        label: item.label,
        amount,
        allocation: item.allocation,
        totalKey: item.totalKey,
        apartmentKey: item.apartmentKey,
        directAmount,
        prorateByOccupancy: item.prorateByOccupancy,
        note: importedNote,
      });
    }
  }
  return { ...source, costs: nextCosts };
}

function normalizeCost(row: any, index: number): CostRow { const d = DEFAULT_COSTS[index % DEFAULT_COSTS.length]; return { ...d, ...row, id: row?.id || createId(), totalKey: Number.isFinite(row?.totalKey) ? row.totalKey : (row?.allocationTotalKey ?? d.totalKey), apartmentKey: Number.isFinite(row?.apartmentKey) ? row.apartmentKey : (row?.allocationApartmentKey ?? d.apartmentKey), prorateByOccupancy: typeof row?.prorateByOccupancy === "boolean" ? row.prorateByOccupancy : false }; }
function applyColmarer2025Fixes(costs: CostRow[], year: number, object?: ObjectOption): CostRow[] {
  const objectText = `${object?.objekt_code ?? ""} ${object?.label ?? ""}`.toLowerCase();
  const isColmarer2025 = year === 2025 && objectText.includes("colmarer");
  if (!isColmarer2025) return costs;

  return costs.map((row) => {
    const label = row.label.toLowerCase();

    if (label.includes("wasser") || label.includes("kanal")) {
      return {
        ...row,
        label: "Wasser / Kanal",
        allocation: "allocationKey",
        amount: 4357.3,
        totalKey: 9911,
        apartmentKey: 365,
        directAmount: 0,
        prorateByOccupancy: true,
        note: "Korrektur Colmarer 2025: 4.357,30 × 365 / 9.911 = 160,47 € Jahresanteil; bei 7 Monaten = 93,61 €.",
      };
    }

    if (label.includes("müll") || label.includes("muell")) {
      return {
        ...row,
        label: "Müllabfuhr",
        allocation: "allocationKey",
        amount: 3338.39,
        totalKey: 9911,
        apartmentKey: 365,
        directAmount: 0,
        prorateByOccupancy: true,
        note: "Korrektur Colmarer 2025: 3.338,39 × 365 / 9.911 = 122,95 € Jahresanteil; bei 7 Monaten = 71,72 €.",
      };
    }

    if (label.includes("allgemeinstrom") || label.includes("strom gebäude") || label.includes("strom gebaeude")) {
      return {
        ...row,
        label: "Allgemeinstrom",
        allocation: "allocationKey",
        amount: 696.01,
        totalKey: 9911,
        apartmentKey: 365,
        directAmount: 0,
        prorateByOccupancy: true,
        note: "Korrektur Colmarer 2025: 696,01 × 365 / 9.911 = 25,63 € Jahresanteil; bei 7 Monaten = 14,95 €.",
      };
    }

    return row;
  });
}
function normalizeWorkspace(raw: Partial<BillingWorkspace> | null | undefined, year: number, object?: ObjectOption): BillingWorkspace { const fb = createDefaultWorkspace(year, object); const apartments = Array.isArray(raw?.apartments) && raw.apartments.length ? raw.apartments.map((a: any, i) => ({ ...fb.apartments[0], ...a, id: a?.id || createId(), label: a?.label || `Wohnung ${i + 1}`, co2LandlordDeductionKalo: Number.isFinite(a?.co2LandlordDeductionKalo) ? a.co2LandlordDeductionKalo : 0, active: typeof a?.active === "boolean" ? a.active : true })) : fb.apartments; const costs = applyColmarer2025Fixes(Array.isArray(raw?.costs) && raw.costs.length ? raw.costs.map(normalizeCost) : fb.costs, year, object); return { meta: { ...fb.meta, ...(raw?.meta ?? {}), propertyCode: object?.objekt_code ?? raw?.meta?.propertyCode ?? fb.meta.propertyCode, propertyLabel: object?.label ?? raw?.meta?.propertyLabel ?? fb.meta.propertyLabel, billingYear: year, locked: Boolean(raw?.meta?.locked) }, apartments, costs, heating: { ...fb.heating, ...(raw?.heating ?? {}) }, selectedApartmentId: raw?.selectedApartmentId && apartments.some(a => a.id === raw.selectedApartmentId) ? raw.selectedApartmentId : apartments[0]?.id ?? null }; }


function makePeriodName(w: BillingWorkspace) {
  const from = w.meta.periodFrom ? formatDate(w.meta.periodFrom) : "von offen";
  const to = w.meta.periodTo ? formatDate(w.meta.periodTo) : "bis offen";
  const tenant = w.apartments.find(a => a.id === w.selectedApartmentId)?.tenantName || w.apartments[0]?.tenantName || "ohne Mieter";
  return `${from} - ${to} · ${tenant}`;
}
function makeBillingRecord(workspace: BillingWorkspace, id = createId()): BillingRecord { return { id, name: makePeriodName(workspace), workspace }; }
function asBillingCollection(raw: any, year: number, object?: ObjectOption): BillingCollection {
  if (raw?.version === 2 && Array.isArray(raw?.billings) && raw.billings.length) {
    const billings = raw.billings.map((b: any, i: number) => {
      const workspace = normalizeWorkspace(b?.workspace ?? null, year, object);
      return { id: b?.id || createId(), name: b?.name || makePeriodName(workspace) || `Abrechnung ${i + 1}`, workspace };
    });
    const selectedBillingId = raw.selectedBillingId && billings.some((b: BillingRecord) => b.id === raw.selectedBillingId) ? raw.selectedBillingId : billings[0].id;
    return cleanupBillingRecords(billings, selectedBillingId, year, object);
  }
  const workspace = normalizeWorkspace(raw as Partial<BillingWorkspace> | null | undefined, year, object);
  const record = makeBillingRecord(workspace);
  return cleanupBillingRecords([record], record.id, year, object);
}
function replaceBillingRecord(records: BillingRecord[], id: string | null, workspace: BillingWorkspace) {
  if (!id) return records.length ? records : [makeBillingRecord(workspace)];
  const next = records.map(b => b.id === id ? { ...b, name: makePeriodName(workspace), workspace } : b);
  return next.some(b => b.id === id) ? next : [...next, makeBillingRecord(workspace, id)];
}

function isColmarer2025(year: number, object?: ObjectOption) {
  const objectText = `${object?.objekt_code ?? ""} ${object?.label ?? ""}`.toLowerCase();
  return year === 2025 && objectText.includes("colmarer");
}

function setWorkspacePeriodAndTenant(source: BillingWorkspace, from: string, to: string, tenantName: string, advancePayments: number, occupancyMonths: number, year: number, object?: ObjectOption, co2LandlordDeductionKalo?: number): BillingWorkspace {
  const selectedId = source.selectedApartmentId || source.apartments[0]?.id || createId();
  const apartments = (source.apartments.length ? source.apartments : createDefaultWorkspace(year, object).apartments).map((a, i) => ({
    ...a,
    tenantName: i === 0 ? tenantName : a.tenantName,
    advancePayments: i === 0 ? advancePayments : a.advancePayments,
    occupancyMonths: i === 0 ? occupancyMonths : a.occupancyMonths,
    co2LandlordDeductionKalo: i === 0 && typeof co2LandlordDeductionKalo === "number" ? co2LandlordDeductionKalo : (Number.isFinite(a.co2LandlordDeductionKalo) ? a.co2LandlordDeductionKalo : 0),
    active: i === 0 ? Boolean(tenantName) : a.active,
  }));
  return {
    ...source,
    meta: {
      ...source.meta,
      propertyCode: object?.objekt_code ?? source.meta.propertyCode,
      propertyLabel: object?.label ?? source.meta.propertyLabel,
      billingYear: year,
      periodFrom: from,
      periodTo: to,
    },
    apartments,
    selectedApartmentId: apartments.some(a => a.id === selectedId) ? selectedId : apartments[0]?.id ?? null,
  };
}


function getPrimaryApartment(workspace: BillingWorkspace): ApartmentRow | undefined {
  return workspace.apartments.find(a => a.id === workspace.selectedApartmentId) ?? workspace.apartments[0];
}

function workspaceCompletenessScore(workspace: BillingWorkspace): number {
  const apartment = getPrimaryApartment(workspace);
  let score = 0;
  if (apartment?.tenantName?.trim()) score += 1000;
  if (Number.isFinite(apartment?.advancePayments) && (apartment?.advancePayments ?? 0) > 0) score += 200;
  if (Number.isFinite(apartment?.co2LandlordDeductionKalo) && (apartment?.co2LandlordDeductionKalo ?? 0) > 0) score += 100;
  if (Number.isFinite(apartment?.occupancyMonths) && (apartment?.occupancyMonths ?? 0) > 0) score += 50;
  if (workspace.meta.landlordName?.trim()) score += 20;
  if (workspace.meta.landlordAddress?.trim()) score += 20;
  score += workspace.costs.filter(c => Number.isFinite(c.directAmount) && c.directAmount > 0).length * 10;
  score += workspace.costs.filter(c => Number.isFinite(c.amount) && c.amount > 0).length;
  return score;
}

function pickBestWorkspace(candidates: BillingWorkspace[], fallback: BillingWorkspace): BillingWorkspace {
  if (!candidates.length) return fallback;
  return [...candidates].sort((a, b) => workspaceCompletenessScore(b) - workspaceCompletenessScore(a))[0];
}

function cleanupBillingRecords(records: BillingRecord[], selectedId: string | null, year: number, object?: ObjectOption): BillingCollection {
  let cleaned = records.filter((record) => {
    const from = record.workspace.meta.periodFrom;
    const to = record.workspace.meta.periodTo;
    if (from === "2025-07-31" && to === "2025-07-31") return false;
    if (from === "2025-07-31" && to === "2025-12-31") return false;
    return true;
  });

  const seen = new Set<string>();
  cleaned = cleaned.filter((record) => {
    const tenant = getPrimaryApartment(record.workspace)?.tenantName || "";
    const key = `${record.workspace.meta.periodFrom}|${record.workspace.meta.periodTo}|${tenant}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (isColmarer2025(year, object)) {
    const defaultWorkspace = createDefaultWorkspace(year, object);
    const firstCandidates = cleaned
      .filter(r => r.id === "colmarer-2025-01-07" || (r.workspace.meta.periodFrom === "2025-01-01" && r.workspace.meta.periodTo === "2025-07-31"))
      .map(r => r.workspace);
    const firstExisting = pickBestWorkspace(firstCandidates, defaultWorkspace);

    const secondFallback = nextPeriodWorkspace(firstExisting, year, object);
    const secondCandidates = cleaned
      .filter(r => r.id === "colmarer-2025-08-12" || (r.workspace.meta.periodFrom === "2025-08-01" && r.workspace.meta.periodTo === "2025-12-31"))
      .map(r => r.workspace);
    const secondExisting = pickBestWorkspace(secondCandidates, secondFallback);

    const firstApartment = getPrimaryApartment(firstExisting);
    const secondApartment = getPrimaryApartment(secondExisting);

    const firstWorkspace = setWorkspacePeriodAndTenant(
      firstExisting,
      "2025-01-01",
      "2025-07-31",
      firstApartment?.tenantName?.trim() || "Cansu Kurt",
      typeof firstApartment?.advancePayments === "number" && Number.isFinite(firstApartment.advancePayments) ? firstApartment.advancePayments : 770,
      7,
      year,
      object,
      typeof firstApartment?.co2LandlordDeductionKalo === "number" && Number.isFinite(firstApartment.co2LandlordDeductionKalo) && firstApartment.co2LandlordDeductionKalo > 0 ? firstApartment.co2LandlordDeductionKalo : 13.49,
    );
    const secondWorkspace = setWorkspacePeriodAndTenant(
      secondExisting,
      "2025-08-01",
      "2025-12-31",
      secondApartment?.tenantName?.trim() || "Nicholas Kraeft-Wendte",
      typeof secondApartment?.advancePayments === "number" && Number.isFinite(secondApartment.advancePayments) ? secondApartment.advancePayments : 0,
      5,
      year,
      object,
      typeof secondApartment?.co2LandlordDeductionKalo === "number" && Number.isFinite(secondApartment.co2LandlordDeductionKalo) && secondApartment.co2LandlordDeductionKalo > 0 ? secondApartment.co2LandlordDeductionKalo : 9.26,
    );

    const first: BillingRecord = { id: "colmarer-2025-01-07", name: makePeriodName(firstWorkspace), workspace: firstWorkspace };
    const second: BillingRecord = { id: "colmarer-2025-08-12", name: makePeriodName(secondWorkspace), workspace: secondWorkspace };
    const selectedOriginalSecond = Boolean(selectedId && cleaned.some(r => r.id === selectedId && (r.id === "colmarer-2025-08-12" || (r.workspace.meta.periodFrom === "2025-08-01" && r.workspace.meta.periodTo === "2025-12-31"))));
    const preferred = selectedOriginalSecond ? second.id : first.id;
    return { version: 2, selectedBillingId: preferred, billings: [first, second] };
  }

  if (!cleaned.length) {
    const workspace = createDefaultWorkspace(year, object);
    const record = makeBillingRecord(workspace);
    return cleanupBillingRecords([record], record.id, year, object);
  }

  const validSelectedId = selectedId && cleaned.some(r => r.id === selectedId) ? selectedId : cleaned[0].id;
  return { version: 2, selectedBillingId: validSelectedId, billings: cleaned.map(r => ({ ...r, name: makePeriodName(r.workspace) })) };
}
function nextPeriodWorkspace(source: BillingWorkspace, year: number, object?: ObjectOption): BillingWorkspace {
  const clone: BillingWorkspace = JSON.parse(JSON.stringify(source));
  const nextId = createId();
  const end = new Date(`${source.meta.periodTo || `${year}-07-31`}T00:00:00`);
  const nextStart = Number.isNaN(end.getTime()) ? new Date(year, 7, 1) : new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  const fallbackStart = new Date(year, 7, 1);
  const start = nextStart.getFullYear() === year ? nextStart : fallbackStart;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  clone.meta = { ...clone.meta, propertyCode: object?.objekt_code ?? clone.meta.propertyCode, propertyLabel: object?.label ?? clone.meta.propertyLabel, billingYear: year, periodFrom: iso(start), periodTo: `${year}-12-31`, locked: false };
  clone.apartments = clone.apartments.map((a, i) => ({ ...a, id: i === 0 ? nextId : createId(), tenantName: "", advancePayments: 0, co2LandlordDeductionKalo: 0, occupancyMonths: Math.max(1, 12 - start.getMonth()) }));
  clone.costs = clone.costs.map(c => ({ ...c, id: createId() }));
  clone.selectedApartmentId = nextId;
  return clone;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2"><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>{children}</label>; }
function TextInput(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-[15px] text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 ${props.className ?? ""}`} />; }
function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) { const { children, ...rest } = props; return <select {...rest} className={`h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-[15px] font-medium text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 ${props.className ?? ""}`}>{children}</select>; }
function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`min-h-[72px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 ${props.className ?? ""}`} />; }
function NumberInput({ value, onCommit, disabled, decimals = 2, min, max }: { value: number; onCommit: (v: number) => void; disabled?: boolean; decimals?: number; min?: number; max?: number }) { const [draft, setDraft] = useState(decimals === 4 ? formatFlex(value) : formatNumber(value, decimals)); useEffect(() => { setDraft(decimals === 4 ? formatFlex(value) : formatNumber(value, decimals)); }, [value, decimals]); function commit() { let n = parseGermanNumber(draft || "0"); if (typeof min === "number") n = Math.max(min, n); if (typeof max === "number") n = Math.min(max, n); onCommit(n); setDraft(decimals === 4 ? formatFlex(n) : formatNumber(n, decimals)); } return <TextInput inputMode="decimal" value={draft} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />; }
function YearInput({ value, onChange, disabled }: { value: number; onChange: (year: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(String(value || new Date().getFullYear()));
  useEffect(() => { setDraft(String(value || new Date().getFullYear())); }, [value]);
  function commit() {
    const digits = draft.replace(/\D/g, "").slice(0, 4);
    const year = Number(digits || new Date().getFullYear());
    const safeYear = Number.isFinite(year) && year >= 1900 && year <= 2100 ? year : new Date().getFullYear();
    onChange(safeYear);
    setDraft(String(safeYear));
  }
  return (
    <TextInput
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      disabled={disabled}
      onChange={e => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
    />
  );
}

function Card({ title, icon, actions, children }: { title: string; icon: ReactNode; actions?: ReactNode; children: ReactNode }) { return <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">{icon}</div><h2 className="text-base font-semibold text-slate-950">{title}</h2></div>{actions}</div><div className="p-5 md:p-6">{children}</div></section>; }
function Stat({ title, value, accent = "default" }: { title: string; value: string; accent?: "default" | "success" | "danger" }) { const c = accent === "success" ? "text-emerald-700" : accent === "danger" ? "text-rose-700" : "text-slate-950"; return <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</div><div className={`mt-3 text-2xl font-semibold ${c}`}>{value}</div></div>; }


type ImportedBillingItem = {
  sourceId: string;
  date: string;
  category: string;
  note: string;
  amount: number;
  label: string;
  allocation: AllocationType;
  totalKey: number;
  apartmentKey: number;
  directAmount: number;
  prorateByOccupancy: boolean;
  confidence: "hoch" | "mittel" | "prüfen";
  reason: string;
};

type IgnoredBillingItem = {
  sourceId: string;
  date: string;
  category: string;
  note: string;
  amount: number;
  reason: string;
};

type BillingImportResult = {
  imported: ImportedBillingItem[];
  ignored: IgnoredBillingItem[];
};

function normalizeForMatch(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textHasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(normalizeForMatch(word)));
}

function entryText(entry: AppFinanceEntry) {
  return normalizeForMatch(`${entry.category ?? ""} ${entry.note ?? ""}`);
}

function isExpenseInPeriod(entry: AppFinanceEntry, from: string, to: string, year: number) {
  if (entry.entry_type !== "expense") return false;
  if (!entry.booking_date) return false;
  if (from && to) return entry.booking_date >= from && entry.booking_date <= to;
  return entry.booking_date.startsWith(`${year}-`);
}

function sameObjectForBilling(entry: AppFinanceEntry, selectedObjectCode: string, selectedObject: ObjectOption | null, appObjects: Array<{ id: string; code: string | null; label: string }>) {
  const code = normalizeForMatch(selectedObjectCode);
  const selectedLabel = normalizeForMatch(selectedObject?.label ?? "");
  const directCode = normalizeForMatch(entry.objekt_code);
  if (code && directCode && directCode === code) return true;

  const entryObject = appObjects.find((object) => String(object.id) === String(entry.object_id ?? ""));
  const entryLabel = normalizeForMatch(entryObject?.label ?? "");
  const entryCode = normalizeForMatch(entryObject?.code ?? "");

  if (code && entryCode && entryCode === code) return true;
  if (selectedLabel && entryLabel && (selectedLabel.includes(entryLabel) || entryLabel.includes(selectedLabel))) return true;
  if (selectedLabel && directCode && selectedLabel.includes(directCode)) return true;
  return false;
}

function findPresetCostTemplate(label: string, preset: BillingPreset | null, workspace: BillingWorkspace): Omit<CostRow, "id"> | null {
  const normalizedLabel = normalizeForMatch(label);
  const pools = [preset?.costs ?? [], workspace.costs.map(({ id: _id, ...rest }) => rest)];
  for (const pool of pools) {
    const found = pool.find((row) => {
      const rowLabel = normalizeForMatch(row.label);
      return rowLabel === normalizedLabel || rowLabel.includes(normalizedLabel) || normalizedLabel.includes(rowLabel);
    });
    if (found) return { ...found };
  }
  return null;
}

function classifyBillingEntry(entry: AppFinanceEntry, preset: BillingPreset | null, workspace: BillingWorkspace, heatingIsTenantDirect: boolean): ImportedBillingItem | IgnoredBillingItem {
  const text = entryText(entry);
  const amount = Math.abs(Number(entry.amount) || 0);
  const sourceId = String(entry.id ?? `${entry.booking_date}-${entry.category}-${amount}`);
  const base = { sourceId, date: entry.booking_date ?? "", category: entry.category ?? "", note: entry.note ?? "", amount };

  if (amount <= 0) return { ...base, reason: "Betrag ist 0 €." };
  if (textHasAny(text, ["ruecklage", "rucklage", "erhaltungsrucklage", "erhaltungsruecklage", "zufuehrung", "zufuhrung"])) return { ...base, reason: "Rücklage ist nicht umlagefähig." };
  if (textHasAny(text, ["verwalter", "verwaltung", "bankgebuehr", "bankgebuhr", "kontofuehrung", "konto gebuehr"])) return { ...base, reason: "Verwaltung/Bankgebühren werden nicht automatisch auf Mieter umgelegt." };
  if (textHasAny(text, ["reparatur", "instandhaltung", "sanierung", "modernisierung", "sonderumlage", "darlehen", "zins", "notar", "makler"])) return { ...base, reason: "Reparatur/Instandhaltung/Finanzierung ist nicht umlagefähig bzw. muss manuell geprüft werden." };
  if (textHasAny(text, ["hausgeld", "wohngeld"])) return { ...base, reason: "Hausgeld ist Sammelzahlung. Bitte Einzelpositionen aus der Abrechnung verwenden, nicht die Gesamtrate." };
  if (heatingIsTenantDirect && textHasAny(text, ["gas", "heizung", "heizkosten", "warmwasser", "co2"]) && !textHasAny(text, ["therme", "thermenwartung", "schornstein", "kehr", "wartung"])) {
    return { ...base, reason: "Heizung/Gas läuft bei dieser Immobilie direkt über den Mieter." };
  }

  const matchers: Array<{ label: string; keywords: string[]; confidence: ImportedBillingItem["confidence"] }> = [
    { label: "Grundsteuer", keywords: ["grundsteuer"], confidence: "hoch" },
    { label: "Abfallgebühren", keywords: ["abfall", "muell", "mull", "müll"], confidence: "hoch" },
    { label: "Nachforderung Abfallgebühren", keywords: ["nachforderung abfall", "nachforderung muell", "nachforderung mull"], confidence: "hoch" },
    { label: "Gebäudeversicherung", keywords: ["gebaudeversicherung", "gebäudeversicherung", "wohngebaude", "wohngebäude"], confidence: "hoch" },
    { label: "Haftpflichtversicherung", keywords: ["haftpflicht"], confidence: "hoch" },
    { label: "Versicherung", keywords: ["versicherung"], confidence: "mittel" },
    { label: "Wasser / Kanal", keywords: ["wasser kanal", "wasser", "abwasser", "kanal"], confidence: "hoch" },
    { label: "Hausstrom", keywords: ["hausstrom", "allgemeinstrom", "strom allgemein", "beleuchtung"], confidence: "hoch" },
    { label: "Straßenreinigung", keywords: ["strassenreinigung", "straßenreinigung", "strasse reinigung", "straße reinigung"], confidence: "hoch" },
    { label: "Gebäudereinigung", keywords: ["gebaudereinigung", "gebäudereinigung", "hausreinigung", "reinigung"], confidence: "hoch" },
    { label: "Gehwegreinigung", keywords: ["gehweg"], confidence: "hoch" },
    { label: "Gartenpflege", keywords: ["garten", "gartenpflege"], confidence: "hoch" },
    { label: "Wartung Therme", keywords: ["therme", "thermenwartung", "wartung therme"], confidence: "hoch" },
    { label: "Schornsteinfeger", keywords: ["schornstein", "feger", "kehr"], confidence: "hoch" },
    { label: "Rauchwarnmelder Service", keywords: ["rauchwarn", "rauchmelder", "rwm"], confidence: "hoch" },
    { label: "Dachrinnenreinigung", keywords: ["dachrinne"], confidence: "hoch" },
    { label: "Winterdienst", keywords: ["winterdienst", "schnee", "eis"], confidence: "hoch" },
    { label: "Wartung Pumpen / Hebeanlage", keywords: ["pumpe", "hebeanlage"], confidence: "hoch" },
  ];

  const matcher = matchers.find((candidate) => textHasAny(text, candidate.keywords));
  if (!matcher) return { ...base, reason: "Keine sichere umlagefähige Kostenart erkannt." };

  let label = matcher.label;
  if (label === "Versicherung") {
    const template = findPresetCostTemplate("Versicherung", preset, workspace) || findPresetCostTemplate("Gebäudeversicherung", preset, workspace) || findPresetCostTemplate("Versicherungen", preset, workspace);
    label = template?.label ?? "Versicherung";
  }
  if (label === "Abfallgebühren") {
    const template = findPresetCostTemplate("Abfallgebühren", preset, workspace) || findPresetCostTemplate("Müllabfuhr", preset, workspace);
    label = template?.label ?? label;
  }
  if (label === "Wasser / Kanal") {
    const template = findPresetCostTemplate("Wasser / Kanal", preset, workspace) || findPresetCostTemplate("Wasser", preset, workspace) || findPresetCostTemplate("Wasser/Abwasser", preset, workspace);
    label = template?.label ?? label;
  }

  const template = findPresetCostTemplate(label, preset, workspace);
  const allocation = template?.allocation ?? (preset?.key === "lilienthaler" ? "directAmount" : "allocationKey");
  const totalKey = template?.totalKey ?? 0;
  const apartmentKey = template?.apartmentKey ?? 0;
  const directAmount = allocation === "directAmount" || allocation === "heatingDirect" ? amount : 0;

  return {
    ...base,
    label,
    allocation,
    totalKey,
    apartmentKey,
    directAmount,
    prorateByOccupancy: template?.prorateByOccupancy ?? false,
    confidence: matcher.confidence,
    reason: `Automatisch erkannt aus Kategorie/Notiz: ${entry.category ?? ""}${entry.note ? ` · ${entry.note}` : ""}`,
  };
}

function summarizeImport(imported: ImportedBillingItem[]) {
  const map = new Map<string, ImportedBillingItem>();
  for (const item of imported) {
    const key = `${normalizeForMatch(item.label)}|${item.allocation}|${item.totalKey}|${item.apartmentKey}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
    } else {
      existing.amount = roundMoney(existing.amount + item.amount);
      if (existing.allocation === "directAmount" || existing.allocation === "heatingDirect") existing.directAmount = roundMoney(existing.directAmount + item.amount);
      existing.reason = `${existing.reason}; ${item.date} ${item.category}`;
      if (existing.confidence !== item.confidence) existing.confidence = existing.confidence === "prüfen" || item.confidence === "prüfen" ? "prüfen" : "mittel";
    }
  }
  return Array.from(map.values());
}

export default function NebenkostenWohnungen() {
  const appData = useAppData();
  const currentYear = new Date().getFullYear();
  const [objects, setObjects] = useState<ObjectOption[]>([]); const [selectedObjectCode, setSelectedObjectCode] = useState(""); const [selectedYear, setSelectedYear] = useState(currentYear);
  const [workspace, setWorkspace] = useState<BillingWorkspace>(() => createDefaultWorkspace(currentYear)); const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]); const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null); const [status, setStatus] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [lastImportResult, setLastImportResult] = useState<BillingImportResult | null>(null); const loaded = useRef(false);
  useEffect(() => { let alive = true; (async () => { const { data, error } = await supabase.from("v_object_dropdown").select("objekt_code,label").order("label", { ascending: true }); if (!alive) return; if (error) { setError(`Objekte konnten nicht geladen werden: ${error.message}`); return; } const list = ((data ?? []) as ObjectOption[]).filter(o => o.objekt_code && o.label && !isGarage(o)); setObjects(list); if (!selectedObjectCode && list[0]) setSelectedObjectCode(list[0].objekt_code); })(); return () => { alive = false; }; }, [selectedObjectCode]);
  const selectedObject = useMemo(() => objects.find(o => o.objekt_code === selectedObjectCode) ?? null, [objects, selectedObjectCode]);
  const activePreset = useMemo(() => getBillingPreset(selectedObject, selectedYear), [selectedObject, selectedYear]);
  useEffect(() => { let alive = true; async function load() { if (!selectedObjectCode) return; loaded.current = false; setLoading(true); setError(""); const { data, error } = await supabase.from("apartment_billing_workspaces").select("data").eq("object_id", selectedObjectCode).eq("year", String(selectedYear)).maybeSingle(); if (!alive) return; if (error) { const ws = createDefaultWorkspace(selectedYear, selectedObject ?? undefined); const rec = makeBillingRecord(ws); setBillingRecords([rec]); setSelectedBillingId(rec.id); setWorkspace(ws); setError(`Supabase-Fehler: ${error.message}`); } else { const collection = asBillingCollection(data?.data ?? null, selectedYear, selectedObject ?? undefined); const selected = collection.billings.find(b => b.id === collection.selectedBillingId) ?? collection.billings[0]; setBillingRecords(collection.billings); setSelectedBillingId(selected.id); setWorkspace(selected.workspace); setStatus(data?.data ? `Gespeicherte Abrechnungen für ${selectedYear} geladen.` : `Neue Abrechnung für ${selectedYear} erstellt.`); } setLoading(false); loaded.current = true; } void load(); return () => { alive = false; }; }, [selectedObjectCode, selectedYear, selectedObject]);
  useEffect(() => { if (!selectedObjectCode || !loaded.current) return; const normalizedWorkspace = { ...workspace, meta: { ...workspace.meta, propertyCode: selectedObjectCode, propertyLabel: selectedObject?.label ?? workspace.meta.propertyLabel, billingYear: selectedYear } }; const billingsRaw = replaceBillingRecord(billingRecords, selectedBillingId, normalizedWorkspace); const cleaned = cleanupBillingRecords(billingsRaw, selectedBillingId, selectedYear, selectedObject ?? undefined); const payload: BillingCollection = cleaned; const id = window.setTimeout(async () => { setSaving(true); const { error } = await supabase.from("apartment_billing_workspaces").upsert({ object_id: selectedObjectCode, year: String(selectedYear), data: payload }, { onConflict: "object_id,year" }); setSaving(false); if (error) setError(`Supabase-Fehler: ${error.message}`); else { setStatus(`Gespeichert: ${selectedObject?.label ?? selectedObjectCode} / ${selectedYear} / ${makePeriodName(normalizedWorkspace)}`); } }, 650); return () => window.clearTimeout(id); }, [workspace, billingRecords, selectedObjectCode, selectedYear, selectedObject, selectedBillingId]);
  const locked = workspace.meta.locked; const heatingIsTenantDirect = activePreset?.heatingMode === "TENANT_DIRECT_CONTRACT"; const activeApartment = useMemo(() => workspace.apartments.find(a => a.id === workspace.selectedApartmentId) ?? workspace.apartments[0] ?? null, [workspace]);
  function update(updater: (p: BillingWorkspace) => BillingWorkspace) { setWorkspace(prev => { const next = updater(prev); setBillingRecords(current => cleanupBillingRecords(replaceBillingRecord(current, selectedBillingId, next), selectedBillingId, selectedYear, selectedObject ?? undefined).billings); return next; }); } function selectBilling(id: string) { if (id === selectedBillingId) return; const cleaned = cleanupBillingRecords(replaceBillingRecord(billingRecords, selectedBillingId, workspace), selectedBillingId, selectedYear, selectedObject ?? undefined); const target = cleaned.billings.find(b => b.id === id); if (!target) return; setBillingRecords(cleaned.billings); setSelectedBillingId(id); setWorkspace(target.workspace); } function createNewPartialBilling() { const cleaned = cleanupBillingRecords(replaceBillingRecord(billingRecords, selectedBillingId, workspace), selectedBillingId, selectedYear, selectedObject ?? undefined); if (isColmarer2025(selectedYear, selectedObject ?? undefined) && cleaned.billings.length >= 2) { const second = cleaned.billings[1]; setBillingRecords(cleaned.billings); setSelectedBillingId(second.id); setWorkspace(second.workspace); setStatus("Für Colmarer Str. 2025 sind die zwei Teilabrechnungen bereits angelegt."); return; } const newWorkspace = nextPeriodWorkspace(workspace, selectedYear, selectedObject ?? undefined); const rec = makeBillingRecord(newWorkspace); const next = cleanupBillingRecords([...cleaned.billings, rec], rec.id, selectedYear, selectedObject ?? undefined); const selected = next.billings.find(b => b.id === next.selectedBillingId) ?? next.billings[0]; setBillingRecords(next.billings); setSelectedBillingId(selected.id); setWorkspace(selected.workspace); setStatus("Neue Teilabrechnung erstellt. Zeitraum, Mieter und Vorauszahlungen bitte anpassen."); } function updateMeta<K extends keyof BuildingMeta>(key: K, value: BuildingMeta[K]) { update(p => ({ ...p, meta: { ...p.meta, [key]: value } })); } function updateHeating<K extends keyof HeatingSettings>(key: K, value: HeatingSettings[K]) { update(p => ({ ...p, heating: { ...p.heating, [key]: value } })); } function updateApartment(id: string, patch: Partial<ApartmentRow>) { update(p => ({ ...p, apartments: p.apartments.map(a => a.id === id ? { ...a, ...patch } : a) })); } function updateCost(id: string, patch: Partial<CostRow>) { update(p => ({ ...p, costs: p.costs.map(c => c.id === id ? { ...c, ...patch } : c) })); }
  function addApartment() { if (locked) return; const a: ApartmentRow = { id: createId(), label: `Wohnung ${workspace.apartments.length + 1}`, tenantName: "", area: 0, allocationKey: 0, persons: 1, occupancyMonths: 12, advancePayments: 0, co2LandlordDeductionKalo: 0, active: true }; update(p => ({ ...p, apartments: [...p.apartments, a], selectedApartmentId: a.id })); }
  function deleteApartment(id: string) { if (locked) return; update(p => { const next = p.apartments.filter(a => a.id !== id); return { ...p, apartments: next.length ? next : createDefaultWorkspace(selectedYear, selectedObject ?? undefined).apartments, selectedApartmentId: next[0]?.id ?? null }; }); }
  function addCost() { if (locked) return; update(p => ({ ...p, costs: [...p.costs, { id: createId(), label: `Kostenart ${p.costs.length + 1}`, amount: 0, allocation: "allocationKey", totalKey: 0, apartmentKey: 0, directAmount: 0, prorateByOccupancy: false, note: "" }] })); }
  function applyActivePreset() {
    if (locked || !activePreset) return;
    const ok = window.confirm(`${activePreset.title}

Diese Vorlage überschreibt die aktuellen Wohnungs- und Kostenzeilen dieser Abrechnung. Bereits gespeicherte andere Teilabrechnungen bleiben erhalten. Fortfahren?`);
    if (!ok) return;
    update((p) => applyBillingPresetToWorkspace(p, activePreset, selectedYear, selectedObject ?? undefined));
    setStatus(`Vorlage angewendet: ${activePreset.title}`);
  }
  function deleteCost(id: string) { if (locked) return; update(p => ({ ...p, costs: p.costs.filter(c => c.id !== id) })); }
  function importBookingsIntoBilling() {
    if (locked) return;
    if (!selectedObjectCode) {
      setError("Bitte zuerst ein Objekt auswählen.");
      return;
    }

    const relevantEntries = appData.entries
      .filter((entry) => sameObjectForBilling(entry, selectedObjectCode, selectedObject, appData.objects))
      .filter((entry) => isExpenseInPeriod(entry, workspace.meta.periodFrom, workspace.meta.periodTo, selectedYear));

    const imported: ImportedBillingItem[] = [];
    const ignored: IgnoredBillingItem[] = [];

    for (const entry of relevantEntries) {
      const classified = classifyBillingEntry(entry, activePreset, workspace, heatingIsTenantDirect);
      if ("label" in classified) imported.push(classified);
      else ignored.push(classified);
    }

    const summarized = summarizeImport(imported);
    if (!summarized.length) {
      setLastImportResult({ imported: [], ignored });
      setStatus(`Keine eindeutig umlagefähigen Buchungen für ${workspace.meta.propertyLabel} / ${selectedYear} gefunden.`);
      return;
    }

    update((p) => {
      const withPresetDefaults = applyPresetDefaultsBeforeImport(p, activePreset, selectedYear, selectedObject ?? undefined);
      return mergeImportedItemsIntoCosts(withPresetDefaults, summarized, selectedYear);
    });

    setLastImportResult({ imported: summarized, ignored });
    setStatus(`${summarized.length} Kostenart(en) wurden übernommen und unten in den Kostenarten aktualisiert. Das Ergebnis/Druck wird daraus neu berechnet. ${ignored.length} Buchung(en) wurden nicht automatisch übernommen und bleiben zur Prüfung.`);
  }

  const co2TotalKg = roundMoney(workspace.heating.totalConsumptionKwh * workspace.heating.emissionFactor); const co2PerSqm = workspace.heating.heatedArea > 0 ? co2TotalKg / workspace.heating.heatedArea : 0; const co2Stage = getCo2Stage(co2PerSqm);
  const isHeatingCostRow = (row: CostRow) => {
    const label = row.label.toLowerCase();
    return row.allocation === "heatingDirect" || label.includes("heiz") || label.includes("wärme") || label.includes("waerme") || label.includes("warmwasser") || label.includes("kalo");
  };

  const costBreakdown = useMemo(() => {
    if (!activeApartment) return [];

    const preliminary = workspace.costs.map(row => {
      const isHeating = isHeatingCostRow(row);
      let tenantShareBeforeCo2 = 0;

      if (row.allocation === "directAmount" || row.allocation === "heatingDirect") {
        tenantShareBeforeCo2 = row.directAmount;
      } else {
        const base = row.totalKey > 0 ? row.amount * (row.apartmentKey / row.totalKey) : 0;
        tenantShareBeforeCo2 = row.prorateByOccupancy ? base * (clamp(activeApartment.occupancyMonths, 0, 12) / 12) : base;
      }

      return { row, isHeating, tenantShareBeforeCo2 };
    });

    const heatingBaseForManualCo2 = preliminary.filter(x => x.isHeating).reduce((s, x) => s + x.tenantShareBeforeCo2, 0);
    const manualCo2Deduction = Number.isFinite(activeApartment.co2LandlordDeductionKalo) ? Math.max(0, activeApartment.co2LandlordDeductionKalo) : 0;

    return preliminary.map(({ row, isHeating, tenantShareBeforeCo2 }) => {
      // Standard: CO₂-Automatik aus Gesamtwerten. Wenn KALO für diese Wohnung bereits einen konkreten
      // Vermieteranteil ausweist, hat der eingetragene KALO-Wert Vorrang.
      const heatingQuote = isHeating && workspace.heating.totalHeatingCost > 0 ? tenantShareBeforeCo2 / workspace.heating.totalHeatingCost : 0;
      const co2ShareApartment = roundMoney(workspace.heating.totalCo2Cost * heatingQuote);
      const autoCo2TenantShare = roundMoney(co2ShareApartment * (co2Stage.tenantPercent / 100));
      const autoCo2LandlordShare = roundMoney(co2ShareApartment * (co2Stage.landlordPercent / 100));
      const co2LandlordShare = isHeating && manualCo2Deduction > 0 && heatingBaseForManualCo2 > 0
        ? roundMoney(manualCo2Deduction * (tenantShareBeforeCo2 / heatingBaseForManualCo2))
        : autoCo2LandlordShare;
      const co2TenantShare = isHeating && manualCo2Deduction > 0 ? Math.max(0, roundMoney(co2ShareApartment - co2LandlordShare)) : autoCo2TenantShare;
      const tenantShare = isHeating ? Math.max(0, tenantShareBeforeCo2 - co2LandlordShare) : tenantShareBeforeCo2;

      return {
        row,
        isHeating,
        tenantShareBeforeCo2: roundMoney(tenantShareBeforeCo2),
        tenantShare: roundMoney(tenantShare),
        landlordShare: roundMoney(Math.max(0, row.amount - tenantShare)),
        co2ShareApartment,
        co2TenantShare,
        co2LandlordShare,
      };
    });
  }, [workspace.costs, activeApartment, workspace.heating.totalHeatingCost, workspace.heating.totalCo2Cost, co2Stage.tenantPercent, co2Stage.landlordPercent]);
  const totalCo2LandlordShare = roundMoney(costBreakdown.reduce((s, x) => s + x.co2LandlordShare, 0));
  const totalHeatingBeforeCo2 = roundMoney(costBreakdown.filter(x => x.isHeating).reduce((s, x) => s + x.tenantShareBeforeCo2, 0));
  const totalHeatingCosts = roundMoney(costBreakdown.filter(x => x.isHeating).reduce((s, x) => s + x.tenantShare, 0)); const totalColdCosts = roundMoney(costBreakdown.filter(x => !x.isHeating).reduce((s, x) => s + x.tenantShare, 0)); const totalTenantCosts = roundMoney(totalColdCosts + totalHeatingCosts); const tenantBalance = activeApartment ? roundMoney(activeApartment.advancePayments - totalTenantCosts) : 0;
  function exportOnePager() {
    if (!activeApartment) return;
    const filename = safeFilename(`NK-Abrechnung_${workspace.meta.propertyLabel}_${workspace.meta.billingYear}_${activeApartment.tenantName || activeApartment.label}`);
    const numberedAttachments = (workspace.meta.attachmentReferences || "").split(/\n|;/).map(x => x.trim()).filter(Boolean).map((x, i) => `Anlage ${i + 1}: ${x}`);
    const lines = [
      "Nebenkostenabrechnung Wohnung",
      `Objekt: ${workspace.meta.propertyLabel}`,
      `Objekt-Code: ${workspace.meta.propertyCode}`,
      `Jahr: ${workspace.meta.billingYear}`,
      `Zeitraum: ${formatDate(workspace.meta.periodFrom)} bis ${formatDate(workspace.meta.periodTo)}`,
      "",
      `Wohnung: ${activeApartment.label}`,
      `Mieter: ${activeApartment.tenantName || "—"}`,
      `Vorauszahlungen: ${formatCurrency(activeApartment.advancePayments)}`,
      "",
      "KOSTENAUFSTELLUNG",
      ...costBreakdown.map(x => `${x.row.label} | Gesamt ${formatCurrency(x.row.amount)} | ${x.row.totalKey ? `Gesamtanteile ${formatFlex(x.row.totalKey)} / Wohnungsanteil ${formatFlex(x.row.apartmentKey)}` : "Direktbetrag"} | Mieter ${formatCurrency(x.tenantShare)}`),
      "",
      "HEIZKOSTEN / CO₂-DOKUMENTATION",
      `Heizkosten laut KALO: ${formatCurrency(totalHeatingBeforeCo2)}`,
      `CO₂-Abzug Vermieter laut KALO/automatisch: -${formatCurrency(totalCo2LandlordShare)}`,
      `Heizkosten nach CO₂-Abzug: ${formatCurrency(totalHeatingCosts)}`,
      "",
      `Kalte Betriebskosten: ${formatCurrency(totalColdCosts)}`,
      `Gesamtkosten Mieter: ${formatCurrency(totalTenantCosts)}`,
      `Vorauszahlungen: ${formatCurrency(activeApartment.advancePayments)}`,
      `Saldo: ${formatCurrency(tenantBalance)}`,
      "",
      "ANLAGEN / REFERENZEN",
      ...numberedAttachments,
    ];
    downloadText(`${filename}.txt`, lines.join("\n"));
  }

  function escapeHtml(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function printBillingDocument() {
    if (!activeApartment) return;

    const rows = costBreakdown.map(x => `
      <tr>
        <td>${escapeHtml(x.row.label)}</td>
        <td class="right">${escapeHtml(formatCurrency(x.row.amount))}</td>
        <td class="right">${escapeHtml(x.row.totalKey ? formatFlex(x.row.totalKey) : "Direkt")}</td>
        <td class="right">${escapeHtml(x.row.totalKey ? formatFlex(x.row.apartmentKey) : "—")}</td>
        <td>${escapeHtml(calculationText(x))}${x.co2LandlordShare > 0 ? `; abzgl. CO₂-Vermieteranteil ${escapeHtml(formatCurrency(x.co2LandlordShare))}` : ""}</td>
        <td class="right strong">${escapeHtml(formatCurrency(x.tenantShare))}</td>
      </tr>`).join("");

    const serviceTableRows = serviceRows.length
      ? serviceRows.map(x => `
        <tr>
          <td>${escapeHtml(x.row.label)}</td>
          <td class="right">${escapeHtml(formatCurrency(x.row.amount))}</td>
          <td>${escapeHtml(calculationText(x))}</td>
          <td class="right strong">${escapeHtml(formatCurrency(x.tenantShare))}</td>
        </tr>`).join("")
      : `<tr><td colspan="4">Keine § 35a-relevanten Kostenarten eingetragen.</td></tr>`;

    const attachments = attachmentList.length
      ? attachmentList.map((x, i) => `<li><strong>Anlage ${i + 1}:</strong> ${escapeHtml(x)}</li>`).join("")
      : `<li>Keine Anlagen eingetragen.</li>`;

    const maxTotalKey = Math.max(...costBreakdown.map(x => x.row.totalKey || 0), 0);
    const residentialTotalKey = costBreakdown.find(x => x.row.label.toLowerCase().includes("wasser"))?.row.totalKey || 0;
    const totalPersons = costBreakdown.find(x => x.row.allocation === "persons")?.row.totalKey || activeApartment.persons;
    const printFilename = safeFilename(`NK-Abrechnung_${workspace.meta.propertyLabel}_${workspace.meta.billingYear}_${activeApartment.tenantName || activeApartment.label}`);

    const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(printFilename)}</title>
<style>
  @page { size: A4 portrait; margin: 9mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 8.8pt; line-height: 1.22; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 100%; min-height: 0; page-break-after: always; break-after: page; overflow: hidden; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .box { border-top: 3px double #000; border-bottom: 3px double #000; padding: 7px 9px; margin-bottom: 7px; break-inside: avoid; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  h2 { font-size: 11.5pt; margin: 8px 0 5px; }
  .sub { font-size: 10.2pt; margin-bottom: 5px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 18px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin: 6px 0; }
  .kpi { border: 1px solid #000; padding: 5px; min-height: 37px; }
  .kpi .label { font-size: 7pt; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
  .kpi .value { font-size: 12pt; font-weight: 800; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 7.8pt; table-layout: fixed; }
  th { border-bottom: 1.5px solid #000; text-align: left; padding: 3px 4px; font-weight: 800; }
  td { border-bottom: .5px solid #999; padding: 2.2px 4px; vertical-align: top; overflow-wrap: anywhere; }
  th:nth-child(1), td:nth-child(1) { width: 19%; }
  th:nth-child(2), td:nth-child(2) { width: 14%; }
  th:nth-child(3), td:nth-child(3) { width: 11%; }
  th:nth-child(4), td:nth-child(4) { width: 11%; }
  th:nth-child(5), td:nth-child(5) { width: 32%; }
  th:nth-child(6), td:nth-child(6) { width: 13%; }
  .right { text-align: right; white-space: nowrap; }
  .strong { font-weight: 800; }
  ul { margin: 4px 0 0 16px; padding: 0; }
  .small { font-size: 8pt; }
</style>
</head>
<body>
  <section class="page">
    <div class="box">
      <h1>Nebenkostenabrechnung ${escapeHtml(workspace.meta.billingYear)}</h1>
      <div class="sub">${escapeHtml(workspace.meta.propertyLabel)} · ${escapeHtml(formatDate(workspace.meta.periodFrom))} bis ${escapeHtml(formatDate(workspace.meta.periodTo))}</div>
      <div class="grid">
        <div><strong>Vermieter:</strong> ${escapeHtml(workspace.meta.landlordName || "—")}</div>
        <div><strong>Wohnung / Mieter:</strong> ${escapeHtml(activeApartment.label)} / ${escapeHtml(activeApartment.tenantName || "—")}</div>
        <div><strong>Vermieteradresse:</strong> ${escapeHtml(workspace.meta.landlordAddress || "—")}</div>
        <div><strong>Wohnfläche / MEA / Personen:</strong> ${escapeHtml(formatFlex(activeApartment.area))} m² / ${escapeHtml(formatFlex(activeApartment.allocationKey))} / ${escapeHtml(formatFlex(activeApartment.persons))}</div>
      </div>
    </div>

    <div class="box">
      <strong>Kostenverteilung</strong>
      <div class="grid" style="margin-top:4px">
        <div>Miteigentumsanteile gesamt: <strong>${escapeHtml(formatFlex(maxTotalKey))} MEA</strong></div>
        <div>Ihre MEA: <strong>${escapeHtml(formatFlex(activeApartment.allocationKey))}</strong></div>
        <div>Miteigentumsanteile Wohnungen: <strong>${escapeHtml(formatFlex(residentialTotalKey))}</strong></div>
        <div>Ihre Einheiten: <strong>1</strong></div>
        <div>Gesamtpersonen: <strong>${escapeHtml(formatFlex(totalPersons))}</strong></div>
        <div>Ihre Personen / Monate: <strong>${escapeHtml(formatFlex(activeApartment.persons))} / ${escapeHtml(formatFlex(activeApartment.occupancyMonths))}</strong></div>
      </div>
    </div>

    <h2>Kostenarten und Anteilsberechnung</h2>
    <table>
      <thead><tr><th>Kostenart</th><th class="right">Gesamtkosten</th><th class="right">Gesamt</th><th class="right">Wohnung</th><th>Anteilsberechnung</th><th class="right">Betrag</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="kpis">
      <div class="kpi"><div class="label">Kalte Betriebskosten</div><div class="value">${escapeHtml(formatCurrency(totalColdCosts))}</div></div>
      <div class="kpi"><div class="label">Heizkosten nach CO₂</div><div class="value">${escapeHtml(formatCurrency(totalHeatingCosts))}</div></div>
      <div class="kpi"><div class="label">Vorauszahlungen</div><div class="value">${escapeHtml(formatCurrency(activeApartment.advancePayments))}</div></div>
      <div class="kpi"><div class="label">${escapeHtml(balanceLabel)}</div><div class="value">${escapeHtml(formatCurrency(Math.abs(tenantBalance)))}</div></div>
    </div>
    <div class="box small"><strong>Summe umlagefähige Kosten Mieter:</strong> ${escapeHtml(formatCurrency(totalTenantCosts))} · <strong>CO₂-Vermieteranteil:</strong> -${escapeHtml(formatCurrency(totalCo2LandlordShare))}</div>
    <div class="box small"><strong>Dokumentation Heizkosten/CO₂:</strong> Heizkosten laut Einzelabrechnung ${escapeHtml(formatCurrency(totalHeatingBeforeCo2))}; abzüglich Vermieteranteil CO₂ ${escapeHtml(formatCurrency(totalCo2LandlordShare))}; umlagefähige Heizkosten nach CO₂-Abzug ${escapeHtml(formatCurrency(totalHeatingCosts))}.</div>
  </section>

  <section class="page">
    <div class="box">
      <h1>ANLAGE</h1>
      <div class="sub">Heizkosten / CO₂-Anlage für das Jahr ${escapeHtml(workspace.meta.billingYear)}</div>
      <div class="kpis">
        <div class="kpi"><div class="label">Heizkosten gesamt KALO</div><div class="value">${escapeHtml(formatCurrency(workspace.heating.totalHeatingCost))}</div></div>
        <div class="kpi"><div class="label">CO₂-Kosten gesamt</div><div class="value">${escapeHtml(formatCurrency(workspace.heating.totalCo2Cost))}</div></div>
        <div class="kpi"><div class="label">CO₂ gesamt</div><div class="value">${escapeHtml(formatNumber(co2TotalKg,0))} kg</div></div>
        <div class="kpi"><div class="label">Stufe / Aufteilung</div><div class="value">${escapeHtml(co2Stage.stage)} · ${escapeHtml(co2Stage.tenantPercent)}%/${escapeHtml(co2Stage.landlordPercent)}%</div></div>
      </div>
      <div class="grid small">
        <div>Gesamtverbrauch: <strong>${escapeHtml(formatNumber(workspace.heating.totalConsumptionKwh, 2))} kWh</strong></div>
        <div>Emissionsfaktor: <strong>${escapeHtml(formatFlex(workspace.heating.emissionFactor))}</strong></div>
        <div>Beheizte Fläche: <strong>${escapeHtml(formatNumber(workspace.heating.heatedArea, 2))} m²</strong></div>
        <div>CO₂ je m²/Jahr: <strong>${escapeHtml(formatNumber(co2PerSqm, 1))}</strong></div>
      </div>
    </div>

    <div class="box">
      <h2>Aufwände gem. § 35a Abs. 2 Satz 1 EStG haushaltsnahe Dienstleistungen und § 35a Abs. 3 EStG Handwerkerleistungen</h2>
      <table><thead><tr><th>Kostenart</th><th class="right">Gesamtkosten</th><th>Anteilsberechnung</th><th class="right">Betrag</th></tr></thead><tbody>${serviceTableRows}</tbody></table>
    </div>

    <div class="box">
      <strong>Anlagen / Referenzen</strong>
      <ul>${attachments}</ul>
    </div>
  </section>
</body>
</html>`;

    const oldFrame = document.getElementById("nk-print-frame");
    if (oldFrame) oldFrame.remove();

    const frame = document.createElement("iframe");
    frame.id = "nk-print-frame";
    frame.title = "NK-Abrechnung Druck";
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);

    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const doPrint = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 15000);
    };

    if (doc.readyState === "complete") {
      setTimeout(doPrint, 200);
    } else {
      frame.onload = () => setTimeout(doPrint, 200);
    }
  }


  const attachmentList = (workspace.meta.attachmentReferences || "").split(/\n|;/).map(x => x.trim()).filter(Boolean);
  const serviceKeywords = ["reinigung", "garten", "wartung", "pumpe", "hebeanlage", "dachrinne", "hausmeister", "schornstein", "handwerker"];
  const serviceRows = costBreakdown.filter(x => serviceKeywords.some(k => x.row.label.toLowerCase().includes(k)));
  function calculationText(x: typeof costBreakdown[number]) {
    if (x.row.allocation === "directAmount" || x.row.allocation === "heatingDirect") return "Direkt laut Einzelabrechnung";
    const base = `${formatCurrency(x.row.amount)} × ${formatFlex(x.row.apartmentKey)} / ${formatFlex(x.row.totalKey)}`;
    return x.row.prorateByOccupancy ? `${base} × ${formatFlex(activeApartment?.occupancyMonths ?? 0)} / 12` : base;
  }
  const balanceLabel = tenantBalance >= 0 ? "Guthaben" : "Nachzahlung";

  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    const from = new Date(`${workspace.meta.periodFrom}T00:00:00`);
    const to = new Date(`${workspace.meta.periodTo}T00:00:00`);
    if (!workspace.meta.propertyCode) warnings.push("Kein Objekt ausgewählt.");
    if (!workspace.meta.billingYear || workspace.meta.billingYear < 2000) warnings.push("Abrechnungsjahr prüfen.");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) warnings.push("Zeitraum von/bis ist unvollständig oder unplausibel.");
    if (!activeApartment?.tenantName?.trim()) warnings.push("Mietername fehlt.");
    if ((activeApartment?.advancePayments ?? 0) <= 0) warnings.push("Vorauszahlungen sind 0 € oder fehlen.");
    if ((activeApartment?.occupancyMonths ?? 0) <= 0 || (activeApartment?.occupancyMonths ?? 0) > 12) warnings.push("Belegungsmonate müssen zwischen 1 und 12 liegen.");
    if ((activeApartment?.area ?? 0) <= 0) warnings.push("Wohnfläche fehlt oder ist 0.");
    if ((activeApartment?.allocationKey ?? 0) <= 0) warnings.push("MEA/Wohnungsanteil fehlt oder ist 0.");
    if (costBreakdown.some(x => x.row.amount > 0 && x.row.totalKey <= 0 && x.row.allocation !== "directAmount" && x.row.allocation !== "heatingDirect")) warnings.push("Mindestens eine Kostenart hat Gesamtkosten, aber keinen Gesamt-Schlüssel.");
    if (costBreakdown.some(x => x.row.amount > 0 && x.row.apartmentKey <= 0 && x.row.allocation !== "directAmount" && x.row.allocation !== "heatingDirect")) warnings.push("Mindestens eine Kostenart hat Gesamtkosten, aber keinen Wohnungs-Schlüssel.");
    if (totalHeatingBeforeCo2 > 0 && workspace.heating.totalCo2Cost > 0 && totalCo2LandlordShare <= 0) warnings.push("Heizkosten vorhanden, aber kein CO₂-Vermieteranteil berechnet/eingetragen.");
    if (workspace.heating.totalConsumptionKwh > 0 && (workspace.heating.emissionFactor <= 0 || workspace.heating.heatedArea <= 0)) warnings.push("CO₂-Werte prüfen: Emissionsfaktor oder beheizte Fläche fehlt.");
    if (!attachmentList.length) warnings.push("Keine Anlagen/Referenzen für den Druck eingetragen.");
    return warnings;
  }, [workspace.meta.propertyCode, workspace.meta.billingYear, workspace.meta.periodFrom, workspace.meta.periodTo, workspace.heating.totalCo2Cost, workspace.heating.totalConsumptionKwh, workspace.heating.emissionFactor, workspace.heating.heatedArea, activeApartment, costBreakdown, totalHeatingBeforeCo2, totalCo2LandlordShare, attachmentList.length]);

  function finishBilling() {
    if (validationWarnings.length > 0) {
      const ok = window.confirm(`Vor dem Abschluss bitte prüfen:\n\n${validationWarnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}\n\nTrotzdem abschließen?`);
      if (!ok) return;
    }
    updateMeta("locked", true);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-6 print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body, #root { background: white !important; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; display: block !important; font-family: Arial, Helvetica, sans-serif !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-page { page-break-after: always; break-after: page; }
          .print-page:last-child { page-break-after: auto; break-after: auto; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 9.2pt; }
          .print-table th { border-bottom: 1.6px solid #000; text-align: left; font-weight: 700; padding: 4px 5px; }
          .print-table td { border-bottom: 0.6px solid #999; padding: 3.5px 5px; vertical-align: top; }
          .print-box { border-top: 3px double #000; border-bottom: 3px double #000; padding: 8px 10px; margin-top: 8px; }
          .print-title { font-size: 16pt; font-weight: 800; margin: 0 0 5px; }
          .print-subtitle { font-size: 11pt; margin: 0 0 7px; }
          .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; font-size: 9.5pt; }
          .print-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
          .print-kpi { border: 1px solid #000; padding: 6px; min-height: 42px; }
          .print-kpi-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
          .print-kpi-value { font-size: 13pt; font-weight: 800; margin-top: 3px; }
        }
      `}</style>

      <div className="mx-auto max-w-[1500px] space-y-6 no-print">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Property App</div>
              <h1 className="mt-1 text-2xl font-bold">NK-Abrechnungen Wohnungen</h1>
              <p className="mt-1 text-sm text-slate-500">Bearbeitung links, Ergebnis und Druckansicht unten. Der Druck gibt nur die fertige Abrechnung aus.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SelectInput value={selectedBillingId ?? ""} onChange={e => selectBilling(e.target.value)} className="min-w-[260px]"><option value="">Abrechnung wählen</option>{billingRecords.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</SelectInput>
              <button onClick={createNewPartialBilling} className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700"><Plus className="h-4 w-4"/> Teilabrechnung</button>
              <SelectInput value={selectedObjectCode} onChange={e => setSelectedObjectCode(e.target.value)}><option value="">Objekt wählen</option>{objects.map(o => <option key={o.objekt_code} value={o.objekt_code}>{o.label}</option>)}</SelectInput>
              <YearInput value={selectedYear} onChange={setSelectedYear} disabled={locked} />
              <button onClick={() => updateMeta("locked", !locked)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50">{locked ? <Pencil className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}{locked ? "Bearbeiten" : "Sperren"}</button>
            </div>
          </div>
          {(status || error || loading || saving) && <div className="mt-4 text-sm"><span className="text-slate-500">{loading ? "Lade… " : saving ? "Speichere… " : status}</span>{error && <span className="ml-3 text-rose-600">{error}</span>}</div>}
        </section>

        <div className="space-y-6">
          {activePreset && (
            <Card title="Immobilien-Vorlage / Automatische Struktur" icon={<Warehouse className="h-5 w-5"/>} actions={<button onClick={applyActivePreset} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/> Vorlage anwenden</button>}>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-sm font-bold text-emerald-950">{activePreset.title}</div>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">{activePreset.description}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Regel-Hinweis</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">{activePreset.note}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <Stat title="Heizkostenmodus" value={activePreset.heatingMode === "TENANT_DIRECT_CONTRACT" ? "Mieter direkt" : "Vermieter-Abrechnung"} />
                  <Stat title="Gesamtwohn-/Verteilerfläche" value={activePreset.totalArea ? `${formatNumber(activePreset.totalArea, 2)} m²` : "objektabhängig"} />
                  <Stat title="Nutz-/beheizte Fläche" value={activePreset.usableArea ? `${formatNumber(activePreset.usableArea, 2)} m²` : "objektabhängig"} />
                </div>
              </div>
            </Card>
          )}

          <Card title="Grunddaten" icon={<Home className="h-5 w-5"/>}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Abrechnungsjahr"><YearInput value={workspace.meta.billingYear} onChange={v => updateMeta("billingYear", v)} disabled={locked}/></Field>
              <Field label="Zeitraum von"><TextInput type="date" value={workspace.meta.periodFrom} onChange={e => updateMeta("periodFrom", e.target.value)} disabled={locked}/></Field>
              <Field label="Zeitraum bis"><TextInput type="date" value={workspace.meta.periodTo} onChange={e => updateMeta("periodTo", e.target.value)} disabled={locked}/></Field>
              <Field label="Vermieter"><TextInput value={workspace.meta.landlordName} onChange={e => updateMeta("landlordName", e.target.value)} disabled={locked}/></Field>
              <Field label="Vermieteradresse"><TextAreaInput value={workspace.meta.landlordAddress} onChange={e => updateMeta("landlordAddress", e.target.value)} disabled={locked} className="min-h-[118px]"/></Field>
              <Field label="Anlagen / Referenzen für Druck"><TextAreaInput value={workspace.meta.attachmentReferences} onChange={e => updateMeta("attachmentReferences", e.target.value)} disabled={locked} className="min-h-[118px]"/></Field>
            </div>
          </Card>

          <Card title="Wohnungen / Mieter" icon={<UserSquare2 className="h-5 w-5"/>} actions={<button onClick={addApartment} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700"><Plus className="h-4 w-4"/> Wohnung hinzufügen</button>}>
            <div className="space-y-4">{workspace.apartments.map(a => <div key={a.id} className={`overflow-visible rounded-[24px] border p-5 ${workspace.selectedApartmentId === a.id ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white"}`}>
              <div className="mb-4 flex items-start justify-between gap-3"><button onClick={() => update(p => ({...p, selectedApartmentId: a.id}))} className="text-left"><div className="font-semibold">{a.label}</div><div className="text-sm text-slate-500">{a.tenantName || "Noch kein Mieter"}</div></button><div className="flex shrink-0 gap-2"><label className="rounded-full border bg-white px-3 py-2 text-sm"><input type="checkbox" className="mr-2" checked={a.active} disabled={locked} onChange={e => updateApartment(a.id, { active: e.target.checked })}/>belegt</label><button onClick={() => deleteApartment(a.id)} disabled={locked} className="h-10 w-10 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700"><Trash2 className="mx-auto h-4 w-4"/></button></div></div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><Field label="Wohnungsname"><TextInput value={a.label} onChange={e => updateApartment(a.id, { label: e.target.value })} disabled={locked}/></Field><Field label="Mietername"><TextInput value={a.tenantName} onChange={e => updateApartment(a.id, { tenantName: e.target.value })} disabled={locked}/></Field><Field label="Wohnfläche (m²)"><NumberInput value={a.area} onCommit={v => updateApartment(a.id, { area: v })} disabled={locked}/></Field><Field label="Standard-MEA / Info"><NumberInput value={a.allocationKey} onCommit={v => updateApartment(a.id, { allocationKey: v })} disabled={locked} decimals={4}/></Field><Field label="Personen"><NumberInput value={a.persons} onCommit={v => updateApartment(a.id, { persons: v })} disabled={locked} decimals={0}/></Field><Field label="Belegungsmonate"><NumberInput value={a.occupancyMonths} onCommit={v => updateApartment(a.id, { occupancyMonths: clamp(v,0,12) })} disabled={locked} decimals={0}/></Field><Field label="Vorauszahlungen (€)"><NumberInput value={a.advancePayments} onCommit={v => updateApartment(a.id, { advancePayments: v })} disabled={locked}/></Field><Field label="CO₂-Abzug Vermieter laut KALO (€)"><NumberInput value={a.co2LandlordDeductionKalo} onCommit={v => updateApartment(a.id, { co2LandlordDeductionKalo: v })} disabled={locked}/></Field></div>
            </div>)}</div>
          </Card>
        </div>

        <Card title="Buchungen → automatische NK-Abrechnung" icon={<Calculator className="h-5 w-5"/>} actions={<button onClick={importBookingsIntoBilling} disabled={locked || appData.loading} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/> Buchungen importieren</button>}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <div className="font-semibold text-slate-950">So funktioniert der Import</div>
              <p className="mt-1">Die App liest echte Ausgaben aus <strong>finance_entry</strong> für das gewählte Objekt und den Abrechnungszeitraum. Kategorie und Notiz werden automatisch erkannt, z.B. Versicherung, Grundsteuer, Wasser, Müll, Schornsteinfeger oder Thermenwartung.</p>
              <p className="mt-2">Nicht umlagefähige oder riskante Buchungen wie Hausgeld-Sammelzahlungen, Rücklage, Reparaturen, Verwaltergebühren oder Bankgebühren werden bewusst nicht übernommen.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <div className="font-semibold text-slate-950">Aktueller Zeitraum</div>
              <div className="mt-2 grid gap-2 text-slate-700">
                <div>Objekt: <strong>{workspace.meta.propertyLabel}</strong></div>
                <div>Zeitraum: <strong>{formatDate(workspace.meta.periodFrom)} bis {formatDate(workspace.meta.periodTo)}</strong></div>
                <div>Heizmodus: <strong>{heatingIsTenantDirect ? "Mieter direkt — keine Heizkosten/CO₂" : "Vermieter-Abrechnung — Heizkosten/CO₂ aktiv"}</strong></div>
                <div>Geladene Buchungen im App-Kontext: <strong>{appData.entries.length}</strong></div>
              </div>
            </div>
          </div>
          {lastImportResult && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <div className="font-semibold">Übernommen</div>
                {lastImportResult.imported.length ? <><div className="mt-1 text-xs text-emerald-800">Diese Positionen wurden in den Kostenarten aktualisiert und fließen sofort in Ergebnis/Druck ein.</div><ul className="mt-2 space-y-1">{lastImportResult.imported.map((item, i) => <li key={`${item.label}-${i}`}>✓ {item.label}: <strong>{formatCurrency(item.amount)}</strong> <span className="text-emerald-700">({item.confidence})</span></li>)}</ul></> : <div className="mt-2">Keine eindeutig umlagefähige Buchung erkannt.</div>}
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="font-semibold">Nicht automatisch übernommen / prüfen</div>
                {lastImportResult.ignored.length ? <ul className="mt-2 max-h-52 space-y-1 overflow-auto pr-2">{lastImportResult.ignored.slice(0, 20).map((item, i) => <li key={`${item.sourceId}-${i}`}>• {item.date} · {item.category || "ohne Kategorie"} · {formatCurrency(item.amount)} — {item.reason}</li>)}</ul> : <div className="mt-2">Keine ignorierten Buchungen.</div>}
              </div>
            </div>
          )}
        </Card>

        <Card title="Kostenarten" icon={<Warehouse className="h-5 w-5"/>} actions={<button onClick={addCost} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700"><Plus className="h-4 w-4"/> Kostenart hinzufügen</button>}>
          <div className="space-y-4">{workspace.costs.map(row => <div key={row.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-lg font-semibold">{row.label}</h3><p className="text-sm text-slate-500">{allocationLabel(row.allocation)}</p></div><button onClick={() => deleteCost(row.id)} disabled={locked} className="h-10 w-10 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700"><Trash2 className="mx-auto h-4 w-4"/></button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"><Field label="Bezeichnung"><TextInput value={row.label} onChange={e => updateCost(row.id, { label: e.target.value })} disabled={locked}/></Field><Field label="Gesamtbetrag (€)"><NumberInput value={row.amount} onCommit={v => updateCost(row.id, { amount: v })} disabled={locked}/></Field><Field label="Verteilung"><SelectInput value={row.allocation} onChange={e => updateCost(row.id, { allocation: e.target.value as AllocationType })} disabled={locked}><option value="allocationKey">Umlageschlüssel</option><option value="persons">Personen/Tage</option><option value="directAmount">Direktbetrag</option><option value="heatingDirect">KALO-Heizkosten direkt</option></SelectInput></Field>{(row.allocation === "allocationKey" || row.allocation === "persons") && <><Field label="Gesamt-Schlüssel"><NumberInput value={row.totalKey} onCommit={v => updateCost(row.id, { totalKey: v })} disabled={locked} decimals={4}/></Field><Field label="Wohnungs-Schlüssel"><NumberInput value={row.apartmentKey} onCommit={v => updateCost(row.id, { apartmentKey: v })} disabled={locked} decimals={4}/></Field></>}{(row.allocation === "directAmount" || row.allocation === "heatingDirect") && <Field label="Direktbetrag Mieter (€)"><NumberInput value={row.directAmount} onCommit={v => updateCost(row.id, { directAmount: v })} disabled={locked}/></Field>}<label className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700"><input type="checkbox" checked={row.prorateByOccupancy} disabled={locked || row.allocation === "directAmount" || row.allocation === "heatingDirect"} onChange={e => updateCost(row.id, { prorateByOccupancy: e.target.checked })}/><span>nach Belegungsmonaten kürzen</span></label></div><div className="mt-3 grid gap-4 md:grid-cols-[1fr_180px]"><Field label="Notiz"><TextInput value={row.note} onChange={e => updateCost(row.id, { note: e.target.value })} disabled={locked} /></Field><div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Mieteranteil</div><div className="mt-1 text-xl font-semibold">{formatCurrency(costBreakdown.find(x => x.row.id === row.id)?.tenantShare ?? 0)}</div></div></div></div>)}</div>
        </Card>

        {heatingIsTenantDirect ? (
          <Card title="Heizkosten / Gas" icon={<Calculator className="h-5 w-5"/>}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Für dieses Objekt ist hinterlegt: <strong>Heizung/Gas läuft direkt über den Mieter beim Versorger.</strong> Deshalb werden keine Heizkosten, Warmwasser- oder CO₂-Kosten in dieser Nebenkostenabrechnung erzeugt. Umlagefähig bleiben nur vorhandene Wartungspositionen, z.B. Thermenwartung oder Schornsteinfeger, wenn als Kostenzeile eingetragen.
            </div>
          </Card>
        ) : (
          <Card title="Heizkosten / CO₂-Anlage" icon={<Calculator className="h-5 w-5"/>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Heizkosten gesamt KALO"><NumberInput value={workspace.heating.totalHeatingCost} onCommit={v => updateHeating("totalHeatingCost", v)} disabled={locked}/></Field><Field label="Warmwasser gesamt"><NumberInput value={workspace.heating.totalWarmWaterCost} onCommit={v => updateHeating("totalWarmWaterCost", v)} disabled={locked}/></Field><Field label="CO₂-Kosten gesamt"><NumberInput value={workspace.heating.totalCo2Cost} onCommit={v => updateHeating("totalCo2Cost", v)} disabled={locked}/></Field><Field label="Gesamtverbrauch kWh"><NumberInput value={workspace.heating.totalConsumptionKwh} onCommit={v => updateHeating("totalConsumptionKwh", v)} disabled={locked}/></Field><Field label="Emissionsfaktor"><NumberInput value={workspace.heating.emissionFactor} onCommit={v => updateHeating("emissionFactor", v)} disabled={locked} decimals={4}/></Field><Field label="Beheizte Fläche m²"><NumberInput value={workspace.heating.heatedArea} onCommit={v => updateHeating("heatedArea", v)} disabled={locked}/></Field></div><div className="mt-4 grid gap-4 md:grid-cols-4"><Stat title="CO₂ gesamt" value={`${formatNumber(co2TotalKg,0)} kg`}/><Stat title="CO₂ je m²/Jahr" value={formatNumber(co2PerSqm,1)}/><Stat title="Stufe" value={String(co2Stage.stage)}/><Stat title="Mieter / Vermieter" value={`${co2Stage.tenantPercent}% / ${co2Stage.landlordPercent}%`}/></div></Card>
        )}

        <Card title="Ergebnis / Druck" icon={<FileText className="h-5 w-5"/>} actions={<div className="flex gap-2"><button onClick={exportOnePager} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium"><FileText className="h-4 w-4"/> Export</button><button onClick={printBillingDocument} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium"><Printer className="h-4 w-4"/> Drucken</button><button onClick={finishBilling} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><CheckCircle2 className="h-4 w-4"/> Abschließen</button></div>}><div className="grid gap-4 md:grid-cols-4"><Stat title="Kalte Betriebskosten" value={formatCurrency(totalColdCosts)}/><Stat title="Heizkosten vor CO₂" value={formatCurrency(totalHeatingBeforeCo2)}/><Stat title="CO₂-Abzug Vermieter" value={`-${formatCurrency(totalCo2LandlordShare)}`} accent="success"/><Stat title="Gesamtkosten Mieter" value={formatCurrency(totalTenantCosts)}/><Stat title="Vorauszahlungen" value={formatCurrency(activeApartment?.advancePayments ?? 0)}/><Stat title={balanceLabel} value={formatCurrency(Math.abs(tenantBalance))} accent={tenantBalance >= 0 ? "success" : "danger"}/></div><div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div className="font-semibold text-slate-950">Dokumentation Heizkosten / CO₂</div><div className="mt-1">Heizkosten laut Einzelabrechnung: <strong>{formatCurrency(totalHeatingBeforeCo2)}</strong> · CO₂-Abzug Vermieter: <strong>-{formatCurrency(totalCo2LandlordShare)}</strong> · Umlagefähig nach CO₂-Abzug: <strong>{formatCurrency(totalHeatingCosts)}</strong></div><div className="mt-2 text-xs text-slate-500">Druckhinweis: Im Browser beim PDF-Speichern am besten Kopf- und Fußzeilen deaktivieren.</div></div>{validationWarnings.length > 0 ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="font-semibold">Plausibilitätsprüfung vor Abschluss</div><ul className="mt-2 list-disc pl-5">{validationWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div> : <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">Plausibilitätsprüfung: keine Warnungen.</div>}</Card>
      </div>

      <section id="print-area" className="hidden print:block">
        <div className="print-page">
          <div className="print-box avoid-break">
            <p className="print-title">Nebenkostenabrechnung {workspace.meta.billingYear}</p>
            <p className="print-subtitle">{workspace.meta.propertyLabel} · {formatDate(workspace.meta.periodFrom)} bis {formatDate(workspace.meta.periodTo)}</p>
            <div className="print-grid"><span><strong>Vermieter:</strong> {workspace.meta.landlordName || "—"}</span><span><strong>Wohnung/Mieter:</strong> {activeApartment?.label || "—"} / {activeApartment?.tenantName || "—"}</span><span><strong>Vermieteradresse:</strong> {workspace.meta.landlordAddress || "—"}</span><span><strong>Wohnfläche / MEA / Personen:</strong> {formatFlex(activeApartment?.area ?? 0)} m² / {formatFlex(activeApartment?.allocationKey ?? 0)} / {formatFlex(activeApartment?.persons ?? 0)}</span><span><strong>CO₂-Abzug Vermieter laut KALO:</strong> {formatCurrency(activeApartment?.co2LandlordDeductionKalo ?? 0)}</span></div>
          </div>
          <div className="print-box avoid-break"><strong>Kostenverteilung</strong><div className="print-grid" style={{marginTop: 6}}><span>Miteigentumsanteile gesamt: <strong>{formatFlex(Math.max(...costBreakdown.map(x => x.row.totalKey || 0), 0))} MEA</strong></span><span>Ihre MEA: <strong>{formatFlex(activeApartment?.allocationKey ?? 0)}</strong></span><span>Miteigentumsanteile Wohnungen: <strong>{formatFlex(costBreakdown.find(x => x.row.label.toLowerCase().includes("wasser"))?.row.totalKey || 0)}</strong></span><span>Ihre Einheiten: <strong>1</strong></span><span>Gesamtpersonen: <strong>{formatFlex(costBreakdown.find(x => x.row.allocation === "persons")?.row.totalKey || 0)}</strong></span><span>Ihre Personen / Monate: <strong>{formatFlex(activeApartment?.persons ?? 0)} / {formatFlex(activeApartment?.occupancyMonths ?? 0)}</strong></span></div></div>
          <h2 style={{fontSize: "12pt", margin: "10px 0 5px"}}>Kostenarten und Anteilsberechnung</h2>
          <table className="print-table"><thead><tr><th>Kostenart</th><th>Gesamtkosten</th><th>Gesamt</th><th>Wohnung</th><th>Anteilsberechnung</th><th style={{textAlign:"right"}}>Betrag</th></tr></thead><tbody>{costBreakdown.map(x => <tr key={`p-${x.row.id}`}><td>{x.row.label}</td><td>{formatCurrency(x.row.amount)}</td><td>{x.row.totalKey ? formatFlex(x.row.totalKey) : "Direkt"}</td><td>{x.row.totalKey ? formatFlex(x.row.apartmentKey) : "—"}</td><td>{calculationText(x)}{x.co2LandlordShare > 0 ? ` abzüglich CO₂ ${formatCurrency(x.co2LandlordShare)}` : ""}</td><td style={{textAlign:"right", fontWeight:700}}>{formatCurrency(x.tenantShare)}</td></tr>)}</tbody></table>
          <div className="print-kpi-grid avoid-break" style={{marginTop: 8}}><div className="print-kpi"><div className="print-kpi-label">Kalte Betriebskosten</div><div className="print-kpi-value">{formatCurrency(totalColdCosts)}</div></div><div className="print-kpi"><div className="print-kpi-label">Heizkosten nach CO₂</div><div className="print-kpi-value">{formatCurrency(totalHeatingCosts)}</div></div><div className="print-kpi"><div className="print-kpi-label">Gesamtkosten</div><div className="print-kpi-value">{formatCurrency(totalTenantCosts)}</div></div><div className="print-kpi"><div className="print-kpi-label">{balanceLabel}</div><div className="print-kpi-value">{formatCurrency(Math.abs(tenantBalance))}</div></div></div><div className="print-box avoid-break" style={{marginTop: 8}}><strong>Dokumentation Heizkosten/CO₂:</strong> Heizkosten laut Einzelabrechnung {formatCurrency(totalHeatingBeforeCo2)}; abzüglich Vermieteranteil CO₂ {formatCurrency(totalCo2LandlordShare)}; umlagefähige Heizkosten nach CO₂-Abzug {formatCurrency(totalHeatingCosts)}.</div>
        </div>
        <div className="print-page">
          <div className="print-box avoid-break"><p className="print-title">ANLAGE</p><p className="print-subtitle">Heizkosten / CO₂-Anlage für das Jahr {workspace.meta.billingYear}</p><div className="print-kpi-grid"><div className="print-kpi"><div className="print-kpi-label">Heizkosten gesamt KALO</div><div className="print-kpi-value">{formatCurrency(workspace.heating.totalHeatingCost)}</div></div><div className="print-kpi"><div className="print-kpi-label">CO₂-Kosten gesamt</div><div className="print-kpi-value">{formatCurrency(workspace.heating.totalCo2Cost)}</div></div><div className="print-kpi"><div className="print-kpi-label">CO₂ gesamt</div><div className="print-kpi-value">{formatNumber(co2TotalKg,0)} kg</div></div><div className="print-kpi"><div className="print-kpi-label">Stufe / Aufteilung</div><div className="print-kpi-value">{co2Stage.stage} · {co2Stage.tenantPercent}%/{co2Stage.landlordPercent}%</div></div></div></div>
          <div className="print-box avoid-break"><h2 style={{fontSize: "12pt", margin: 0}}>Aufwände gem. § 35a Abs. 2 Satz 1 EStG haushaltsnahe Dienstleistungen und § 35a Abs. 3 EStG Handwerkerleistungen</h2><table className="print-table" style={{marginTop: 8}}><thead><tr><th>Kostenart</th><th>Gesamtkosten</th><th>Anteilsberechnung</th><th style={{textAlign:"right"}}>Betrag</th></tr></thead><tbody>{serviceRows.length ? serviceRows.map(x => <tr key={`s-${x.row.id}`}><td>{x.row.label}</td><td>{formatCurrency(x.row.amount)}</td><td>{calculationText(x)}</td><td style={{textAlign:"right", fontWeight:700}}>{formatCurrency(x.tenantShare)}</td></tr>) : <tr><td colSpan={4}>Keine § 35a-relevanten Kostenarten markiert/eingetragen.</td></tr>}</tbody></table></div>
          <div className="print-box avoid-break"><strong>Anlagen / Referenzen</strong><ul style={{margin: "6px 0 0 18px", padding: 0}}>{attachmentList.length ? attachmentList.map((x, i) => <li key={i}><strong>Anlage {i + 1}:</strong> {x}</li>) : <li>Keine Anlagen eingetragen.</li>}</ul></div>
        </div>
      </section>
    </main>
  );
}
