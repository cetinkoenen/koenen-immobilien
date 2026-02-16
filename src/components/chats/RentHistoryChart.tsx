import * as React from "react";
import { useRentHistory24m } from "@/hooks/useRentHistory24m";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type ScopeType = "user" | "property";

interface RentHistoryChartProps {
  scopeType: ScopeType;
  propertyId?: string;
}

type ChartPoint = {
  month: string; // YYYY-MM
  rent: number;  // EUR
};

function monthLabel(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return s.length >= 7 ? s.slice(0, 7) : s;
}

function errorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err && "message" in err) return String((err as any).message);
  return String(err);
}

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEur(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "";
  return eur.format(n);
}

function formatMonthTick(yyyyMm: string): string {
  const s = String(yyyyMm ?? "");
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return s;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

/**
 * Strict, stable element-size hook.
 * - One ref
 * - One state
 * - Avoids re-setting same size (prevents loops)
 * - Works in StrictMode
 */
function useElementSize<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState(() => ({ width: 0, height: 0 }));

  const setIfChanged = React.useCallback((w: number, h: number) => {
    const width = Math.max(0, Math.floor(w));
    const height = Math.max(0, Math.floor(h));
    setSize((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, []);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // initial measurement
    const r = el.getBoundingClientRect();
    setIfChanged(r.width, r.height);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setIfChanged(width, height);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [setIfChanged]);

  return { ref, size };
}

export default function RentHistoryChart({ scopeType, propertyId }: RentHistoryChartProps) {
  const DEBUG = import.meta.env.VITE_DEBUG_CHARTS === "1";

  // 1) Hooks – always called in the same order
  const { ref, size } = useElementSize<HTMLDivElement>();

  const { data, loading, error, requiresAuth } = useRentHistory24m({
    scopeType,
    propertyId,
  });

  const propertyIdMissing = scopeType === "property" && !propertyId;

  const chartData: ChartPoint[] = React.useMemo(() => {
    if (propertyIdMissing) return [];

    const rows = Array.isArray(data) ? data : [];
    return rows.map((r: any) => {
      const hasCents = r?.rent_cents_total != null;
      const raw = Number(r?.rent_cents_total ?? r?.rent ?? 0);
      return {
        month: monthLabel(r?.month),
        rent: hasCents ? raw / 100 : raw,
      };
    });
  }, [data, propertyIdMissing]);

  const yDomain = React.useMemo(() => {
    const vals = chartData.map((d) => d.rent).filter((n) => Number.isFinite(n));
    if (!vals.length) return ["auto", "auto"] as const;

    const min = Math.min(...vals);
    const max = Math.max(...vals);

    if (min === max) return [Math.max(0, min * 0.9), max * 1.1] as const;

    const pad = (max - min) * 0.1;
    return [Math.max(0, min - pad), max + pad] as const;
  }, [chartData]);

  if (DEBUG) {
    console.log("RentHistoryChart(debug)", {
      scopeType,
      propertyId,
      propertyIdMissing,
      requiresAuth,
      loading,
      error,
      rows: Array.isArray(data) ? data.length : null,
      size,
      chartSample: chartData[0],
      yDomain,
    });
  }

  // 2) Render decision – no early returns, just one "content"
  let content: React.ReactNode = null;

  if (requiresAuth) {
    content = <div className="text-sm text-gray-500">Bitte einloggen, um den Mietverlauf zu sehen.</div>;
  } else if (loading) {
    content = <div className="text-sm text-gray-500">Lade Mietverlauf…</div>;
  } else if (error) {
    content = (
      <div className="text-sm text-red-600">
        Fehler beim Laden: {errorText(error)}
      </div>
    );
  } else if (propertyIdMissing) {
    content = <div className="text-sm text-gray-500">propertyId fehlt (Scope: property).</div>;
  } else if (!chartData.length) {
    content = <div className="text-sm text-gray-500">Keine Mietdaten gefunden.</div>;
  } else {
    content = (
      <div
        ref={ref}
        style={{
          width: "100%",
          height: 320,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {size.width > 0 && size.height > 0 && (
          <LineChart
            width={size.width}
            height={size.height}
            data={chartData}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickFormatter={(v) => formatMonthTick(String(v))}
              interval="preserveStartEnd"
            />
            <YAxis domain={yDomain as any} tickFormatter={(v) => formatEur(v)} />
            <Tooltip
              labelFormatter={(label) => formatMonthTick(String(label))}
              formatter={(value) => formatEur(value)}
            />
            <Line type="monotone" dataKey="rent" dot={false} />
          </LineChart>
        )}
      </div>
    );
  }

  return content;
}
