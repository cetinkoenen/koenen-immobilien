import { useRentHistory24m } from "@/hooks/useRentHistory24m";
import { transformForChart } from "@/utils/chartTransform";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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

  if (loading) return <div>Lade Daten...</div>;
  if (error) return <div>Fehler: {error}</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="rent" />
      </LineChart>
    </ResponsiveContainer>
  );
}
