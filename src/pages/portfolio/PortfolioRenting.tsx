import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { normalizeUuid } from "../../lib/ids";
import type { PortfolioOutletContext } from "./PortfolioPropertyLayout";
import RentHistoryChart from "../../components/RentHistoryChart";

type Props = {
  propertyId?: string;
};

type RentalRow = {
  id: string;
  property_id: string;
  unit_id?: string | null;
  rent_type: string | null;
  rent_monthly: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type RentalFormState = {
  id?: string;
  rent_type: string;
  rent_monthly: string;
  start_date: string;
  end_date: string;
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type PortfolioPropertyLite = {
  id: string;
  name: string | null;
  core_property_id: string | null;
};

type RentalTargetResolution = {
  properties: PortfolioPropertyLite[];
  candidateIds: string[];
  effectiveRentalPropertyId: string | null;
  propertyWithRentalsId: string | null;
  rentalCountsByPropertyId: Record<string, number>;
};

const RENTALS_TABLE = "portfolio_property_rentals";
const PROPERTIES_TABLE = "portfolio_properties";
const MAX_GRAPH_DEPTH = 5;

function uniqueValidIds(values: Array<string | null | undefined>): string[] {
  const normalized = values
    .map((value) => normalizeUuid(String(value ?? "").trim()))
    .filter((value): value is string => Boolean(value));

  return [...new Set(normalized)];
}

function firstValidId(values: Array<string | null | undefined>): string | null {
  return uniqueValidIds(values)[0] ?? null;
}

function getEmptyFormState(): RentalFormState {
  return {
    rent_type: "",
    rent_monthly: "",
    start_date: "",
    end_date: "",
  };
}

function toNullableNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNullableNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} €`;
  }
}

function prettyDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(date);
}

function formatErrorMessage(error: unknown): string {
  if (!error) return "Unbekannter Fehler";
  if (typeof error === "string") return error;

  const err = error as SupabaseLikeError;
  const parts = [err.message, err.details, err.hint, err.code].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Unbekannter Fehler";
}

function toDayKey(value: string): number {
  const date = new Date(`${value}T00:00:00Z`);
  return Math.floor(date.getTime() / 86400000);
}

function rangesOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null
): boolean {
  const aS = toDayKey(aStart);
  const aE = aEnd ? toDayKey(aEnd) : Number.POSITIVE_INFINITY;
  const bS = toDayKey(bStart);
  const bE = bEnd ? toDayKey(bEnd) : Number.POSITIVE_INFINITY;

  return aS <= bE && bS <= aE;
}

function isShadowName(name: string | null | undefined): boolean {
  return String(name ?? "").toLowerCase().includes("core-shadow");
}

function MissingCoreBox() {
  return (
    <div
      style={{
        border: "1px solid #fde68a",
        background: "#fffbeb",
        color: "#92400e",
        padding: 14,
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.5,
      }}
    >
      Dieses Portfolio-Objekt hat keine belastbare Verknüpfung zu den Vermietungsdaten.
    </div>
  );
}

function EmptyStateCard() {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        background: "#f9fafb",
        color: "#374151",
        padding: 16,
        borderRadius: 14,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      Für diese Immobilie sind aktuell keine Vermietungszeiträume gepflegt.
    </div>
  );
}

function scorePropertyForRentalUse(
  property: PortfolioPropertyLite,
  seedIds: string[],
  rentalCount: number
): number {
  let score = 0;

  if (rentalCount > 0) score += 1000;
  if (!isShadowName(property.name)) score += 100;
  if (seedIds.includes(property.id)) score += 20;
  if (property.core_property_id && seedIds.includes(property.core_property_id)) score += 50;

  return score;
}

function collectUuidStringsDeep(
  value: unknown,
  maxDepth = 4,
  seen = new WeakSet<object>()
): string[] {
  const found = new Set<string>();

  function visit(current: unknown, depth: number) {
    if (depth > maxDepth || current == null) return;

    if (typeof current === "string") {
      const normalized = normalizeUuid(current.trim());
      if (normalized) found.add(normalized);
      return;
    }

    if (typeof current !== "object") return;

    if (seen.has(current as object)) return;
    seen.add(current as object);

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item, depth + 1);
      }
      return;
    }

    for (const item of Object.values(current as Record<string, unknown>)) {
      visit(item, depth + 1);
    }
  }

  visit(value, 0);
  return [...found];
}

async function fetchPropertiesAroundIds(ids: string[]): Promise<PortfolioPropertyLite[]> {
  const idList = uniqueValidIds(ids);
  if (!idList.length) return [];

  const collected = new Map<string, PortfolioPropertyLite>();

  const queries = [
    supabase.from(PROPERTIES_TABLE).select("id, name, core_property_id").in("id", idList),
    supabase
      .from(PROPERTIES_TABLE)
      .select("id, name, core_property_id")
      .in("core_property_id", idList),
  ];

  for (const query of queries) {
    const { data, error } = await query;
    if (error) throw error;

    for (const row of (data ?? []) as PortfolioPropertyLite[]) {
      const normalizedId = normalizeUuid(row.id);
      if (!normalizedId) continue;

      collected.set(normalizedId, {
        id: normalizedId,
        name: row.name ?? null,
        core_property_id: normalizeUuid(row.core_property_id ?? "") ?? null,
      });
    }
  }

  return Array.from(collected.values());
}

async function fetchRentalCounts(propertyIds: string[]): Promise<Record<string, number>> {
  const ids = uniqueValidIds(propertyIds);
  if (!ids.length) return {};

  const counts: Record<string, number> = {};

  for (const propertyId of ids) {
    const { count, error } = await supabase
      .from(RENTALS_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId);

    if (error) throw error;
    counts[propertyId] = count ?? 0;
  }

  return counts;
}

async function resolveRentalTargets(seedIds: string[]): Promise<RentalTargetResolution> {
  const normalizedSeeds = uniqueValidIds(seedIds);
  const visitedIds = new Set<string>(normalizedSeeds);
  const propertyMap = new Map<string, PortfolioPropertyLite>();

  let frontier = [...normalizedSeeds];

  for (let depth = 0; depth < MAX_GRAPH_DEPTH && frontier.length > 0; depth += 1) {
    const neighbors = await fetchPropertiesAroundIds(frontier);

    const nextFrontier = new Set<string>();

    for (const property of neighbors) {
      propertyMap.set(property.id, property);

      if (!visitedIds.has(property.id)) {
        visitedIds.add(property.id);
        nextFrontier.add(property.id);
      }

      if (property.core_property_id && !visitedIds.has(property.core_property_id)) {
        visitedIds.add(property.core_property_id);
        nextFrontier.add(property.core_property_id);
      }
    }

    frontier = [...nextFrontier];
  }

  const allPropertyIds = uniqueValidIds([
    ...normalizedSeeds,
    ...Array.from(propertyMap.keys()),
    ...Array.from(propertyMap.values()).map((p) => p.core_property_id),
  ]);

  const rentalCountsByPropertyId = await fetchRentalCounts(allPropertyIds);

  const sortedProperties = Array.from(propertyMap.values()).sort((a, b) => {
    const aScore = scorePropertyForRentalUse(
      a,
      normalizedSeeds,
      rentalCountsByPropertyId[a.id] ?? 0
    );
    const bScore = scorePropertyForRentalUse(
      b,
      normalizedSeeds,
      rentalCountsByPropertyId[b.id] ?? 0
    );

    if (bScore !== aScore) return bScore - aScore;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });

  const propertyWithRentalsId =
    sortedProperties.find((p) => (rentalCountsByPropertyId[p.id] ?? 0) > 0)?.id ?? null;

  const effectiveRentalPropertyId =
    propertyWithRentalsId ?? sortedProperties[0]?.id ?? firstValidId(normalizedSeeds);

  const candidateIds = uniqueValidIds([
    propertyWithRentalsId,
    effectiveRentalPropertyId,
    ...sortedProperties.map((p) => p.id),
    ...normalizedSeeds,
  ]);

  return {
    properties: sortedProperties,
    candidateIds,
    effectiveRentalPropertyId,
    propertyWithRentalsId,
    rentalCountsByPropertyId,
  };
}

function pickMatchedPropertyId(candidateIds: string[], rows: RentalRow[]): string | null {
  if (!rows.length) return null;

  const grouped = new Set(
    rows
      .map((row) => normalizeUuid(row.property_id))
      .filter((id): id is string => Boolean(id))
  );

  for (const candidateId of candidateIds) {
    if (grouped.has(candidateId)) return candidateId;
  }

  return firstValidId([...grouped]);
}

function DiagnosticsPanel({
  visible,
  onToggle,
  routePropertyId,
  portfolioPropertyId,
  corePropertyId,
  extractedOutletIds,
  outletKeys,
  baseCandidateIds,
  resolvedProperties,
  rentalCountsByPropertyId,
  resolvedPropertyWithRentalsId,
  effectiveRentalPropertyId,
  readCandidateIds,
  preferredWriteId,
  isReadonlyBecauseNoCanonicalProperty,
  matchedPropertyId,
  chartPortfolioPropertyId,
  chartFallbackIds,
}: {
  visible: boolean;
  onToggle: () => void;
  routePropertyId: string | null;
  portfolioPropertyId: string | null;
  corePropertyId: string | null;
  extractedOutletIds: string[];
  outletKeys: string[];
  baseCandidateIds: string[];
  resolvedProperties: PortfolioPropertyLite[];
  rentalCountsByPropertyId: Record<string, number>;
  resolvedPropertyWithRentalsId: string | null;
  effectiveRentalPropertyId: string | null;
  readCandidateIds: string[];
  preferredWriteId: string | null;
  isReadonlyBecauseNoCanonicalProperty: boolean;
  matchedPropertyId: string | null;
  chartPortfolioPropertyId: string | null;
  chartFallbackIds: string[];
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          style={secondaryButtonStyle(false)}
        >
          {visible ? "Diagnose ausblenden" : "Diagnose anzeigen"}
        </button>
      </div>

      {visible ? (
        <div
          style={{
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            borderRadius: 14,
            padding: 14,
            fontSize: 13,
            color: "#1e3a8a",
            lineHeight: 1.6,
            wordBreak: "break-word",
          }}
        >
          <div>
            <b>Diagnose:</b>
          </div>
          <div>Route-ID: {routePropertyId || "—"}</div>
          <div>Portfolio-ID: {portfolioPropertyId || "—"}</div>
          <div>Core-ID: {corePropertyId || "—"}</div>
          <div>
            Extracted Outlet UUIDs:{" "}
            {extractedOutletIds.length > 0 ? extractedOutletIds.join(" | ") : "—"}
          </div>
          <div>
            Outlet Keys: {outletKeys.length > 0 ? outletKeys.join(", ") : "—"}
          </div>
          <div>
            Basis-Kandidaten: {baseCandidateIds.length > 0 ? baseCandidateIds.join(" | ") : "—"}
          </div>
          <div>
            Aufgelöste Properties:{" "}
            {resolvedProperties.length > 0
              ? resolvedProperties
                  .map((p) => `${p.name ?? "ohne Name"} [${p.id}]`)
                  .join(" | ")
              : "keine"}
          </div>
          <div>
            Rental-Counts:{" "}
            {Object.keys(rentalCountsByPropertyId).length > 0
              ? Object.entries(rentalCountsByPropertyId)
                  .map(([id, count]) => `${id}: ${count}`)
                  .join(" | ")
              : "keine"}
          </div>
          <div>Property mit Rentals: {resolvedPropertyWithRentalsId || "keine"}</div>
          <div>Effektive Rental-ID: {effectiveRentalPropertyId || "—"}</div>
          <div>
            Geprüfte Kandidaten: {readCandidateIds.length > 0 ? readCandidateIds.join(" | ") : "—"}
          </div>
          <div>Bevorzugte Write-ID: {preferredWriteId || "—"}</div>
          <div>
            Readonly wegen fehlender kanonischer Portfolio-ID:{" "}
            {isReadonlyBecauseNoCanonicalProperty ? "ja" : "nein"}
          </div>
          <div>Treffer-ID für Vermietung: {matchedPropertyId || "keine"}</div>
          <div>Chart-Portfolio-ID: {chartPortfolioPropertyId || "keine"}</div>
          <div>
            Chart-Fallback-IDs:{" "}
            {chartFallbackIds.length > 0 ? chartFallbackIds.join(" | ") : "keine"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PortfolioRenting(props: Props) {
  const outlet = useOutletContext<PortfolioOutletContext>();
  const requestSeq = useRef(0);

  const routePropertyId = useMemo(() => {
    return normalizeUuid(String(props.propertyId ?? outlet.propertyId ?? "").trim()) ?? null;
  }, [props.propertyId, outlet.propertyId]);

  const portfolioPropertyId = useMemo(() => {
    return normalizeUuid(String(outlet.portfolioPropertyId ?? "").trim()) ?? null;
  }, [outlet.portfolioPropertyId]);

  const corePropertyId = useMemo(() => {
    return normalizeUuid(String(outlet.corePropertyId ?? "").trim()) ?? null;
  }, [outlet.corePropertyId]);

  const extractedOutletIds = useMemo(() => {
    return collectUuidStringsDeep(outlet, 5);
  }, [outlet]);

  const extractedPropIds = useMemo(() => {
    return collectUuidStringsDeep(props, 3);
  }, [props]);

  const outletKeys = useMemo(() => {
    try {
      return Object.keys((outlet ?? {}) as Record<string, unknown>);
    } catch {
      return [];
    }
  }, [outlet]);

  const baseCandidateIds = useMemo(() => {
    return uniqueValidIds([
      routePropertyId,
      portfolioPropertyId,
      corePropertyId,
      ...extractedOutletIds,
      ...extractedPropIds,
    ]);
  }, [
    routePropertyId,
    portfolioPropertyId,
    corePropertyId,
    extractedOutletIds,
    extractedPropIds,
  ]);

  const hasAnyBaseCandidate = baseCandidateIds.length > 0;
  const isBlockedByMapping = Boolean(outlet.mapLoading || outlet.mapErr);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<RentalRow[]>([]);
  const [matchedPropertyId, setMatchedPropertyId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<RentalFormState>(getEmptyFormState());

  const [resolvedProperties, setResolvedProperties] = useState<PortfolioPropertyLite[]>([]);
  const [resolvedCandidateIds, setResolvedCandidateIds] = useState<string[]>([]);
  const [resolvedEffectiveRentalPropertyId, setResolvedEffectiveRentalPropertyId] = useState<string | null>(null);
  const [resolvedPropertyWithRentalsId, setResolvedPropertyWithRentalsId] = useState<string | null>(null);
  const [rentalCountsByPropertyId, setRentalCountsByPropertyId] = useState<Record<string, number>>({});

  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const isEditing = Boolean(form.id);

  const effectiveRentalPropertyId = resolvedEffectiveRentalPropertyId;
  const readCandidateIds = resolvedCandidateIds;

  const preferredWriteId = portfolioPropertyId;
  const isReadonlyBecauseNoCanonicalProperty = !portfolioPropertyId;

  const chartPortfolioPropertyId = effectiveRentalPropertyId;

  const chartFallbackIds = useMemo(() => {
    return uniqueValidIds([
      matchedPropertyId,
      resolvedPropertyWithRentalsId,
      ...resolvedCandidateIds,
      ...baseCandidateIds,
    ]);
  }, [matchedPropertyId, resolvedPropertyWithRentalsId, resolvedCandidateIds, baseCandidateIds]);

  const hasAnyCandidate = readCandidateIds.length > 0;

  const isDisabled =
    loading || busy || !hasAnyCandidate || isBlockedByMapping || resolveLoading;

  const canCreate =
    Boolean(preferredWriteId) &&
    !isReadonlyBecauseNoCanonicalProperty &&
    !loading &&
    !busy &&
    !isBlockedByMapping &&
    !resolveLoading;

  const resetForm = useCallback(() => {
    setForm(getEmptyFormState());
  }, []);

  const resolveTargets = useCallback(async () => {
    if (!hasAnyBaseCandidate || isBlockedByMapping) {
      setResolvedProperties([]);
      setResolvedCandidateIds([]);
      setResolvedEffectiveRentalPropertyId(null);
      setResolvedPropertyWithRentalsId(null);
      setRentalCountsByPropertyId({});
      setResolveError(null);
      setResolveLoading(false);
      return;
    }

    setResolveLoading(true);
    setResolveError(null);

    try {
      const result = await resolveRentalTargets(baseCandidateIds);

      setResolvedProperties(result.properties);
      setResolvedCandidateIds(result.candidateIds);
      setResolvedEffectiveRentalPropertyId(result.effectiveRentalPropertyId);
      setResolvedPropertyWithRentalsId(result.propertyWithRentalsId);
      setRentalCountsByPropertyId(result.rentalCountsByPropertyId);
    } catch (err) {
      console.error("PortfolioRenting target resolution failed:", err);

      setResolvedProperties([]);
      setResolvedCandidateIds(baseCandidateIds);
      setResolvedEffectiveRentalPropertyId(firstValidId(baseCandidateIds));
      setResolvedPropertyWithRentalsId(null);
      setRentalCountsByPropertyId({});
      setResolveError(formatErrorMessage(err));
    } finally {
      setResolveLoading(false);
    }
  }, [baseCandidateIds, hasAnyBaseCandidate, isBlockedByMapping]);

  const loadRenting = useCallback(async () => {
    const seq = ++requestSeq.current;
    setError(null);

    if (!hasAnyCandidate || isBlockedByMapping) {
      setRows([]);
      setMatchedPropertyId(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from(RENTALS_TABLE)
        .select(
          "id, property_id, unit_id, rent_type, rent_monthly, start_date, end_date, notes, created_at, updated_at"
        )
        .in("property_id", readCandidateIds)
        .order("start_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (seq !== requestSeq.current) return;
      if (error) throw error;

      const allRows = (data ?? []) as RentalRow[];
      const foundId = pickMatchedPropertyId(readCandidateIds, allRows);

      const filteredRows = foundId
        ? allRows.filter((row) => normalizeUuid(row.property_id) === foundId)
        : [];

      setRows(filteredRows);
      setMatchedPropertyId(foundId);
    } catch (err) {
      if (seq !== requestSeq.current) return;

      console.error("PortfolioRenting load failed:", err);
      setError(formatErrorMessage(err));
      setRows([]);
      setMatchedPropertyId(null);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [readCandidateIds, hasAnyCandidate, isBlockedByMapping]);

  useEffect(() => {
    setRows([]);
    setMatchedPropertyId(null);
    setError(null);
    setBusy(false);
    setIsFormOpen(false);
    resetForm();

    if (outlet.mapLoading) {
      setLoading(true);
      return;
    }

    void resolveTargets();
  }, [outlet.mapLoading, outlet.mapErr, resetForm, resolveTargets]);

  useEffect(() => {
    if (outlet.mapLoading || resolveLoading) {
      setLoading(true);
      return;
    }

    void loadRenting();
  }, [loadRenting, outlet.mapLoading, resolveLoading]);

  useEffect(() => {
    console.log("DEBUG PortfolioRenting IDs");
    console.log("Route-ID:", routePropertyId);
    console.log("Portfolio-ID:", portfolioPropertyId);
    console.log("Core-ID:", corePropertyId);
    console.log("Extracted Outlet UUIDs:", extractedOutletIds);
    console.log("Extracted Prop UUIDs:", extractedPropIds);
    console.log("Outlet Keys:", outletKeys);
    console.log("Outlet Snapshot:", outlet);
    console.log("Base Candidate IDs:", baseCandidateIds);
    console.log("Resolved Properties:", resolvedProperties);
    console.log("Rental Counts By Property ID:", rentalCountsByPropertyId);
    console.log("Resolved Property With Rentals ID:", resolvedPropertyWithRentalsId);
    console.log("Effective Rental Property ID:", effectiveRentalPropertyId);
    console.log("Read Candidate IDs:", readCandidateIds);
    console.log("Preferred Write ID:", preferredWriteId);
    console.log("Readonly wegen fehlender kanonischer Portfolio-ID:", isReadonlyBecauseNoCanonicalProperty);
    console.log("Matched Rental ID:", matchedPropertyId);
    console.log("Chart portfolioPropertyId:", chartPortfolioPropertyId);
    console.log("Chart fallback IDs:", chartFallbackIds);
  }, [
    routePropertyId,
    portfolioPropertyId,
    corePropertyId,
    extractedOutletIds,
    extractedPropIds,
    outletKeys,
    outlet,
    baseCandidateIds,
    resolvedProperties,
    rentalCountsByPropertyId,
    resolvedPropertyWithRentalsId,
    effectiveRentalPropertyId,
    readCandidateIds,
    preferredWriteId,
    isReadonlyBecauseNoCanonicalProperty,
    matchedPropertyId,
    chartPortfolioPropertyId,
    chartFallbackIds,
  ]);

  function openCreate() {
    if (!canCreate) return;
    resetForm();
    setIsFormOpen(true);
  }

  function openEdit(row: RentalRow) {
    if (isReadonlyBecauseNoCanonicalProperty) return;

    setForm({
      id: row.id,
      rent_type: row.rent_type ?? "",
      rent_monthly: formatNullableNumber(row.rent_monthly),
      start_date: row.start_date ?? "",
      end_date: row.end_date ?? "",
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    resetForm();
  }

  function validate(): string | null {
    if (outlet.mapErr) return outlet.mapErr;
    if (resolveError) return resolveError;

    if (isReadonlyBecauseNoCanonicalProperty || !preferredWriteId) {
      return "Für dieses Objekt existiert keine kanonische Portfolio-ID. Schreiben ist daher deaktiviert.";
    }

    if (!form.start_date.trim()) {
      return "Bitte ein Anfangsdatum eingeben.";
    }

    if (form.end_date.trim() && form.start_date.trim() > form.end_date.trim()) {
      return "Das Anfangsdatum darf nicht nach dem Enddatum liegen.";
    }

    if (form.rent_monthly.trim() && toNullableNumber(form.rent_monthly) === null) {
      return "Die Miete muss eine gültige Zahl sein.";
    }

    const newStart = form.start_date.trim();
    const newEnd = form.end_date.trim() || null;

    const overlappingRow = rows.find((row) => {
      if (!row.start_date) return false;
      if (form.id && row.id === form.id) return false;

      return rangesOverlap(newStart, newEnd, row.start_date, row.end_date ?? null);
    });

    if (overlappingRow) {
      return `Der Zeitraum überschneidet sich mit einem bestehenden Eintrag (${overlappingRow.start_date} bis ${
        overlappingRow.end_date ?? "offen"
      }).`;
    }

    return null;
  }

  async function onSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const targetId = preferredWriteId;
    if (isReadonlyBecauseNoCanonicalProperty || !targetId) {
      setError("Speichern blockiert: keine kanonische Portfolio-ID vorhanden.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload = {
        property_id: targetId,
        rent_type: form.rent_type.trim() || null,
        rent_monthly: toNullableNumber(form.rent_monthly),
        start_date: form.start_date.trim() || null,
        end_date: form.end_date.trim() || null,
        notes: null as string | null,
      };

      if (isEditing && form.id) {
        const { error } = await supabase
          .from(RENTALS_TABLE)
          .update(payload)
          .eq("id", form.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from(RENTALS_TABLE).insert(payload);
        if (error) throw error;
      }

      closeForm();
      await loadRenting();
    } catch (err) {
      console.error("PortfolioRenting save failed:", err);
      setError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(rowId: string) {
    const targetId = preferredWriteId;
    if (isReadonlyBecauseNoCanonicalProperty || !targetId) {
      setError("Löschen blockiert: keine kanonische Portfolio-ID vorhanden.");
      return;
    }

    const confirmed = window.confirm("Diesen Vermietungszeitraum wirklich löschen?");
    if (!confirmed) return;

    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase
        .from(RENTALS_TABLE)
        .delete()
        .eq("id", rowId)
        .eq("property_id", targetId);

      if (error) throw error;

      await loadRenting();
    } catch (err) {
      console.error("PortfolioRenting delete failed:", err);
      setError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isEmpty =
    !loading &&
    !error &&
    !outlet.mapErr &&
    !resolveError &&
    hasAnyCandidate &&
    rows.length === 0;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>
          Vermietung
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
          Mietentwicklung und historische Vermietungszeiträume der Immobilie.
        </div>
      </div>

      <DiagnosticsPanel
        visible={showDiagnostics}
        onToggle={() => setShowDiagnostics((current) => !current)}
        routePropertyId={routePropertyId}
        portfolioPropertyId={portfolioPropertyId}
        corePropertyId={corePropertyId}
        extractedOutletIds={extractedOutletIds}
        outletKeys={outletKeys}
        baseCandidateIds={baseCandidateIds}
        resolvedProperties={resolvedProperties}
        rentalCountsByPropertyId={rentalCountsByPropertyId}
        resolvedPropertyWithRentalsId={resolvedPropertyWithRentalsId}
        effectiveRentalPropertyId={effectiveRentalPropertyId}
        readCandidateIds={readCandidateIds}
        preferredWriteId={preferredWriteId}
        isReadonlyBecauseNoCanonicalProperty={isReadonlyBecauseNoCanonicalProperty}
        matchedPropertyId={matchedPropertyId}
        chartPortfolioPropertyId={chartPortfolioPropertyId}
        chartFallbackIds={chartFallbackIds}
      />

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 18,
          display: "grid",
          gap: 12,
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
          Mietentwicklung
        </div>

        {chartPortfolioPropertyId || chartFallbackIds.length > 0 ? (
          <div style={{ width: "100%", minWidth: 0 }}>
            <RentHistoryChart
              scopeType="property"
              portfolioPropertyId={chartPortfolioPropertyId ?? undefined}
              fallbackPropertyIds={chartFallbackIds}
            />
          </div>
        ) : (
          <>
            <MissingCoreBox />
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Fallback: Gesamtsicht
              </div>
              <div style={{ width: "100%", minWidth: 0 }}>
                <RentHistoryChart scopeType="user" />
              </div>
            </div>
          </>
        )}
      </div>

      {outlet.mapErr ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {outlet.mapErr}
        </div>
      ) : null}

      {resolveError ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          Fehler bei Property-Auflösung: {resolveError}
        </div>
      ) : null}

      {!outlet.mapErr && !outlet.mapLoading && !hasAnyCandidate ? <MissingCoreBox /> : null}

      {isReadonlyBecauseNoCanonicalProperty ? (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          Diese Seite wurde nicht über eine kanonische <code>portfolio_properties.id</code> geöffnet.
          Vermietungsdaten können angezeigt, aber aus Sicherheitsgründen nicht bearbeitet oder
          gespeichert werden.
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      ) : null}

      {isEmpty ? <EmptyStateCard /> : null}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 18,
          display: "grid",
          gap: 16,
          opacity: !hasAnyCandidate || isBlockedByMapping ? 0.92 : 1,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
              Vermietungszeiträume
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
              Historische und laufende Mietzeiträume ohne Überschneidungen.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void loadRenting()}
              disabled={isDisabled}
              style={secondaryButtonStyle(isDisabled)}
            >
              Neu laden
            </button>

            <button
              type="button"
              onClick={openCreate}
              disabled={!canCreate}
              style={primaryButtonStyle(!canCreate)}
            >
              + Neuer Zeitraum
            </button>
          </div>
        </div>

        {isFormOpen ? (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              background: "#f8fafc",
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                {isEditing ? "Zeitraum bearbeiten" : "Neuer Vermietungszeitraum"}
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={busy}
                style={secondaryButtonStyle(busy)}
              >
                Schließen
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              <label style={labelStyle}>
                Miete (monatlich)
                <input
                  value={form.rent_monthly}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rent_monthly: event.target.value,
                    }))
                  }
                  disabled={busy || isReadonlyBecauseNoCanonicalProperty}
                  inputMode="decimal"
                  placeholder="z. B. 1200"
                  style={inputStyle(busy || isReadonlyBecauseNoCanonicalProperty)}
                />
              </label>

              <label style={labelStyle}>
                Typ
                <input
                  value={form.rent_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rent_type: event.target.value,
                    }))
                  }
                  disabled={busy || isReadonlyBecauseNoCanonicalProperty}
                  placeholder="z. B. Kaltmiete"
                  style={inputStyle(busy || isReadonlyBecauseNoCanonicalProperty)}
                />
              </label>

              <label style={labelStyle}>
                Anfangsdatum
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      start_date: event.target.value,
                    }))
                  }
                  disabled={busy || isReadonlyBecauseNoCanonicalProperty}
                  style={inputStyle(busy || isReadonlyBecauseNoCanonicalProperty)}
                />
              </label>

              <label style={labelStyle}>
                Enddatum
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      end_date: event.target.value,
                    }))
                  }
                  disabled={busy || isReadonlyBecauseNoCanonicalProperty}
                  style={inputStyle(busy || isReadonlyBecauseNoCanonicalProperty)}
                />
              </label>
            </div>

            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Enddatum leer lassen, wenn der Zeitraum aktuell noch läuft.
            </div>

            {form.rent_monthly.trim() && toNullableNumber(form.rent_monthly) === null ? (
              <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>
                Bitte eine gültige Zahl für die Miete eingeben.
              </div>
            ) : null}

            <div>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={busy || isReadonlyBecauseNoCanonicalProperty}
                style={primaryButtonStyle(busy || isReadonlyBecauseNoCanonicalProperty)}
              >
                {busy
                  ? "Speichert…"
                  : isEditing
                    ? "Änderungen speichern"
                    : "Zeitraum hinzufügen"}
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 760,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Miete</th>
                <th style={thStyle}>Typ</th>
                <th style={thStyle}>Anfang</th>
                <th style={thStyle}>Ende</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Aktionen</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={tdStyle}>
                    Lädt…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={tdStyle}>
                    Noch keine Vermietungszeiträume vorhanden.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const active = !row.end_date;

                  return (
                    <tr key={row.id}>
                      <td style={tdStyle}>{formatCurrency(row.rent_monthly)}</td>
                      <td style={tdStyle}>{row.rent_type ?? "—"}</td>
                      <td style={tdStyle}>{prettyDate(row.start_date)}</td>
                      <td style={tdStyle}>{prettyDate(row.end_date)}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: active ? "#dcfce7" : "#f3f4f6",
                            color: active ? "#166534" : "#374151",
                            border: active ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                          }}
                        >
                          {active ? "Laufend" : "Beendet"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          disabled={busy || isReadonlyBecauseNoCanonicalProperty}
                          style={smallActionButtonStyle(busy || isReadonlyBecauseNoCanonicalProperty)}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(row.id)}
                          disabled={busy || isReadonlyBecauseNoCanonicalProperty}
                          style={{
                            ...smallActionButtonStyle(
                              busy || isReadonlyBecauseNoCanonicalProperty
                            ),
                            marginLeft: 8,
                          }}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  display: "grid",
};

function inputStyle(disabled: boolean): CSSProperties {
  return {
    marginTop: 6,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: disabled ? "#f9fafb" : "#ffffff",
    color: "#111827",
    fontWeight: 700,
  };
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #f3f4f6",
  color: "#111827",
  verticalAlign: "top",
};

function smallActionButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}