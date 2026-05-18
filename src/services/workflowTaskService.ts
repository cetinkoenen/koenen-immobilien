import { supabase } from "@/lib/supabase";

export type PropertyTaskPriority = "niedrig" | "mittel" | "hoch" | "kritisch";
export type PropertyTaskStatus = "offen" | "in_bearbeitung" | "erledigt" | "archiviert";
export type PropertyTaskCategory = "miete" | "nk" | "dokument" | "darlehen" | "capex" | "leerstand" | "prüfung" | "allgemein";

export type PropertyTaskRow = {
  id: string;
  property_id: string | null;
  portfolio_property_id: string | null;
  objekt_code: string | null;
  property_name: string | null;
  title: string;
  description: string | null;
  category: PropertyTaskCategory;
  priority: PropertyTaskPriority;
  status: PropertyTaskStatus;
  due_date: string | null;
  source: "manuell" | "system" | "import" | "datenprüfung";
  related_document_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type UpsertPropertyTaskInput = {
  id?: string;
  propertyId?: string | null;
  portfolioPropertyId?: string | null;
  objektCode?: string | null;
  propertyName?: string | null;
  title: string;
  description?: string | null;
  category?: PropertyTaskCategory;
  priority?: PropertyTaskPriority;
  status?: PropertyTaskStatus;
  dueDate?: string | null;
  source?: "manuell" | "system" | "import" | "datenprüfung";
  relatedDocumentId?: string | null;
  meta?: Record<string, unknown>;
};

export async function listPropertyTasks(params: {
  propertyId?: string | null;
  portfolioPropertyId?: string | null;
  status?: PropertyTaskStatus | "aktiv";
} = {}) {
  let query = supabase
    .from("property_tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (params.propertyId) query = query.eq("property_id", params.propertyId);
  if (params.portfolioPropertyId) query = query.eq("portfolio_property_id", params.portfolioPropertyId);
  if (params.status === "aktiv") query = query.in("status", ["offen", "in_bearbeitung"]);
  else if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PropertyTaskRow[];
}

export async function savePropertyTask(input: UpsertPropertyTaskInput) {
  const payload = {
    property_id: input.propertyId ?? null,
    portfolio_property_id: input.portfolioPropertyId ?? null,
    objekt_code: input.objektCode ?? null,
    property_name: input.propertyName ?? null,
    title: input.title,
    description: input.description ?? null,
    category: input.category ?? "allgemein",
    priority: input.priority ?? "mittel",
    status: input.status ?? "offen",
    due_date: input.dueDate ?? null,
    source: input.source ?? "manuell",
    related_document_id: input.relatedDocumentId ?? null,
    meta: input.meta ?? {},
    completed_at: input.status === "erledigt" ? new Date().toISOString() : null,
  };

  const query = input.id
    ? supabase.from("property_tasks").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("property_tasks").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return data as PropertyTaskRow;
}

export async function completePropertyTask(id: string) {
  const { data, error } = await supabase
    .from("property_tasks")
    .update({ status: "erledigt", completed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as PropertyTaskRow;
}

export async function getPropertyTaskSummary() {
  const { data, error } = await supabase.rpc("get_property_task_summary");
  if (error) throw error;
  return data ?? [];
}
