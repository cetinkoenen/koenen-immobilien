import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: {
    year: number;
    cashflow: number;
  }[];
};

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CashflowChart({ data }: Props) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis tickFormatter={(value) => formatEuro(Number(value))} width={100} />
          <Tooltip
            formatter={(value) => [formatEuro(Number(value)), "Cashflow"]}
            labelFormatter={(label) => `Jahr ${label}`}
          />
          <Bar dataKey="cashflow" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={`cashflow-cell-${entry.year}`}
                fill={entry.cashflow >= 0 ? "#16a34a" : "#dc2626"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}