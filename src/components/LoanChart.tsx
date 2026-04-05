import { useMemo, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  year: number;
  balance: number;
};

type LoanChartProps = {
  data: ChartPoint[];
};

type ChartSummary = {
  startYear: number;
  endYear: number;
  startBalance: number;
  currentBalance: number;
  absoluteReduction: number;
};

type TooltipPayloadEntry = {
  value?: unknown;
};

type CustomTooltipProps = {
  active?: boolean;
  label?: unknown;
  payload?: TooltipPayloadEntry[];
};

function parseNumber(value: unknown): number | null {
  if (value == null) return null;

  if (Array.isArray(value)) {
    return parseNumber(value[0]);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatYearRange(startYear: number, endYear: number): string {
  return startYear === endYear ? String(startYear) : `${startYear} – ${endYear}`;
}

function CardShell(props: {
  children: ReactNode;
  background?: string;
  borderColor?: string;
}) {
  return (
    <div
      style={{
        marginTop: 8,
        background: props.background ?? "#ffffff",
        border: `1px solid ${props.borderColor ?? "#e5e7eb"}`,
        borderRadius: 20,
        padding: 20,
      }}
    >
      {props.children}
    </div>
  );
}

function SectionTitle(props: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: props.subtitle ? 10 : 18 }}>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: "#111827",
        }}
      >
        {props.title}
      </div>

      {props.subtitle ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 14,
            color: "#6b7280",
          }}
        >
          {props.subtitle}
        </div>
      ) : null}
    </div>
  );
}

function SummaryBox(props: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: 6,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "#111827",
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const rawValue = payload[0]?.value;
  const balance = parseNumber(rawValue);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 4,
        }}
      >
        Jahr
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 8,
        }}
      >
        {String(label ?? "—")}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 4,
        }}
      >
        Restschuld
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        {formatCurrency(balance)}
      </div>
    </div>
  );
}

export default function LoanChart({ data }: LoanChartProps) {
  const points = useMemo<ChartPoint[]>(() => {
    return [...data]
      .map((row) => {
        const year = parseNumber(row.year);
        const balance = parseNumber(row.balance);

        if (year == null || balance == null) return null;

        return {
          year,
          balance,
        };
      })
      .filter((row): row is ChartPoint => row !== null)
      .sort((a, b) => a.year - b.year);
  }, [data]);

  const summary = useMemo<ChartSummary | null>(() => {
    if (points.length === 0) return null;

    const first = points[0];
    const last = points[points.length - 1];

    return {
      startYear: first.year,
      endYear: last.year,
      startBalance: first.balance,
      currentBalance: last.balance,
      absoluteReduction: first.balance - last.balance,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <CardShell background="#fffbeb" borderColor="#fde68a">
        <SectionTitle title="Darlehensverlauf" />
        <div style={{ fontSize: 17, fontWeight: 800, color: "#92400e" }}>
          Keine Verlaufsdaten vorhanden
        </div>
        <div style={{ marginTop: 8, color: "#b45309" }}>
          Für diese Immobilie wurden keine Ledger-Daten gefunden.
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <SectionTitle
        title="Darlehensverlauf"
        subtitle="Jährlicher Verlauf der Restschuld auf Basis der Ledger-Daten."
      />

      {summary ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <SummaryBox label="Startsumme" value={formatCurrency(summary.startBalance)} />
          <SummaryBox label="Aktuelle Restschuld" value={formatCurrency(summary.currentBalance)} />
          <SummaryBox label="Zeitraum" value={formatYearRange(summary.startYear, summary.endYear)} />
          <SummaryBox label="Abbau seit Start" value={formatCurrency(summary.absoluteReduction)} />
        </div>
      ) : null}

      <div
        style={{
          width: "100%",
          height: 340,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              type="number"
              domain={["dataMin", "dataMax"]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              width={110}
              tickFormatter={(value) => formatCurrency(parseNumber(value))}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#4f46e5"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}