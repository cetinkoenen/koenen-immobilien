import { useEffect, useState } from "react";
import PropertyLoanDashboard, { type Row } from "../components/PropertyLoanDashboard";
import { supabase } from "../lib/supabase"; // <- muss existieren (createClient mit anon key)

function eur(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function yearOrDash(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s === "—") return "—";
  return s;
}

export default function PropertyDashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ DIE View die bei dir Daten zeigt:
        const { data, error: qerr } = await supabase
          .from("vw_property_loan_dashboard_display")
          .select(
            "property_id, property_name, first_year, last_year, last_balance_year, last_balance, interest_total, principal_total"
          );

        if (qerr) throw qerr;

        const safe = Array.isArray(data) ? data : [];
        const mapped: Row[] = safe.map((r: any) => {
          const hasLoanData =
            r.last_balance !== null ||
            r.interest_total !== null ||
            r.principal_total !== null ||
            (r.first_year !== null && r.first_year !== "—");

          return {
            property_id: String(r.property_id ?? ""),
            property_name: String(r.property_name ?? "—"),

            repayment_status: hasLoanData ? "green" : "grey",
            repayment_label: hasLoanData ? "healthy" : "no_data",
            status_rank: hasLoanData ? 3 : 9,

            repaid_percent: null,
            repaid_percent_display: "—",

            last_balance_eur: eur(r.last_balance),
            interest_total_eur: eur(r.interest_total),
            principal_total_eur: eur(r.principal_total),

            first_year: yearOrDash(r.first_year),
            last_year: yearOrDash(r.last_year),
            last_balance_year: yearOrDash(r.last_balance_year),

            refreshed_at: new Date().toISOString(),
          };
        });

        if (!cancelled) setRows(mapped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Lade Darlehensdaten…</div>;
  }

  return <PropertyLoanDashboard rows={rows} error={error} />;
}
