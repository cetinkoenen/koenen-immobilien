import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: {
    year: number;
    balance: number;
  }[];
};

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function BalanceChart({ data }: Props) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#dbe6e5" strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fill: "#64748b", fontWeight: 700 }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
          <YAxis tickFormatter={(value) => formatEuro(Number(value))} width={100} tick={{ fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => [formatEuro(Number(value)), "Restschuld"]}
            labelFormatter={(label) => `Jahr ${label}`}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#315f72"
            strokeWidth={3}
            dot={{ r: 4, fill: "#315f72", stroke: "#ffffff", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#315f72", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
