import { supabase } from "@/lib/supabase";
import { recordAuditLog } from "@/services/auditLogService";
import { insertPropertyLoanLedgerRow, loadPropertyLoanLedger } from "@/services/propertyLoanLedgerService";

export async function createMissingIncomeYear(propertyId: string, year = new Date().getFullYear()) {
  const payload = { property_id: propertyId, year, annual_rent: 0, other_income: 0, source: "datenpruefung_repair" };
  const { error } = await supabase.from("yearly_property_income").upsert(payload, { onConflict: "property_id,year" });
  if (error) throw error;
  await recordAuditLog({ action: "data_repair_requested", property_id: propertyId, label: "Income-Jahreszeile erzeugt", new_value: payload });
}

export async function createMissingCapexYear(propertyId: string, year = new Date().getFullYear()) {
  const payload = { property_id: propertyId, year, amount: 0, category: "Datenprüfung", note: "Automatisch erzeugt" };
  const { error } = await supabase.from("yearly_capex_entries").upsert(payload, { onConflict: "property_id,year" });
  if (error) throw error;
  await recordAuditLog({ action: "data_repair_requested", property_id: propertyId, label: "Capex-Jahreszeile erzeugt", new_value: payload });
}

export async function extendLoanOneYear(propertyId: string) {
  const rows = await loadPropertyLoanLedger(propertyId);
  const last = rows.at(-1);
  if (!last) throw new Error("Keine Darlehenszeile vorhanden, die fortgeschrieben werden kann.");
  const newRow = {
    year: last.year + 1,
    interest: last.interest,
    principal: Math.min(last.balance, last.principal || 0),
    balance: Math.max(0, last.balance - (last.principal || 0)),
    source: "datenpruefung_repair_auto_forward",
  };
  await insertPropertyLoanLedgerRow(propertyId, newRow);
  await recordAuditLog({ action: "data_repair_requested", property_id: propertyId, label: "Darlehensjahr fortgeschrieben", old_value: last, new_value: newRow });
}
