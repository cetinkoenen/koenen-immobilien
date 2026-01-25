// src/pages/portfolio/PortfolioRenting.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { normalizeUuid } from "../../lib/ids";

/**
 * PortfolioRenting
 * ----------------
 * IMPORTANT:
 * - Must query renting data using portfolio_properties.id (portfolioPropertyId).
 * - Must NOT fall back to corePropertyId for renting queries.
 *
 * DB assumptions (based on your findings):
 * - Units are in portfolio_units (unit_id required for rentals).
 * - Rentals are stored in portfolio_property_rentals (unit_id NOT NULL).
 * - Current rentals per unit come from v_units_with_current_rental.
 * - Full history per unit comes from v_unit_rentals_classified.
 */

type PortfolioOutletContext = {
  usedPortfolioPropertyId?: string;
  portfolioPropertyId?: string;
  portfolioId?: string; // legacy alias

  mapLoading?: boolean;
  mapErr?: string | null;

  corePropertyId?: string | null; // intentionally ignored here
};

type Props = {
  /** Optional explicit override (must be a portfolio_properties.id). */
  propertyId?: string;
};

type UnitWithCurrentRentalRow = {
  unit_id: string;
  property_id: string;
  user_id: string;
  unit_type: string;
  unit_name: string;
  is_active: boolean;

  rental_id: string | null;
  start_date: string | null;
  end_date: string | null;

  rent_monthly: number | null;
  kaltmiete_laut_mietvertrag: number | null;
  nebenkosten: number | null;
  gesamt_mietkosten: number | null;

  notes: string | null;
  rental_status: "current" | "future" | "history" | "planned" | string | null;
};

type ClassifiedRentalRow = {
  id: string;
  unit_id: string;
  property_id: string;
  rent_type: string | null;

  rent_monthly: number | null;
  kaltmiete_laut_mietvertrag: number | null;
  nebenkosten: number | null;
  gesamt_mietkosten: number | null;

  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  is_planned: boolean | null;

  rental_status: "current" | "future" | "history" | "planned" | string;
  created_at?: string;
  updated_at?: string;
};

type RentalFormState = {
  id?: string;
  unit_id: string;
  rent_type: "MONTHLY";
  kaltmiete: string;
  nebenkosten: string;
  start_date: string;
  end_date: string;
  notes: string;
  is_planned: boolean;
};

function toNullableNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const normalized = v.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function euro(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function prettyDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("de-DE");
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function oneDayBefore(dateISO: string): string {
  return addDaysISO(dateISO, -1);
}

function unitTypeKey(unitType: string): string {
  return String(unitType ?? "").toLowerCase();
}

function unitTypeLabel(unitType: string): string {
  const t = unitTypeKey(unitType);
  if (t === "apartment") return "Wohnung";
  if (t === "garage") return "Garage";
  return unitType;
}

function isUnitRow(x: unknown): x is UnitWithCurrentRentalRow {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.unit_id === "string" && typeof r.property_id === "string";
}

function sanitizeUnitRows(data: unknown): UnitWithCurrentRentalRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isUnitRow);
}

function isClassifiedRentalRow(x: unknown): x is ClassifiedRentalRow {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.unit_id === "string";
}

function sanitizeRentalRows(data: unknown): ClassifiedRentalRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isClassifiedRentalRow);
}

function statusBadge(status: string | null | undefined) {
  const s = String(status ?? "").toLowerCase();
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (s === "current") return <span style={{ ...base, borderColor: "#bbf7d0", background: "#f0fdf4" }}>Aktiv</span>;
  if (s === "future") return <span style={{ ...base, borderColor: "#bfdbfe", background: "#eff6ff" }}>Zukünftig</span>;
  if (s === "history") return <span style={{ ...base, borderColor: "#e5e7eb", background: "#f9fafb" }}>Historie</span>;
  if (s === "planned") return <span style={{ ...base, borderColor: "#fed7aa", background: "#fff7ed" }}>Geplant</span>;
  return <span style={base}>{status ?? "—"}</span>;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, background: "white" }}>
      {children}
    </div>
  );
}

function Box({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warn" | "error";
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#111827" },
    warn: { border: "1px solid #fde68a", background: "#fffbeb", color: "#7c2d12" },
    error: { border: "1px solid #fecaca", background: "#fff1f2", color: "#7f1d1d" },
  };

  return (
    <div
      style={{ padding: 12, borderRadius: 12, whiteSpace: "pre-wrap", fontSize: 13, fontWeight: 800, ...styles[tone] }}
      role={tone === "error" ? "alert" : undefined}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: disabled ? "#e5e7eb" : "#111827",
      color: disabled ? "#6b7280" : "white",
      border: "1px solid #111827",
    },
    ghost: {
      background: "white",
      color: disabled ? "#9ca3af" : "#111827",
      border: "1px solid #e5e7eb",
    },
    danger: {
      background: disabled ? "#fee2e2" : "#dc2626",
      color: "white",
      border: "1px solid #dc2626",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ padding: "8px 12px", borderRadius: 12, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", ...styles[variant] }}
    >
      {children}
    </button>
  );
}

function PageTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 18, fontWeight: 950 }}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 16, fontWeight: 950 }}>{children}</div>;
}

export default function PortfolioRenting({ propertyId }: Props) {
  const ctx = useOutletContext<PortfolioOutletContext>();

  const mapLoading = Boolean(ctx?.mapLoading);
  const mapErr = ctx?.mapErr ? String(ctx.mapErr) : null;

  const resolvedRaw =
    propertyId ?? ctx?.usedPortfolioPropertyId ?? ctx?.portfolioPropertyId ?? ctx?.portfolioId ?? "";

  const portfolioPropertyId = useMemo(() => normalizeUuid(String(resolvedRaw ?? "").trim()), [resolvedRaw]);

  const disabled = useMemo(() => {
    if (mapLoading) return true;
    if (mapErr) return true;
    if (!portfolioPropertyId) return true;
    return false;
  }, [mapLoading, mapErr, portfolioPropertyId]);

  const [units, setUnits] = useState<UnitWithCurrentRentalRow[]>([]);
  const [historyByUnit, setHistoryByUnit] = useState<Record<string, ClassifiedRentalRow[]>>({});

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<RentalFormState>({
    unit_id: "",
    rent_type: "MONTHLY",
    kaltmiete: "",
    nebenkosten: "",
    start_date: "",
    end_date: "",
    notes: "",
    is_planned: false,
  });

  const listSeq = useRef(0);
  const histSeq = useRef(0);

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);

  const warmmietePreviewNum = useMemo(() => {
    const hasAny = Boolean(form.kaltmiete.trim() || form.nebenkosten.trim());
    if (!hasAny) return null;
    const k = toNullableNumber(form.kaltmiete);
    const n = toNullableNumber(form.nebenkosten);
    return (k ?? 0) + (n ?? 0);
  }, [form.kaltmiete, form.nebenkosten]);

  const activeUnits = useMemo(() => units.filter((u) => u.is_active), [units]);

  const apartmentUnits = useMemo(
    () => activeUnits.filter((u) => unitTypeKey(u.unit_type) === "apartment"),
    [activeUnits]
  );
  const garageUnits = useMemo(
    () => activeUnits.filter((u) => unitTypeKey(u.unit_type) === "garage"),
    [activeUnits]
  );
  const otherUnits = useMemo(() => {
    const keep = new Set(["apartment", "garage"]);
    return activeUnits.filter((u) => !keep.has(unitTypeKey(u.unit_type)));
  }, [activeUnits]);

  const unitOptions = useMemo(
    () =>
      activeUnits.map((u) => ({
        value: u.unit_id,
        label: `${u.unit_name} (${unitTypeLabel(u.unit_type)})`,
      })),
    [activeUnits]
  );

  const resetForm = useCallback((defaultUnitId?: string) => {
    setForm({
      unit_id: defaultUnitId ?? "",
      rent_type: "MONTHLY",
      kaltmiete: "",
      nebenkosten: "",
      start_date: "",
      end_date: "",
      notes: "",
      is_planned: false,
    });
  }, []);

  const openCreate = useCallback(
    (defaultUnitId?: string) => {
      resetForm(defaultUnitId);
      setIsFormOpen(true);
    },
    [resetForm]
  );

  const openEdit = useCallback((r: ClassifiedRentalRow) => {
    setForm({
      id: r.id,
      unit_id: r.unit_id,
      rent_type: "MONTHLY",
      kaltmiete: r.kaltmiete_laut_mietvertrag != null ? String(r.kaltmiete_laut_mietvertrag) : "",
      nebenkosten: r.nebenkosten != null ? String(r.nebenkosten) : "",
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
      notes: r.notes ?? "",
      is_planned: Boolean(r.is_planned),
    });
    setIsFormOpen(true);
  }, []);

  const loadUnitsWithCurrentRental = useCallback(async () => {
    const seq = ++listSeq.current;
    setError(null);

    if (mapLoading || mapErr || !portfolioPropertyId) {
      setUnits([]);
      setHistoryByUnit({});
      setLoading(mapLoading);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("v_units_with_current_rental")
      .select(
        [
          "unit_id",
          "property_id",
          "user_id",
          "unit_type",
          "unit_name",
          "is_active",
          "rental_id",
          "start_date",
          "end_date",
          "rent_monthly",
          "kaltmiete_laut_mietvertrag",
          "nebenkosten",
          "gesamt_mietkosten",
          "notes",
          "rental_status",
        ].join(",")
      )
      .eq("property_id", portfolioPropertyId)
      .order("unit_type", { ascending: true })
      .order("unit_name", { ascending: true });

    if (seq !== listSeq.current) return;

    if (error) {
      setError(error.message);
      setUnits([]);
      setLoading(false);
      return;
    }

    const clean = sanitizeUnitRows((data ?? []) as unknown);
    setUnits(clean);

    setForm((prev) => {
      if (prev.unit_id) return prev;
      const preferred = clean.find((u) => unitTypeKey(u.unit_type) === "apartment") ?? clean[0];
      if (!preferred) return prev;
      return { ...prev, unit_id: preferred.unit_id };
    });

    setLoading(false);
  }, [mapLoading, mapErr, portfolioPropertyId]);

  const loadHistoryForUnit = useCallback(async (unitId: string) => {
    const seq = ++histSeq.current;
    setBusy(true);
    setError(null);

    const { data, error } = await supabase
      .from("v_unit_rentals_classified")
      .select(
        [
          "id",
          "unit_id",
          "property_id",
          "rent_type",
          "rent_monthly",
          "kaltmiete_laut_mietvertrag",
          "nebenkosten",
          "gesamt_mietkosten",
          "start_date",
          "end_date",
          "notes",
          "is_planned",
          "rental_status",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("unit_id", unitId)
      .order("start_date", { ascending: false });

    if (seq !== histSeq.current) return;

    if (error) {
      setError(error.message);
      setHistoryByUnit((prev) => ({ ...prev, [unitId]: [] }));
      setBusy(false);
      return;
    }

    const clean = sanitizeRentalRows((data ?? []) as unknown);
    setHistoryByUnit((prev) => ({ ...prev, [unitId]: clean }));
    setBusy(false);
  }, []);

  useEffect(() => {
    setUnits([]);
    setHistoryByUnit({});
    setError(null);
    setLoading(false);
    setBusy(false);
    setExpandedUnitId(null);
    setIsFormOpen(false);
    resetForm();
    void loadUnitsWithCurrentRental();
  }, [portfolioPropertyId, mapLoading, mapErr, loadUnitsWithCurrentRental, resetForm]);

  const closeAnyOpenRentalForUnit = useCallback(async (unitId: string, newStartDate: string) => {
    const closeDate = oneDayBefore(newStartDate);

    const { error } = await supabase
      .from("portfolio_property_rentals")
      .update({ end_date: closeDate, updated_at: new Date().toISOString() })
      .eq("unit_id", unitId)
      .is("end_date", null);

    if (error) throw error;
  }, []);

  const submitForm = useCallback(async () => {
    if (disabled) return;
    if (!portfolioPropertyId) return;

    const unitId = form.unit_id;
    if (!unitId) {
      setError("Bitte eine Einheit auswählen (Wohnung/Garage).");
      return;
    }
    if (!form.start_date.trim()) {
      setError("Bitte ein Startdatum setzen.");
      return;
    }
    if (form.end_date.trim() && form.end_date.trim() < form.start_date.trim()) {
      setError("Enddatum darf nicht vor dem Startdatum liegen.");
      return;
    }

    const k = toNullableNumber(form.kaltmiete);
    const n = toNullableNumber(form.nebenkosten);
    const rentMonthly = (k ?? 0) + (n ?? 0);

    setBusy(true);
    setError(null);

    try {
      if (!isEditing) {
        if (!form.is_planned && !form.end_date.trim()) {
          await closeAnyOpenRentalForUnit(unitId, form.start_date.trim());
        }

        const payload = {
          property_id: portfolioPropertyId,
          unit_id: unitId,
          rent_type: "MONTHLY" as const,
          kaltmiete_laut_mietvertrag: k,
          nebenkosten: n ?? 0,
          rent_monthly: rentMonthly,
          start_date: form.start_date.trim(),
          end_date: form.end_date.trim() ? form.end_date.trim() : null,
          notes: form.notes.trim() ? form.notes.trim() : null,
          is_planned: form.is_planned,
        };

        const { error } = await supabase.from("portfolio_property_rentals").insert(payload);
        if (error) throw error;
      } else {
        const payload = {
          unit_id: unitId,
          kaltmiete_laut_mietvertrag: k,
          nebenkosten: n ?? 0,
          rent_monthly: rentMonthly,
          start_date: form.start_date.trim(),
          end_date: form.end_date.trim() ? form.end_date.trim() : null,
          notes: form.notes.trim() ? form.notes.trim() : null,
          is_planned: form.is_planned,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from("portfolio_property_rentals").update(payload).eq("id", form.id!);
        if (error) throw error;
      }

      setIsFormOpen(false);
      resetForm(unitId);

      await loadUnitsWithCurrentRental();
      if (expandedUnitId) await loadHistoryForUnit(expandedUnitId);
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Speichern.");
    } finally {
      setBusy(false);
    }
  }, [
    disabled,
    portfolioPropertyId,
    form,
    isEditing,
    closeAnyOpenRentalForUnit,
    loadUnitsWithCurrentRental,
    expandedUnitId,
    loadHistoryForUnit,
    resetForm,
  ]);

  const deleteRental = useCallback(
    async (rentalId: string) => {
      const ok = window.confirm("Diesen Mietvertrag wirklich löschen?");
      if (!ok) return;

      setBusy(true);
      setError(null);
      try {
        const { error } = await supabase.from("portfolio_property_rentals").delete().eq("id", rentalId);
        if (error) throw error;

        await loadUnitsWithCurrentRental();
        if (expandedUnitId) await loadHistoryForUnit(expandedUnitId);
      } catch (e: any) {
        setError(e?.message ?? "Fehler beim Löschen.");
      } finally {
        setBusy(false);
      }
    },
    [expandedUnitId, loadUnitsWithCurrentRental, loadHistoryForUnit]
  );

  const header = useMemo(() => {
    const defaultUnitForNew = apartmentUnits[0]?.unit_id ?? activeUnits[0]?.unit_id ?? "";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div>
          <PageTitle>Vermietung Wohnung & Garage</PageTitle>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Wohnung & Garage werden separat angezeigt.</div>
        </div>
        <Button disabled={busy || loading || disabled || unitOptions.length === 0} onClick={() => openCreate(defaultUnitForNew)}>
          + Mietvertrag
        </Button>
      </div>
    );
  }, [activeUnits, apartmentUnits, busy, disabled, loading, openCreate, unitOptions.length]);

  const renderUnitCard = useCallback(
    (u: UnitWithCurrentRentalRow) => {
      const isExpanded = expandedUnitId === u.unit_id;
      const history = historyByUnit[u.unit_id] ?? null;

      return (
        <Card key={u.unit_id}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 950, fontSize: 16 }}>{u.unit_name}</div>
                <div style={{ opacity: 0.6, fontWeight: 800, fontSize: 12 }}>{unitTypeLabel(u.unit_type)}</div>
                {statusBadge(u.rental_status)}
              </div>

              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                Heute gültig:{" "}
                {u.rental_id ? (
                  <>
                    {euro(u.gesamt_mietkosten)} (Start: {prettyDate(u.start_date)})
                  </>
                ) : (
                  <>—</>
                )}
              </div>

              {u.notes ? <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, whiteSpace: "pre-wrap" }}>{u.notes}</div> : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="ghost" disabled={busy || disabled} onClick={() => openCreate(u.unit_id)}>
                + Mietvertrag
              </Button>
              <Button
                variant="ghost"
                disabled={busy || disabled}
                onClick={async () => {
                  const next = isExpanded ? null : u.unit_id;
                  setExpandedUnitId(next);
                  if (next) await loadHistoryForUnit(next);
                }}
              >
                {isExpanded ? "Historie schließen" : "Historie anzeigen"}
              </Button>
            </div>
          </div>

          {isExpanded ? (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.85 }}>Miet-Historie</div>

              {busy && !history ? <div style={{ opacity: 0.7 }}>Lade…</div> : null}
              {history && history.length === 0 ? <div style={{ opacity: 0.75, fontSize: 13 }}>Keine Einträge.</div> : null}

              {history && history.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {history.map((r) => (
                    <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fafafa", display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {statusBadge(r.rental_status)}
                          <div style={{ fontWeight: 900 }}>
                            {prettyDate(r.start_date)} – {r.end_date ? prettyDate(r.end_date) : "offen"}
                          </div>
                        </div>
                        <div style={{ fontWeight: 950 }}>{euro(r.gesamt_mietkosten)}</div>
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.8 }}>
                        Kalt: {euro(r.kaltmiete_laut_mietvertrag)} · NK: {euro(r.nebenkosten)}
                      </div>

                      {r.notes ? <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap" }}>{r.notes}</div> : null}

                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Button variant="ghost" disabled={busy || disabled} onClick={() => openEdit(r)}>
                          Bearbeiten
                        </Button>
                        <Button variant="danger" disabled={busy || disabled} onClick={() => void deleteRental(r.id)}>
                          Löschen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      );
    },
    [busy, deleteRental, disabled, expandedUnitId, historyByUnit, loadHistoryForUnit, openCreate, openEdit]
  );

  const renderSection = useCallback(
    (title: string, rows: UnitWithCurrentRentalRow[]) => {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <SectionTitle>{title}</SectionTitle>
          {rows.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>Keine Einheiten in dieser Kategorie.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>{rows.map(renderUnitCard)}</div>
          )}
        </div>
      );
    },
    [renderUnitCard]
  );

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      {header}

      {mapErr ? <Box tone="error">{mapErr}</Box> : null}

      {!mapErr && !mapLoading && !portfolioPropertyId ? (
        <Box tone="error">
          Keine gültige Portfolio-Property-ID gefunden.
          {"\n"}
          Erwartet wird portfolio_properties.id (Portfolio-Property-ID), nicht properties.id (Core-ID).
        </Box>
      ) : null}

      {error ? <Box tone="error">{error}</Box> : null}

      {loading ? <div style={{ opacity: 0.7 }}>Lade Vermietung…</div> : null}

      <div style={{ display: "grid", gap: 16 }}>
        {renderSection("Vermietung Wohnung", apartmentUnits)}
        {renderSection("Vermietung Garage", garageUnits)}
        {otherUnits.length > 0 ? renderSection("Weitere Einheiten", otherUnits) : null}

        {!loading && activeUnits.length === 0 ? (
          <Box tone="warn">Keine aktiven Einheiten gefunden. Bitte prüfe portfolio_units.</Box>
        ) : null}
      </div>

      {isFormOpen ? (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}
          onClick={() => {
            if (!busy) setIsFormOpen(false);
          }}
        >
          <div
            style={{ width: "min(720px, 100%)", background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 16, display: "grid", gap: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>{isEditing ? "Mietvertrag bearbeiten" : "Mietvertrag anlegen"}</div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>Kaltmiete + Nebenkosten → Gesamtmiete wird automatisch berechnet.</div>
              </div>
              <Button variant="ghost" disabled={busy} onClick={() => setIsFormOpen(false)}>
                Schließen
              </Button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>Einheit</div>
                <select
                  value={form.unit_id}
                  onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value }))}
                  disabled={busy || isEditing}
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
                >
                  <option value="">Bitte wählen…</option>
                  {unitOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Kaltmiete</div>
                  <input
                    value={form.kaltmiete}
                    onChange={(e) => setForm((p) => ({ ...p, kaltmiete: e.target.value }))}
                    placeholder="z.B. 75"
                    disabled={busy}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Nebenkosten</div>
                  <input
                    value={form.nebenkosten}
                    onChange={(e) => setForm((p) => ({ ...p, nebenkosten: e.target.value }))}
                    placeholder="z.B. 0"
                    disabled={busy}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Startdatum</div>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                    disabled={busy}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Enddatum (optional)</div>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                    disabled={busy}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>Notizen</div>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  disabled={busy}
                  rows={3}
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", resize: "vertical" }}
                />
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={form.is_planned} onChange={(e) => setForm((p) => ({ ...p, is_planned: e.target.checked }))} disabled={busy} />
                <span>Geplant (wird nicht als „aktiv“ gezählt)</span>
              </label>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Vorschau Gesamtmiete: <b>{warmmietePreviewNum === null ? "—" : euro(warmmietePreviewNum)}</b>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" disabled={busy} onClick={() => setIsFormOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button disabled={busy} onClick={() => void submitForm()}>
                    {busy ? "Speichere…" : "Speichern"}
                  </Button>
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.65 }}>
                Hinweis: Neuer offener Vertrag (ohne Enddatum) & nicht „geplant“ → bestehender offener Vertrag wird bis zum Tag vor Startdatum beendet.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ height: 8 }} />
      <div style={{ opacity: 0.6, fontSize: 12 }}>Datum heute: {new Date().toISOString().slice(0, 10)}</div>
    </div>
  );
}
