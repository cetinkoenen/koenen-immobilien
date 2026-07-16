// src/components/CategoryPie.tsx
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export type PieRow = { name: string; value: number };

const MODERN_CHART_COLORS = ["#315f72", "#38a189", "#6878d8", "#a16fba", "#d08a5b", "#7a9eb1", "#5f8d6f", "#c77992"];

export default function CategoryPie({
  title = "Verteilung (Kreisdiagramm)",
  data,
  height = 320,
}: {
  title?: string;
  data: PieRow[];
  height?: number;
}) {
  const hasData = Array.isArray(data) && data.some((d) => (d?.value ?? 0) > 0);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.72)",
        borderRadius: 20,
        padding: 14,
        background: "rgba(255,255,255,0.84)",
        boxShadow: "0 14px 34px rgba(51,65,85,0.07)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>{title}</div>

      {!hasData ? (
        <div style={{ padding: 14, fontSize: 13, opacity: 0.75 }}>
          Keine Daten für das Kreisdiagramm vorhanden.
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                innerRadius={55}
                paddingAngle={2}
                label={(d) => d.name}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={MODERN_CHART_COLORS[idx % MODERN_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
