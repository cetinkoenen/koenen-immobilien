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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis width={70} tickFormatter={(value) => formatNumber(Number(value))} />
          <Tooltip
            formatter={(value) => [formatNumber(Number(value)), "DSCR"]}
            labelFormatter={(label) => `Jahr ${label}`}
          />
          <ReferenceLine y={1} stroke="#dc2626" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="dscr"
            stroke="#7c3aed"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}