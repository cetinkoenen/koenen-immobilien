import type { RentHistory24mRow } from "@/types/rentHistory";

export function transformForChart(data: RentHistory24mRow[]) {
  return data.map((row) => ({
    month: new Date(row.month).toLocaleDateString("de-DE", {
      month: "short",
      year: "2-digit",
    }),
    rent: row.rent_cents_total / 100,
    vacancyRate: row.vacancy_rate ? row.vacancy_rate * 100 : 0,
    occupancyRate: row.occupancy_rate ? row.occupancy_rate * 100 : 0,
  }));
}
