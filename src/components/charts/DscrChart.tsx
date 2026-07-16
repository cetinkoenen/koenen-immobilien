import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: {
    year: number;
    dscr: number;
  }[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function DscrChart({ data }: Props) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#dbe6e5" strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fill: "#64748b", fontWeight: 700 }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
          <YAxis width={70} tickFormatter={(value) => formatNumber(Number(value))} tick={{ fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => [formatNumber(Number(value)), "DSCR"]}
            labelFormatter={(label) => `Jahr ${label}`}
          />
          <ReferenceLine y={1} stroke="#c77992" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="dscr"
            stroke="#6878d8"
            strokeWidth={3}
            dot={{ r: 4, fill: "#6878d8", stroke: "#ffffff", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#6878d8", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
