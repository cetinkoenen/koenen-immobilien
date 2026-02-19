import * as React from "react";
import { useMemo } from "react";
import { useRentHistory24m } from "@/hooks/useRentHistory24m";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
interface RentHistoryChartProps {
  scopeType: "user" | "property";
  propertyId?: string;
}

type ChartPoint = {
  month: string; // YYYY-MM
  rent: number;  // numeric
};

function monthLabel(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return s.length >= 7 ? s.slice(0, 7) : s;
}

function errorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err && "message" in err) {
    return String((err as any).message);
  }
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

function useElementSize<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    const initial = el.getBoundingClientRect();
    setSize({
      width: Math.floor(initial.width),
      height: Math.floor(initial.height),
    });

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({
        width: Math.floor(width),
        height: Math.floor(height),
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

export default function RentHistoryChart({ scopeType, propertyId }: RentHistoryChartProps) {
  const DEBUG = import.meta.env.VITE_DEBUG_CHARTS === "1";

  // ✅ MUST be unconditional (before any early returns)
  const { ref, size } = useElementSize<HTMLDivElement>();

  const hookResult: any = useRentHistory24m({ scopeType, propertyId });

  const data = hookResult?.data ?? [];
  const error = hookResult?.error ?? null;
  const loading = Boolean(hookResult?.loading ?? hookResult?.isLoading ?? false);

  const chartData: ChartPoint[] = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    if (scopeType === "property" && !propertyId) return [];

    return rows.map((r: any) => {
      const hasCents = r?.rent_cents_total != null;
      const raw = Number(r?.rent_cents_total ?? r?.rent ?? 0);

      return {
        month: monthLabel(r?.month),
        rent: hasCents ? raw / 100 : raw,
      };
    });
  }, [data, scopeType, propertyId]);

  const yDomain = useMemo(() => {
    const vals = chartData.map((d) => d.rent).filter((n) => Number.isFinite(n));
    if (!vals.length) return ["auto", "auto"] as const;

    const min = Math.min(...vals);
    const max = Math.max(...vals);

    if (min === max) return [Math.max(0, min * 0.9), max * 1.1] as const;

    const pad = (max - min) * 0.1;
    return [Math.max(0, min - pad), max + pad] as const;
  }, [chartData]);

  if (DEBUG) {
    console.log("RentHistoryChart", {
      scopeType,
      propertyId,
      loading,
      rows: Array.isArray(data) ? data.length : null,
      error,
      sample: Array.isArray(data) ? data[0] : null,
      chartSample: chartData[0],
      size,
    });
  }

  if (loading) return <div className="text-sm text-gray-500">Lade Mietverlauf…</div>;

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Fehler beim Laden: {errorText(error)}
      </div>
    );
  }

  if (scopeType === "property" && !propertyId) {
    return <div className="text-sm text-gray-500">propertyId fehlt (Scope: property).</div>;
  }

  if (!chartData.length) {
    return <div className="text-sm text-gray-500">Keine Mietdaten gefunden.</div>;
  }

    return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: 320,
        minWidth: 0,
        minHeight: 320,
      }}
    >
      <LineChart
        width={Math.max(1, size.width || 1)}
        height={320}
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
    </div>
  );
}
