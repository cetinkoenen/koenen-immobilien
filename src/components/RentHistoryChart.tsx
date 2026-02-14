import { useRentHistory24m } from "@/hooks/useRentHistory24m";
import { transformForChart } from "@/utils/chartTransform";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type ScopeType = "user" | "property";

interface RentHistoryChartProps {
  scopeType: ScopeType;
  propertyId?: string;
}

export default function RentHistoryChart({
  scopeType,
  propertyId,
}: RentHistoryChartProps) {
  const { data, loading, error } = useRentHistory24m({
    scopeType,
    propertyId,
  });

  const chartData = transformForChart(data);

  // Debug (kannst du später entfernen)
  console.log("RentHistoryChart", {
    scopeType,
    propertyId,
    rows: data?.length,
    error,
  });

  if (loading) {
    return <div style={{ padding: 20 }}>Lade Daten...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Fehler beim Laden: {error}
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        Keine Daten für diesen Zeitraum verfügbar.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="rent"
            stroke="#2563eb"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


