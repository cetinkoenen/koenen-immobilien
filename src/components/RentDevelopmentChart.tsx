import { useEffect, useMemo, useState } from "react";
~import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../lib/supabase";

type RangeKey = "max" | "last_24m" | "last_12m" | "last_3m";

function monthStartISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function startISOForRange(range: RangeKey) {
  if (range === "max") return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "last_3m") d.setMonth(d.getMonth() - 3);
  if (range === "last_12m") d.setMonth(d.getMonth() - 12);
  if (range === "last_24m") d.setMonth(d.getMonth() - 24);
  return monthStartISO(d);
}

function fmtMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

export default function RentDevelopmentChart({
  portfolioUnitId,
  title = "Mögliche Miete:",
}: {
  portfolioUnitId: string;
  title?: string;
}) {
  const [range, setRange] = useState<RangeKey>("max");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<{ period: string; rent: number }[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const startISO = startISOForRange(range);

      let q = supabase
        .from("v_portfolio_unit_rent_history_monthly")
        .select("period, rent_cents")
        .eq("portfolio_unit_id", portfolioUnitId)
        .order("period", { ascending: true });

      if (startISO) q = q.gte("period", startISO);

      const { data, error } = await q;

      if (error) {
        console.error("rent chart query error", error);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(
        (data ?? []).map((r: any) => ({
          period: r.period,
          rent: (r.rent_cents ?? 0) / 100,
        }))
      );

      setLoading(false);
    }

    load();
  }, [portfolioUnitId, range]);

  const stats = useMemo(() => {
    if (!rows.length) return { current: 0, changePct: 0 };
    const first = rows[0].rent;
    const last = rows[rows.length - 1].rent;
    const changePct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    return { current: last, changePct };
  }, [rows]);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 14, color: "#4b5563" }}>{title}</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: "#2563eb" }}>
            {stats.current.toFixed(0)} €
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>
          {stats.changePct >= 0 ? "+" : ""}
          {stats.changePct}%
        </div>
      </div>

      <div style={{ width: "100%", height: 320, marginTop: 10 }}>
        {loading ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#6b7280" }}>
            Lädt…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tickFormatter={fmtMonth}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(v) => fmtMonth(String(v))}
                formatter={(v: any) => [`${Number(v).toFixed(0)} €`, "Kaltmiete"]}
              />
              <Area type="monotone" dataKey="rent" strokeWidth={2} fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
        <Chip active={range === "max"} onClick={() => setRange("max")}>Max</Chip>
        <Chip active={range === "last_24m"} onClick={() => setRange("last_24m")}>Letzte 24 Monate</Chip>
        <Chip active={range === "last_12m"} onClick={() => setRange("last_12m")}>Letzte 12 Monate</Chip>
        <Chip active={range === "last_3m"} onClick={() => setRange("last_3m")}>Letzte 3 Monate</Chip>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: active ? "#e0f2fe" : "white",
        color: active ? "#0369a1" : "#2563eb",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}
