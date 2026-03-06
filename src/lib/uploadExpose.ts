import { supabase } from "./supabaseClient";

type UploadExposeResult = {
  filePath: string;
  publicUrl: string;
};

export async function uploadExpose(
  propertyId: string,
  file: File
): Promise<UploadExposeResult> {
  if (!propertyId || typeof propertyId !== "string") {
    throw new Error("Ungültige propertyId.");
  }

  if (!file) {
    throw new Error("Keine Datei ausgewählt.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Nur PDF-Dateien sind erlaubt.");
  }

  const filePath = `${propertyId}/expose.pdf`;

  console.log("[uploadExpose] start", {
    propertyId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    filePath,
  });

  // 1. Upload in Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("exposes")
    .upload(filePath, file, {
      upsert: true,
      contentType: "application/pdf",
    });

  if (uploadError) {
    console.error("[uploadExpose] storage upload error", uploadError);
    throw new Error(`Storage-Upload fehlgeschlagen: ${uploadError.message}`);
  }

  console.log("[uploadExpose] storage upload success", { filePath });

  // 2. DB-Update: expose_path speichern
  const { data: updatedRows, error: updateError } = await supabase
    .from("portfolio_properties")
    .update({ expose_path: filePath })
    .eq("id", propertyId)
    .select("id, name, expose_path");

  if (updateError) {
    console.error("[uploadExpose] db update error", updateError);
    throw new Error(
      `DB-Update für expose_path fehlgeschlagen: ${updateError.message}`
    );
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.error("[uploadExpose] no rows updated", { propertyId, filePath });
    throw new Error(
      "DB-Update fehlgeschlagen: Es wurde keine Immobilie aktualisiert."
    );
  }

  console.log("[uploadExpose] db update success", updatedRows[0]);

  // 3. Public URL erzeugen
  const {
    data: { publicUrl },
  } = supabase.storage.from("exposes").getPublicUrl(filePath);

  if (!publicUrl) {
    console.error("[uploadExpose] public url generation failed", { filePath });
    throw new Error("Public URL konnte nicht erzeugt werden.");
  }

  console.log("[uploadExpose] done", {
    propertyId,
    filePath,
    publicUrl,
  });

  return {
    filePath,
    publicUrl,
  };
}