// src/components/CategoryPie.tsx
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export type PieRow = { name: string; value: number };

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
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>

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
                  <Cell key={idx} />
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
