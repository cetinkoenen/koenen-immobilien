import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import {
  Calculator,
  CheckCircle2,
  FileText,
  Home,
  Lock,
  Pencil,
  Plus,
  Printer,
  Trash2,
  UserSquare2,
  Warehouse,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type AllocationMethod = "sqm" | "key";
type CostAllocationType = "sqm" | "key" | "persons" | "manualShare" | "directAmount" | "heating";

type ObjectOption = {
  objekt_code: string;
  label: string;
};

type ApartmentRow = {
  id: string;
  label: string;
  tenantName: string;
  area: number;
  allocationKey: number;
  persons: number;
  occupancyMonths: number;
  advancePayments: number;
  heatingConsumptionShare: number;
  warmWaterShare: number;
  active: boolean;
};

type CostRow = {
  id: string;
  label: string;
  amount: number;
  allocation: CostAllocationType;
  note: string;
  manualSharePercent: number;
  directAmount: number;
};

type HeatingSettings = {
  totalHeatingCost: number;
  totalWarmWaterCost: number;
  totalCo2Cost: number;
  consumptionPercent: number;
  areaPercent: number;
  totalConsumptionKwh: number;
  emissionFactor: number;
  heatedArea: number;
};

type BuildingMeta = {
  propertyCode: string;
  propertyLabel: string;
  billingYear: number;
  periodFrom: string;
  periodTo: string;
  landlordName: string;
  landlordAddress: string;
  totalArea: number;
  totalAllocationKey: number;
  totalPersons: number;
  defaultAllocationMethod: AllocationMethod;
  locked: boolean;
};

type BillingWorkspace = {
  meta: BuildingMeta;
  apartments: ApartmentRow[];
  costs: CostRow[];
  heating: HeatingSettings;
  selectedApartmentId: string | null;
};

type CostResult = {
  row: CostRow;
  tenantShare: number;
  landlordShare: number;
};

type Co2StageResult = {
  stage: number;
  tenantPercent: number;
  landlordPercent: number;
};

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseGermanNumber(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumberInput(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatShortNumberInput(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8;") {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function allocationLabel(type: CostAllocationType) {
  switch (type) {
    case "sqm":
      return "Wohnfläche";
    case "key":
      return "Umlageschlüssel";
    case "persons":
      return "Personen";
    case "manualShare":
      return "Manueller Anteil";
    case "directAmount":
      return "Direktbetrag";
    case "heating":
      return "HeizkostenV / CO₂";
    default:
      return type;
  }
}

function getCo2Stage(co2PerSqm: number): Co2StageResult {
  if (co2PerSqm < 12) return { stage: 1, tenantPercent: 100, landlordPercent: 0 };
  if (co2PerSqm < 17) return { stage: 2, tenantPercent: 90, landlordPercent: 10 };
  if (co2PerSqm < 22) return { stage: 3, tenantPercent: 80, landlordPercent: 20 };
  if (co2PerSqm < 27) return { stage: 4, tenantPercent: 70, landlordPercent: 30 };
  if (co2PerSqm < 32) return { stage: 5, tenantPercent: 60, landlordPercent: 40 };
  if (co2PerSqm < 37) return { stage: 6, tenantPercent: 50, landlordPercent: 50 };
  if (co2PerSqm < 42) return { stage: 7, tenantPercent: 40, landlordPercent: 60 };
  if (co2PerSqm < 47) return { stage: 8, tenantPercent: 30, landlordPercent: 70 };
  if (co2PerSqm < 52) return { stage: 9, tenantPercent: 20, landlordPercent: 80 };
  return { stage: 10, tenantPercent: 5, landlordPercent: 95 };
}

function isProbablyGarage(option: ObjectOption) {
  const text = `${option.objekt_code} ${option.label}`.toLowerCase();
  return text.includes("garage") || text.includes("garagen") || text.includes("tg") || text.includes("tiefgarage");
}

const DEFAULT_COSTS: Array<Omit<CostRow, "id">> = [
  { label: "Frischwasser", amount: 0, allocation: "manualShare", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Gartenpflege", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Gebäudereinigung", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Grundsteuer", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Müllentsorgung", amount: 0, allocation: "persons", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Schornsteinfeger", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Strom Gebäude", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Versicherung", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Wartung Therme", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Winterdienst", amount: 0, allocation: "sqm", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Fehlende Mietzahlungen / Rechnung", amount: 0, allocation: "directAmount", note: "", manualSharePercent: 0, directAmount: 0 },
  { label: "Heiz- und Warmwasserkosten", amount: 0, allocation: "heating", note: "Automatisch aus Heizdaten", manualSharePercent: 0, directAmount: 0 },
];

function createDefaultWorkspace(year: number, object?: ObjectOption): BillingWorkspace {
  const apartmentId = createId();

  return {
    meta: {
      propertyCode: object?.objekt_code ?? "",
      propertyLabel: object?.label ?? "Bitte Objekt wählen",
      billingYear: year,
      periodFrom: `${year}-01-01`,
      periodTo: `${year}-12-31`,
      landlordName: "",
      landlordAddress: "",
      totalArea: 0,
      totalAllocationKey: 0,
      totalPersons: 0,
      defaultAllocationMethod: "sqm",
      locked: false,
    },
    apartments: [
      {
        id: apartmentId,
        label: "Wohnung 1",
        tenantName: "",
        area: 0,
        allocationKey: 0,
        persons: 1,
        occupancyMonths: 12,
        advancePayments: 0,
        heatingConsumptionShare: 0,
        warmWaterShare: 0,
        active: true,
      },
    ],
    costs: DEFAULT_COSTS.map((item) => ({ ...item, id: createId() })),
    heating: {
      totalHeatingCost: 0,
      totalWarmWaterCost: 0,
      totalCo2Cost: 0,
      consumptionPercent: 70,
      areaPercent: 30,
      totalConsumptionKwh: 0,
      emissionFactor: 0.201,
      heatedArea: 0,
    },
    selectedApartmentId: apartmentId,
  };
}

function normalizeWorkspace(raw: Partial<BillingWorkspace> | null | undefined, year: number, object?: ObjectOption): BillingWorkspace {
  const fallback = createDefaultWorkspace(year, object);

  const apartments = Array.isArray(raw?.apartments) && raw.apartments.length > 0
    ? raw.apartments.map((apartment, index) => ({
        ...fallback.apartments[0],
        ...apartment,
        id: apartment?.id || createId(),
        label: apartment?.label || `Wohnung ${index + 1}`,
        active: typeof apartment?.active === "boolean" ? apartment.active : true,
      }))
    : fallback.apartments;

  const costs = Array.isArray(raw?.costs) && raw.costs.length > 0
    ? raw.costs.map((row, index) => ({
        ...DEFAULT_COSTS[index % DEFAULT_COSTS.length],
        ...row,
        id: row?.id || createId(),
        label: row?.label || `Kostenart ${index + 1}`,
      }))
    : fallback.costs;

  const selectedApartmentId = raw?.selectedApartmentId && apartments.some((item) => item.id === raw.selectedApartmentId)
    ? raw.selectedApartmentId
    : apartments[0]?.id ?? null;

  return {
    meta: {
      ...fallback.meta,
      ...(raw?.meta ?? {}),
      propertyCode: object?.objekt_code ?? raw?.meta?.propertyCode ?? fallback.meta.propertyCode,
      propertyLabel: object?.label ?? raw?.meta?.propertyLabel ?? fallback.meta.propertyLabel,
      billingYear: year,
      locked: Boolean(raw?.meta?.locked),
    },
    apartments,
    costs,
    heating: {
      ...fallback.heating,
      ...(raw?.heating ?? {}),
    },
    selectedApartmentId,
  };
}

function CardSection({
  title,
  icon,
  children,
  actions,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">
            {icon}
          </div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const { children, ...rest } = props;
  return (
    <select
      {...rest}
      className={`h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-[15px] font-medium text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 ${props.className ?? ""}`}
    >
      {children}
    </select>
  );
}

function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[110px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 ${props.className ?? ""}`}
    />
  );
}

function NumberInput({
  value,
  onCommit,
  disabled,
  placeholder,
  decimals = 2,
  min,
  max,
}: {
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
  decimals?: number;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(decimals === 0 ? formatShortNumberInput(value) : formatNumberInput(value, decimals));

  useEffect(() => {
    setDraft(decimals === 0 ? formatShortNumberInput(value) : formatNumberInput(value, decimals));
  }, [value, decimals]);

  function commit() {
    let next = parseGermanNumber(draft || "0");
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    onCommit(next);
    setDraft(decimals === 0 ? formatShortNumberInput(next) : formatNumberInput(next, decimals));
  }

  return (
    <TextInput
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}

function StatCard({ title, value, accent = "default" }: { title: string; value: string; accent?: "default" | "success" | "danger" }) {
  const color = accent === "success" ? "text-emerald-700" : accent === "danger" ? "text-rose-700" : "text-slate-950";

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className={`mt-3 text-[30px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default function NebenkostenWohnungen() {
  const currentYear = new Date().getFullYear();

  const [objects, setObjects] = useState<ObjectOption[]>([]);
  const [selectedObjectCode, setSelectedObjectCode] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [workspace, setWorkspace] = useState<BillingWorkspace>(() => createDefaultWorkspace(currentYear));
  const [statusMessage, setStatusMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from("v_object_dropdown")
        .select("objekt_code,label")
        .order("label", { ascending: true });

      if (!alive) return;

      if (error) {
        setSaveError(`Objekte konnten nicht geladen werden: ${error.message}`);
        return;
      }

      const list = ((data ?? []) as ObjectOption[])
        .filter((item) => item?.objekt_code && item?.label)
        .filter((item) => !isProbablyGarage(item))
        .sort((a, b) => a.label.localeCompare(b.label, "de"));

      setObjects(list);
      if (!selectedObjectCode && list[0]) setSelectedObjectCode(list[0].objekt_code);
    })();

    return () => {
      alive = false;
    };
  }, [selectedObjectCode]);

  const selectedObject = useMemo(
    () => objects.find((item) => item.objekt_code === selectedObjectCode) ?? null,
    [objects, selectedObjectCode]
  );

  useEffect(() => {
    let alive = true;

    async function loadWorkspace() {
      if (!selectedObjectCode) return;

      hasLoadedRef.current = false;
      setLoadingWorkspace(true);
      setSaveError("");

      const { data, error } = await supabase
        .from("apartment_billing_workspaces")
        .select("data")
        .eq("object_id", selectedObjectCode)
        .eq("year", String(selectedYear))
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setWorkspace(createDefaultWorkspace(selectedYear, selectedObject ?? undefined));
        setStatusMessage(`Neue Abrechnung für ${selectedYear} erstellt.`);
        setSaveError(`Supabase-Fehler: ${error.message}`);
        setLoadingWorkspace(false);
        hasLoadedRef.current = true;
        return;
      }

      if (data?.data) {
        setWorkspace(normalizeWorkspace(data.data as Partial<BillingWorkspace>, selectedYear, selectedObject ?? undefined));
        setStatusMessage(`Gespeicherte Abrechnung für ${selectedYear} geladen.`);
      } else {
        setWorkspace(createDefaultWorkspace(selectedYear, selectedObject ?? undefined));
        setStatusMessage(`Neue Abrechnung für ${selectedYear} erstellt.`);
      }

      setLoadingWorkspace(false);
      hasLoadedRef.current = true;
    }

    void loadWorkspace();

    return () => {
      alive = false;
    };
  }, [selectedObjectCode, selectedYear, selectedObject]);

  useEffect(() => {
    if (!selectedObjectCode || !hasLoadedRef.current) return;

    const payload: BillingWorkspace = {
      ...workspace,
      meta: {
        ...workspace.meta,
        propertyCode: selectedObjectCode,
        propertyLabel: selectedObject?.label ?? workspace.meta.propertyLabel,
        billingYear: selectedYear,
      },
    };

    const timeoutId = window.setTimeout(async () => {
      setSavingWorkspace(true);
      setSaveError("");

      const { error } = await supabase
        .from("apartment_billing_workspaces")
        .upsert(
          {
            object_id: selectedObjectCode,
            year: String(selectedYear),
            data: payload,
          },
          { onConflict: "object_id,year" }
        );

      setSavingWorkspace(false);

      if (error) {
        setSaveError(`Supabase-Fehler: ${error.message}`);
      } else {
        setStatusMessage(`Gespeichert: ${selectedObject?.label ?? selectedObjectCode} / ${selectedYear}`);
      }
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [workspace, selectedObjectCode, selectedYear, selectedObject]);

  function updateWorkspace(updater: (prev: BillingWorkspace) => BillingWorkspace) {
    setWorkspace((prev) => updater(prev));
  }

  function updateMeta<K extends keyof BuildingMeta>(key: K, value: BuildingMeta[K]) {
    updateWorkspace((prev) => ({ ...prev, meta: { ...prev.meta, [key]: value } }));
  }

  function updateHeating<K extends keyof HeatingSettings>(key: K, value: HeatingSettings[K]) {
    updateWorkspace((prev) => ({ ...prev, heating: { ...prev.heating, [key]: value } }));
  }

  function updateApartment(id: string, patch: Partial<ApartmentRow>) {
    updateWorkspace((prev) => ({
      ...prev,
      apartments: prev.apartments.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addApartment() {
    if (workspace.meta.locked) return;
    const apartment: ApartmentRow = {
      id: createId(),
      label: `Wohnung ${workspace.apartments.length + 1}`,
      tenantName: "",
      area: 0,
      allocationKey: 0,
      persons: 1,
      occupancyMonths: 12,
      advancePayments: 0,
      heatingConsumptionShare: 0,
      warmWaterShare: 0,
      active: true,
    };

    updateWorkspace((prev) => ({
      ...prev,
      apartments: [...prev.apartments, apartment],
      selectedApartmentId: apartment.id,
    }));
  }

  function deleteApartment(id: string) {
    if (workspace.meta.locked) return;

    updateWorkspace((prev) => {
      const next = prev.apartments.filter((item) => item.id !== id);
      const safe = next.length > 0 ? next : createDefaultWorkspace(selectedYear, selectedObject ?? undefined).apartments;
      return {
        ...prev,
        apartments: safe,
        selectedApartmentId: safe[0]?.id ?? null,
      };
    });
  }

  function updateCost(id: string, patch: Partial<CostRow>) {
    updateWorkspace((prev) => ({
      ...prev,
      costs: prev.costs.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  }

  function addCostRow() {
    if (workspace.meta.locked) return;
    updateWorkspace((prev) => ({
      ...prev,
      costs: [
        ...prev.costs,
        {
          id: createId(),
          label: `Kostenart ${prev.costs.length + 1}`,
          amount: 0,
          allocation: prev.meta.defaultAllocationMethod === "sqm" ? "sqm" : "key",
          note: "",
          manualSharePercent: 0,
          directAmount: 0,
        },
      ],
    }));
  }

  function deleteCost(id: string) {
    if (workspace.meta.locked) return;
    updateWorkspace((prev) => ({
      ...prev,
      costs: prev.costs.filter((row) => row.id !== id),
    }));
  }

  const activeApartment = useMemo(
    () => workspace.apartments.find((item) => item.id === workspace.selectedApartmentId) ?? workspace.apartments[0] ?? null,
    [workspace.apartments, workspace.selectedApartmentId]
  );

  const occupiedApartments = useMemo(() => workspace.apartments.filter((item) => item.active), [workspace.apartments]);

  const totalOccupiedArea = useMemo(() => occupiedApartments.reduce((sum, item) => sum + Math.max(0, item.area), 0), [occupiedApartments]);
  const totalOccupiedKey = useMemo(() => occupiedApartments.reduce((sum, item) => sum + Math.max(0, item.allocationKey), 0), [occupiedApartments]);
  const totalOccupiedPersons = useMemo(() => occupiedApartments.reduce((sum, item) => sum + Math.max(0, item.persons), 0), [occupiedApartments]);

  const vacancyArea = Math.max(0, workspace.meta.totalArea - totalOccupiedArea);
  const vacancyKey = Math.max(0, workspace.meta.totalAllocationKey - totalOccupiedKey);
  const vacancyPersons = Math.max(0, workspace.meta.totalPersons - totalOccupiedPersons);

  const co2TotalKg = roundMoney(workspace.heating.totalConsumptionKwh * workspace.heating.emissionFactor);
  const co2PerSqm = workspace.heating.heatedArea > 0 ? co2TotalKg / workspace.heating.heatedArea : 0;
  const co2Stage = getCo2Stage(co2PerSqm);

  const heatingBreakdown = useMemo(() => {
    if (!activeApartment) {
      return { heatingTenant: 0, warmWaterTenant: 0, co2TenantShare: 0, co2LandlordShare: 0, totalTenant: 0 };
    }

    const areaShare = workspace.meta.totalArea > 0 ? activeApartment.area / workspace.meta.totalArea : 0;
    const heatingConsumptionShare = clamp(activeApartment.heatingConsumptionShare, 0, 100) / 100;
    const warmWaterShare = clamp(activeApartment.warmWaterShare, 0, 100) / 100;

    const heatingTenant = workspace.heating.totalHeatingCost * (
      (workspace.heating.consumptionPercent / 100) * heatingConsumptionShare +
      (workspace.heating.areaPercent / 100) * areaShare
    );

    const warmWaterTenant = workspace.heating.totalWarmWaterCost * warmWaterShare;

    const totalHeatBase = workspace.heating.totalHeatingCost + workspace.heating.totalWarmWaterCost;
    const ratio = totalHeatBase > 0 ? (heatingTenant + warmWaterTenant) / totalHeatBase : 0;
    const grossCo2Apartment = workspace.heating.totalCo2Cost * ratio;
    const co2TenantShare = grossCo2Apartment * (co2Stage.tenantPercent / 100);
    const co2LandlordShare = grossCo2Apartment * (co2Stage.landlordPercent / 100);

    return {
      heatingTenant: roundMoney(heatingTenant),
      warmWaterTenant: roundMoney(warmWaterTenant),
      co2TenantShare: roundMoney(co2TenantShare),
      co2LandlordShare: roundMoney(co2LandlordShare),
      totalTenant: roundMoney(heatingTenant + warmWaterTenant + co2TenantShare),
    };
  }, [activeApartment, workspace, co2Stage]);

  const costBreakdown = useMemo<CostResult[]>(() => {
    if (!activeApartment) return [];

    return workspace.costs.map((row) => {
      let tenantShare = 0;
      let landlordShare = 0;

      switch (row.allocation) {
        case "sqm": {
          const totalBase = workspace.meta.totalArea;
          tenantShare = totalBase > 0 ? row.amount * (activeApartment.area / totalBase) * (activeApartment.occupancyMonths / 12) : 0;
          landlordShare = totalBase > 0 ? row.amount * (vacancyArea / totalBase) : 0;
          break;
        }
        case "key": {
          const totalBase = workspace.meta.totalAllocationKey;
          tenantShare = totalBase > 0 ? row.amount * (activeApartment.allocationKey / totalBase) * (activeApartment.occupancyMonths / 12) : 0;
          landlordShare = totalBase > 0 ? row.amount * (vacancyKey / totalBase) : 0;
          break;
        }
        case "persons": {
          const totalBase = workspace.meta.totalPersons;
          tenantShare = totalBase > 0 ? row.amount * (activeApartment.persons / totalBase) * (activeApartment.occupancyMonths / 12) : 0;
          landlordShare = totalBase > 0 ? row.amount * (vacancyPersons / totalBase) : 0;
          break;
        }
        case "manualShare": {
          tenantShare = row.amount * (clamp(row.manualSharePercent, 0, 100) / 100);
          landlordShare = Math.max(0, row.amount - tenantShare);
          break;
        }
        case "directAmount": {
          tenantShare = row.directAmount;
          landlordShare = Math.max(0, row.amount - tenantShare);
          break;
        }
        case "heating": {
          tenantShare = heatingBreakdown.totalTenant;
          landlordShare = heatingBreakdown.co2LandlordShare;
          break;
        }
      }

      return { row, tenantShare: roundMoney(tenantShare), landlordShare: roundMoney(landlordShare) };
    });
  }, [activeApartment, workspace, vacancyArea, vacancyKey, vacancyPersons, heatingBreakdown]);

  const totalColdCosts = roundMoney(costBreakdown.filter((item) => item.row.allocation !== "heating").reduce((sum, item) => sum + item.tenantShare, 0));
  const totalHeatingCosts = roundMoney(costBreakdown.filter((item) => item.row.allocation === "heating").reduce((sum, item) => sum + item.tenantShare, 0));
  const totalTenantCosts = roundMoney(totalColdCosts + totalHeatingCosts);
  const tenantBalance = activeApartment ? roundMoney(activeApartment.advancePayments - totalTenantCosts) : 0;

  function exportOnePager() {
    if (!activeApartment) return;

    const lines: string[] = [
      "Nebenkostenabrechnung Wohnung",
      `Objekt: ${workspace.meta.propertyLabel}`,
      `Objekt-Code: ${workspace.meta.propertyCode}`,
      `Jahr: ${workspace.meta.billingYear}`,
      `Zeitraum: ${formatDate(workspace.meta.periodFrom)} bis ${formatDate(workspace.meta.periodTo)}`,
      "",
      `Wohnung: ${activeApartment.label}`,
      `Mieter: ${activeApartment.tenantName || "—"}`,
      `Fläche: ${activeApartment.area} m²`,
      `Vorauszahlungen: ${formatCurrency(activeApartment.advancePayments)}`,
      "",
      "KOSTENAUFSTELLUNG",
      ...costBreakdown.map((item) => `${item.row.label} | ${allocationLabel(item.row.allocation)} | Mieter ${formatCurrency(item.tenantShare)} | Vermieter ${formatCurrency(item.landlordShare)}`),
      "",
      `Kalte Betriebskosten: ${formatCurrency(totalColdCosts)}`,
      `Heiz-/Warmwasserkosten: ${formatCurrency(totalHeatingCosts)}`,
      `Gesamtkosten Mieter: ${formatCurrency(totalTenantCosts)}`,
      `Vorauszahlungen: ${formatCurrency(activeApartment.advancePayments)}`,
      `Saldo: ${formatCurrency(tenantBalance)}`,
      "",
      `CO2-Stufe: ${co2Stage.stage}`,
      `Mieteranteil CO2: ${co2Stage.tenantPercent}%`,
      `Vermieteranteil CO2: ${co2Stage.landlordPercent}%`,
    ];

    downloadText(
      `nebenkosten_${workspace.meta.propertyCode || "objekt"}_${workspace.meta.billingYear}_${activeApartment.label.replace(/\s+/g, "_")}.txt`,
      lines.join("\n")
    );
  }

  const locked = workspace.meta.locked;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-700">
              <Home className="h-4 w-4" />
              Wohnungs-Nebenkostenabrechnung
            </div>
            <h1 className="max-w-4xl text-[24px] font-semibold leading-tight tracking-tight text-slate-950 md:text-[30px]">
              Wohnungen mit m², Umlageschlüssel, HeizkostenV, CO₂-Modell und Abschluss-Funktion
            </h1>
            <p className="max-w-3xl text-[15px] leading-7 text-slate-600">
              Kommawerte wie 360,72 funktionieren. Nach dem Abschließen ist die Abrechnung eingefroren und nur über den Button „Bearbeiten“ wieder änderbar.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Objekt">
                <SelectInput value={selectedObjectCode} onChange={(e) => setSelectedObjectCode(e.target.value)}>
                  <option value="">Bitte wählen</option>
                  {objects.map((item) => (
                    <option key={item.objekt_code} value={item.objekt_code}>{item.label}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Abrechnungsjahr">
                <SelectInput value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                  {Array.from({ length: 8 }).map((_, index) => {
                    const year = currentYear - 2 + index;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </SelectInput>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => updateMeta("defaultAllocationMethod", "sqm")}
                className={`rounded-[22px] border px-5 py-5 text-lg font-medium transition ${workspace.meta.defaultAllocationMethod === "sqm" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-800"} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Standard: nach m²
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => updateMeta("defaultAllocationMethod", "key")}
                className={`rounded-[22px] border px-5 py-5 text-lg font-medium transition ${workspace.meta.defaultAllocationMethod === "key" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-800"} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Standard: nach Umlageschlüssel
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {statusMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{statusMessage}</div> : null}
              {loadingWorkspace ? <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">Lade Daten aus Supabase…</div> : null}
              {savingWorkspace ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">Speichere in Supabase…</div> : null}
              {saveError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{saveError}</div> : null}
              <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${locked ? "border-slate-300 bg-slate-100 text-slate-700" : "border-indigo-200 bg-indigo-50 text-indigo-700"}`}>
                {locked ? "Diese Abrechnung ist abgeschlossen und aktuell gesperrt." : "Diese Abrechnung ist aktuell bearbeitbar."}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard title="Aktive Wohnung" value={activeApartment?.label ?? "—"} />
        <StatCard title="Kalte Betriebskosten" value={formatCurrency(totalColdCosts)} />
        <StatCard title="Heiz- und Warmwasserkosten" value={formatCurrency(totalHeatingCosts)} />
        <StatCard title="Saldo" value={formatCurrency(tenantBalance)} accent={tenantBalance >= 0 ? "success" : "danger"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CardSection title="Gebäudedaten" icon={<Warehouse className="h-5 w-5" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Objektbezeichnung">
              <TextInput value={workspace.meta.propertyLabel} onChange={(e) => updateMeta("propertyLabel", e.target.value)} disabled={locked} />
            </Field>
            <Field label="Objekt-Code">
              <TextInput value={workspace.meta.propertyCode} disabled />
            </Field>
            <Field label="Zeitraum von">
              <TextInput type="date" value={workspace.meta.periodFrom} onChange={(e) => updateMeta("periodFrom", e.target.value)} disabled={locked} />
            </Field>
            <Field label="Zeitraum bis">
              <TextInput type="date" value={workspace.meta.periodTo} onChange={(e) => updateMeta("periodTo", e.target.value)} disabled={locked} />
            </Field>
            <Field label="Vermieter">
              <TextInput value={workspace.meta.landlordName} onChange={(e) => updateMeta("landlordName", e.target.value)} disabled={locked} />
            </Field>
            <Field label="Vermieteradresse">
              <TextAreaInput value={workspace.meta.landlordAddress} onChange={(e) => updateMeta("landlordAddress", e.target.value)} disabled={locked} />
            </Field>
            <Field label="Gesamtfläche Gebäude (m²)">
              <NumberInput value={workspace.meta.totalArea} onCommit={(value) => updateMeta("totalArea", value)} disabled={locked} />
            </Field>
            <Field label="Gesamt-Umlageschlüssel">
              <NumberInput value={workspace.meta.totalAllocationKey} onCommit={(value) => updateMeta("totalAllocationKey", value)} disabled={locked} />
            </Field>
            <Field label="Gesamtpersonen">
              <NumberInput value={workspace.meta.totalPersons} onCommit={(value) => updateMeta("totalPersons", value)} disabled={locked} />
            </Field>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Belegte Fläche</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{roundMoney(totalOccupiedArea)} m²</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Leerstand Fläche</div>
              <div className="mt-2 text-xl font-semibold text-rose-700">{roundMoney(vacancyArea)} m²</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Leerstand Schlüssel</div>
              <div className="mt-2 text-xl font-semibold text-rose-700">{roundMoney(vacancyKey)}</div>
            </div>
          </div>
        </CardSection>

        <CardSection
          title="Wohnungen / Mieter"
          icon={<UserSquare2 className="h-5 w-5" />}
          actions={
            <button type="button" onClick={addApartment} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">
              <Plus className="h-4 w-4" /> Wohnung hinzufügen
            </button>
          }
        >
          <div className="space-y-4">
            {workspace.apartments.map((apartment) => (
              <div key={apartment.id} className={`rounded-[24px] border p-4 shadow-sm ${workspace.selectedApartmentId === apartment.id ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white"}`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <button type="button" onClick={() => updateWorkspace((prev) => ({ ...prev, selectedApartmentId: apartment.id }))} className="text-left">
                    <div className="text-base font-semibold text-slate-950">{apartment.label}</div>
                    <div className="text-sm text-slate-500">{apartment.tenantName || "Noch kein Mietername"}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={apartment.active} disabled={locked} onChange={(e) => updateApartment(apartment.id, { active: e.target.checked })} />
                      belegt
                    </label>
                    <button type="button" onClick={() => deleteApartment(apartment.id)} disabled={locked} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Wohnungsname">
                    <TextInput value={apartment.label} onChange={(e) => updateApartment(apartment.id, { label: e.target.value })} disabled={locked} />
                  </Field>
                  <Field label="Mietername">
                    <TextInput value={apartment.tenantName} onChange={(e) => updateApartment(apartment.id, { tenantName: e.target.value })} disabled={locked} />
                  </Field>
                  <Field label="Wohnfläche (m²)">
                    <NumberInput value={apartment.area} onCommit={(value) => updateApartment(apartment.id, { area: value })} disabled={locked} />
                  </Field>
                  <Field label="Umlageschlüssel">
                    <NumberInput value={apartment.allocationKey} onCommit={(value) => updateApartment(apartment.id, { allocationKey: value })} disabled={locked} />
                  </Field>
                  <Field label="Personen">
                    <NumberInput value={apartment.persons} onCommit={(value) => updateApartment(apartment.id, { persons: value })} disabled={locked} decimals={0} min={0} />
                  </Field>
                  <Field label="Belegungsmonate">
                    <NumberInput value={apartment.occupancyMonths} onCommit={(value) => updateApartment(apartment.id, { occupancyMonths: clamp(value, 0, 12) })} disabled={locked} decimals={0} min={0} max={12} />
                  </Field>
                  <Field label="Vorauszahlungen (€)">
                    <NumberInput value={apartment.advancePayments} onCommit={(value) => updateApartment(apartment.id, { advancePayments: value })} disabled={locked} />
                  </Field>
                  <Field label="Heizverbrauchsanteil (%)">
                    <NumberInput value={apartment.heatingConsumptionShare} onCommit={(value) => updateApartment(apartment.id, { heatingConsumptionShare: clamp(value, 0, 100) })} disabled={locked} />
                  </Field>
                  <Field label="Warmwasseranteil (%)">
                    <NumberInput value={apartment.warmWaterShare} onCommit={(value) => updateApartment(apartment.id, { warmWaterShare: clamp(value, 0, 100) })} disabled={locked} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </CardSection>
      </div>

      <CardSection
          title="Onepager / Ergebnis"
          icon={<FileText className="h-5 w-5" />}
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportOnePager} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <FileText className="h-4 w-4" /> Export
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <Printer className="h-4 w-4" /> Drucken
              </button>
              {!locked ? (
                <button
                  type="button"
                  onClick={() => updateMeta("locked", true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" /> Abrechnung abschließen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateMeta("locked", false)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  <Pencil className="h-4 w-4" /> Bearbeiten
                </button>
              )}
            </div>
          }
        >
          {activeApartment ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Wohnung</div>
                <div className="mt-2 text-[22px] font-semibold text-slate-950">{activeApartment.label}</div>
                <div className="mt-4 space-y-2 text-[16px] text-slate-600">
                  <div>Mieter: {activeApartment.tenantName || "—"}</div>
                  <div>Fläche: {activeApartment.area} m²</div>
                  <div>Vorauszahlungen: {formatCurrency(activeApartment.advancePayments)}</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <div className="grid gap-3 text-[15px] text-slate-700">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Zeitraum</span>
                    <span className="font-semibold text-slate-950">{formatDate(workspace.meta.periodFrom)} – {formatDate(workspace.meta.periodTo)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Kalte Betriebskosten</span>
                    <span className="font-semibold text-slate-950">{formatCurrency(totalColdCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Heiz- / Warmwasserkosten</span>
                    <span className="font-semibold text-slate-950">{formatCurrency(totalHeatingCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[18px]">
                    <span className="font-semibold text-slate-950">Gesamtkosten Mieter</span>
                    <span className="font-semibold text-slate-950">{formatCurrency(totalTenantCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Vorauszahlungen</span>
                    <span className="font-semibold text-slate-950">{formatCurrency(activeApartment.advancePayments)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[18px]">
                    <span className="font-semibold text-slate-950">Saldo</span>
                    <span className={`font-semibold ${tenantBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCurrency(tenantBalance)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {costBreakdown.map((item) => (
                  <div key={item.row.id} className="rounded-[20px] border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-slate-950">{item.row.label}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{allocationLabel(item.row.allocation)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-950">{formatCurrency(item.tenantShare)}</div>
                        <div className="text-sm text-slate-500">Vermieter/Leerstand: {formatCurrency(item.landlordShare)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Bitte zuerst eine Wohnung anlegen.</div>
          )}
        </CardSection>

      <CardSection
          title="Kostenarten / Verteilung"
          icon={<Calculator className="h-5 w-5" />}
          actions={
            <button type="button" onClick={addCostRow} disabled={locked} className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">
              <Plus className="h-4 w-4" /> Kostenart hinzufügen
            </button>
          }
        >
          <div className="space-y-4">
            {workspace.costs.map((row) => (
              <div key={row.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-950">{row.label}</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{allocationLabel(row.allocation)}</div>
                  </div>
                  <button type="button" onClick={() => deleteCost(row.id)} disabled={locked} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <Field label="Bezeichnung">
                    <TextInput value={row.label} onChange={(e) => updateCost(row.id, { label: e.target.value })} disabled={locked} />
                  </Field>
                  <Field label="Gesamtbetrag (€)">
                    <NumberInput value={row.amount} onCommit={(value) => updateCost(row.id, { amount: value })} disabled={locked} />
                  </Field>
                  <Field label="Verteilung">
                    <SelectInput value={row.allocation} onChange={(e) => updateCost(row.id, { allocation: e.target.value as CostAllocationType })} disabled={locked}>
                      <option value="sqm">Wohnfläche (m²)</option>
                      <option value="key">Umlageschlüssel</option>
                      <option value="persons">Personen</option>
                      <option value="manualShare">Manueller Anteil (%)</option>
                      <option value="directAmount">Direktbetrag</option>
                      <option value="heating">HeizkostenV / CO₂</option>
                    </SelectInput>
                  </Field>

                  {row.allocation === "manualShare" ? (
                    <Field label="Anteil aktive Wohnung (%)">
                      <NumberInput value={row.manualSharePercent} onCommit={(value) => updateCost(row.id, { manualSharePercent: clamp(value, 0, 100) })} disabled={locked} />
                    </Field>
                  ) : row.allocation === "directAmount" ? (
                    <Field label="Direktbetrag aktive Wohnung (€)">
                      <NumberInput value={row.directAmount} onCommit={(value) => updateCost(row.id, { directAmount: value })} disabled={locked} />
                    </Field>
                  ) : (
                    <div />
                  )}

                  <Field label="Notiz">
                    <TextAreaInput value={row.note} onChange={(e) => updateCost(row.id, { note: e.target.value })} disabled={locked} className="min-h-[96px]" />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </CardSection>

      <CardSection title="Heizkosten / CO₂" icon={<Lock className="h-5 w-5" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Heizkosten gesamt (€)">
              <NumberInput value={workspace.heating.totalHeatingCost} onCommit={(value) => updateHeating("totalHeatingCost", value)} disabled={locked} />
            </Field>
            <Field label="Warmwasserkosten gesamt (€)">
              <NumberInput value={workspace.heating.totalWarmWaterCost} onCommit={(value) => updateHeating("totalWarmWaterCost", value)} disabled={locked} />
            </Field>
            <Field label="CO₂-Kosten gesamt (€)">
              <NumberInput value={workspace.heating.totalCo2Cost} onCommit={(value) => updateHeating("totalCo2Cost", value)} disabled={locked} />
            </Field>
            <Field label="Verbrauchsanteil Heizkosten (%)">
              <NumberInput
                value={workspace.heating.consumptionPercent}
                onCommit={(value) => updateWorkspace((prev) => ({
                  ...prev,
                  heating: {
                    ...prev.heating,
                    consumptionPercent: clamp(value, 50, 70),
                    areaPercent: 100 - clamp(value, 50, 70),
                  },
                }))}
                disabled={locked}
              />
            </Field>
            <Field label="Grundkostenanteil Fläche (%)">
              <NumberInput
                value={workspace.heating.areaPercent}
                onCommit={(value) => updateWorkspace((prev) => ({
                  ...prev,
                  heating: {
                    ...prev.heating,
                    areaPercent: clamp(value, 30, 50),
                    consumptionPercent: 100 - clamp(value, 30, 50),
                  },
                }))}
                disabled={locked}
              />
            </Field>
            <Field label="Gesamtverbrauch kWh">
              <NumberInput value={workspace.heating.totalConsumptionKwh} onCommit={(value) => updateHeating("totalConsumptionKwh", value)} disabled={locked} />
            </Field>
            <Field label="Emissionsfaktor">
              <NumberInput value={workspace.heating.emissionFactor} onCommit={(value) => updateHeating("emissionFactor", value)} disabled={locked} decimals={3} />
            </Field>
            <Field label="Beheizte Fläche Gebäude (m²)">
              <NumberInput value={workspace.heating.heatedArea} onCommit={(value) => updateHeating("heatedArea", value)} disabled={locked} />
            </Field>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">CO₂ gesamt</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{co2TotalKg} kg</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">CO₂ je m²/Jahr</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{roundMoney(co2PerSqm)}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Stufe</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{co2Stage.stage}</div>
            </div>
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Mieter zahlt</div>
              <div className="mt-2 text-xl font-semibold text-emerald-800">{co2Stage.tenantPercent}%</div>
            </div>
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700">Vermieter zahlt</div>
              <div className="mt-2 text-xl font-semibold text-rose-800">{co2Stage.landlordPercent}%</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Aktive Wohnung Heizkosten</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{formatCurrency(heatingBreakdown.totalTenant)}</div>
            </div>
          </div>
        </CardSection>
    </div>
  );
}
