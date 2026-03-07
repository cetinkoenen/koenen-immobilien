import { supabase } from "./supabaseClient";

const EXPOSE_BUCKET = "exposes";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type UploadExposeResult = {
  filePath: string;
  publicUrl: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateExposeUpload(propertyId: string, file: File | null | undefined) {
  if (!propertyId || typeof propertyId !== "string" || !propertyId.trim()) {
    throw new Error("Ungültige propertyId.");
  }

  if (!file) {
    throw new Error("Keine Datei ausgewählt.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Nur PDF-Dateien sind erlaubt.");
  }

  if (file.size <= 0) {
    throw new Error("Die ausgewählte Datei ist leer.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Die PDF ist zu groß. Erlaubt sind maximal ${formatBytes(
        MAX_FILE_SIZE_BYTES
      )}. Ausgewählt: ${formatBytes(file.size)}.`
    );
  }
}

export async function uploadExpose(
  propertyId: string,
  file: File
): Promise<UploadExposeResult> {
  validateExposeUpload(propertyId, file);

  const normalizedPropertyId = propertyId.trim();
  const filePath = `${normalizedPropertyId}/expose.pdf`;

  console.log("[uploadExpose] start", {
    propertyId: normalizedPropertyId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    filePath,
  });

  // 1. Datei in Supabase Storage hochladen
  const { error: uploadError } = await supabase.storage
    .from(EXPOSE_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      contentType: "application/pdf",
    });

  if (uploadError) {
    console.error("[uploadExpose] storage upload error", uploadError);
    throw new Error(`Storage-Upload fehlgeschlagen: ${uploadError.message}`);
  }

  console.log("[uploadExpose] storage upload success", { filePath });

  // 2. DB aktualisieren
  const { data: updatedRows, error: updateError } = await supabase
    .from("portfolio_properties")
    .update({ expose_path: filePath })
    .eq("id", normalizedPropertyId)
    .select("id, name, expose_path");

  if (updateError) {
    console.error("[uploadExpose] db update error", updateError);
    throw new Error(
      `DB-Update für expose_path fehlgeschlagen: ${updateError.message}`
    );
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.error("[uploadExpose] no rows updated", {
      propertyId: normalizedPropertyId,
      filePath,
    });
    throw new Error(
      "DB-Update fehlgeschlagen: Es wurde keine Immobilie aktualisiert."
    );
  }

  console.log("[uploadExpose] db update success", updatedRows[0]);

  // 3. Public URL erzeugen
  const {
    data: { publicUrl },
  } = supabase.storage.from(EXPOSE_BUCKET).getPublicUrl(filePath);

  if (!publicUrl) {
    console.error("[uploadExpose] public url generation failed", { filePath });
    throw new Error("Public URL konnte nicht erzeugt werden.");
  }

  console.log("[uploadExpose] done", {
    propertyId: normalizedPropertyId,
    filePath,
    publicUrl,
  });

  return {
    filePath,
    publicUrl,
  };
}