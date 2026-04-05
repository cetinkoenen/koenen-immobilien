export type RentHistory24mRow = {
  scope_type: "user" | "property";
  scope_id: string; // uuid
  month: string; // ISO date string (YYYY-MM-DD)
  rent_cents_total: number;
  units_with_rent: number;
  units_total: number;
  units_vacant: number;
  rent_cents_avg_unit_with_rent: number | null;
  mom_pct_total: number | null;
  vacancy_rate: number | null;
  occupancy_rate: number | null;
  rent_cents_avg_unit_with_rent_f: number | null;
};
