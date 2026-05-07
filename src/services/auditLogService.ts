import { supabase } from "@/lib/supabase";

const AUDIT_STORAGE_KEY = "koenen:audit-log:v1";
const AUDIT_TABLE = "app_audit_log";

export type AuditAction =
  | "loan_projection_generated"
  | "loan_row_saved"
  | "data_repair_requested"
  | "backup_created"
  | "portfolio_sync_checked";

export type AuditLogEntry = {
  id: string;
  created_at: string;
  action: AuditAction | string;
  property_id?: string | null;
  label?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  meta?: Record<string, unknown> | null;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLocalAuditLog(): AuditLogEntry[] {
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAuditLog(entries: AuditLogEntry[]) {
  try {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries.slice(0, 500)));
  } catch {}
}

export async function recordAuditLog(entry: Omit<AuditLogEntry, "id" | "created_at">): Promise<void> {
  const next: AuditLogEntry = { id: makeId(), created_at: new Date().toISOString(), ...entry };
  writeLocalAuditLog([next, ...readLocalAuditLog()]);
  try {
    await supabase.from(AUDIT_TABLE).insert({
      action: next.action,
      property_id: next.property_id ?? null,
      label: next.label ?? null,
      old_value: next.old_value ?? null,
      new_value: next.new_value ?? null,
      meta: next.meta ?? null,
    });
  } catch {}
}

export function getLocalAuditLog(limit = 50): AuditLogEntry[] {
  return readLocalAuditLog().slice(0, limit);
}
